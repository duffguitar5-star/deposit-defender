/**
 * Session Authentication Middleware
 *
 * Provides session-based case ownership tracking to prevent unauthorized access.
 * This replaces the need for a full user authentication system while still
 * providing basic access control.
 */

const session = require('express-session');

// Session configuration
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'deposit-defender-dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
  name: 'depositDefender.sid', // Custom session name
};

// Create session middleware
const sessionMiddleware = session(sessionConfig);

/**
 * Associate a case with the current session
 * @param {object} req - Express request object
 * @param {string} caseId - Case ID to associate with session
 */
function associateCaseWithSession(req, caseId) {
  if (!req.session.cases) {
    req.session.cases = [];
  }

  if (!req.session.cases.includes(caseId)) {
    req.session.cases.push(caseId);
  }
}

/**
 * Check if current session can access a case
 * @param {object} req - Express request object
 * @param {string} caseId - Case ID to check
 * @returns {boolean} - True if session can access case
 */
function canAccessCase(req, caseId) {
  if (!req.session || !req.session.cases) {
    return false;
  }

  return req.session.cases.includes(caseId);
}

/**
 * Middleware to require case ownership for a route
 * Use this middleware on routes that need case access control
 *
 * Usage: router.get('/:caseId', requireCaseOwnership, handler)
 */
function requireCaseOwnership(req, res, next) {
  const caseId = req.params.caseId;

  if (!caseId) {
    return res.status(400).json({
      status: 'error',
      message: 'Case ID is required',
    });
  }

  if (!canAccessCase(req, caseId)) {
    return res.status(403).json({
      status: 'forbidden',
      message: 'Access denied. This case does not belong to your session.',
    });
  }

  next();
}

module.exports = {
  sessionMiddleware,
  associateCaseWithSession,
  canAccessCase,
  requireCaseOwnership,
};
