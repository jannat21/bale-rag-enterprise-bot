const axios = require("axios");

const TOKEN = process.env.BALE_TOKEN;
const BASE =
  `https://tapi.bale.ai/bot${TOKEN}`;

async function getUpdates(offset) {
  const res = await axios.post(
    `${BASE}/getUpdates`,
    {
      offset,
      timeout: 30
    }
  );

  return res.data.result || [];
}

async function sendMessage(chatId, text, replyMarkup = null) {
  const payload = {
    chat_id: chatId,
    text: text
  };
  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }
  await axios.post(`${BASE}/sendMessage`, payload);
}

// تابع جدید برای ارسال عکس
async function sendPhoto(chatId, photoUrl, caption = "") {
  await axios.post(`${BASE}/sendPhoto`, {
    chat_id: chatId,
    photo: photoUrl,      // می‌تواند URL یا file_id باشد
    caption: caption
  });
}

module.exports = {
  getUpdates,
  sendMessage,
  sendPhoto
};
