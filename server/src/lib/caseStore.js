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
  });
  persistStore();
}

function getCase(caseId) {
  return caseStore.get(caseId) || null;
}

module.exports = {
  saveCase,
  getCase,
};
