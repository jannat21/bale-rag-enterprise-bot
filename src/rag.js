const axios = require("axios");

/**
 * نرمال‌سازی ساده فارسی
 */
function normalizeText(text) {
    if (!text) return "";

    return String(text)
        .replace(/[ي]/g, "ی")
        .replace(/[ك]/g, "ک")
        .replace(/\u200c/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

/**
 * توکن‌سازی ساده
 */
function tokenize(text) {
    return normalizeText(text)
        .split(/[^آ-یa-zA-Z0-9]+/)
        .filter(Boolean);
}

/**
 * شباهت کسینوسی
 */
function cosineSimilarity(vecA, vecB) {
    if (!Array.isArray(vecA) || !Array.isArray(vecB)) return 0;
    if (vecA.length !== vecB.length || vecA.length === 0) return 0;

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dot += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * امتیاز تطبیق کلمه‌ای
 */
function keywordScore(question, docText) {
    const qTokens = tokenize(question);
    const dTokens = tokenize(docText);

    if (!qTokens.length || !dTokens.length) return 0;

    const dSet = new Set(dTokens);
    let hit = 0;

    for (const token of qTokens) {
        if (dSet.has(token)) hit++;
    }

    return hit / qTokens.length;
}

/**
 * گرفتن embedding از embedder
 */
async function getEmbedding(embedder, text) {
    if (!embedder) throw new Error("embedder is undefined");

    if (typeof embedder === "function") {
        return await embedder(text);
    }

    if (typeof embedder.embed === "function") {
        return await embedder.embed(text);
    }

    if (typeof embedder.embedQuery === "function") {
        return await embedder.embedQuery(text);
    }

    throw new Error("embedder format is not supported");
}

/**
 * متن chunk
 */
function getDocText(doc) {
    return (
        doc?.text ||
        doc?.content ||
        doc?.chunk ||
        doc?.pageContent ||
        doc?.page_content ||
        ""
    );
}

/**
 * metadata
 */
function getDocMetadata(doc) {
    return doc?.metadata || {};
}

/**
 * embedding سند
 */
function getDocEmbedding(doc) {
    return doc?.embedding || doc?.metadata?.embedding || null;
}

/**
 * بازیابی اسناد مرتبط
 */
async function retrieveRelevantDocs(question, embedder, keywordDocs, topK = 3) {
    if (!Array.isArray(keywordDocs)) return [];

    const qEmbedding = await getEmbedding(embedder, question);
    const results = [];

    for (const doc of keywordDocs) {
        const text = getDocText(doc);
        if (!text || !text.trim()) continue;

        const metadata = getDocMetadata(doc);
        const dEmbedding = getDocEmbedding(doc);

        const kScore = keywordScore(question, text);
        const vScore = dEmbedding ? cosineSimilarity(qEmbedding, dEmbedding) : 0;

        // وزن‌دهی هیبرید
        const finalScore = (0.4 * kScore) + (0.6 * vScore);

        results.push({
            text,
            metadata,
            keywordScore: kScore,
            vectorScore: vScore,
            finalScore
        });
    }

    results.sort((a, b) => b.finalScore - a.finalScore);
    return results.slice(0, topK);
}

/**
 * ساخت context
 */
async function buildContext(question, embedder, keywordDocs, topK = 3) {
    const docs = await retrieveRelevantDocs(question, embedder, keywordDocs, topK);

    if (!docs.length) {
        return {
            context: "",
            docs: []
        };
    }

    const context = docs.map((doc, i) => {
        const source =
            doc.metadata.source ||
            doc.metadata.file ||
            doc.metadata.filename ||
            "unknown-source";

        const page =
            doc.metadata.page ||
            doc.metadata.pageNumber ||
            doc.metadata.page_number ||
            "";

        const pageInfo = page ? ` | page: ${page}` : "";

        return `[منبع ${i + 1}] ${source}${pageInfo}\n${doc.text}`;
    }).join("\n\n--------------------\n\n");

    return { context, docs };
}

/**
 * ساخت prompt نهایی
 */



function buildPrompt_OLD(question, context) {
    return `
شما یک دستیار فارسی دقیق برای پاسخ‌گویی بر اساس اسناد داخلی هستید.
فقط بر اساس متن زمینه پاسخ بده و هیچ اطلاعاتی از خودت اضافه نکن.
اگر پاسخ در متن زمینه وجود نداشت، فقط بنویس:
«اطلاعات کافی در اسناد پیدا نشد.»

پاسخ را کوتاه، دقیق و فارسی بنویس.

متن زمینه:
${context || "متنی یافت نشد"}

سؤال:
${question}

پاسخ:
`.trim();
}

/**
 * ارسال به مدل
 */
async function askModel(prompt) {
    const response = await axios.post(
        `${process.env.GAPGPT_BASE_URL}/chat/completions`,
        {
            model: process.env.GAPGPT_MODEL_NAME,
            messages: [
                {
                    role: "system",
                    content: "تو یک دستیار فارسی دقیق هستی و فقط بر اساس context پاسخ می‌دهی."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.2
        },
        {
            headers: {
                Authorization: `Bearer ${process.env.GAPGPT_API_KEY}`,
                "Content-Type": "application/json"
            },
            timeout: 60000
        }
    );

    return response?.data?.choices?.[0]?.message?.content || "پاسخی دریافت نشد.";
}

/**
 * تابع اصلی
 */
async function askGapGPT_OLD(question, embedder, keywordDocs) {
    try {
        const { context, docs } = await buildContext(question, embedder, keywordDocs, 3);

        // console.log("========== QUESTION ==========");
        // console.log(question);

        // console.log("========== RETRIEVED DOCS ==========");
        // console.log(
        //     docs.map((d, i) => ({
        //         rank: i + 1,
        //         source: d.metadata.source || d.metadata.file || d.metadata.filename || "unknown-source",
        //         page: d.metadata.page || d.metadata.pageNumber || d.metadata.page_number || "",
        //         keywordScore: d.keywordScore,
        //         vectorScore: d.vectorScore,
        //         finalScore: d.finalScore
        //     }))
        // );

        // console.log("========== CONTEXT ==========");
        // console.log(context || "[EMPTY CONTEXT]");

        if (!context || !context.trim()) {
            return "اطلاعات کافی در اسناد پیدا نشد.";
        }

        const prompt = buildPrompt(question, context);

        // console.log("========== FINAL PROMPT ==========");
        // console.log(prompt);

        const answer = await askModel(prompt);

        // console.log("========== MODEL ANSWER ==========");
        // console.log(answer);

        return answer;
    } catch (error) {
        console.error("RAG ERROR:", error?.response?.data || error.message || error);
        return "در پردازش سؤال خطایی رخ داد.";
    }
}

function buildPrompt(question, context, history = []) {
    let historyText = "";
    if (history.length > 0) {
        historyText = "برای درک ارجاعات (مانند 'آن'، 'این پروژه')، تاریخچه گفتگو را بخوان:\n" +
            history.map(msg => `${msg.role === "user" ? "کاربر" : "دستیار"}: ${msg.content}`).join("\n") + "\n\n";
    }
    return `
شما یک دستیار فارسی هستید که بر اساس اسناد داخلی پاسخ می‌دهد.

⚠️ قوانین بسیار مهم:
1. هر سوال را کاملاً مستقل از پاسخ‌های قبلی ارزیابی کن.
2. پاسخ قبلی که "اطلاعات کافی نیست" بوده، به این معنا نیست که سوال بعدی هم بی‌پاسخ است.
3. فقط و فقط به "متن زمینه" (اسناد) نگاه کن. اگر در متن زمینه پاسخ وجود دارد، حتماً بده.
4. اگر پاسخ در متن زمینه وجود نداشت، فقط بنویس: «اطلاعات کافی در اسناد پیدا نشد.»
5. از تاریخچه فقط برای فهمیدن ضمایر و ارجاعات استفاده کن، نه برای قضاوت درباره وجود پاسخ.

${historyText}
متن زمینه (اسناد):
${context || "متنی یافت نشد"}

سؤال فعلی:
${question}

پاسخ (بر اساس متن زمینه و بدون توجه به پاسخ‌های قبلی):
`.trim();
}

// تغییر تابع askGapGPT برای دریافت history
async function askGapGPT(question, embedder, keywordDocs, chatId = null) {
    try {
        // اگر chatId داده شده، تاریخچه را دریافت کن
        let history = [];
        if (chatId) {
            const { getRelevantHistory } = require("./chatHistory");
            history = await getRelevantHistory(chatId, 4); // آخرین ۴ پیام (۲ دور گفتگو)
            //const { getRecentHistory } = require("./chatHistory");
            //history = await getRecentHistory(chatId, 4); // آخرین ۴ پیام (۲ دور گفتگو)
        }

        const { context, docs } = await buildContext(question, embedder, keywordDocs, 3);

        if (!context || !context.trim()) {
            return "اطلاعات کافی در اسناد پیدا نشد.";
        }

        const prompt = buildPrompt(question, context, history);

        // console.log("__________________________________");
        // console.log("PROMPT: ", prompt);
        // console.log("END OF PROMPT.");
        // console.log("__________________________________");

        const answer = await askModel(prompt);
        return answer;
    } catch (error) {
        console.error("RAG ERROR:", error?.response?.data || error.message);
        return "در پردازش سؤال خطایی رخ داد.";
    }
}

module.exports = {
    askGapGPT,
    buildContext,
    buildPrompt,
    retrieveRelevantDocs
};
