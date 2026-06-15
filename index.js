const fs = require("fs");
const path = require("path");
const https = require("https");
const axios = require("axios");
require("dotenv").config();

const { buildKeywordIndex } = require("./src/keywordIndex");
const { loadStore } = require("./src/vectorStore");
const { askGapGPT } = require("./src/rag");
const { createEmbedder } = require("./src/localEmbeddings");
const { initDatabase, saveMessage } = require("./src/chatHistory");
const { sendMessage, sendPhoto, answerCallbackQuery, editMessageText } = require("./src/baleClient");
const {
  getMainReplyMenu,
  getMainInlineMenu,
  getFaqQuestionsMenu,
  getBackToFaqMenuButton,
  getHelpText,
  getHelpMenu,
  getContactMenu
} = require("./src/menuHelper");

const BALE_TOKEN = process.env.BALE_TOKEN;
const STORE_PATH = path.join(__dirname, "data/vectorStore.json");

let keywordDocs = [];

function initKeywordIndex() {
  const store = JSON.parse(fs.readFileSync(STORE_PATH));
  keywordDocs = buildKeywordIndex(store);
}

async function getUpdatesWithRetry(offset, maxRetries = 5) {
  let lastError;
  let delay = 1000;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await axios.get(`https://tapi.bale.ai/bot${BALE_TOKEN}/getUpdates`, {
        params: { offset, timeout: 30 },
        timeout: 60000,
        httpsAgent: new https.Agent({ keepAlive: true })
      });
      return res;
    } catch (err) {
      lastError = err;
      const isNetworkError = [
        'ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED',
        'ETIMEDOUT', 'ENETUNREACH', 'EAI_AGAIN'
      ].includes(err.code) || err.response?.status === 504;
      if (!isNetworkError) throw err;
      console.log(`Attempt ${attempt} failed: ${err.code || err.message}. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * 2, 30000);
    }
  }
  throw lastError;
}

async function main() {
  await initDatabase();
  console.log("Loading vector store...");
  loadStore();
  initKeywordIndex();
  const embedder = await createEmbedder();
  console.log("✅ Bale bot started with MySQL history");

  let offset = 0;

  while (true) {
    try {
      const res = await getUpdatesWithRetry(offset);
      const updates = res.data.result;

      for (const update of updates) {
        offset = update.update_id + 1;

        // ========== 1. پردازش کلیک روی دکمه‌های اینلاین ==========
        if (update.callback_query) {
          const query = update.callback_query;
          const chatId = query.message.chat.id.toString();
          const messageId = query.message.message_id;
          const data = query.data;

          await answerCallbackQuery(query.id);

          if (data === 'menu_faq') {
            const faqText = "📋 *پرسش‌های متداول تسهیلات آموزشی فرزندان کارمندان*\n\nلطفاً یکی از سوالات زیر را انتخاب کنید:";
            await editMessageText(chatId, messageId, faqText, getFaqQuestionsMenu());
          }
          else if (data === 'menu_contact') {
            const contact = getContactMenu();
            await editMessageText(chatId, messageId, contact.text, contact.reply_markup);
            // برای تماس، بهتر است یک پیام جدید ارسال شود (چون نیازی به ویرایش منو نیست)
            //await sendMessage(chatId, "📞 پشتیبانی: ۰۹۹۱۲۷۰۷۲۸۵ (ساعت ۹ تا ۱۷)");
            // همچنین می‌توانید منوی اصلی را دوباره برای همان پیام ویرایش نکنید
            // اما برای برگشت، کاربر می‌تواند /menu بزند یا دکمه جدیدی اضافه کنید
          }
          else if (data === 'menu_help') {
            const help = getHelpMenu();
            await editMessageText(chatId, messageId, help.text, help.reply_markup);
          }
          else if (data === 'back_to_main') {
            await editMessageText(chatId, messageId, "منوی اصلی ربات را انتخاب کنید:", getMainInlineMenu());
          }
          else if (data === 'faq_q1') {
            const answer = "✅ *تسهیلات شامل چه کسانی می‌شود؟*\n\nفقط برای فرزندان کارمندان بالای ۴ سال (از پیش‌دبستانی تا دانشگاه).";
            await editMessageText(chatId, messageId, answer, getBackToFaqMenuButton());
          }
          else if (data === 'faq_q2') {
            const answer = "💰 *سقف یارانه و نحوه پرداخت:*\n\nبه ازای هر فرزند ۱۵ میلیون تومان معرفی‌نامه تعلق می‌گیرد. ۵۰٪ آن شرکت به عنوان یارانه می‌پردازد و ۵۰٪ باقی‌مانده (متناسب با هزینه واقعی) حداکثر در ۳ قسط از فیش حقوقی کسر می‌شود.";
            await editMessageText(chatId, messageId, answer, getBackToFaqMenuButton());
          }
          else if (data === 'faq_q3') {
            const answer = "🏦 *آیا باید هزینه کلاس را نقداً بپردازم؟*\n\nخیر، به جز دوره‌های سازمان فرهنگی ورزشی شهرداری اصفهان، شرکت هزینه را مستقیماً با مراکز طرف قرارداد تسویه می‌کند و نیازی به پرداخت نقدی شما نیست.";
            await editMessageText(chatId, messageId, answer, getBackToFaqMenuButton());
          }
          else if (data === 'faq_q4') {
            const answer = "📄 *چگونه معرفی‌نامه دریافت کنم؟*\n\nاز طریق ارسال پیامک یا تماس تلفنی با کارشناسان واحد آموزش به شماره ۰۹۹۱۲۷۰۷۲۸۵ اقدام کنید.";
            await editMessageText(chatId, messageId, answer, getBackToFaqMenuButton());
          }
          else if (data === 'faq_q5') {
            const answer = "⚠️ *در صورت غیبت غیرمجاز چه می‌شود؟*\n\nدر صورت غیبت غیرمجاز، کلیه مبالغ یارانه‌ای شرکت از فیش حقوقی شما کسر می‌شود و گواهی‌نامه نیز صادر نخواهد شد.";
            await editMessageText(chatId, messageId, answer, getBackToFaqMenuButton());
          }
          else if (data === 'back_to_faq_menu') {
            const faqText = "📋 *پرسش‌های متداول تسهیلات آموزشی*\n\nلطفاً یکی از سوالات زیر را انتخاب کنید:";
            await editMessageText(chatId, messageId, faqText, getFaqQuestionsMenu());
          }

          continue; // مهم: از پردازش بیشتر جلوگیری شود
        }

        // بقیه کد (پردازش پیام‌های عادی، RAG و ...) بدون تغییر باقی می‌ماند
        // if (update.callback_query) {
        //   const query = update.callback_query;
        //   const chatId = query.message.chat.id.toString();
        //   const data = query.data;
        //   console.log(query);

        //   // اعلام دریافت به سرور بله (برای رفع چرخیدن دکمه)
        //   await answerCallbackQuery(query.id);

        //   if (data === 'menu_courses') {
        //     await sendMessage(chatId, "دوره‌های موجود:\n• برنامه‌نویسی پایتون\n• طراحی سایت با React\n• هوش مصنوعی");
        //   } else if (data === 'menu_faq') {
        //     await sendMessage(chatId, "سوالات رایج:\n۱. هزینه چقدر است؟\n۲. مدت دوره چقدر است؟");
        //   } else if (data === 'menu_contact') {
        //     await sendMessage(chatId, "پشتیبانی: ۰۲۱-۱۲۳۴۵۶۷۸ (ساعت ۹ تا ۱۷)");
        //   } else if (data === 'menu_exit') {
        //     await sendMessage(chatId, "از منو خارج شدید. برای بازگشت /menu را بزنید.");
        //   }
        //   continue;
        // }

        // ========== 2. پردازش پیام‌های متنی ==========
        const msg = update.message;
        if (!msg?.text) continue;
        const chatId = msg.chat.id.toString();
        const text = msg.text;

        // --- دستورات اسلش ---
        if (text === "/start") {
          const welcomeText = "به ربات خوش آمدید!\n\nمن می‌توانم به سوالات شما بر اساس اسناد شرکت پاسخ دهم. سوال خود را بپرسید.";
          //await sendMessage(chatId, "به ربات خوش آمدید! سوال خود را بپرسید.");
          await sendPhoto(chatId, "https://uploadkon.ir/uploads/e85015_261781462818093.jpg", "ربات هوشمند");
          await sendMessage(chatId, welcomeText, getMainInlineMenu());
          continue;
        }

        if (text === "/menu") {
          // ارسال منوی اینلاین
          await sendMessage(chatId, "منوی اصلی:", getMainInlineMenu());
          continue;
        }

        if (text === "/replymenu") {
          // ارسال منوی شناور (دکمه‌های پایین صفحه)
          await sendMessage(chatId, "منوی شناور:", getMainReplyMenu());
          continue;
        }

        // --- دکمه‌های منوی شناور (Reply Keyboard) ---
        if (text === "📚 اطلاعات دوره‌ها") {
          await sendMessage(chatId, "دوره‌های آموزشی: Python, React, Django");
          continue;
        }
        if (text === "❓ پرسش متداول") {
          await sendMessage(chatId, "سوالات متداول: ...");
          continue;
        }
        if (text === "📞 تماس با پشتیبان") {
          await sendMessage(chatId, "شماره تماس: ۰۲۱-۱۲۳۴۵۶۷۸");
          continue;
        }
        if (text === "🚪 خروج") {
          await sendMessage(chatId, "خروج از منو. برای بازگشت /menu را بزنید.");
          continue;
        }

        // ========== 3. سوالات عادی (RAG) ==========
        await saveMessage(chatId, "user", text);
        let answer = "خطا در دریافت پاسخ.";
        try {
          answer = await askGapGPT(text, embedder, keywordDocs, chatId);
        } catch (err) {
          console.error(err.message);
          answer = "سرویس در دسترس نیست. بعداً تلاش کنید.";
        }
        if (!answer.includes("اطلاعات کافی")) {
          await saveMessage(chatId, "assistant", answer);
        }
        await sendMessage(chatId, answer);
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      console.error("Fatal error:", err.message);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

main();