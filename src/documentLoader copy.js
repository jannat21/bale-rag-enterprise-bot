const fs = require("fs");
const path = require("path");
const pdfParse = require('pdf-parse');  // تغییر نام متغیر
const mammoth = require("mammoth");

const { chunkText } = require("./chunker");

const DOC_PATH = path.join(__dirname, "../documents");

async function loadDocuments() {

  const files = fs.readdirSync(DOC_PATH);
  const docs = [];

  for (const file of files) {

    const full = path.join(DOC_PATH, file);

    if (file.endsWith(".pdf")) {

      const data = await pdfParse(fs.readFileSync(full));
      const chunks = chunkText(data.text);

      chunks.forEach(c =>
        docs.push({ text: c, source: file })
      );

    }

    if (file.endsWith(".docx")) {

      const result =
        await mammoth.extractRawText({ path: full });

      const chunks = chunkText(result.value);

      chunks.forEach(c =>
        docs.push({ text: c, source: file })
      );

    }

  }

  return docs;
}

module.exports = { loadDocuments };
