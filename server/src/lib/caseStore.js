/**
 * Enhanced File-Based Case Storage (V2)
 *
 * Per-case folder structure with atomic writes and retention policy.
 *
 * Structure:
 * data/cases/{caseId}/
 *   - case.json (intake + metadata)
 *   - report.json (analysis report)
 *   - document.pdf (generated PDF)
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const logger = require('./logger');

const dataDir = path.join(__dirname, '..', '..', 'data', 'cases');

// Retention policy: 72 hours (in milliseconds)
const RETENTION_MS = 72 * 60 * 60 * 1000;

/**
 * Ensure data directory exists
 */
async function ensureDataDir() {
  try {
    await fs.mkdir(dataDir, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      logger.error('Failed to create data directory', { error });
      throw error;
    }
  }
}

/**
 * Get case directory path
 */
function getCaseDir(caseId) {
  return path.join(dataDir, caseId);
}

/**
 * Atomic write using temp file + rename
 * @param {string} filePath - Target file path
 * @param {string|Buffer} data - Data to write
 */
async function atomicWrite(filePath, data) {
  const tempPath = `${filePath}.tmp`;
  try {
    await fs.writeFile(tempPath, data, 'utf8');
    await fs.rename(tempPath, filePath);
  } catch (error) {
    // Clean up temp file if it exists
    try {
      await fs.unlink(tempPath);
    } catch {}
    throw error;
  }
}

/**
 * Save a new case
 * @param {string} caseId - Case ID
 * @param {Object} payload - Intake payload
 */
async function saveCase(caseId, payload) {
  await ensureDataDir();

  const caseDir = getCaseDir(caseId);

  try {
    // Create case directory
    await fs.mkdir(caseDir, { recursive: true });

    // Prepare case data
    const caseData = {
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
    };

    // Atomic write to case.json
    const casePath = path.join(caseDir, 'case.json');
    await atomicWrite(casePath, JSON.stringify(caseData, null, 2));

    logger.info('Case saved successfully', { caseId });
  } catch (error) {
    logger.error('Failed to save case', { caseId, error });
    throw error;
  }
}

/**
 * Get a case by ID
 * @param {string} caseId - Case ID
 * @returns {Object|null} Case data or null if not found
 */
async function getCase(caseId) {
  const casePath = path.join(getCaseDir(caseId), 'case.json');

  try {
    const data = await fs.readFile(casePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null; // Case not found
    }
    logger.error('Failed to read case', { caseId, error });
    throw error;
  }
}

/**
 * Update case payment status
 * @param {string} caseId - Case ID
 * @param {Object} paymentData - Payment data to merge
 * @returns {Object|null} Updated case or null if not found
 */
async function updateCasePaymentStatus(caseId, paymentData) {
  const existingCase = await getCase(caseId);

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

  const casePath = path.join(getCaseDir(caseId), 'case.json');
  await atomicWrite(casePath, JSON.stringify(updatedCase, null, 2));

  logger.info('Payment status updated', { caseId, paymentStatus: updatedCase.paymentStatus });
  return updatedCase;
}

/**
 * Update case with lease data
 * @param {string} caseId - Case ID
 * @param {string} leaseText - Extracted lease text
 * @param {Array} pageMarkers - Page markers
 * @returns {Object|null} Updated case or null if not found
 */
async function updateCaseLeaseData(caseId, leaseText, pageMarkers = null) {
  const existingCase = await getCase(caseId);

  if (!existingCase) {
    return null;
  }

  const updatedCase = {
    ...existingCase,
    leaseText,
    leasePageMarkers: pageMarkers,
  };

  const casePath = path.join(getCaseDir(caseId), 'case.json');
  await atomicWrite(casePath, JSON.stringify(updatedCase, null, 2));

  logger.info('Lease data updated', { caseId });
  return updatedCase;
}

/**
 * Update case with analysis report
 * @param {string} caseId - Case ID
 * @param {Object} report - Analysis report
 * @returns {Object|null} Updated case or null if not found
 */
async function updateCaseAnalysisReport(caseId, report) {
  const existingCase = await getCase(caseId);

  if (!existingCase) {
    return null;
  }

  const updatedCase = {
    ...existingCase,
    analysisReport: report,
    analysisGeneratedAt: new Date().toISOString(),
  };

  // Save updated case metadata
  const casePath = path.join(getCaseDir(caseId), 'case.json');
  await atomicWrite(casePath, JSON.stringify(updatedCase, null, 2));

  // Also save report as separate JSON file
  const reportPath = path.join(getCaseDir(caseId), 'report.json');
  await atomicWrite(reportPath, JSON.stringify(report, null, 2));

  logger.info('Analysis report updated', { caseId });
  return updatedCase;
}

/**
 * Save PDF document
 * @param {string} caseId - Case ID
 * @param {Buffer} pdfBuffer - PDF buffer
 */
async function savePdfDocument(caseId, pdfBuffer) {
  const pdfPath = path.join(getCaseDir(caseId), 'document.pdf');
  await atomicWrite(pdfPath, pdfBuffer);
  logger.info('PDF document saved', { caseId, size: pdfBuffer.length });
}

/**
 * Get PDF document
 * @param {string} caseId - Case ID
 * @returns {Buffer|null} PDF buffer or null if not found
 */
async function getPdfDocument(caseId) {
  const pdfPath = path.join(getCaseDir(caseId), 'document.pdf');

  try {
    return await fs.readFile(pdfPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    logger.error('Failed to read PDF document', { caseId, error });
    throw error;
  }
}

/**
 * Find the most recent paid case for a given email address.
 * Used by the resend-report endpoint.
 * @param {string} email - Tenant email
 * @returns {Object|null} Most recent paid case or null
 */
async function getCaseByEmail(email) {
  try {
    const cases = await fs.readdir(dataDir);
    const normalizedEmail = email.toLowerCase().trim();
    let best = null;

    for (const caseId of cases) {
      const caseData = await getCase(caseId);
      if (!caseData) continue;

      const caseEmail = caseData.intake?.tenant_information?.email;
      if (!caseEmail || caseEmail.toLowerCase().trim() !== normalizedEmail) continue;
      if (caseData.paymentStatus !== 'paid') continue;

      if (!best || new Date(caseData.paidAt) > new Date(best.paidAt)) {
        best = caseData;
      }
    }

    return best;
  } catch (error) {
    logger.error('Failed to search cases by email', { error });
    throw error;
  }
}

/**
 * Find case by Stripe session ID
 * @param {string} sessionId - Stripe session ID
 * @returns {Object|null} Case data or null if not found
 */
async function getCaseBySessionId(sessionId) {
  try {
    const cases = await fs.readdir(dataDir);

    for (const caseId of cases) {
      const caseData = await getCase(caseId);
      if (caseData && caseData.stripeSessionId === sessionId) {
        return caseData;
      }
    }

    return null;
  } catch (error) {
    logger.error('Failed to search cases by session ID', { error });
    throw error;
  }
}

/**
 * Delete case folder (for cleanup)
 * @param {string} caseId - Case ID
 */
async function deleteCase(caseId) {
  const caseDir = getCaseDir(caseId);

  try {
    await fs.rm(caseDir, { recursive: true, force: true });
    logger.info('Case deleted', { caseId });
  } catch (error) {
    logger.error('Failed to delete case', { caseId, error });
    throw error;
  }
}

/**
 * Cleanup old cases based on retention policy
 * Deletes cases older than RETENTION_MS (72 hours)
 */
async function cleanupOldCases() {
  try {
    const cases = await fs.readdir(dataDir);
    const now = Date.now();
    let deletedCount = 0;

    for (const caseId of cases) {
      const caseData = await getCase(caseId);

      if (!caseData || !caseData.createdAt) {
        continue;
      }

      const createdAt = new Date(caseData.createdAt).getTime();
      const age = now - createdAt;

      if (age > RETENTION_MS) {
        await deleteCase(caseId);
        deletedCount++;
      }
    }

    logger.info('Cleanup completed', { deletedCount, retentionHours: RETENTION_MS / (60 * 60 * 1000) });
    return deletedCount;
  } catch (error) {
    logger.error('Cleanup failed', { error });
    throw error;
  }
}

/**
 * Start cleanup interval
 * Runs cleanup every 6 hours
 */
function startCleanupInterval() {
  const CLEANUP_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours

  // Run cleanup on startup
  cleanupOldCases().catch((error) => {
    logger.error('Initial cleanup failed', { error });
  });

  // Schedule periodic cleanup
  setInterval(() => {
    cleanupOldCases().catch((error) => {
      logger.error('Periodic cleanup failed', { error });
    });
  }, CLEANUP_INTERVAL);

  logger.info('Cleanup interval started', { intervalHours: CLEANUP_INTERVAL / (60 * 60 * 1000) });
}

module.exports = {
  saveCase,
  getCase,
  updateCasePaymentStatus,
  updateCaseLeaseData,
  updateCaseAnalysisReport,
  getCaseBySessionId,
  getCaseByEmail,
  savePdfDocument,
  getPdfDocument,
  deleteCase,
  cleanupOldCases,
  startCleanupInterval,
};
