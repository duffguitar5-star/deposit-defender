const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', '..', 'data');
const dataFile = path.join(dataDir, 'cases.json');
const caseStore = new Map();

// In-memory lock registry to prevent concurrent file writes
const locks = new Map();

function ensureStoreLoaded() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, '{}', 'utf8');
  }

  const raw = fs.readFileSync(dataFile, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    Object.keys(parsed).forEach((key) => {
      caseStore.set(key, parsed[key]);
    });
  } catch (error) {
    fs.writeFileSync(dataFile, '{}', 'utf8');
  }
}

/**
 * Acquire lock for file writing
 * @param {string} key - Lock key
 * @param {number} timeout - Timeout in milliseconds
 */
async function acquireLock(key, timeout = 5000) {
  const start = Date.now();
  while (locks.has(key)) {
    if (Date.now() - start > timeout) {
      throw new Error(`Lock acquisition timeout for ${key}`);
    }
    // Wait 10ms before retrying
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  locks.set(key, Date.now());
}

/**
 * Release lock for file writing
 * @param {string} key - Lock key
 */
function releaseLock(key) {
  locks.delete(key);
}

/**
 * Persist case store to disk with file locking
 */
async function persistStore() {
  const lockKey = 'cases.json';
  await acquireLock(lockKey);

  try {
    const payload = Object.fromEntries(caseStore.entries());
    await fs.promises.writeFile(dataFile, JSON.stringify(payload, null, 2), 'utf8');
  } finally {
    releaseLock(lockKey);
  }
}

ensureStoreLoaded();

async function saveCase(caseId, payload) {
  caseStore.set(caseId, {
    id: caseId,
    intake: payload,
    createdAt: new Date().toISOString(),
    paymentStatus: 'pending',
    stripeSessionId: null,
    paidAt: null,
    amount: 4999, // cents
    leaseText: null,
    leasePageMarkers: null,
    analysisReport: null,
  });
  await persistStore();
}

async function updateCaseLeaseData(caseId, leaseText, pageMarkers = null) {
  const existingCase = caseStore.get(caseId);
  if (!existingCase) {
    return null;
  }

  const updatedCase = {
    ...existingCase,
    leaseText,
    leasePageMarkers: pageMarkers,
  };

  caseStore.set(caseId, updatedCase);
  await persistStore();
  return updatedCase;
}

async function updateCaseAnalysisReport(caseId, report) {
  const existingCase = caseStore.get(caseId);
  if (!existingCase) {
    return null;
  }

  const updatedCase = {
    ...existingCase,
    analysisReport: report,
    analysisGeneratedAt: new Date().toISOString(),
  };

  caseStore.set(caseId, updatedCase);
  await persistStore();
  return updatedCase;
}

function getCase(caseId) {
  return caseStore.get(caseId) || null;
}

async function updateCasePaymentStatus(caseId, paymentData) {
  const existingCase = caseStore.get(caseId);
  if (!existingCase) {
    return null;
  }

  const updatedCase = {
    ...existingCase,
    paymentStatus: paymentData.paymentStatus || existingCase.paymentStatus,
    stripeSessionId: paymentData.stripeSessionId || existingCase.stripeSessionId,
    paidAt: paymentData.paidAt || existingCase.paidAt,
    amount: paymentData.amount || existingCase.amount,
  };

  caseStore.set(caseId, updatedCase);
  await persistStore();
  return updatedCase;
}

function getCaseBySessionId(sessionId) {
  for (const [, caseData] of caseStore.entries()) {
    if (caseData.stripeSessionId === sessionId) {
      return caseData;
    }
  }
  return null;
}

module.exports = {
  saveCase,
  getCase,
  updateCasePaymentStatus,
  getCaseBySessionId,
  updateCaseLeaseData,
  updateCaseAnalysisReport,
};
