/**
 * Leverage Scoring Engine
 *
 * Calculates a quantified case strength score (0-100) and exposes the
 * SCORE_BANDS / RECOVERY_BANDS tables that are the single source of truth
 * for every score-derived output in the pipeline.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * MASTER MAPPING TABLE
 *
 * Position / Grade / Action  (boundaries: 75 · 50 · 25 · 0)
 * ┌──────────┬───────┬────────────┬───────────────────────────────────────────┐
 * │ Score    │ Grade │ Position   │ Recommended Action                        │
 * ├──────────┼───────┼────────────┼───────────────────────────────────────────┤
 * │ 90–100   │ A     │ STRONG     │ SEND_DEMAND_LETTER         (urgency: HIGH) │
 * │ 75–89    │ B     │ STRONG     │ SEND_DEMAND_LETTER         (urgency: HIGH) │
 * │ 50–74    │ C     │ MODERATE   │ REQUEST_ITEMIZATION_OR_NEGOTIATE  (MEDIUM) │
 * │ 25–49    │ D     │ WEAK       │ GATHER_EVIDENCE_THEN_EVALUATE     (LOW)    │
 * │  0–24    │ F     │ UNCERTAIN  │ REVIEW_SITUATION                  (LOW)    │
 * └──────────┴───────┴────────────┴───────────────────────────────────────────┘
 *
 * Recovery multipliers  (sub-bands: 80 · 65 · 50 · 25 · 0)
 * ┌──────────┬─────────────┬───────────┬──────────┬─────────────┬──────────┐
 * │ Score    │ likelyMult  │ worstMult │ probFull │ probPartial │ probNone │
 * ├──────────┼─────────────┼───────────┼──────────┼─────────────┼──────────┤
 * │ 80–100   │ 1.00+penalty│ 0.75      │ 70       │ 25          │ 5        │
 * │ 65–79    │ 0.80        │ 0.50      │ 50       │ 40          │ 10       │
 * │ 50–64    │ 0.80        │ 0.30      │ 30       │ 50          │ 20       │
 * │ 25–49    │ 0.50        │ 0.00      │ 15       │ 45          │ 40       │
 * │  0–24    │ 0.25        │ 0.00      │  5       │ 30          │ 65       │
 * └──────────┴─────────────┴───────────┴──────────┴─────────────┴──────────┘
 *
 * HIGH-severity invariant
 * ───────────────────────
 * HIGH-severity detectors may fire either past OR within the 30-day window:
 *   - deadline_missed_full_deposit:        requires past_30_days = true  (≥ 18 pts timeline)
 *   - deadline_missed_no_itemization_only: requires past_30_days = true  (≥ 18 pts timeline)
 *   - within_30_days_deposit_withheld:     fires within 30 days          (≥ 20 pts timeline)
 * HIGH issue boost:                                                       + 10 pts.
 * Minimum total when any HIGH issue fires:              ≥ 30 pts → WEAK (≥ 25).
 * Therefore: HIGH severity issue ⟹ position ∈ {STRONG, MODERATE, WEAK} ≠ UNCERTAIN.
 *
 * IMPORTANT: All outputs are informational estimations only. Not legal advice.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const SEVERITY = { HIGH: 'high', MEDIUM: 'medium', LOW: 'low' };

// ─────────────────────────────────────────────────────────────────────────────
// SCORE_BANDS — single source of truth for position / grade / action / urgency.
// Ordered highest to lowest; getScoreBand() returns the first matching entry.
// ─────────────────────────────────────────────────────────────────────────────
const SCORE_BANDS = [
  {
    minScore: 75,
    grade:    'B',          // A assigned at 90+ by getLeverageGrade special-case
    position: 'STRONG',
    action:   'SEND_DEMAND_LETTER',
    urgency:  'HIGH',
  },
  {
    minScore: 50,
    grade:    'C',
    position: 'MODERATE',
    action:   'REQUEST_ITEMIZATION_OR_NEGOTIATE',
    urgency:  'MEDIUM',
  },
  {
    minScore: 25,
    grade:    'D',
    position: 'WEAK',
    action:   'GATHER_EVIDENCE_THEN_EVALUATE',
    urgency:  'LOW',
  },
  {
    minScore: 0,
    grade:    'F',
    position: 'UNCERTAIN',
    action:   'REVIEW_SITUATION',
    urgency:  'LOW',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// RECOVERY_BANDS — single source of truth for financial projections.
// Sub-bands at 80 / 65 within the STRONG and MODERATE position zones allow
// finer-grained recovery differentiation without duplicating any value.
// ─────────────────────────────────────────────────────────────────────────────
const RECOVERY_BANDS = [
  {
    minScore:          80,
    likelyMult:        1.00,   // 100% of amount still owed
    likelyAddsPenalty: true,   // + $100 statutory penalty when applicable
    worstMult:         0.75,
    probFull:          70,
    probPartial:       25,
    probNone:           5,
    confidenceNote:    'Strong case. Full recovery is likely with proper documentation and follow-through.',
  },
  {
    minScore:          65,
    likelyMult:        0.80,
    likelyAddsPenalty: false,
    worstMult:         0.50,
    probFull:          50,
    probPartial:       40,
    probNone:          10,
    confidenceNote:    'Moderate-to-strong case. Outcome depends on landlord response and any claimed deductions.',
  },
  {
    minScore:          50,
    likelyMult:        0.80,
    likelyAddsPenalty: false,
    worstMult:         0.30,
    probFull:          30,
    probPartial:       50,
    probNone:          20,
    confidenceNote:    'Moderate case. Recovery is possible but involves some uncertainty.',
  },
  {
    minScore:          25,
    likelyMult:        0.50,
    likelyAddsPenalty: false,
    worstMult:         0.00,
    probFull:          15,
    probPartial:       45,
    probNone:          40,
    confidenceNote:    'Case strength is limited based on information provided. Additional facts may change this assessment.',
  },
  {
    minScore:          0,
    likelyMult:        0.25,
    likelyAddsPenalty: false,
    worstMult:         0.00,
    probFull:           5,
    probPartial:       30,
    probNone:          65,
    confidenceNote:    'Case strength is limited based on information provided. Additional facts may change this assessment.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Band lookup helpers — pure functions of score, no side effects.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return the SCORE_BANDS entry that governs this score.
 * Used by strategyEngine and any module that needs position / action / urgency.
 *
 * @param {number} score  case_strength_score (0–100)
 * @returns {object}      matching SCORE_BANDS entry
 */
function getScoreBand(score) {
  return SCORE_BANDS.find((b) => score >= b.minScore);
}

/**
 * Return the RECOVERY_BANDS entry that governs this score.
 * Used by recoveryEstimator for multipliers and probability distribution.
 *
 * @param {number} score  case_strength_score (0–100)
 * @returns {object}      matching RECOVERY_BANDS entry
 */
function getRecoveryBand(score) {
  return RECOVERY_BANDS.find((b) => score >= b.minScore);
}

// ─────────────────────────────────────────────────────────────────────────────
// Score calculation — the raw inputs that produce case_strength_score.
// This function is the only place raw factors (timeline, evidence, issues) are
// weighted; all downstream modules consume the resulting scalar.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate leverage score (0-100) based on case factors.
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

  // ─── TIMELINE FACTORS (max 40 pts) ───────────────────────────────────────
  // Each branch maps to a distinct statutory state under Tex. Prop. Code § 92.103.
  // Only one branch fires per case (most-specific first).

  if (past30Days && !depositReturned && !itemizationProvided) {
    // Clearest § 92.103 + § 92.109 violation: deadline passed, zero response.
    score += 40;
  } else if (past30Days && depositReturnedRaw === 'partial' && !itemizationProvided) {
    // Partial refund, no written itemization (§ 92.104).
    score += 30;
  } else if (past30Days && !isFullyReturned && itemizationProvided) {
    // Deadline missed but landlord provided itemization — weaker violation.
    score += 18;
  } else if (past30Days && !depositReturned) {
    // Deadline missed, deposit not returned (itemization state unclear).
    score += 25;
  } else if (!past30Days && !depositReturned && !itemizationProvided && daysSinceMoveOut >= 20) {
    // Imminent § 92.103 violation: <10 days remain, landlord has neither returned
    // deposit nor provided written itemization. Score at post-deadline level.
    score += 40;
  } else if (!past30Days && !depositReturned && !itemizationProvided && daysSinceMoveOut >= 1) {
    // Approaching deadline: landlord withholding deposit with >10 days remaining.
    score += 20;
  } else if (!past30Days && daysSinceMoveOut >= 20) {
    // Approaching deadline — monitor, no clear violation (deposit situation unclear).
    score += 8;
  }

  // ─── LANDLORD BEHAVIOR (max 30 pts) ──────────────────────────────────────
  // countBadFaithIndicators returns an array of indicator strings; use .length
  // to get the numeric count.  (Multiplying an array by 8 yields NaN — that was
  // a pre-existing silent bug that caused score corruption when indicators fired.)
  const badFaithIndicatorList = countBadFaithIndicators(intake, timeline);
  score += Math.min(badFaithIndicatorList.length * 8, 25);

  if (past30Days && daysSinceMoveOut >= 45 && !depositReturned && !itemizationProvided) {
    score += 5; // Extended silence bonus
  }

  // ─── TENANT COMPLIANCE (max 20 pts) ──────────────────────────────────────
  if (forwardingProvided) score += 10; // § 92.107 requirement met — clock was running

  if (past30Days && forwardingProvided && !depositReturned) {
    score += 8; // Strongest factual position: tenant complied, landlord did not
  }

  if (!past30Days && forwardingProvided && !depositReturned && !itemizationProvided) {
    score += 15; // Approaching deadline: tenant complied fully, landlord has not responded
  }

  const hasLeaseDocument = !!(intake._leaseText || intake.leaseFile);
  if (hasLeaseDocument) score += 5;

  if (postMoveOut.communication_methods_used && postMoveOut.communication_methods_used.length > 0) {
    score += 5;
  }

  // ─── ISSUE SEVERITY BOOST (max 20 pts) ───────────────────────────────────
  // HIGH-severity issues guarantee a minimum total ≥ 30 pts, making UNCERTAIN
  // position impossible when any HIGH-severity issue is detected.
  // (See invariant comment at top of file.)
  const highSeverityCount  = (detectedIssues || []).filter((i) => i.severity === SEVERITY.HIGH).length;
  const mediumSeverityCount = (detectedIssues || []).filter((i) => i.severity === SEVERITY.MEDIUM).length;

  score += Math.min(highSeverityCount * 10, 20);
  score += Math.min(mediumSeverityCount * 3, 10);

  return Math.min(Math.max(Math.round(score), 0), 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// Derived outputs — all pure functions of case_strength_score
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assign letter grade. Reads from SCORE_BANDS; special-cases A at 90+.
 */
function getLeverageGrade(score) {
  if (score >= 90) return 'A';
  return getScoreBand(score).grade;
}

/**
 * Get strategic position label. Reads from SCORE_BANDS.
 * Thresholds are identical to strategyEngine.determineStrategy by design.
 */
function getStrategicPosition(score) {
  return getScoreBand(score).position;
}

/**
 * Estimate win probability (5–95%) based on score and context.
 * Formula: score × 0.85 gives the base probability percentage.
 *
 * @param {number} leverageScore - 0-100 leverage score
 * @param {object} intake        - Normalized intake data
 * @param {object} [timeline]    - Timeline object (optional, enables deadline floor)
 */
function estimateWinProbability(leverageScore, intake, timeline) {
  const forwardingProvided =
    intake.move_out_information?.forwarding_address_provided === 'yes' ||
    intake.move_out_information?.forwarding_address_provided === true;

  let prob = leverageScore * 0.85;
  if (forwardingProvided) prob *= 1.1;
  if (intake._leaseText)  prob  = Math.min(prob * 1.05, 95);

  // Approaching-deadline floor: when within 30 days but already past day 20,
  // deposit is withheld, and no itemization — a § 92.103 violation is highly
  // likely to materialise within days. Score is low because no violation exists
  // yet, not because the case is weak. Apply a 40% floor to reflect this.
  if (timeline) {
    const past30Days       = timeline.past_30_days === true;
    const daysSinceMoveOut = timeline.days_since_move_out || 0;
    const secDeposit       = intake.security_deposit_information || {};
    const postMoveOut      = intake.post_move_out_communications || {};
    const depositWithheld  = secDeposit.deposit_returned !== 'yes';
    const noItemization    = postMoveOut.itemized_deductions_received !== 'yes';

    if (!past30Days && daysSinceMoveOut >= 20 && depositWithheld && noItemization) {
      prob = Math.max(prob, 40);
    }
  }

  return Math.min(Math.max(Math.round(prob), 5), 95);
}

// ─────────────────────────────────────────────────────────────────────────────
// Evidence quality assessment (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

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
  if      (evidenceScore >= 9) overall = 'strong';
  else if (evidenceScore >= 6) overall = 'moderate';
  else if (evidenceScore >= 3) overall = 'weak';
  else                          overall = 'minimal';

  return { overall_strength: overall, items };
}

// ─────────────────────────────────────────────────────────────────────────────
// Bad faith indicator detection (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

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

function getBadFaithIndicators(intake, timeline) {
  return countBadFaithIndicators(intake, timeline);
}

module.exports = {
  // Score calculation
  calculateLeverageScore,
  // Band lookups — exported so strategyEngine and recoveryEstimator use these
  // tables rather than maintaining their own threshold copies
  SCORE_BANDS,
  RECOVERY_BANDS,
  getScoreBand,
  getRecoveryBand,
  // Derived outputs (all functions of case_strength_score)
  getLeverageGrade,
  getStrategicPosition,
  estimateWinProbability,
  assessEvidenceQuality,
  getBadFaithIndicators,
};
