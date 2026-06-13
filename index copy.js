
const fs = require("fs");
const path = require("path");
const { buildKeywordIndex } = require("./src/keywordIndex");
require("dotenv").config();
const axios = require("axios");
const { loadStore } = require("./src/vectorStore");
const { askGapGPT } = require("./src/rag");
const { createEmbedder } = require("./src/localEmbeddings");
const { initDatabase, saveMessage } = require("./src/chatHistory");

const { sendMessage, sendPhoto } = require("./src/baleClient");  // 👈 مهم

const BALE_TOKEN = process.env.BALE_TOKEN;
const STORE_PATH = path.join(__dirname, "data/vectorStore.json");

let keywordDocs = [];

const axiosRetry = require('axios-retry');
axiosRetry(axios, {
  retries: 5,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return [
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENETUNREACH',
      'EAI_AGAIN'
    ].includes(error.code);
  }
});

function initKeywordIndex() {
  const store = JSON.parse(fs.readFileSync(STORE_PATH));
  keywordDocs = buildKeywordIndex(store);
}

async function main() {
  // راه‌اندازی دیتابیس
  await initDatabase();

  console.log("Loading vector store...");
  loadStore();
  initKeywordIndex();

  const embedder = await createEmbedder();
  console.log("✅ Bale bot started with MySQL history");

  let offset = 0;
  let retryDelay = 1000; // شروع با 1 ثانیه

  while (true) {
    const res = await axios.get(
      `https://tapi.bale.ai/bot${BALE_TOKEN}/getUpdates`,
      { params: { offset, timeout: 30 } }
    );
    const updates = res.data.result;
    for (const update of updates) {
      offset = update.update_id + 1;
      const msg = update.message;
      if (!msg?.text) continue;
      const chatId = msg.chat.id.toString();
      const question = msg.text;


      // اضافه شده: پاسخ به دستور /start
      if (question === "/start") {
        const welcomeText = "به ربات خوش آمدید!\n\nمن می‌توانم به سوالات شما در مورد دوره های آموزشی ارایه شده برای فرزندانتان، بر اساس اسناد شرکت پاسخ دهم. سوال خود را بپرسید.";
        const imageUrl = "https://uploadkon.ir/uploads/a0a513_26welcome.jpg"; // آدرس عکس دلخواه خود را قرار دهید

        await sendMessage(chatId, welcomeText);
        // ارسال عکس (اختیاری)
        try {
          await sendPhoto(chatId, imageUrl, "ربات پاسخگوی هوشمند");
        } catch (err) {
          console.error("Failed to send photo:", err.message);
        }
        continue; // عدم ارسال به RAG
      }




      // ذخیره سوال کاربر در دیتابیس
      await saveMessage(chatId, "user", question);

      let answer = "خطا در دریافت پاسخ از مدل.";
      try {
        answer = await askGapGPT(question, embedder, keywordDocs, chatId);
      } catch (err) {
        console.error("GapGPT error:", err.message);
        answer = "در حال حاضر سرویس پاسخ‌دهی در دسترس نیست. لطفاً کمی بعد دوباره تلاش کنید.";
      }

      // ذخیره پاسخ دستیار
      await saveMessage(chatId, "assistant", answer);

      await axios.post(
        `https://tapi.bale.ai/bot${BALE_TOKEN}/sendMessage`,
        { chat_id: chatId, text: answer }
      );
    }
    // تاخیر برای جلوگیری از مصرف بالای CPU
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

main();