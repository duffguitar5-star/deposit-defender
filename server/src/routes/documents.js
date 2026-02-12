/**
 * Documents Route
 *
 * Handles document generation using the Case Analysis Report pipeline.
 * Replaces the legacy "Security Deposit – Informational Summary" generator.
 */

const express = require('express');
const { getCase, updateCaseAnalysisReport } = require('../lib/caseStore');
const { buildCaseAnalysisReport, validateReport } = require('../lib/CaseAnalysisService');
const { generateReportPdf, generateReportJson } = require('../lib/reportPdfGenerator');
const { requireCaseOwnership } = require('../middleware/sessionAuth');

const router = express.Router();

/**
 * GET /:caseId
 *
 * Generate and download Case Analysis Report as PDF
 */
router.get('/:caseId', requireCaseOwnership, async (req, res) => {
  const storedCase = getCase(req.params.caseId);

  if (!storedCase) {
    return res.status(404).json({
      status: 'not_found',
      message: 'Case not found.',
    });
  }

  // Payment gate: Only allow document generation if payment is completed
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
      console.error('Report validation failed:', validation.errors);
      // Continue anyway - validation is advisory
    }

    // Store the generated report
    await updateCaseAnalysisReport(req.params.caseId, report);

    // Generate PDF
    const pdfBuffer = await generateReportPdf(report);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="case-analysis-report-${storedCase.id}.pdf"`
    );
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Document generation error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Document generation is temporarily unavailable. Please try again later.',
    });
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
      console.error('Report validation failed:', validation.errors);
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
    console.error('Report generation error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Report generation failed. Please try again later.',
    });
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
    console.error('Preview generation error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Preview generation failed.',
    });
  }
});

module.exports = router;
