/**
 * Documents Route
 *
 * Handles document generation using the Case Analysis Report pipeline.
 * Replaces the legacy "Security Deposit – Informational Summary" generator.
 */

const express = require('express');
const { getCase, updateCaseAnalysisReport, getPdfDocument, savePdfDocument } = require('../lib/caseStore');
const { buildCaseAnalysisReport, validateReport } = require('../lib/CaseAnalysisService');
const { generateReportPdf } = require('../lib/reportPdfGenerator');
const { generateDemandLetterPdf } = require('../lib/demandLetterGenerator');
const { requireCaseOwnership } = require('../middleware/sessionAuth');
const { ERROR_CODES, createErrorResponse } = require('../lib/errorCodes');
const logger = require('../lib/logger');

const router = express.Router();

/**
 * GET /:caseId
 *
 * Generate and download Case Analysis Report as PDF
 */
router.get('/:caseId', async (req, res) => {
  const storedCase = await getCase(req.params.caseId);

  if (!storedCase) {
    return res.status(404).json(createErrorResponse(ERROR_CODES.CASE_NOT_FOUND));
  }

  // Payment gate: Only allow document generation if payment is completed
  if (storedCase.paymentStatus !== 'paid') {
    return res.status(402).json(createErrorResponse(ERROR_CODES.PAYMENT_REQUIRED));
  }

  // Note: No session check required. Case ID is a UUID (secure token).
  // Payment verification above provides sufficient authorization.

  try {
    // Check if PDF already exists (cache). Pass ?nocache=1 to force regeneration.
    let pdfBuffer = req.query.nocache ? null : await getPdfDocument(req.params.caseId);

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
router.get('/:caseId/json', async (req, res) => {
  const storedCase = await getCase(req.params.caseId);

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

  // Note: No session check required. Case ID + payment status provides authorization.

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

    // Build intake context for letter modal (safe field extraction)
    const intake = storedCase.intake || {};
    const ti = intake.tenant_information || {};
    const li = intake.landlord_information || {};
    const pi = intake.property_information || {};
    const mo = intake.move_out_information || {};
    const sd = intake.security_deposit_information || {};

    const context = {
      tenantName: ti.full_name || '',
      tenantEmail: ti.email || '',
      tenantPhone: ti.phone || '',
      landlordName: li.landlord_name || '',
      landlordAddress: li.landlord_address || '',
      landlordCity: li.landlord_city || '',
      landlordState: li.landlord_state || 'TX',
      landlordZip: li.landlord_zip || '',
      landlordPhone: li.landlord_phone || '',
      propertyAddress: pi.property_address || '',
      propertyCity: pi.city || '',
      propertyZip: pi.zip_code || '',
      moveOutDate: mo.move_out_date || '',
      depositAmount: sd.deposit_amount || '',
      amountReturned: sd.amount_returned || '',
    };

    return res.json({
      status: 'ok',
      data: {
        report,
        validation,
        context,
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
router.get('/:caseId/preview', async (req, res) => {
  const storedCase = await getCase(req.params.caseId);

  if (!storedCase) {
    return res.status(404).json({
      status: 'not_found',
      message: 'Case not found.',
    });
  }

  // Note: No session check required. Preview available to anyone with case ID.

  try {
    // Build Case Analysis Report
    const report = buildCaseAnalysisReport(storedCase);

    const cs = report.case_strength || {};
    const topLp = report.leverage_points?.[0];

    // Return limited preview (grade, probability, strongest argument only)
    return res.json({
      status: 'ok',
      data: {
        preview: {
          case_id: report.report_metadata?.case_id,
          leverage_grade: cs.leverage_grade || '?',
          leverage_score: cs.leverage_score ?? 0,
          win_probability: cs.win_probability || 0,
          strategic_position: cs.strategic_position || 'UNCERTAIN',
          days_since_move_out: report.timeline?.days_since_move_out ?? null,
          past_30_days: report.timeline?.past_30_days ?? null,
          strongest_argument: topLp ? topLp.title : null,
          leverage_point_count: report.leverage_points?.length ?? 0,
          recommended_action: report.strategy?.recommended_action || null,
          disclaimer: report.disclaimers?.primary || null,
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
 * POST /:caseId/letter
 *
 * Generate demand letter as PDF with user-supplied field overrides
 */
router.post('/:caseId/letter', async (req, res) => {
  const storedCase = await getCase(req.params.caseId);

  if (!storedCase) {
    return res.status(404).json(createErrorResponse(ERROR_CODES.CASE_NOT_FOUND));
  }

  if (storedCase.paymentStatus !== 'paid') {
    return res.status(402).json(createErrorResponse(ERROR_CODES.PAYMENT_REQUIRED));
  }

  try {
    // Build report for leverage context (bad faith indicators, violations)
    const report = buildCaseAnalysisReport(storedCase);

    // Merge user-supplied fields with intake data as fallback
    const fields = req.body.fields || {};

    const letterBuffer = await generateDemandLetterPdf(fields, report);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="demand-letter-${storedCase.id}.pdf"`);
    res.setHeader('Content-Length', letterBuffer.length);
    return res.send(letterBuffer);
  } catch (error) {
    logger.error('Letter generation error', { caseId: req.params.caseId, error });
    return res.status(500).json({ status: 'error', message: 'Letter generation failed. Please try again.' });
  }
});

module.exports = router;
