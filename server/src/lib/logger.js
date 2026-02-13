/**
 * Structured Logging Utility
 *
 * Provides JSON-formatted logging for better observability
 * in production environments.
 */

/**
 * Log levels
 */
const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
};

/**
 * Format log entry as JSON
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} metadata - Additional metadata
 * @returns {string} JSON-formatted log entry
 */
function formatLog(level, message, metadata = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...metadata,
  };

  return JSON.stringify(logEntry);
}

/**
 * Log debug message
 * @param {string} message - Log message
 * @param {Object} metadata - Additional metadata
 */
function debug(message, metadata = {}) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(formatLog(LOG_LEVELS.DEBUG, message, metadata));
  }
}

/**
 * Log info message
 * @param {string} message - Log message
 * @param {Object} metadata - Additional metadata
 */
function info(message, metadata = {}) {
  console.log(formatLog(LOG_LEVELS.INFO, message, metadata));
}

/**
 * Log warning message
 * @param {string} message - Log message
 * @param {Object} metadata - Additional metadata
 */
function warn(message, metadata = {}) {
  console.warn(formatLog(LOG_LEVELS.WARN, message, metadata));
}

/**
 * Log error message
 * @param {string} message - Log message
 * @param {Object} metadata - Additional metadata (should include error object)
 */
function error(message, metadata = {}) {
  // Extract error details if error object is provided
  if (metadata.error && metadata.error instanceof Error) {
    metadata.errorMessage = metadata.error.message;
    metadata.errorStack = metadata.error.stack;
    delete metadata.error; // Remove the error object to avoid circular references
  }

  console.error(formatLog(LOG_LEVELS.ERROR, message, metadata));
}

/**
 * Log HTTP request
 * @param {Object} req - Express request object
 * @param {number} statusCode - HTTP status code
 * @param {number} duration - Request duration in ms
 */
function logRequest(req, statusCode, duration) {
  info('HTTP Request', {
    method: req.method,
    path: req.path,
    statusCode,
    duration,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
}

/**
 * Log case-related operation
 * @param {string} operation - Operation name
 * @param {string} caseId - Case ID
 * @param {Object} metadata - Additional metadata
 */
function logCaseOperation(operation, caseId, metadata = {}) {
  info(operation, {
    caseId,
    ...metadata,
  });
}

/**
 * Log payment-related operation
 * @param {string} operation - Operation name
 * @param {string} caseId - Case ID
 * @param {Object} metadata - Additional metadata
 */
function logPaymentOperation(operation, caseId, metadata = {}) {
  info(operation, {
    caseId,
    operation: 'payment',
    ...metadata,
  });
}

module.exports = {
  LOG_LEVELS,
  debug,
  info,
  warn,
  error,
  logRequest,
  logCaseOperation,
  logPaymentOperation,
};
