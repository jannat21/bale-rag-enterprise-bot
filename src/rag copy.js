const { hybridSearch } =
require("./searchEngine");

const { buildContext } =
require("./contextBuilder");

const { askGapGPT } =
require("./gapgptClient");

async function askQuestion(
  question,
  embedder,
  keywordDocs
) {

  const results =
    await hybridSearch(
      question,
      embedder,
      keywordDocs
    );

  const context =
    buildContext(results);

  const prompt = `
با استفاده از متن زیر پاسخ بده.

اگر پاسخ در متن نبود بگو
"اطلاعات کافی در اسناد وجود ندارد"

متن:
${context}

سوال:
${question}
`;

  return await askGapGPT(prompt);
}

module.exports = { askQuestion };
