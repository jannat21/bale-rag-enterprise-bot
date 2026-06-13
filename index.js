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
const { sendMessage, sendPhoto, answerCallbackQuery } = require("./src/baleClient");
const { getMainReplyMenu, getMainInlineMenu } = require("./src/menuHelper");

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
          const data = query.data;

          // اعلام دریافت به سرور بله (برای رفع چرخیدن دکمه)
          await answerCallbackQuery(query.id);

          if (data === 'menu_courses') {
            await sendMessage(chatId, "دوره‌های موجود:\n• برنامه‌نویسی پایتون\n• طراحی سایت با React\n• هوش مصنوعی");
          } else if (data === 'menu_faq') {
            await sendMessage(chatId, "سوالات رایج:\n۱. هزینه چقدر است؟\n۲. مدت دوره چقدر است؟");
          } else if (data === 'menu_contact') {
            await sendMessage(chatId, "پشتیبانی: ۰۲۱-۱۲۳۴۵۶۷۸ (ساعت ۹ تا ۱۷)");
          } else if (data === 'menu_exit') {
            await sendMessage(chatId, "از منو خارج شدید. برای بازگشت /menu را بزنید.");
          }
          continue;
        }

        // ========== 2. پردازش پیام‌های متنی ==========
        const msg = update.message;
        if (!msg?.text) continue;
        const chatId = msg.chat.id.toString();
        const text = msg.text;

        // --- دستورات اسلش ---
        if (text === "/start") {
          await sendMessage(chatId, "به ربات خوش آمدید! سوال خود را بپرسید.");
          await sendPhoto(chatId, "https://uploadkon.ir/uploads/a0a513_26welcome.jpg", "ربات هوشمند");
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