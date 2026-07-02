// src/menuHelper.js

// منو پاسخ (ReplyKeyboardMarkup)
function getMainReplyMenu() {
    return {
        keyboard: [
            [{ text: '📚 اطلاعات دوره‌ها', callback_data: 'menu_courses_2' },
            { text: '❓ پرسش متداول' }],
            [{ text: '📞 تماس با پشتیبان' }, { text: '🚪 خروج' }]
        ],
        resize_keyboard: true,  // برای جاگیری بهتر در صفحات کوچک
        one_time_keyboard: false // تا زمانی که منوی جدیدی ارسال نشود، این منو باقی می‌ماند
    };
}

// منوی درون‌خطی (InlineKeyboardMarkup)
function getMainInlineMenu() {
    return {
        inline_keyboard: [
            [{ text: '❓ پرسش متداول', callback_data: 'menu_faq' }],
            [{ text: '📞 تماس با پشتیبان', callback_data: 'menu_contact' }],
            [{ text: '❔ راهنما', callback_data: 'menu_help' }],   // دکمه راهنما
        ]
    };
}

// منوی لیست ۵ سوال متداول
function getFaqQuestionsMenu() {
    return {
        inline_keyboard: [
            [{ text: ' تسهیلات شامل چه کسانی می‌شود؟', callback_data: 'faq_q1' }],
            [{ text: ' سقف یارانه و نحوه پرداخت؟', callback_data: 'faq_q2' }],
            // [{ text: '۳️⃣ آیا باید نقداً هزینه کلاس را بپردازم؟', callback_data: 'faq_q3' }],
            [{ text: ' چگونه معرفی‌نامه دریافت کنم؟', callback_data: 'faq_q4' }],
            [{ text: ' در صورت غیبت غیرمجاز چه می‌شود؟', callback_data: 'faq_q5' }],
            [{ text: '🔙 بازگشت به منوی اصلی', callback_data: 'back_to_main' }]
        ]
    };
}

// دکمه بازگشت به لیست سوالات (برای نمایش بعد از پاسخ)
function getBackToFaqMenuButton() {
    return {
        inline_keyboard: [
            [{ text: '🔙 بازگشت به لیست سوالات', callback_data: 'back_to_faq_menu' }],
            [{ text: '🏠 منوی اصلی', callback_data: 'back_to_main' }]
        ]
    };
}

// پیام راهنما
function getHelpText() {
    return `📌 *راهنمای استفاده از ربات*

✅ *سوال پرسیدن:*  
متن سوال خود را مستقیم بنویسید. ربات بر اساس اسناد شرکت پاسخ می‌دهد.

✅ *منوها:*  
از دکمه‌های زیر پیام (اینلاین) می‌توانید به بخش‌های مختلف دسترسی پیدا کنید.

✅ *پرسش‌های متداول:*  
پاسخ ۵ سوال پرتکرار را در بخش «❓ پرسش متداول» ببینید.

✅ *تماس با پشتیبان:*  
از طریق دکمه «📞 تماس با پشتیبان» شماره تماس را دریافت کنید.

🔄 در هر مرحله با دکمه «بازگشت» به منوی اصلی برمی‌گردید.

⏳ پاسخ‌دهی ممکن است چند ثانیه طول بکشد.

_برای خروج از منو، گزینه «🚪 خروج» را بزنید._`;
}

// منوی راهنما (جدید) – با دکمه بازگشت
function getHelpMenu() {
    const helpText = `📌 *راهنمای استفاده از ربات*

✅ *سوال پرسیدن:*  
متن سوال خود را مستقیم بنویسید. ربات بر اساس اسناد شرکت پاسخ می‌دهد.

✅ *منوها:*  
از دکمه‌های زیر می‌توانید به بخش‌های مختلف دسترسی پیدا کنید.

✅ *پرسش‌های متداول:*  
پاسخ ۵ سوال پرتکرار را در بخش «❓ پرسش متداول» ببینید.

✅ *تماس با پشتیبان:*  
از طریق دکمه «📞 تماس با پشتیبان» شماره تماس را دریافت کنید.

🔄 در هر مرحله با دکمه «بازگشت» به منوی اصلی برمی‌گردید.

⏳ پاسخ‌دهی ممکن است چند ثانیه طول بکشد.`;

    return {
        text: helpText,
        reply_markup: {
            inline_keyboard: [
                [{ text: '🔙 بازگشت به منوی اصلی', callback_data: 'back_to_main' }]
            ]
        }
    };
}

// منوی تماس با پشتیبان (جدید)
function getContactMenu() {
    const contactText = `📞 *تماس با پشتیبانی*

شماره تماس کارشناسان واحد آموزش:
**۰۹۹۱۲۷۰۷۲۸۵**

ساعت پاسخگویی: ۹ صبح تا ۱۷ عصر

می‌توانید از طریق پیامک یا تماس تلفنی برای دریافت معرفی‌نامه اقدام کنید.`;

    return {
        text: contactText,
        reply_markup: {
            inline_keyboard: [
                [{ text: '🔙 بازگشت به منوی اصلی', callback_data: 'back_to_main' }]
            ]
        }
    };
}

module.exports = {
    getMainReplyMenu,
    getMainInlineMenu,
    getFaqQuestionsMenu,
    getBackToFaqMenuButton,
    getHelpMenu,
    getContactMenu,
    getHelpText
};