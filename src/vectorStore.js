const fs = require("fs");
const path = require("path");

const STORE_PATH =
  path.join(__dirname, "../data/vectorStore.json");

let store = [];

function cosineSimilarity(a, b) {

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function saveStore() {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store));
}

function loadStore() {

  if (fs.existsSync(STORE_PATH)) {
    store = JSON.parse(fs.readFileSync(STORE_PATH));
  }

}

async function buildStore(docs, embedder) {

  for (const doc of docs) {

    const embedding =
      await embedder.embed(doc.text);

    store.push({
      text: doc.text,
      source: doc.source,
      embedding
    });
  }

  saveStore();
}

async function vectorSearch(queryEmbedding, k = 10) {

  const scores = store.map(item => ({

    text: item.text,
    source: item.source,

    score:
      cosineSimilarity(queryEmbedding, item.embedding)

  }));

  scores.sort((a, b) => b.score - a.score);

  return scores.slice(0, k);
}

module.exports = {
  loadStore,
  buildStore,
  vectorSearch
};
