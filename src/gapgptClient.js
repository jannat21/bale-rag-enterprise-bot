const axios = require("axios");

const BASE_URL = process.env.GAPGPT_BASE_URL;
const API_KEY = process.env.GAPGPT_API_KEY;

async function generateAnswer(question, context) {

  const payload = {
    model: "gapgpt",
    messages: [
      {
        role: "system",
        content: `
تو یک دستیار پاسخگویی فارسی بر اساس اسناد شرکت هستی.

قوانین:
- فقط بر اساس Context پاسخ بده
- اگر پاسخ موجود نبود بگو:
  "پاسخ در اسناد موجود نیست."
- پاسخ دقیق و رسمی باشد
`
      },
      {
        role: "user",
        content: `
Context:
${context}

Question:
${question}
`
      }
    ],
    temperature: 0.1
  };

  const res = await axios.post(
    `${BASE_URL}/chat/completions`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      }
    }
  );

  return res.data?.choices?.[0]?.message?.content
    || "پاسخی تولید نشد.";
}

module.exports = { generateAnswer };
