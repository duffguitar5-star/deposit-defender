/**
 * Leverage Scoring Engine
 *
 * Calculates a quantified case strength score (0-100) and grade (A-F)
 * based on timeline, evidence, landlord behavior, and legal clarity.
 *
 * IMPORTANT: All outputs are informational estimations only.
 * Not legal advice.
 */

const SEVERITY = { HIGH: 'high', MEDIUM: 'medium', LOW: 'low' };

/**
 * Calculate leverage score (0-100) based on case factors
 */
function calculateLeverageScore(intake, timeline, detectedIssues) {
  let score = 0;

  const daysSinceMoveOut = timeline.days_since_move_out || 0;
  const past30Days = timeline.past_30_days === true;

  const secDeposit = intake.security_deposit_information || {};
  const postMoveOut = intake.post_move_out_communications || {};
  const moveOutInfo = intake.move_out_information || {};

  const depositReturnedRaw = secDeposit.deposit_returned;
  const depositReturned = depositReturnedRaw === true || depositReturnedRaw === 'yes' || depositReturnedRaw === 'partial';
  const isFullyReturned = depositReturnedRaw === 'yes';
  const itemizationProvided = postMoveOut.itemized_deductions_received === true || postMoveOut.itemized_deductions_received === 'yes';
  const forwardingProvided = moveOutInfo.forwarding_address_provided === true || moveOutInfo.forwarding_address_provided === 'yes';
  const tenantNotes = (intake.additional_notes?.tenant_notes || '').toLowerCase();

  // ─────────────────────────────────────────────────────────────
  // TIMELINE FACTORS (max 40 points)
  //
  // Each branch maps to a distinct statutory state under Tex. Prop. Code § 92.103.
  // Only one branch fires per case (most-specific first).
  // ─────────────────────────────────────────────────────────────

  if (past30Days && !depositReturned && !itemizationProvided) {
    // Clearest § 92.103 + § 92.109 violation: deadline passed with zero response.
    // Landlord neither returned the deposit nor provided written itemization.
    score += 40;
  } else if (past30Days && depositReturnedRaw === 'partial' && !itemizationProvided) {
    // Partial refund returned but no written explanation of deductions (§ 92.104).
    score += 30;
  } else if (past30Days && !isFullyReturned && itemizationProvided) {
    // Deadline missed but landlord provided itemization — weaker violation.
    score += 18;
  } else if (past30Days && !depositReturned) {
    // Deadline missed, deposit not returned (itemization state unclear).
    score += 25;
  } else if (!past30Days && daysSinceMoveOut >= 20) {
    // Approaching 30-day deadline — monitor but no violation yet.
    score += 8;
  }

  // ─────────────────────────────────────────────────────────────
  // LANDLORD BEHAVIOR FACTORS (max 30 points)
  // ─────────────────────────────────────────────────────────────

  const badFaithCount = countBadFaithIndicators(intake, timeline);
  score += Math.min(badFaithCount * 8, 25); // Up to 25 pts for bad faith

  // No response at all at or past 45 days is very strong evidence of bad faith.
  // >= 45 (not strictly >) so a case at exactly 45 days qualifies.
  if (past30Days && daysSinceMoveOut >= 45 && !depositReturned && !itemizationProvided) {
    score += 5; // Extended silence bonus
  }

  // ─────────────────────────────────────────────────────────────
  // TENANT COMPLIANCE FACTORS (max 20 points)
  // ─────────────────────────────────────────────────────────────

  if (forwardingProvided) {
    // Tenant fulfilled the § 92.107 requirement — the 30-day clock was running.
    score += 10;
  }

  // Compound condition: forwarding address confirmed AND deadline already passed AND no refund.
  // This is the strongest possible factual position — tenant did everything right,
  // landlord has no excuse for the delay.
  if (past30Days && forwardingProvided && !depositReturned) {
    score += 8;
  }

  const hasLeaseDocument = !!(intake._leaseText || intake.leaseFile);
  if (hasLeaseDocument) score += 5; // Lease document strengthens deposit amount proof

  if (postMoveOut.communication_methods_used && postMoveOut.communication_methods_used.length > 0) {
    score += 5; // Tenant attempted follow-up
  }

  // ─────────────────────────────────────────────────────────────
  // ISSUE SEVERITY BOOST (max 20 points)
  // ─────────────────────────────────────────────────────────────

  const highSeverityCount = (detectedIssues || []).filter(i => i.severity === SEVERITY.HIGH).length;
  const mediumSeverityCount = (detectedIssues || []).filter(i => i.severity === SEVERITY.MEDIUM).length;

  score += Math.min(highSeverityCount * 10, 20);
  score += Math.min(mediumSeverityCount * 3, 10);

  return Math.min(Math.max(Math.round(score), 0), 100);
}

/**
 * Detect bad faith indicators from case data
 * Returns array of indicator strings
 */
function countBadFaithIndicators(intake, timeline) {
  const indicators = [];
  const daysSinceMoveOut = timeline.days_since_move_out || 0;
  const past30Days = timeline.past_30_days === true;
  const secDeposit = intake.security_deposit_information || {};
  const postMoveOut = intake.post_move_out_communications || {};
  const depositReturnedRaw = secDeposit.deposit_returned;

  if (daysSinceMoveOut >= 45 && depositReturnedRaw !== 'yes' && postMoveOut.itemized_deductions_received !== 'yes') {
    indicators.push('No refund or itemization after 45+ days');
  }

  if (past30Days && depositReturnedRaw !== 'yes' && depositReturnedRaw !== 'partial') {
    if (postMoveOut.communication_methods_used && postMoveOut.communication_methods_used.length >= 2) {
      indicators.push('No response to multiple tenant follow-ups');
    }
  }

  if (past30Days && depositReturnedRaw !== 'yes' && postMoveOut.itemized_deductions_received !== 'yes') {
    indicators.push('Zero communication about deposit after deadline passed');
  }

  return indicators;
}

/**
 * Get bad faith indicator strings for report
 */
function getBadFaithIndicators(intake, timeline) {
  return countBadFaithIndicators(intake, timeline);
}

/**
 * Assign letter grade based on score.
 * Thresholds align with strategy action thresholds (75/50/25) for consistency.
 */
function getLeverageGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B'; // STRONG: demand letter territory
  if (score >= 50) return 'C'; // MODERATE: negotiation territory
  if (score >= 25) return 'D'; // WEAK: gather evidence territory
  return 'F';
}

/**
 * Get strategic position label.
 * Thresholds MUST align with strategyEngine.determineStrategy thresholds:
 *   75 → SEND_DEMAND_LETTER     → STRONG
 *   50 → REQUEST_ITEMIZATION    → MODERATE
 *   25 → GATHER_EVIDENCE        → WEAK
 *  <25 → REVIEW_SITUATION       → UNCERTAIN
 */
function getStrategicPosition(score) {
  if (score >= 75) return 'STRONG';
  if (score >= 50) return 'MODERATE';
  if (score >= 25) return 'WEAK';
  return 'UNCERTAIN';
}

/**
 * Estimate win probability (5-95%) based on score and context.
 *
 * Formula: leverageScore * 0.85 gives the base probability percentage.
 * At score 75 (STRONG): ~64% base → ~70% with forwarding confirmed.
 * At score 50 (MODERATE): ~43% base → ~47% with forwarding confirmed.
 * Floor of 5% prevents displaying 0% for any case with data.
 */
function estimateWinProbability(leverageScore, intake) {
  const forwardingProvided = intake.move_out_information?.forwarding_address_provided === 'yes' ||
                              intake.move_out_information?.forwarding_address_provided === true;

  let prob = leverageScore * 0.85; // Base: leverage score maps to win probability

  // Boost if tenant confirmed forwarding address — proves § 92.107 clock was running
  if (forwardingProvided) prob *= 1.1;

  // NOTE: intake._leaseText is injected by CaseAnalysisService from caseData.leaseText.
  // If present, boost slightly (stronger evidence of deposit amount and terms).
  if (intake._leaseText) prob = Math.min(prob * 1.05, 95);

  return Math.min(Math.max(Math.round(prob), 5), 95);
}

/**
 * Assess evidence quality from intake
 */
function assessEvidenceQuality(intake) {
  let evidenceScore = 0;
  const items = [];

  const postMoveOut = intake.post_move_out_communications || {};
  const moveOutInfo = intake.move_out_information || {};

  if (intake._leaseText || intake.leaseFile) {
    evidenceScore += 3;
    items.push({ type: 'lease_document', present: true, strength: 'strong', critical: true });
  } else {
    items.push({ type: 'lease_document', present: false, strength: null, critical: true });
  }

  if (moveOutInfo.forwarding_address_provided === 'yes' || moveOutInfo.forwarding_address_provided === true) {
    evidenceScore += 3;
    items.push({ type: 'forwarding_address_proof', present: true, strength: 'strong', critical: true });
  } else {
    items.push({ type: 'forwarding_address_proof', present: false, strength: null, critical: true });
  }

  if (postMoveOut.communication_methods_used && postMoveOut.communication_methods_used.length > 0) {
    evidenceScore += 2;
    items.push({ type: 'communication_trail', present: true, strength: 'moderate', critical: false });
  } else {
    items.push({ type: 'communication_trail', present: false, strength: null, critical: false });
  }

  const notes = (intake.additional_notes?.tenant_notes || '').toLowerCase();
  const hasPhotoMention = /photo|picture|pic|image|record|document/i.test(notes);
  if (hasPhotoMention) {
    evidenceScore += 1;
    items.push({ type: 'move_out_photos', present: true, strength: 'moderate', critical: false });
  } else {
    items.push({ type: 'move_out_photos', present: false, strength: null, critical: false });
  }

  const secDeposit = intake.security_deposit_information || {};
  if (secDeposit.deposit_paid_date || secDeposit.deposit_amount) {
    evidenceScore += 2;
    items.push({ type: 'deposit_payment_proof', present: true, strength: 'strong', critical: true });
  } else {
    items.push({ type: 'deposit_payment_proof', present: false, strength: null, critical: true });
  }

  let overall;
  if (evidenceScore >= 9) overall = 'strong';
  else if (evidenceScore >= 6) overall = 'moderate';
  else if (evidenceScore >= 3) overall = 'weak';
  else overall = 'minimal';

  return { overall_strength: overall, items };
}

module.exports = {
  calculateLeverageScore,
  getLeverageGrade,
  getStrategicPosition,
  estimateWinProbability,
  assessEvidenceQuality,
  getBadFaithIndicators,
};
