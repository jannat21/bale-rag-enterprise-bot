// src/menuHelper.js

// منو پاسخ (ReplyKeyboardMarkup)
function getMainReplyMenu() {
    return {
        keyboard: [
            [{ text: '📚 اطلاعات دوره‌ها' }, { text: '❓ پرسش متداول' }],
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
            [{ text: '📚 اطلاعات دوره‌ها', callback_data: 'menu_courses' }],
            [{ text: '❓ پرسش متداول', callback_data: 'menu_faq' }],
            [{ text: '📞 تماس با پشتیبان', callback_data: 'menu_contact' }],
            [{ text: '🚪 خروج', callback_data: 'menu_exit' }]
        ]
    };
}

module.exports = { getMainReplyMenu, getMainInlineMenu };