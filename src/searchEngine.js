const { vectorSearch } = require("./vectorStore");
const {
  tokenize,
  keywordScore
} = require("./keywordIndex");

async function hybridSearch(
  query,
  embedder,
  keywordDocs
) {

  const queryEmbedding =
    await embedder.embed(query);

  const vectorResults =
    await vectorSearch(queryEmbedding, 10);

  const tokens =
    tokenize(query);

  const keywordResults =
    keywordDocs.map(doc => ({

      text: doc.text,
      source: doc.source,

      score:
        keywordScore(tokens, doc.tokens)

    }));

  keywordResults.sort((a,b)=>b.score-a.score);

  const combined =
    [...vectorResults, ...keywordResults];

  const map = new Map();

  for (const item of combined) {

    if (!map.has(item.text))
      map.set(item.text, item);

  }

  return Array.from(map.values())
    .sort((a,b)=>b.score-a.score)
    .slice(0,5);

}

module.exports = { hybridSearch };
