# DepositDefender Test Harness — Dockerfile
#
# BUILD CONTEXT: repo root (deposit-defender/)
# Build command: docker build -f gcp-pipeline/harness/Dockerfile -t IMAGE .
#
# This image imports buildCaseAnalysisReport() directly from the app source.
# The directory structure /app/server/src/lib/ and /app/ai/ must be maintained
# so that the relative path in issueDetectors.js resolves correctly:
#   path.join(__dirname, '..', '..', '..', 'ai', 'tx_security_deposit_rules.json')
#   = /app/server/src/lib/../../../ai/ = /app/ai/  ✓

FROM node:20-alpine

WORKDIR /app

# ── Step 1: Install server dependencies ──────────────────────────────────────
# date-fns, date-fns-tz, and other packages used by the analysis pipeline
# are installed under /app/server/node_modules/, which Node.js will find
# when resolving requires from /app/server/src/lib/*.js
COPY server/package.json ./server/package.json
RUN cd server && npm install --omit=dev

# ── Step 2: Install harness-specific GCP client libraries ────────────────────
# These land in /app/node_modules/ and are used only by harness.js
COPY gcp-pipeline/harness/package.json ./package.json
RUN npm install --omit=dev

# ── Step 3: Copy app analysis code (exact path structure required) ────────────
COPY server/src/ ./server/src/

# ── Step 4: Copy AI knowledge base files ──────────────────────────────────────
# issueDetectors.js loads tx_security_deposit_rules.json via:
#   path.join(__dirname, '..', '..', '..', 'ai', 'tx_security_deposit_rules.json')
# intakeValidation.js loads TX-SAFE INTAKE SCHEMA.json the same way.
COPY ai/ ./ai/

# ── Step 5: Copy harness entry point ─────────────────────────────────────────
COPY gcp-pipeline/harness/harness.js ./harness.js

CMD ["node", "harness.js"]
