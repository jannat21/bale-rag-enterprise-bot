const fs = require("fs");
const path = require("path");
const { buildKeywordIndex } = require("./src/keywordIndex");


require("dotenv").config();

const axios = require("axios");

const { loadStore } = require("./src/vectorStore");
const { askGapGPT } = require("./src/rag");

const { createEmbedder } = require("./src/localEmbeddings");


const BALE_TOKEN = process.env.BALE_TOKEN;

const STORE_PATH = path.join(__dirname, "data/vectorStore.json");

let keywordDocs = [];

function initKeywordIndex() {

    const store = JSON.parse(fs.readFileSync(STORE_PATH));

    keywordDocs = buildKeywordIndex(store);
}


async function main() {

    console.log("Loading vector store...");
    loadStore();
    initKeywordIndex();

    const embedder = await createEmbedder();

    console.log("✅ Bale bot started");

    let offset = 0;

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

            const chatId = msg.chat.id;

            const question = msg.text;

            let answer = "خطا در دریافت پاسخ از مدل.";

            try {
                answer = await askGapGPT(
                    question,
                    embedder,
                    keywordDocs
                );

            } catch (err) {
                console.error("GapGPT error:", err.message);
                answer = "در حال حاضر سرویس پاسخ‌دهی در دسترس نیست. لطفاً کمی بعد دوباره تلاش کنید.";
            }

            await axios.post(
                `https://tapi.bale.ai/bot${BALE_TOKEN}/sendMessage`,
                {
                    chat_id: chatId,
                    text: answer
                }
            );
        }
    }
}

main();
