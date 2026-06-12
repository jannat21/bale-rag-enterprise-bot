const { loadDocuments } = require("../src/documentLoader");
const { createEmbedder  } = require("../src/localEmbeddings");
const { buildStore } = require("../src/vectorStore");

async function run() {

  const embedder = await createEmbedder();
  //await embedder.init();

  const docs = await loadDocuments();

  await buildStore(docs, embedder);

}

run();
