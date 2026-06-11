const axios = require("axios");

/**
 * نرمال‌سازی ساده فارسی برای بهتر شدن جستجو
 */
function normalizeText(text) {
  if (!text) return "";

  return text
    .toString()
    .replace(/[ي]/g, "ی")
    .replace(/[ك]/g, "ک")
    .replace(/\u200c/g, " ") // نیم‌فاصله
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * توکن‌سازی خیلی ساده
 */
function tokenize(text) {
  return normalizeText(text)
    .split(/[^آ-یa-zA-Z0-9]+/)
    .filter(Boolean);
}

/**
 * cosine similarity بین دو بردار
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB) return 0;
  if (!Array.isArray(vecA) || !Array.isArray(vecB)) return 0;
  if (vecA.length !== vecB.length) return 0;

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
 * امتیازدهی keyword-based
 */
function keywordScore(question, docText) {
  const qTokens = tokenize(question);
  const dTokens = tokenize(docText);

  if (!qTokens.length || !dTokens.length) return 0;

  const docTokenSet = new Set(dTokens);
  let score = 0;

  for (const token of qTokens) {
    if (docTokenSet.has(token)) {
      score += 1;
    }
  }

  return score / qTokens.length;
}

/**
 * گرفتن embedding سؤال
 * انتظار داریم embedder یک تابع async باشد:
 * const vector = await embedder(text)
 * یا آبجکتی باشد که متدی مثل embed/embedQuery داشته باشد.
 */
async function getQuestionEmbedding(question, embedder) {
  if (!embedder) {
    throw new Error("embedder is undefined");
  }

  if (typeof embedder === "function") {
    return await embedder(question);
  }

  if (typeof embedder.embed === "function") {
    return await embedder.embed(question);
  }

  if (typeof embedder.embedQuery === "function") {
    return await embedder.embedQuery(question);
  }

  throw new Error("embedder format is not supported");
}

/**
 * متن سند را از فرمت‌های مختلف احتمالی استخراج می‌کند
 */
function extractDocText(doc) {
  if (!doc) return "";

  return (
    doc.text ||
    doc.content ||
    doc.chunk ||
    doc.pageContent ||
    doc.page_content ||
    ""
  );
}

/**
 * metadata سند را از فرمت‌های مختلف احتمالی استخراج می‌کند
 */
function extractDocMetadata(doc) {
  return doc.metadata || {};
}

/**
 * جستجوی ترکیبی: keyword + vector similarity
 */
async function retrieveRelevantDocs(question, embedder, keywordDocs, topK = 5) {
  if (!Array.isArray(keywordDocs)) return [];

  const questionEmbedding = await getQuestionEmbedding(question, embedder);
  const scored = [];

  for (const doc of keywordDocs) {
    const text = extractDocText(doc);
    if (!text) continue;

    const metadata = extractDocMetadata(doc);

    const docEmbedding =
      doc.embedding ||
      metadata.embedding ||
      null;

    const kScore = keywordScore(question, text);
    const vScore = docEmbedding ? cosineSimilarity(questionEmbedding, docEmbedding) : 0;

    // وزن‌دهی ترکیبی
    const finalScore = (0.4 * kScore) + (0.6 * vScore);

    scored.push({
      text,
      metadata,
      keywordScore: kScore,
      vectorScore: vScore,
      finalScore
    });
  }

  scored.sort((a, b) => b.finalScore - a.finalScore);

  return scored.slice(0, topK);
}

/**
 * ساخت context نهایی از نتایج بازیابی‌شده
 */
async function buildContext(question, embedder, keywordDocs, topK = 3) {
  const docs = await retrieveRelevantDocs(question, embedder, keywordDocs, topK);

  if (!docs.length) {
    return {
      context: "",
      docs: []
    };
  }

  const context = docs
    .map((doc, index) => {
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

      const pageLabel = page ? ` | page: ${page}` : "";

      return `[منبع ${index + 1}] ${source}${pageLabel}\n${doc.text}`;
    })
    .join("\n\n--------------------\n\n");

  return {
    context,
    docs
  };
}

/**
 * ساخت prompt نهایی
 */
function buildPrompt(question, context) {
  return `
شما یک دستیار فارسی دقیق برای پاسخ‌گویی بر اساس اسناد داخلی هستید.
فقط و فقط بر اساس متن زمینه پاسخ بده.
اگر پاسخ به‌صورت مستقیم یا قابل استنباط روشن در متن نبود، فقط بنویس:
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
 * ارسال prompt به GapGPT
 */
async function askModel(prompt) {
  const response = await axios.post(
    `${process.env.GAPGPT_BASE_URL}/chat/completions`,
    {
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "تو یک دستیار فارسی دقیق هستی که فقط بر اساس context پاسخ می‌دهد."
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
 * تابع اصلی RAG
 */
async function askGapGPT(question, embedder, keywordDocs) {
  try {
    const { context, docs } = await buildContext(question, embedder, keywordDocs, 3);

    console.log("========== QUESTION ==========");
    console.log(question);

    console.log("========== RETRIEVED DOCS ==========");
    console.log(
      docs.map((d, i) => ({
        rank: i + 1,
        source: d.metadata.source || d.metadata.file || d.metadata.filename || "unknown-source",
        page: d.metadata.page || d.metadata.pageNumber || d.metadata.page_number || "",
        keywordScore: d.keywordScore,
        vectorScore: d.vectorScore,
        finalScore: d.finalScore
      }))
    );

    console.log("========== CONTEXT ==========");
    console.log(context || "[EMPTY CONTEXT]");

    const prompt = buildPrompt(question, context);

    console.log("========== FINAL PROMPT ==========");
    console.log(prompt);

    // اگر هیچ context پیدا نشد، می‌توانی مستقیماً fallback بدهی
    if (!context || !context.trim()) {
      return "اطلاعات کافی در اسناد پیدا نشد.";
    }

    const answer = await askModel(prompt);

    console.log("========== MODEL ANSWER ==========");
    console.log(answer);

    return answer;
  } catch (error) {
    console.error("RAG ERROR:", error?.response?.data || error.message || error);
    return "در پردازش سؤال خطایی رخ داد.";
  }
}

module.exports = {
  askGapGPT,
  buildContext,
  buildPrompt,
  retrieveRelevantDocs,
  cosineSimilarity,
  keywordScore,
  normalizeText,
  tokenize
};
