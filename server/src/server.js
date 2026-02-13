require('dotenv').config();

const express = require('express');
const cors = require('cors');

const casesRouter = require('./routes/cases');
const paymentsRouter = require('./routes/payments');
const documentsRouter = require('./routes/documents');
const { sessionMiddleware } = require('./middleware/sessionAuth');
const { generalApiLimiter } = require('./middleware/rateLimiter');
const logger = require('./lib/logger');
const { startCleanupInterval } = require('./lib/caseStore');

const app = express();
const port = process.env.PORT || 5000;
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:3000';
const corsOptions = {
  origin: clientOrigin,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: true, // Allow credentials (cookies/sessions)
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Stripe webhook needs raw body, so we apply express.json() selectively
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '2mb' }));

// Session middleware for case ownership tracking
app.use(sessionMiddleware);

// Apply general rate limiting to all API routes
app.use('/api', generalApiLimiter);

// Comprehensive health check with diagnostics
app.get('/api/health', (req, res) => {
  const fs = require('fs');
  const path = require('path');

  const casesDir = path.join(__dirname, '..', 'data', 'cases');

  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    services: {
      datastore: 'unknown',
      stripe: 'unknown',
    },
    system: {
      memory: {
        used: process.memoryUsage().heapUsed,
        total: process.memoryUsage().heapTotal,
        external: process.memoryUsage().external,
      },
      platform: process.platform,
      nodeVersion: process.version,
    },
  };

  // Check datastore accessibility (per-case folder structure)
  try {
    if (fs.existsSync(casesDir)) {
      const stats = fs.statSync(casesDir);
      health.services.datastore = 'accessible';
      health.services.datastoreType = 'per-case-folders';
    } else {
      health.services.datastore = 'not_found';
      health.status = 'degraded';
    }
  } catch (error) {
    health.services.datastore = 'error';
    health.status = 'degraded';
  }

  // Check Stripe API key configured
  if (process.env.STRIPE_SECRET_KEY) {
    health.services.stripe = 'configured';
  } else {
    health.services.stripe = 'not_configured';
    health.status = 'degraded';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Simple liveness probe
app.get('/api/health/live', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Readiness probe with dependency checks
app.get('/api/health/ready', async (req, res) => {
  const fs = require('fs');
  const path = require('path');

  const casesDir = path.join(__dirname, '..', 'data', 'cases');

  const ready = {
    status: 'ready',
    timestamp: new Date().toISOString(),
    checks: {
      datastore: false,
      stripe: false,
    },
  };

  // Check datastore (per-case folder structure)
  try {
    if (fs.existsSync(casesDir)) {
      // Try to read the directory
      fs.readdirSync(casesDir);
      ready.checks.datastore = true;
    }
  } catch (error) {
    ready.checks.datastore = false;
  }

  // Check Stripe configuration
  ready.checks.stripe = !!process.env.STRIPE_SECRET_KEY;

  // Overall ready status
  const isReady = ready.checks.datastore && ready.checks.stripe;
  ready.status = isReady ? 'ready' : 'not_ready';

  const statusCode = isReady ? 200 : 503;
  res.status(statusCode).json(ready);
});

app.use('/api/cases', casesRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/documents', documentsRouter);

// Start cleanup interval for old cases (72-hour retention)
startCleanupInterval();

app.listen(port, () => {
  logger.info('DepositDefender API started', {
    port,
    environment: process.env.NODE_ENV || 'development',
    clientOrigin,
  });
  logger.info('Case cleanup interval started', { retentionHours: 72 });
});
