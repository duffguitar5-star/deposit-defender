/**
 * Documents Route
 *
 * Handles document generation using the Case Analysis Report pipeline.
 * Replaces the legacy "Security Deposit – Informational Summary" generator.
 */

const express = require('express');
const { getCase, updateCaseAnalysisReport, getPdfDocument, savePdfDocument } = require('../lib/caseStore');
const { buildCaseAnalysisReport, validateReport } = require('../lib/CaseAnalysisService');
const { generateReportPdf, generateReportJson } = require('../lib/reportPdfGenerator');
const { requireCaseOwnership } = require('../middleware/sessionAuth');
const { ERROR_CODES, createErrorResponse } = require('../lib/errorCodes');
const logger = require('../lib/logger');
const { sendPdfEmail } = require('../lib/emailService');

const router = express.Router();

/**
 * GET /:caseId
 *
 * Generate and download Case Analysis Report as PDF
 */
router.get('/:caseId', requireCaseOwnership, async (req, res) => {
  const storedCase = getCase(req.params.caseId);

  if (!storedCase) {
    return res.status(404).json(createErrorResponse(ERROR_CODES.CASE_NOT_FOUND));
  }

  // Payment gate: Only allow document generation if payment is completed
  if (storedCase.paymentStatus !== 'paid') {
    return res.status(402).json(createErrorResponse(ERROR_CODES.PAYMENT_REQUIRED));
  }

  try {
    // Check if PDF already exists (cache)
    let pdfBuffer = await getPdfDocument(req.params.caseId);

    if (!pdfBuffer) {
      // Build Case Analysis Report
      const report = buildCaseAnalysisReport(storedCase);

      // Validate report structure
      const validation = validateReport(report);
      if (!validation.valid) {
        logger.warn('Report validation failed', { caseId: req.params.caseId, errors: validation.errors });
        // Continue anyway - validation is advisory
      }

      // Store the generated report
      await updateCaseAnalysisReport(req.params.caseId, report);

      // Generate PDF
      pdfBuffer = await generateReportPdf(report);

      // Cache PDF for future requests
      await savePdfDocument(req.params.caseId, pdfBuffer);

      logger.info('PDF generated and cached', { caseId: req.params.caseId });
    } else {
      logger.info('PDF served from cache', { caseId: req.params.caseId });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="case-analysis-report-${storedCase.id}.pdf"`
    );
    return res.send(pdfBuffer);
  } catch (error) {
    logger.error('Document generation error', { caseId: req.params.caseId, error });

    // Check if it's a timeout error
    const isTimeout = error.message && error.message.includes('timed out');
    const errorCode = isTimeout ? ERROR_CODES.OCR_TIMEOUT : ERROR_CODES.PDF_GENERATION_FAILED;

    return res.status(500).json(createErrorResponse(errorCode));
  }
});

/**
 * GET /:caseId/json
 *
 * Get Case Analysis Report as JSON
 */
router.get('/:caseId/json', requireCaseOwnership, async (req, res) => {
  const storedCase = getCase(req.params.caseId);

  if (!storedCase) {
    return res.status(404).json({
      status: 'not_found',
      message: 'Case not found.',
    });
  }

  // Payment gate
  if (storedCase.paymentStatus !== 'paid') {
    return res.status(402).json({
      status: 'payment_required',
      message: 'Payment required before document generation.',
    });
  }

  try {
    // Build Case Analysis Report
    const report = buildCaseAnalysisReport(storedCase);

    // Validate report structure
    const validation = validateReport(report);
    if (!validation.valid) {
      logger.warn('Report validation failed', { caseId: req.params.caseId, errors: validation.errors });
    }

    // Store the generated report
    await updateCaseAnalysisReport(req.params.caseId, report);

    return res.json({
      status: 'ok',
      data: {
        report,
        validation,
      },
    });
  } catch (error) {
    logger.error('Report generation error', { caseId: req.params.caseId, error });
    return res.status(500).json(createErrorResponse(ERROR_CODES.REPORT_GENERATION_FAILED));
  }
});

/**
 * GET /:caseId/preview
 *
 * Preview Case Analysis Report (no payment required)
 * Returns a limited preview for UI display
 */
router.get('/:caseId/preview', requireCaseOwnership, async (req, res) => {
  const storedCase = getCase(req.params.caseId);

  if (!storedCase) {
    return res.status(404).json({
      status: 'not_found',
      message: 'Case not found.',
    });
  }

  try {
    // Build Case Analysis Report
    const report = buildCaseAnalysisReport(storedCase);

    // Return limited preview (no full leverage points or procedural steps)
    return res.json({
      status: 'ok',
      data: {
        preview: {
          case_id: report.report_metadata.case_id,
          timeline_phase: report.timeline.current_status.timeline_phase,
          days_since_move_out: report.timeline.current_status.days_since_move_out,
          compliance_summary: report.compliance_checklist.summary,
          leverage_point_count: report.leverage_points.length,
          statutory_reference_count: report.statutory_references.length,
          lease_clause_count: report.lease_clause_citations.length,
          disclaimer: report.disclaimers.primary,
        },
        payment_required: storedCase.paymentStatus !== 'paid',
      },
    });
  } catch (error) {
    logger.error('Preview generation error', { caseId: req.params.caseId, error });
    return res.status(500).json(createErrorResponse(ERROR_CODES.REPORT_GENERATION_FAILED, 'Preview generation failed.'));
  }
});

/**
 * POST /:caseId/email
 *
 * Email Case Analysis Report PDF to provided email address
 * Email address is used transiently and not stored
 */
router.post('/:caseId/email', requireCaseOwnership, async (req, res) => {
  const storedCase = getCase(req.params.caseId);

  if (!storedCase) {
    return res.status(404).json(createErrorResponse(ERROR_CODES.CASE_NOT_FOUND));
  }

  // Payment gate
  if (storedCase.paymentStatus !== 'paid') {
    return res.status(402).json(createErrorResponse(ERROR_CODES.PAYMENT_REQUIRED));
  }

  // Validate email address from request body
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json(createErrorResponse(ERROR_CODES.INVALID_EMAIL, 'Email address is required'));
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json(createErrorResponse(ERROR_CODES.INVALID_EMAIL));
  }

  try {
    // Check if PDF already exists (cache)
    let pdfBuffer = await getPdfDocument(req.params.caseId);

    if (!pdfBuffer) {
      // Build Case Analysis Report
      const report = buildCaseAnalysisReport(storedCase);

      // Validate report structure
      const validation = validateReport(report);
      if (!validation.valid) {
        logger.warn('Report validation failed', { caseId: req.params.caseId, errors: validation.errors });
      }

      // Store the generated report
      await updateCaseAnalysisReport(req.params.caseId, report);

      // Generate PDF
      pdfBuffer = await generateReportPdf(report);

      // Cache PDF
      await savePdfDocument(req.params.caseId, pdfBuffer);
    }

    // Send email (email address used transiently, not stored)
    await sendPdfEmail(email, storedCase.id, pdfBuffer);

    logger.info('PDF emailed successfully', {
      caseId: req.params.caseId,
      emailSentTo: email, // Logged but not persisted
    });

    return res.json({
      status: 'ok',
      data: {
        message: 'PDF sent to your email address',
      },
    });
  } catch (error) {
    logger.error('Email delivery error', { caseId: req.params.caseId, error });

    // Check if it's a timeout error
    const isTimeout = error.message && error.message.includes('timed out');
    const errorCode = isTimeout ? ERROR_CODES.OCR_TIMEOUT : ERROR_CODES.PDF_GENERATION_FAILED;

    return res.status(500).json(createErrorResponse(errorCode, 'Unable to send email. Please try again.'));
  }
});

module.exports = router;
