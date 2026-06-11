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

async function sendMessage(chatId, text) {
  await axios.post(
    `${BASE}/sendMessage`,
    {
      chat_id: chatId,
      text
    }
  );
}

module.exports = {
  getUpdates,
  sendMessage
};
