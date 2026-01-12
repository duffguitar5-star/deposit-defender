const { createWorker } = require('tesseract.js');
const { extractTextFromPdfOcr } = require('./pdfOcr');

async function extractTextFromImage(buffer) {
  const worker = await createWorker();
  try {
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    const {
      data: { text },
    } = await worker.recognize(buffer);
    return text || '';
  } finally {
    await worker.terminate();
  }
}

module.exports = {
  extractTextFromImage,
  extractTextFromPdf: async (buffer) => {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = Uint8Array.from(buffer);
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdf = await loadingTask.promise;
    const pageCount = Math.min(pdf.numPages, 10);
    let combinedText = '';

    for (let pageIndex = 1; pageIndex <= pageCount; pageIndex += 1) {
      const page = await pdf.getPage(pageIndex);
      const content = await page.getTextContent();
      const pageText = content.items.map((item) => item.str).join(' ');
      combinedText += `${pageText}\n`;
    }

    return combinedText.trim();
  },
  extractTextFromPdfOcr,
};
