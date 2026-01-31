require('dotenv').config();

const express = require('express');
const cors = require('cors');

const casesRouter = require('./routes/cases');
const paymentsRouter = require('./routes/payments');
const documentsRouter = require('./routes/documents');

const app = express();
const port = process.env.PORT || 5000;
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:3000';
const corsOptions = {
  origin: clientOrigin,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Stripe webhook needs raw body, so we apply express.json() selectively
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/cases', casesRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/documents', documentsRouter);

app.listen(port, () => {
  console.log(`DepositDefender API listening on port ${port}`);
});
