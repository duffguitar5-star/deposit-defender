/**
 * Case Analysis Service
 *
 * Orchestrates the full analysis pipeline:
 * 1. Calculate timeline
 * 2. Build compliance checklist
 * 3. Detect issues (4 core detectors)
 * 4. Score leverage (0-100 + grade)
 * 5. Determine strategy (recommended action + steps)
 * 6. Estimate recovery (deposit-capped amounts)
 * 7. Analyze damage defenses
 * 8. Assemble final report
 */

const { detectIssues, buildEnrichedLeveragePoints, deriveProceduralSteps, getApplicableStatutes } = require('./issueDetectors');
const { calculateLeverageScore, getLeverageGrade, getStrategicPosition, estimateWinProbability, assessEvidenceQuality, getBadFaithIndicators } = require('./leverageScoring');
const { determineStrategy } = require('./strategyEngine');
const { estimateRecovery } = require('./recoveryEstimator');
const { analyzeDamageDefenses } = require('./damageDefenseBasic');
const { parseISO, differenceInCalendarDays, isValid } = require('date-fns');
const logger = require('./logger');

/**
 * Build the full case analysis report
 *
 * @param {object} caseData - { intake, leaseText? }
 * @returns {object} full report
 */
function buildCaseAnalysisReport(caseData) {
  if (!caseData || !caseData.intake) {
    throw new Error('Invalid case data: missing intake');
  }

  // Normalize intake: inject _leaseText from caseData.leaseText (top-level field)
  // so that leverageScoring and assessEvidenceQuality can read it correctly.
  // caseData.leaseText is set by the POST /api/cases route when the user uploads a lease.
  const intake = {
    ...caseData.intake,
    _leaseText: caseData.leaseText || caseData.intake._leaseText || null,
  };

  // ─────────────────────────────────────────────
  // 1. TIMELINE
  // ─────────────────────────────────────────────
  const moveOutRaw = intake.move_out_information?.move_out_date || null;
  let daysSinceMoveOut = null;
  let past30Days = null;

  if (moveOutRaw) {
    try {
      let moveOutDate = parseISO(moveOutRaw);
      if (!isValid(moveOutDate)) moveOutDate = new Date(moveOutRaw);
      if (isValid(moveOutDate)) {
        daysSinceMoveOut = differenceInCalendarDays(new Date(), moveOutDate);
        past30Days = daysSinceMoveOut > 30;
      }
    } catch (error) {
      logger.error('Timeline calculation error', { error });
    }
  }

  const timeline = {
    move_out_date: moveOutRaw,
    days_since_move_out: daysSinceMoveOut,
    past_30_days: past30Days,
    deadline_date: calculateDeadlineDisplay(moveOutRaw, 30),
    days_remaining_to_deadline: past30Days ? 0 : (30 - (daysSinceMoveOut || 0)),
  };

  // ─────────────────────────────────────────────
  // 2. COMPLIANCE CHECKLIST
  // ─────────────────────────────────────────────
  const secDeposit = intake.security_deposit_information || {};
  const postMoveOut = intake.post_move_out_communications || {};
  const moveOutInfo = intake.move_out_information || {};

  const depositReturnedRaw = secDeposit.deposit_returned;
  const amountReturnedNum = parseFloat(String(secDeposit.amount_returned || '0').replace(/[^0-9.]/g, '')) || 0;

  const compliance_checklist = {
    deposit_returned: depositReturnedRaw === 'yes' || amountReturnedNum > 0,
    itemization_provided: postMoveOut.itemized_deductions_received === 'yes',
    refund_within_30_days: depositReturnedRaw === 'yes' && daysSinceMoveOut !== null && daysSinceMoveOut <= 30,
    forwarding_address_provided: moveOutInfo.forwarding_address_provided === 'yes' || moveOutInfo.forwarding_address_provided === true,
  };

  // ─────────────────────────────────────────────
  // 3. ISSUE DETECTION (4 core detectors, no lease analysis)
  // ─────────────────────────────────────────────
  const detectedIssues = detectIssues(intake, timeline);
  const leverage_points = buildEnrichedLeveragePoints(detectedIssues);
  const procedural_steps = deriveProceduralSteps(detectedIssues);
  const statutory_references = getApplicableStatutes(detectedIssues);

  // ─────────────────────────────────────────────
  // 4. LEVERAGE SCORING
  // ─────────────────────────────────────────────
  const leverageScore = calculateLeverageScore(intake, timeline, detectedIssues);
  const leverageGrade = getLeverageGrade(leverageScore);
  const strategicPosition = getStrategicPosition(leverageScore);
  const winProbability = estimateWinProbability(leverageScore, intake);
  const evidenceMatrix = assessEvidenceQuality(intake);
  const badFaithIndicators = getBadFaithIndicators(intake, timeline);

  const case_strength = {
    leverage_score: leverageScore,
    leverage_grade: leverageGrade,
    strategic_position: strategicPosition,
    win_probability: winProbability,
    evidence_quality: evidenceMatrix.overall_strength,
    bad_faith_indicators: badFaithIndicators,
    evidence_matrix: evidenceMatrix,
  };

  // ─────────────────────────────────────────────
  // 5. STRATEGY RECOMMENDATION
  // ─────────────────────────────────────────────
  const depositAmount = secDeposit.deposit_amount || '0';
  const strategy = determineStrategy(leverageScore, depositAmount, intake, timeline);

  // ─────────────────────────────────────────────
  // 6. RECOVERY ESTIMATION (deposit-capped)
  // ─────────────────────────────────────────────
  const petDepositAmount = secDeposit.pet_deposit_amount || null;
  const recovery_estimate = estimateRecovery(
    depositAmount,
    petDepositAmount,
    leverageScore,
    daysSinceMoveOut || 0,
    past30Days || false,
    depositReturnedRaw,
    secDeposit.amount_returned
  );

  // ─────────────────────────────────────────────
  // 7. DAMAGE DEFENSE ANALYSIS
  // ─────────────────────────────────────────────
  const tenantNotes = intake.additional_notes?.tenant_notes || '';
  const damage_defense = analyzeDamageDefenses(
    tenantNotes,
    depositReturnedRaw,
    past30Days || false
  );

  // ─────────────────────────────────────────────
  // 8. FINAL REPORT
  // ─────────────────────────────────────────────
  return {
    report_metadata: {
      case_id: intake.case_id || null,
      jurisdiction: intake.jurisdiction || 'TX',
      generated_at: new Date().toISOString(),
      report_version: '2.0',
    },

    // Strategic intelligence (NEW)
    case_strength,
    recovery_estimate,
    strategy,
    damage_defense,

    // Core analysis
    timeline,
    compliance_checklist,
    leverage_points,
    statutory_references,
    procedural_steps,

    disclaimers: {
      primary:
        'This report is provided for informational and document preparation purposes only. ' +
        'It does not constitute legal advice and does not create an attorney-client relationship. ' +
        'For advice specific to your legal situation, consult a licensed Texas attorney.',
      jurisdiction: 'This analysis applies Texas law only (Tex. Prop. Code § 92.101 et seq.).',
      estimates:
        'Recovery estimates and win probability figures are informational tools only based on general case factors. ' +
        'They do not guarantee any outcome.',
    },
  };
}

/**
 * Calculate deadline display date (e.g. "Feb 4, 2026")
 */
function calculateDeadlineDisplay(moveOutRaw, daysToAdd) {
  if (!moveOutRaw) return null;
  try {
    const { addDays, format, parseISO, isValid } = require('date-fns');
    const { utcToZonedTime } = require('date-fns-tz');
    let date = parseISO(moveOutRaw);
    if (!isValid(date)) date = new Date(moveOutRaw);
    if (!isValid(date)) return null;
    const texasDate = utcToZonedTime(date, 'America/Chicago');
    return format(addDays(texasDate, daysToAdd), 'MMM d, yyyy');
  } catch {
    return null;
  }
}

/**
 * Validate report structure
 */
function validateReport(report) {
  const errors = [];

  if (!report) return { valid: false, errors: ['Report is null or undefined'] };
  if (!report.report_metadata) errors.push('Missing report_metadata');
  if (!report.case_strength) errors.push('Missing case_strength');
  if (!report.timeline) errors.push('Missing timeline');
  if (!report.compliance_checklist) errors.push('Missing compliance_checklist');
  if (!Array.isArray(report.leverage_points)) errors.push('leverage_points must be an array');
  if (!report.strategy) errors.push('Missing strategy');
  if (!report.recovery_estimate) errors.push('Missing recovery_estimate');
  if (!report.disclaimers?.primary) errors.push('Missing disclaimers.primary');

  return { valid: errors.length === 0, errors };
}

module.exports = { buildCaseAnalysisReport, validateReport };
