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
const { sendMessage, sendPhoto } = require("./src/baleClient");

const BALE_TOKEN = process.env.BALE_TOKEN;
const STORE_PATH = path.join(__dirname, "data/vectorStore.json");

let keywordDocs = [];

function initKeywordIndex() {
  const store = JSON.parse(fs.readFileSync(STORE_PATH));
  keywordDocs = buildKeywordIndex(store);
}

// تابع کمکی برای درخواست getUpdates با retry دستی
async function getUpdatesWithRetry(offset, maxRetries = 5) {
  let lastError;
  let delay = 1000; // شروع 1 ثانیه

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await axios.get(
        `https://tapi.bale.ai/bot${BALE_TOKEN}/getUpdates`,
        {
          params: { offset, timeout: 30 },
          timeout: 60000,
          httpsAgent: new https.Agent({ keepAlive: true })
        }
      );
      return res;
    } catch (err) {
      lastError = err;
      const isNetworkError = [
        'ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED',
        'ETIMEDOUT', 'ENETUNREACH', 'EAI_AGAIN'
      ].includes(err.code) || err.response?.status === 504;

      if (!isNetworkError) {
        // خطای غیرشبکه (مثلاً 400) را دوباره پرتاب کن
        throw err;
      }

      console.log(`Attempt ${attempt} failed: ${err.code || err.message}. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * 2, 30000); // حداکثر 30 ثانیه
    }
  }
  throw lastError; // بعد از تمام تلاش‌ها
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
        const msg = update.message;
        if (!msg?.text) continue;

        const chatId = msg.chat.id.toString();
        const question = msg.text;

        // پاسخ به دستور /start
        if (question === "/start") {
          const welcomeText = "به ربات خوش آمدید!\n\nمن می‌توانم به سوالات شما بر اساس اسناد شرکت پاسخ دهم. سوال خود را بپرسید.";
          await sendMessage(chatId, welcomeText);

          //const imagePath = path.join(__dirname, "public", "welcome.jpg");
          const imageUrl = "https://uploadkon.ir/uploads/a0a513_26welcome.jpg"; // آدرس عکس دلخواه خود را قرار دهید

          try {
            await sendPhoto(chatId, imageUrl, "ربات پاسخگوی هوشمند");
          } catch (err) {
            console.error("Failed to send photo:", err.message);
          }
          continue;
        }

        await saveMessage(chatId, "user", question);

        let answer = "خطا در دریافت پاسخ از مدل.";
        try {
          answer = await askGapGPT(question, embedder, keywordDocs, chatId);
        } catch (err) {
          console.error("GapGPT error:", err.message);
          answer = "در حال حاضر سرویس پاسخ‌دهی در دسترس نیست. لطفاً کمی بعد دوباره تلاش کنید.";
        }

        const isUsefulAnswer = !answer.includes("اطلاعات کافی") && !answer.includes("پیدا نشد");
        if (isUsefulAnswer) {
          await saveMessage(chatId, "assistant", answer);
        }

        await sendMessage(chatId, answer);
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      console.error("Fatal error in polling loop:", err.message);
      console.log("Restarting polling loop in 5 seconds...");
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

main();