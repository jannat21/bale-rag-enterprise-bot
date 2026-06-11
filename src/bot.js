const {
  similaritySearch
} = require("./vectorStore");

const {
  generateAnswer
} = require("./gapgptClient");

const {
  sendMessage
} = require("./baleClient");

async function handleUpdate(update) {

  if (!update.message?.text) return;

  const chatId = update.message.chat.id;
  const question = update.message.text;

  const docs =
    await similaritySearch(question, 4);

  if (!docs.length) {
    await sendMessage(
      chatId,
      "پاسخی در اسناد پیدا نشد."
    );
    return;
  }

  const context =
    docs.map((d, i) =>
      `بخش ${i+1} | منبع: ${d.metadata.source}\n${d.pageContent}`
    ).join("\n\n---\n\n");

  const answer =
    await generateAnswer(
      question,
      context
    );

  await sendMessage(chatId, answer);
}

module.exports = { handleUpdate };
