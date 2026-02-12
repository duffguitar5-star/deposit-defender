const { createWorker } = require('tesseract.js');
const { createCanvas } = require('@napi-rs/canvas');
const { withTimeout, TIMEOUTS } = require('./timeoutWrapper');

const MAX_OCR_PAGES = 5;

async function renderPdfPageToPng(page, scale = 2) {
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(viewport.width, viewport.height);
  const context = canvas.getContext('2d');
  await page.render({ canvasContext: context, viewport }).promise;
  return canvas.toBuffer('image/png');
}

async function extractTextFromPdfOcr(buffer) {
  const ocrOperation = async () => {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = Uint8Array.from(buffer);
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdf = await loadingTask.promise;
    const pageCount = Math.min(pdf.numPages, MAX_OCR_PAGES);

    const worker = await createWorker();
    try {
      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      let combinedText = '';

      for (let pageIndex = 1; pageIndex <= pageCount; pageIndex += 1) {
        const page = await pdf.getPage(pageIndex);
        const pngBuffer = await renderPdfPageToPng(page);
        const {
          data: { text },
        } = await worker.recognize(pngBuffer);
        if (text) {
          combinedText += `${text}\n`;
        }
      }

      return combinedText;
    } finally {
      await worker.terminate();
    }
  };

  return withTimeout(ocrOperation(), TIMEOUTS.OCR, 'OCR processing');
}

module.exports = {
  extractTextFromPdfOcr,
};
