const { pipeline } = require("@xenova/transformers");

let extractor = null;

async function createEmbedder() {

  if (!extractor) {

    console.log("⏳ Loading embedding model...");

    extractor = await pipeline(
      "feature-extraction",
      "Xenova/paraphrase-multilingual-MiniLM-L12-v2"
    );

    console.log("✅ Embedding model loaded");
  }

  return {
    embed: async (text) => {

      const output = await extractor(text, {
        pooling: "mean",
        normalize: true
      });

      return Array.from(output.data);
    }
  };
}

module.exports = {
  createEmbedder
};
