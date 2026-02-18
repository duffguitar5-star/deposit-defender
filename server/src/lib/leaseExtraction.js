/**
 * Lease Text Extraction
 *
 * Primary: pdfjs-dist (installed) — extracts text page-by-page, preserving
 *          line structure so that regex patterns in extractStructuredData work.
 * Fallback: pdf-parse — used if pdfjs-dist throws.
 * OCR:      Stubbed — tesseract.js not installed in V1. Scanned PDFs degrade
 *           gracefully; user fills any un-detected fields manually.
 */

const { withTimeout, TIMEOUTS } = require('./timeoutWrapper');
const logger = require('./logger');

/**
 * Extract text from a text-based PDF buffer.
 * Uses pdfjs-dist (page-by-page text items) for maximum regex compatibility.
 * Falls back to pdf-parse if pdfjs-dist throws.
 */
async function extractTextFromPdf(buffer) {
  const operation = async () => {
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
  };

  try {
    return await withTimeout(operation(), TIMEOUTS.PDF_EXTRACTION, 'PDF text extraction');
  } catch (primaryError) {
    logger.warn('pdfjs-dist extraction failed, falling back to pdf-parse', {
      error: primaryError.message,
    });
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer, { max: 10 });
      return data.text || '';
    } catch {
      return '';
    }
  }
}

/**
 * OCR fallback for scanned PDFs.
 * Not available in V1 — tesseract.js is not installed.
 * Returns empty string; caller falls through to raw buffer decode.
 */
async function extractTextFromPdfOcr() {
  return '';
}

/**
 * Extract text from an image buffer.
 * Not available in V1 — tesseract.js is not installed.
 */
async function extractTextFromImage() {
  return '';
}

module.exports = { extractTextFromPdf, extractTextFromPdfOcr, extractTextFromImage };
