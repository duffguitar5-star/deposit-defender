/**
 * Timeout Wrapper Utility
 *
 * Provides Promise.race-based timeout handling for async operations
 * to prevent indefinite hanging on long-running tasks.
 */

/**
 * Wraps an async operation with a timeout
 * @param {Promise} promise - The promise to execute
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} operationName - Name of the operation for error messages
 * @returns {Promise} The result or timeout error
 */
async function withTimeout(promise, timeoutMs, operationName = 'Operation') {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

/**
 * Predefined timeout configurations
 */
const TIMEOUTS = {
  OCR: 60000,              // 60 seconds for OCR processing
  PDF_EXTRACTION: 30000,   // 30 seconds for PDF text extraction
  PDF_GENERATION: 30000,   // 30 seconds for PDF generation
  PUPPETEER_LAUNCH: 10000, // 10 seconds for Puppeteer launch
  IMAGE_EXTRACTION: 45000, // 45 seconds for image text extraction
};

module.exports = {
  withTimeout,
  TIMEOUTS,
};
