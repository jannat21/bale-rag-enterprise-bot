function tokenize(text) {

  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .split(/\s+/)
    .filter(Boolean);
}

function buildKeywordIndex(docs) {

  return docs.map(d => ({
    tokens: tokenize(d.text),
    text: d.text,
    source: d.source
  }));

}

function keywordScore(queryTokens, docTokens) {

  let score = 0;

  for (const q of queryTokens) {
    if (docTokens.includes(q)) score++;
  }

  return score;
}

module.exports = {
  tokenize,
  buildKeywordIndex,
  keywordScore
};
