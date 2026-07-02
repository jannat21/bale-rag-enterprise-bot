const fs = require("fs");
const path = require("path");
const mammoth = require("mammoth");
const { PDFParse } = require('pdf-parse');  // نحوه import جدید
const { chunkText } = require("./chunker");
const { loadExcelDocuments } = require('./excelLoader');

const DOC_PATH = path.join(__dirname, "../documents");

async function loadDocuments() {
  const files = fs.readdirSync(DOC_PATH);
  const docs = [];

  for (const file of files) {
    const full = path.join(DOC_PATH, file);

    if (file.endsWith(".pdf")) {
      // خواندن فایل به صورت بافر
      const buffer = fs.readFileSync(full);

      // ایجاد نمونه PDFParse با داده بافر
      const parser = new PDFParse({ data: buffer });  // استفاده از data به جای url[reference:1]

      // استخراج متن
      const result = await parser.getText();

      // خرد کردن متن به تکه‌ها
      const chunks = chunkText(result.text);
      chunks.forEach(c => docs.push({ text: c, source: file }));

      // پاکسازی منابع (اختیاری)
      await parser.destroy();
    }

    if (file.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ path: full });
      const chunks = chunkText(result.value);
      chunks.forEach(c => docs.push({ text: c, source: file }));
    }
    if (file.endsWith('.xlsx')) {
      console.log("Loading Excel Files.");
      const excelChunks = loadExcelDocuments(full, file);
      // تبدیل به فرمت استاندارد
      const formatted = excelChunks.map(chunk => ({
        text: chunk.text,
        source: file,  // نام فایل به عنوان منبع
        metadata: chunk.metadata  // متادیتای کامل
      }));
      docs.push(...formatted);
    }
  }

  return docs;
}

module.exports = { loadDocuments };