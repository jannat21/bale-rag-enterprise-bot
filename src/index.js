require("dotenv").config();

const axios = require("axios");
const fs = require("fs");
const path = require("path");

const { createEmbedder } = require("./src/localEmbeddings");
const { buildKeywordIndex } = require("./src/keywordIndex");
const { askGapGPT } = require("./src/rag");

const BALE_TOKEN = process.env.BALE_TOKEN;
const STORE_PATH = path.join(__dirname, "data", "vectorStore.json");

let offset = 0;
let keywordDocs = [];

function validateEnv() {
    if (!BALE_TOKEN) {
        throw new Error("BALE_TOKEN is missing in .env");
    }

    if (!process.env.GAPGPT_API_KEY) {
        throw new Error("GAPGPT_API_KEY is missing in .env");
    }

    if (!process.env.GAPGPT_BASE_URL) {
        throw new Error("GAPGPT_BASE_URL is missing in .env");
    }
}

function initKeywordIndex() {
    if (!fs.existsSync(STORE_PATH)) {
        throw new Error(`vector store not found: ${STORE_PATH}`);
    }

    const raw = fs.readFileSync(STORE_PATH, "utf8");
    const store = JSON.parse(raw);

    keywordDocs = buildKeywordIndex(store);

    console.log("========== INDEX LOADED ==========");
    console.log(`STORE_PATH: ${STORE_PATH}`);
    console.log(`keywordDocs count: ${keywordDocs.length}`);
}

async function sendMessage(chatId, text) {
    await axios.post(
        `https://tapi.bale.ai/bot${BALE_TOKEN}/sendMessage`,
        {
            chat_id: chatId,
            text
        }
    );
}

async function pollUpdates(embedder) {
    while (true) {
        try {
            const res = await axios.get(
                `https://tapi.bale.ai/bot${BALE_TOKEN}/getUpdates`,
                {
                    params: {
                        offset,
                        timeout: 30
                    },
                    timeout: 40000
                }
            );

            const updates = res.data?.result || [];

            
            for (const update of updates) {
                offset = update.update_id + 1;

                const msg = update.message;
                if (!msg || !msg.text) continue;

                const chatId = msg.chat.id;
                const question = msg.text.trim();

                console.log("\n========================================");
                console.log("NEW MESSAGE FROM BALE");
                console.log("chatId:", chatId);
                console.log("question:", question);
                console.log("========================================\n");

                let answer = "در پردازش سؤال خطایی رخ داد.";

                try {
                    answer = await askGapGPT(question, embedder, keywordDocs);
                } catch (err) {
                    console.error("ASK ERROR:", err?.response?.data || err.message || err);
                    answer = "در پاسخ‌گویی خطایی رخ داد.";
                }

                try {
                    await sendMessage(chatId, answer);
                } catch (err) {
                    console.error("SEND MESSAGE ERROR:", err?.response?.data || err.message || err);
                }
            }
        } catch (err) {
            console.error("POLL ERROR:", err?.response?.data || err.message || err);

            // کمی مکث برای جلوگیری از loop شدید هنگام خطا
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
}

async function main() {
    try {
        validateEnv();

        console.log("========== BOT STARTING ==========");
        console.log("BALE_TOKEN loaded:", !!BALE_TOKEN);
        console.log("GAPGPT_BASE_URL:", process.env.GAPGPT_BASE_URL);
        console.log("==================================");

        initKeywordIndex();

        console.log("Loading embedder...");
        const embedder = await createEmbedder();
        console.log("Embedder loaded.");

        await pollUpdates(embedder);
    } catch (err) {
        console.error("FATAL ERROR:", err.message || err);
        process.exit(1);
    }
}

main();
