/**
 * Rate Limiting Middleware
 *
 * Protects API endpoints from abuse and DDoS attacks
 * using express-rate-limit
 */

const rateLimit = require('express-rate-limit');

/**
 * General API rate limiter
 * Limits all API requests to prevent abuse
 */
const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: {
    status: 'error',
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests from this IP. Please try again in 15 minutes.',
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  // Skip rate limiting in test environment
  skip: () => process.env.NODE_ENV === 'test',
});

/**
 * File upload rate limiter
 * Stricter limits for resource-intensive operations
 */
const fileUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 uploads per hour
  message: {
    status: 'error',
    code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
    message: 'Too many file uploads. Please try again in an hour.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

/**
 * Payment creation rate limiter
 * Very strict limits to prevent payment spam
 */
const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 payment attempts per hour
  message: {
    status: 'error',
    code: 'PAYMENT_RATE_LIMIT_EXCEEDED',
    message: 'Too many payment attempts. Please try again in an hour or contact support.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

/**
 * Case creation rate limiter
 * Moderate limits for case submissions
 */
const caseCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 case creations per hour
  message: {
    status: 'error',
    code: 'CASE_CREATION_RATE_LIMIT_EXCEEDED',
    message: 'Too many case submissions. Please try again in an hour.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

module.exports = {
  generalApiLimiter,
  fileUploadLimiter,
  paymentLimiter,
  caseCreationLimiter,
};
