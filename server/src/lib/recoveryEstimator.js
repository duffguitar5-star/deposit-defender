/**
 * Recovery Estimator
 *
 * Calculates realistic recovery estimates based on deposit amount and case strength.
 * All multipliers, probability distributions, and confidence notes are read from
 * RECOVERY_BANDS in leverageScoring — no threshold constants live here.
 *
 * RECOVERY CAP: Maximum displayed is 100% of the security deposit plus any
 * pet deposit paid, plus the $100 statutory penalty under § 92.109(a).
 * This is a conservative, realistic estimate for a tenant self-help tool.
 *
 * Note: Texas Property Code § 92.109(a) does allow additional damages if bad faith
 * is proven in court, but quantifying those requires legal proceedings and is beyond
 * the scope of this informational tool. Tenants seeking full statutory remedies
 * should consult a licensed Texas attorney.
 *
 * IMPORTANT: All outputs are informational estimations only. Not legal advice.
 */

const { getRecoveryBand } = require('./leverageScoring');

/**
 * Parse a dollar amount string to a float.
 */
function parseAmount(str) {
  if (!str) return 0;
  const num = parseFloat(String(str).replace(/[^0-9.]/g, ''));
  return isNaN(num) ? 0 : num;
}

/**
 * Format a number as currency string.
 */
function formatCurrency(amount) {
  if (!amount || amount <= 0) return '$0';
  return '$' + Math.round(amount).toLocaleString('en-US');
}

/**
 * Estimate recovery range based on case facts.
 *
 * All threshold-dependent values (multipliers, probability distributions,
 * confidence notes) are derived from RECOVERY_BANDS via getRecoveryBand().
 * Only non-threshold logic (statutory penalty applicability, capping) lives here.
 *
 * @param {string}      depositAmount        Security deposit (e.g. "$1,500")
 * @param {string|null} petDepositAmount      Pet deposit if any (e.g. "$300")
 * @param {number}      leverageScore         0-100 case_strength_score
 * @param {number}      daysSinceMoveOut      Days elapsed since move-out
 * @param {boolean}     past30Days            Whether 30-day deadline has passed
 * @param {string}      depositReturnedStatus 'yes' | 'no' | 'partial'
 * @param {string|null} amountReturned        Amount already returned
 * @returns {object}                          recovery estimate object
 */
function estimateRecovery(
  depositAmount,
  petDepositAmount,
  leverageScore,
  daysSinceMoveOut,
  past30Days,
  depositReturnedStatus,
  amountReturned
) {
  const securityDeposit = parseAmount(depositAmount);
  const petDeposit      = parseAmount(petDepositAmount);
  const totalDeposit    = securityDeposit + petDeposit;
  const alreadyReturned = parseAmount(amountReturned);
  const amountStillOwe  = Math.max(0, totalDeposit - alreadyReturned);

  if (totalDeposit <= 0) {
    return {
      deposit_amount:        '$0',
      pet_deposit_amount:    petDeposit > 0 ? formatCurrency(petDeposit) : null,
      total_deposit:         '$0',
      amount_already_returned: formatCurrency(alreadyReturned),
      amount_still_owed:     '$0',
      best_case:             '$0',
      likely_case:           '$0',
      worst_case:            '$0',
      statutory_penalty:     '$0',
      confidence_note:       'No deposit amount provided.',
      probability_distribution: { full_recovery: 0, partial_recovery: 0, no_recovery: 100 },
    };
  }

  // Statutory penalty under § 92.109(a): $100 if landlord acted in bad faith.
  // Applicable only once the deadline has passed and score clears 60.
  const statutoryPenalty = past30Days && leverageScore >= 60 ? 100 : 0;

  // ─── Look up all financial multipliers from the single-source table ───────
  const band = getRecoveryBand(leverageScore);

  // BEST CASE: full amount still owed + $100 penalty (if applicable)
  const bestCase = amountStillOwe + statutoryPenalty;

  // LIKELY CASE: multiplier from RECOVERY_BANDS; penalty added when band flag set
  const likelyBase  = amountStillOwe * band.likelyMult;
  const likelyCase  = band.likelyAddsPenalty && past30Days
    ? likelyBase + statutoryPenalty
    : likelyBase;

  // WORST CASE: worst-case multiplier from RECOVERY_BANDS
  const worstCase = amountStillOwe * band.worstMult;

  // PROBABILITY DISTRIBUTION: from RECOVERY_BANDS
  const probabilities = {
    full_recovery:    band.probFull,
    partial_recovery: band.probPartial,
    no_recovery:      band.probNone,
  };

  return {
    deposit_amount:          formatCurrency(securityDeposit),
    pet_deposit_amount:      petDeposit > 0 ? formatCurrency(petDeposit) : null,
    total_deposit:           formatCurrency(totalDeposit),
    amount_already_returned: alreadyReturned > 0 ? formatCurrency(alreadyReturned) : null,
    amount_still_owed:       formatCurrency(amountStillOwe),

    best_case:   formatCurrency(bestCase),
    likely_case: formatCurrency(likelyCase),
    worst_case:  formatCurrency(worstCase),

    statutory_penalty: statutoryPenalty > 0 ? formatCurrency(statutoryPenalty) : '$0',
    statutory_penalty_basis: statutoryPenalty > 0
      ? 'Tex. Prop. Code § 92.109(a): $100 penalty applicable when landlord fails to meet statutory deadline'
      : null,

    probability_distribution: probabilities,
    confidence_note:          band.confidenceNote,

    disclaimer:
      'These are informational estimates only. Actual recovery depends on many factors including ' +
      'court proceedings, landlord response, and specific facts. This is not legal advice.',
  };
}

module.exports = { estimateRecovery, parseAmount, formatCurrency };
