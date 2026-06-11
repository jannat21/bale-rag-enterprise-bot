const { loadDocuments } = require("../src/documentLoader");
const { LocalEmbeddings } = require("../src/localEmbeddings");
const { buildStore } = require("../src/vectorStore");

async function run() {

  const embedder = new LocalEmbeddings();
  await embedder.init();

  const docs = await loadDocuments();

  await buildStore(docs, embedder);

}

run();
