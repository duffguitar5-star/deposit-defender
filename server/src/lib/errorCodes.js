/**
 * Standardized Error Codes and Messages
 *
 * Provides consistent, actionable error messages across the application
 */

const ERROR_CODES = {
  // Validation errors
  INVALID_INPUT: 'INVALID_INPUT',
  INVALID_EMAIL: 'INVALID_EMAIL',
  INVALID_DATE: 'INVALID_DATE',
  INVALID_AMOUNT: 'INVALID_AMOUNT',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  FILE_CONTENT_MISMATCH: 'FILE_CONTENT_MISMATCH',

  // Resource errors
  CASE_NOT_FOUND: 'CASE_NOT_FOUND',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',

  // Authorization errors
  ACCESS_DENIED: 'ACCESS_DENIED',
  PAYMENT_REQUIRED: 'PAYMENT_REQUIRED',

  // Processing errors
  LEASE_EXTRACTION_FAILED: 'LEASE_EXTRACTION_FAILED',
  OCR_TIMEOUT: 'OCR_TIMEOUT',
  PDF_GENERATION_FAILED: 'PDF_GENERATION_FAILED',
  REPORT_GENERATION_FAILED: 'REPORT_GENERATION_FAILED',

  // Payment errors
  PAYMENT_PROCESSING_ERROR: 'PAYMENT_PROCESSING_ERROR',
  PAYMENT_VERIFICATION_FAILED: 'PAYMENT_VERIFICATION_FAILED',

  // System errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
};

const ERROR_MESSAGES = {
  [ERROR_CODES.INVALID_INPUT]: 'The information provided is invalid. Please review your entries and try again.',
  [ERROR_CODES.INVALID_EMAIL]: 'Please provide a valid email address.',
  [ERROR_CODES.INVALID_DATE]: 'Please provide a valid date in YYYY-MM-DD format.',
  [ERROR_CODES.INVALID_AMOUNT]: 'Please provide a valid dollar amount.',
  [ERROR_CODES.INVALID_FILE_TYPE]: 'Please upload a PDF, PNG, or JPG file.',
  [ERROR_CODES.FILE_TOO_LARGE]: 'File size exceeds the 10MB limit. Please upload a smaller file or compress your PDF.',
  [ERROR_CODES.FILE_CONTENT_MISMATCH]: 'File content does not match the declared type. Please upload a valid file.',

  [ERROR_CODES.CASE_NOT_FOUND]: 'Case not found. The case may have been deleted or the link may be incorrect.',
  [ERROR_CODES.SESSION_NOT_FOUND]: 'Session not found or expired. Please try again.',

  [ERROR_CODES.ACCESS_DENIED]: 'Access denied. You do not have permission to view this resource.',
  [ERROR_CODES.PAYMENT_REQUIRED]: 'Payment is required before accessing this resource. Please complete payment to continue.',

  [ERROR_CODES.LEASE_EXTRACTION_FAILED]: 'Unable to extract text from your lease. The file may be corrupted, password-protected, or scanned at very low resolution. Please try uploading a clearer image or a different file format.',
  [ERROR_CODES.OCR_TIMEOUT]: 'Lease text extraction timed out. The file may be too large or complex. Please try a smaller file or contact support.',
  [ERROR_CODES.PDF_GENERATION_FAILED]: 'Document generation is temporarily unavailable. Please try again in a few moments.',
  [ERROR_CODES.REPORT_GENERATION_FAILED]: 'Report generation failed. Please try again later.',

  [ERROR_CODES.PAYMENT_PROCESSING_ERROR]: 'Unable to process payment. Please try again or contact support.',
  [ERROR_CODES.PAYMENT_VERIFICATION_FAILED]: 'Unable to verify payment status. Please try again or contact support.',

  [ERROR_CODES.INTERNAL_ERROR]: 'An unexpected error occurred. Please try again later.',
  [ERROR_CODES.SERVICE_UNAVAILABLE]: 'The service is temporarily unavailable. Please try again in a few moments.',
};

/**
 * Create a standardized error response
 * @param {string} code - Error code from ERROR_CODES
 * @param {string} customMessage - Optional custom message (overrides default)
 * @param {Array} errors - Optional validation errors array
 * @returns {Object} Standardized error response object
 */
function createErrorResponse(code, customMessage = null, errors = null) {
  const response = {
    status: getStatusForCode(code),
    code,
    message: customMessage || ERROR_MESSAGES[code] || ERROR_MESSAGES[ERROR_CODES.INTERNAL_ERROR],
  };

  if (errors) {
    response.errors = errors;
  }

  return response;
}

/**
 * Get HTTP status category based on error code
 * @param {string} code - Error code
 * @returns {string} Status category
 */
function getStatusForCode(code) {
  if ([
    ERROR_CODES.INVALID_INPUT,
    ERROR_CODES.INVALID_EMAIL,
    ERROR_CODES.INVALID_DATE,
    ERROR_CODES.INVALID_AMOUNT,
    ERROR_CODES.INVALID_FILE_TYPE,
    ERROR_CODES.FILE_TOO_LARGE,
    ERROR_CODES.FILE_CONTENT_MISMATCH,
  ].includes(code)) {
    return 'invalid';
  }

  if ([
    ERROR_CODES.CASE_NOT_FOUND,
    ERROR_CODES.SESSION_NOT_FOUND,
  ].includes(code)) {
    return 'not_found';
  }

  if ([ERROR_CODES.ACCESS_DENIED].includes(code)) {
    return 'forbidden';
  }

  if ([ERROR_CODES.PAYMENT_REQUIRED].includes(code)) {
    return 'payment_required';
  }

  return 'error';
}

module.exports = {
  ERROR_CODES,
  ERROR_MESSAGES,
  createErrorResponse,
};
