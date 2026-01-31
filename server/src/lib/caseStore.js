const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', '..', 'data');
const dataFile = path.join(dataDir, 'cases.json');
const caseStore = new Map();

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

function persistStore() {
  const payload = Object.fromEntries(caseStore.entries());
  fs.writeFileSync(dataFile, JSON.stringify(payload, null, 2), 'utf8');
}

ensureStoreLoaded();

function saveCase(caseId, payload) {
  caseStore.set(caseId, {
    id: caseId,
    intake: payload,
    createdAt: new Date().toISOString(),
    paymentStatus: 'pending',
    stripeSessionId: null,
    paidAt: null,
    amount: 1999, // cents
  });
  persistStore();
}

function getCase(caseId) {
  return caseStore.get(caseId) || null;
}

function updateCasePaymentStatus(caseId, paymentData) {
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
  persistStore();
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
};
