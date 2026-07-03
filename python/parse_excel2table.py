import openpyxl
import re
import pandas as pd
import os

def parse_excel_to_table(file_path, output_path="خروجی_دوره‌ها.xlsx"):
    """
    خواندن فایل اکسل و استخراج اطلاعات به صورت جدول با ستون‌های:
    مشخصات موسسه | عنوان دوره | مبلغ | مقطع تحصیلی | بازه سنی
    """
    wb = openpyxl.load_workbook(file_path, data_only=True)
    sheet = wb.active

    # سطر اول: نام مقاطع
    header_row = [cell.value for cell in sheet[1]]
    # سطر دوم: بازه‌های سنی
    age_row = [cell.value for cell in sheet[2]]

    grade_names = ['پیش‌دبستانی', 'دبستان1', 'دبستان2', 'متوسطه1', 'متوسطه2', 'بزرگسالان']
    col_indices = list(range(1, 7))  # ستون‌های B تا G

    # دیکشنری برای ذخیره بازه سنی هر ستون
    age_ranges = {}
    for idx in col_indices:
        age_ranges[idx] = age_row[idx] if idx < len(age_row) and age_row[idx] else ''

    data_rows = []  # لیست ردیف‌های خروجی

    row_idx = 2  # شروع از سطر سوم (ایندکس ۲ در openpyxl)
    total_rows = sheet.max_row

    # ---------- توابع کمکی ----------
    def is_institute_row(row):
        first = row[0].value
        if not first:
            return False
        first = str(first).strip()
        keywords = ['درصد', 'شماره تماس', 'تلفن', 'آدرس']
        if any(k in first for k in keywords):
            return True
        if (not re.search(r'\d', first)) and len(first) > 3 and re.search(r'[آ-ی]', first):
            return True
        return False

    def is_course_row(row):
        for col in col_indices:
            val = row[col].value
            if val and str(val).strip():
                if not re.search(r'تومان', str(val)) and not isinstance(val, (int, float)):
                    return True
        return False

    def is_price_row(row):
        for col in col_indices:
            val = row[col].value
            if val:
                val_str = str(val).strip()
                if 'تومان' in val_str or re.search(r'\d', val_str):
                    return True
        return False

    def parse_institute(row):
        first = str(row[0].value).strip() if row[0].value else ''
        name = first
        discount = ''
        address = ''
        phone = ''

        disc_match = re.search(r'(\d+)\s*درصد', first)
        if disc_match:
            discount = disc_match.group(1) + '%'
            name = first.replace(disc_match.group(0), '').strip()

        if 'آدرس' in first:
            address = first

        phone_match = re.search(r'۰?۹[۰-۹]{9}', first)
        if phone_match:
            phone = phone_match.group(0)

        return {'name': name, 'discount': discount, 'address': address, 'phone': phone}

    # ---------- حلقه اصلی پیمایش ----------
    while row_idx < total_rows:
        row = sheet[row_idx]
        # رد کردن سطرهای خالی
        if all(cell.value is None or str(cell.value).strip() == '' for cell in row):
            row_idx += 1
            continue

        if is_institute_row(row):
            # استخراج اطلاعات موسسه
            parsed = parse_institute(row)
            institute_str = parsed['name']
            if parsed['discount']:
                institute_str += f" (تخفیف: {parsed['discount']})"
            if parsed['address']:
                institute_str += f" - آدرس: {parsed['address']}"
            if parsed['phone']:
                institute_str += f" - تلفن: {parsed['phone']}"

            row_idx += 1
            course_rows = []
            price_rows = []

            # جمع‌آوری سطرهای دوره و قیمت تا رسیدن به موسسه بعدی
            while row_idx < total_rows:
                next_row = sheet[row_idx]
                if is_institute_row(next_row):
                    break

                if is_course_row(next_row):
                    course_rows.append(next_row)
                elif is_price_row(next_row):
                    if course_rows:
                        price_rows.append(next_row)
                row_idx += 1

            # هم‌طول کردن تعداد سطرهای دوره و قیمت
            while len(price_rows) < len(course_rows):
                price_rows.append(None)

            # پردازش جفت‌های دوره-قیمت
            for course_row, price_row in zip(course_rows, price_rows):
                for col_idx in col_indices:
                    course_name = course_row[col_idx].value
                    if not course_name:
                        continue
                    course_name = str(course_name).strip()

                    price_text = ''
                    if price_row:
                        price_cell = price_row[col_idx].value
                        if price_cell:
                            price_text = str(price_cell).strip()

                    # تعیین مقطع تحصیلی
                    grade_index = col_idx - 1
                    grade = grade_names[grade_index] if grade_index < len(grade_names) else f'مقطع{col_idx}'

                    # بازه سنی
                    age_range = age_ranges.get(col_idx, '')

                    # اضافه کردن ردیف به لیست
                    data_rows.append([
                        institute_str,
                        course_name,
                        price_text if price_text else 'توافقی',
                        grade,
                        age_range
                    ])

            continue
        else:
            row_idx += 1

    # ساخت دیتافریم
    df = pd.DataFrame(data_rows, columns=['مشخصات موسسه', 'عنوان دوره', 'مبلغ', 'مقطع تحصیلی', 'بازه سنی'])
    
    # ذخیره در فایل اکسل
    with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='دوره‌ها', index=False)
    
    print(f"✅ فایل خروجی در مسیر زیر ذخیره شد:\n{os.path.abspath(output_path)}")
    print(f"تعداد ردیف‌های استخراج‌شده: {len(df)}")
    return df

if __name__ == "__main__":
    # نام فایل اکسل ورودی را به‌درستی تنظیم کنید
    file_path = "part2.xlsx"
    df = parse_excel_to_table(file_path)