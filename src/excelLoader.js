// src/excelLoader.js
const XLSX = require('xlsx');
const path = require('path');

/**
 * تبدیل عدد به حروف فارسی (ساده)
 * این تابع فقط برای اعداد تا میلیارد کار می‌کند
 */
function numberToPersianWords(num) {
    if (!num || isNaN(num)) return '';
    const units = ['', 'هزار', 'میلیون', 'میلیارد'];
    const digits = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
    const tens = ['', 'ده', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
    const hundreds = ['', 'یکصد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];

    function convertThreeDigits(n) {
        let str = '';
        const h = Math.floor(n / 100);
        const r = n % 100;
        if (h > 0) str += hundreds[h] + ' ';
        if (r > 0) {
            if (r < 10) str += digits[r] + ' ';
            else if (r < 20) {
                const teens = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
                str += teens[r - 10] + ' ';
            } else {
                const t = Math.floor(r / 10);
                const u = r % 10;
                str += tens[t] + ' ';
                if (u > 0) str += 'و ' + digits[u] + ' ';
            }
        }
        return str.trim();
    }

    if (num === 0) return 'صفر';
    let result = '';
    let unitIndex = 0;
    while (num > 0) {
        const part = num % 1000;
        if (part > 0) {
            const partStr = convertThreeDigits(part);
            const unit = units[unitIndex];
            result = partStr + (unit ? ' ' + unit : '') + ' ' + result;
        }
        num = Math.floor(num / 1000);
        unitIndex++;
    }
    return result.trim();
}

/**
 * بارگذاری و پردازش فایل Excel برای تبدیل به قطعات معنادار
 * @param {string} filePath - مسیر فایل xlsx
 * @param {string} sourceName - نام منبع (نام فایل)
 * @returns {Array<{text: string, metadata: Object}>}
 */
function loadExcelDocuments(filePath, sourceName = 'excel') {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (rows.length < 3) {
        console.warn(`فایل ${sourceName} کمتر از ۳ سطر دارد.`);
        return [];
    }

    // ---- استخراج هدرها و بازه‌های سنی ----
    const headerRow = rows[0]; // ستون‌های A-G
    const ageRow = rows[1];    // بازه‌های سنی

    // ستون‌های مقاطع از B تا G (ایندکس 1 تا 6)
    const gradeColumns = [];
    const gradeNames = ['پیش‌دبستانی', 'دبستان ۱', 'دبستان ۲', 'متوسطه ۱', 'متوسطه ۲', 'بزرگسالان'];
    for (let col = 1; col <= 6; col++) {
        let gradeName = gradeNames[col - 1] || `مقطع ${col}`;
        let ageRange = ageRow[col] ? ageRow[col].toString().trim() : '';
        // استخراج اعداد از بازه سنی (مثلاً "6-7-8-9" -> حداقل و حداکثر)
        let minAge = null, maxAge = null;
        if (ageRange) {
            const numbers = ageRange.split('-').map(Number).filter(n => !isNaN(n));
            if (numbers.length > 0) {
                minAge = Math.min(...numbers);
                maxAge = Math.max(...numbers);
            }
        }
        gradeColumns.push({
            index: col,
            name: gradeName,
            ageRange: ageRange,
            minAge: minAge,
            maxAge: maxAge
        });
    }

    const chunks = [];
    let currentInstitute = null;
    let i = 2; // شروع از سطر سوم

    // تابع کمکی برای تشخیص سطر موسسه
    function isInstituteRow(row) {
        const firstCell = row[0] ? row[0].toString().trim() : '';
        // اگر شامل کلمات کلیدی باشد یا حداقل ۳ کاراکتر داشته باشد و خالی نباشد
        return firstCell.length > 2 && (
            firstCell.includes('درصد') ||
            firstCell.includes('شماره تماس') ||
            firstCell.includes('تلفن') ||
            firstCell.includes('آدرس') ||
            // اگر سطر قبلی موسسه نبوده و این سطر نام موسسه است (با تخفیف)
            (firstCell.match(/[آ-ی]/) && !firstCell.includes('تومان'))
        );
    }

    // تابع کمکی برای استخراج اطلاعات موسسه از سطر
    function parseInstituteRow(row) {
        const first = row[0] ? row[0].toString().trim() : '';
        let name = first;
        let discount = '';
        let address = '';
        let phone = '';

        // تلاش برای استخراج تخفیف از نام (مثلاً "اتاق بازرگانی 50 درصد")
        const discountMatch = first.match(/(\d+)\s*درصد/);
        if (discountMatch) {
            discount = discountMatch[1] + '%';
            name = first.replace(discountMatch[0], '').trim();
        }

        // اگر سطر شامل آدرس باشد (در ستون اول)
        if (first.includes('آدرس')) {
            address = first;
            // نام موسسه را از سطر بعدی یا قبلی نمی‌توانیم بگیریم، پس فعلاً
        }

        // شماره تماس ممکن است در ستون اول یا سایر ستون‌ها باشد
        const phoneMatch = first.match(/۰?۹[۰-۹]{9}/); // شماره موبایل
        if (phoneMatch) {
            phone = phoneMatch[0];
        }

        return { name, discount, address, phone };
    }

    // تابع کمکی برای تشخیص سطر دوره (شامل عناوین دوره‌ها)
    function isCourseRow(row) {
        for (let col = 1; col <= 6; col++) {
            const val = row[col] ? row[col].toString().trim() : '';
            if (val && !val.includes('تومان') && !val.includes('آدرس') && !val.includes('شماره')) {
                return true;
            }
        }
        return false;
    }

    // تابع کمکی برای تشخیص سطر قیمت
    function isPriceRow(row) {
        for (let col = 1; col <= 6; col++) {
            const val = row[col] ? row[col].toString().trim() : '';
            if (val && (val.includes('تومان') || val.match(/[۰-۹0-9,]+/))) {
                return true;
            }
        }
        return false;
    }

    // پردازش سطرها
    while (i < rows.length) {
        const row = rows[i];
        const firstCell = row[0] ? row[0].toString().trim() : '';

        // اگر سطر خالی است یا فقط شامل توضیحات است، رد شو
        if (row.every(cell => !cell || cell.toString().trim() === '')) {
            i++;
            continue;
        }

        // بررسی شروع موسسه جدید
        if (isInstituteRow(row)) {
            // ذخیره موسسه قبلی (اگر وجود داشت)
            if (currentInstitute) {
                // پردازش دوره‌های موسسه قبلی که در buffer ذخیره شده‌اند
                // اما برای سادگی، وقتی موسسه جدید می‌آید، دوره‌های قبلی را پردازش می‌کنیم
                processInstituteCourses(currentInstitute, chunks, gradeColumns, sourceName);
            }

            // ایجاد موسسه جدید
            const parsed = parseInstituteRow(row);
            currentInstitute = {
                name: parsed.name || 'نامشخص',
                discount: parsed.discount || '',
                address: '',
                phone: '',
                // بافر سطرهای دوره (به صورت جفت)
                courseRows: [],
                priceRows: [],
                rawRows: [] // همه سطرهای مربوط به این موسسه (به جز سطر موسسه)
            };
            // اگر سطر موسسه شامل آدرس یا تماس بود، ذخیره کن
            if (parsed.address) currentInstitute.address = parsed.address;
            if (parsed.phone) currentInstitute.phone = parsed.phone;

            // سطرهای بعدی را تا موسسه بعدی جمع‌آوری می‌کنیم
            let j = i + 1;
            let courseBuffer = [];
            let priceBuffer = [];
            let waitingForPrice = false;

            while (j < rows.length) {
                const nextRow = rows[j];
                if (isInstituteRow(nextRow)) {
                    // موسسه جدید شروع شده، حلقه را متوقف کن
                    break;
                }

                // اگر سطر دوره است
                if (isCourseRow(nextRow)) {
                    // اگر در انتظار قیمت بودیم، یعنی قیمت قبلی پیدا نشد و دوره جدید آمده، پس دوره قبلی را بدون قیمت ذخیره می‌کنیم؟
                    if (waitingForPrice) {
                        // دوره قبلی بدون قیمت را ذخیره کن (قیمت null)
                        if (courseBuffer.length > 0) {
                            currentInstitute.courseRows.push(courseBuffer[courseBuffer.length - 1]);
                            currentInstitute.priceRows.push(null); // قیمت null
                        }
                        waitingForPrice = false;
                    }
                    courseBuffer.push(nextRow);
                    waitingForPrice = true;
                }
                // اگر سطر قیمت است
                else if (isPriceRow(nextRow) && waitingForPrice) {
                    // جفت دوره-قیمت کامل شد
                    if (courseBuffer.length > 0) {
                        const lastCourse = courseBuffer[courseBuffer.length - 1];
                        currentInstitute.courseRows.push(lastCourse);
                        currentInstitute.priceRows.push(nextRow);
                        waitingForPrice = false;
                    } else {
                        // قیمت بدون دوره؟ نادیده بگیر
                        waitingForPrice = false;
                    }
                }
                // سطرهای دیگر (مثل توضیحات) را می‌توانیم نادیده بگیریم یا ذخیره کنیم
                else {
                    // اگر سطر شامل آدرس یا تماس باشد، به موسسه اضافه کن
                    const text = nextRow[0] ? nextRow[0].toString().trim() : '';
                    if (text.includes('آدرس')) {
                        currentInstitute.address = text;
                    }
                    if (text.includes('تلفن') || text.includes('شماره')) {
                        const phoneMatch = text.match(/۰?۹[۰-۹]{9}/);
                        if (phoneMatch) currentInstitute.phone = phoneMatch[0];
                    }
                }
                j++;
            }

            // بعد از پایان حلقه، اگر هنوز در انتظار قیمت بودیم، دوره را با قیمت null ذخیره کن
            if (waitingForPrice && courseBuffer.length > 0) {
                currentInstitute.courseRows.push(courseBuffer[courseBuffer.length - 1]);
                currentInstitute.priceRows.push(null);
            }

            i = j; // حرکت به موسسه جدید
            continue;
        }

        // اگر سطر موسسه نیست اما موسسه فعلی وجود دارد، این سطر را به دوره‌ها اضافه کن
        if (currentInstitute) {
            // اگر سطر دوره یا قیمت است، به بافر اضافه کن (اما بهتر است از منطق بالا استفاده کنیم)
            // در اینجا چون قبلاً در حلقه داخلی پردازش کردیم، نیازی نیست
        }

        i++;
    }

    // پس از پایان حلقه، آخرین موسسه را پردازش کن
    if (currentInstitute) {
        processInstituteCourses(currentInstitute, chunks, gradeColumns, sourceName);
    }

    // console.log(chunks);

    return chunks;
}

/**
 * پردازش دوره‌های یک موسسه و تولید قطعات
 */
function processInstituteCourses(institute, chunks, gradeColumns, sourceName) {
    const { name, discount, address, phone, courseRows, priceRows } = institute;

    // اطمینان از هم‌طول بودن آرایه‌ها
    const len = Math.min(courseRows.length, priceRows.length);
    for (let idx = 0; idx < len; idx++) {
        const courseRow = courseRows[idx];
        const priceRow = priceRows[idx];

        // برای هر ستون (مقطع) که دوره دارد
        for (let col of gradeColumns) {
            const courseName = courseRow[col.index] ? courseRow[col.index].toString().trim() : '';
            if (!courseName) continue;

            // استخراج قیمت از ستون مربوطه در priceRow (اگر priceRow موجود باشد)
            let price = null;
            let priceText = '';
            if (priceRow) {
                const rawPrice = priceRow[col.index] ? priceRow[col.index].toString().trim() : '';
                if (rawPrice) {
                    // استخراج عدد از رشته (مثل "2,900,000 تومان")
                    const numMatch = rawPrice.match(/([\d,۰-۹]+)/);
                    if (numMatch) {
                        const numStr = numMatch[1].replace(/,/g, '').replace(/[۰-۹]/g, d => String.fromCharCode(d.charCodeAt(0) - 1728 + 48));
                        price = parseFloat(numStr);
                        priceText = rawPrice;
                    }
                }
            }

            // ساخت متن قطعه
            let text = `${name} `;
            if (discount) text += `با ${discount} تخفیف `;
            text += `دوره «${courseName}» را برای مقطع ${col.name} `;
            if (col.minAge !== null && col.maxAge !== null) {
                text += `(سنین ${col.minAge} تا ${col.maxAge} سال) `;
            }
            if (price !== null && !isNaN(price)) {
                const priceWord = numberToPersianWords(price);
                text += `با هزینه ${priceText} (${priceWord} تومان) `;
            } else {
                text += `با هزینه توافقی `;
            }
            text += `برگزار می‌کند. `;
            if (address) text += `آدرس: ${address}. `;
            if (phone) text += `شماره تماس: ${phone}.`;

            // متادیتا
            const metadata = {
                source: sourceName,
                institute: name,
                grade: col.name,
                gradeIndex: col.index,
                minAge: col.minAge,
                maxAge: col.maxAge,
                courseTitle: courseName,
                price: price,
                priceText: priceText,
                address: address,
                phone: phone,
                discount: discount,
            };

            chunks.push({ text, metadata });
        }
    }
}

module.exports = { loadExcelDocuments };