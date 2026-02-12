// server/src/lib/CaseAnalysisService.js

const { indexLeaseClauses } = require("./leaseClauseIndexer");
const { detectIssues } = require("./issueDetectors");
const { parseISO, differenceInCalendarDays, isValid } = require('date-fns');

/**
 * Core analysis orchestrator.
 *
 * Expected input shape (from caseStore):
 * {
 *   intake: {
 *     move_out_information: { move_out_date, forwarding_address_provided, ... },
 *     security_deposit_information: { deposit_amount, deposit_returned, amount_returned, ... },
 *     post_move_out_communications: { itemized_deductions_received, ... },
 *     ...
 *   },
 *   leaseText?: string
 * }
 */
function buildCaseAnalysisReport(caseData) {
  if (!caseData || !caseData.intake) {
    throw new Error("Invalid case data: missing intake");
  }

  const intake = caseData.intake;
  const leaseText = caseData.leaseText || "";

  // ─────────────────────────────────────────────
  // Timeline
  // ─────────────────────────────────────────────
  const moveOutRaw = intake.move_out_information?.move_out_date || null;
  let daysSinceMoveOut = null;
  let past30Days = null;

  // Calculate timeline with timezone-aware date arithmetic
  if (moveOutRaw) {
    try {
      let moveOutDate = parseISO(moveOutRaw);
      if (!isValid(moveOutDate)) {
        moveOutDate = new Date(moveOutRaw);
      }

      if (isValid(moveOutDate)) {
        const today = new Date();
        // Use calendar day difference (not time-based milliseconds)
        daysSinceMoveOut = differenceInCalendarDays(today, moveOutDate);
        past30Days = daysSinceMoveOut > 30;
      }
    } catch (error) {
      console.error('Timeline calculation error:', error);
    }
  }

  const timeline = {
    move_out_date: moveOutRaw,
    days_since_move_out: daysSinceMoveOut,
    past_30_days: past30Days
  };

  // ─────────────────────────────────────────────
  // Compliance (using canonical field names from intake schema)
  // ─────────────────────────────────────────────
  const securityDeposit = intake.security_deposit_information || {};
  const postMoveOut = intake.post_move_out_communications || {};

  const depositReturned = securityDeposit.deposit_returned;
  const amountReturned = parseFloat(String(securityDeposit.amount_returned || "0").replace(/[^0-9.]/g, "")) || 0;

  const compliance_checklist = {
    deposit_returned: depositReturned === "yes" || amountReturned > 0,
    itemization_provided: postMoveOut.itemized_deductions_received === "yes",
    refund_within_30_days:
      depositReturned === "yes" && daysSinceMoveOut !== null
        ? daysSinceMoveOut <= 30
        : false
  };

  // ─────────────────────────────────────────────
  // Lease clause indexing
  // ─────────────────────────────────────────────
  const lease_clause_citations = leaseText
    ? indexLeaseClauses(leaseText)
    : [];

  // ─────────────────────────────────────────────
  // Issue detection
  // ─────────────────────────────────────────────
  const detectedIssues = detectIssues(
    intake,
    timeline,
    lease_clause_citations
  );

  const leverage_points = detectedIssues.map((issue, i) => ({
    rank: i + 1,
    ...issue
  }));

  const procedural_steps = detectedIssues.flatMap(
    issue => issue.recommended_steps || []
  );

  // ─────────────────────────────────────────────
  // Statutes (TX MVP)
  // ─────────────────────────────────────────────
  const statutory_references = [
    { citation: "Tex. Prop. Code § 92.103", topic: "Deposit refund deadline" },
    { citation: "Tex. Prop. Code § 92.104", topic: "Itemized deductions" },
    { citation: "Tex. Prop. Code § 92.109", topic: "Landlord liability" }
  ];

  // ─────────────────────────────────────────────
  // Final report
  // ─────────────────────────────────────────────
  return {
    report_metadata: {
      case_id: intake.case_id || null,
      jurisdiction: intake.jurisdiction || "TX",
      generated_at: new Date().toISOString()
    },
    timeline,
    compliance_checklist,
    leverage_points,
    statutory_references,
    lease_clause_citations,
    procedural_steps,
    disclaimers: {
      primary:
        "This report is provided for informational and document preparation purposes only and does not constitute legal advice."
    }
  };
}

/**
 * Validate report structure
 * Returns { valid: boolean, errors: string[] }
 */
function validateReport(report) {
  const errors = [];

  if (!report) {
    return { valid: false, errors: ["Report is null or undefined"] };
  }

  if (!report.report_metadata) {
    errors.push("Missing report_metadata");
  }

  if (!report.timeline) {
    errors.push("Missing timeline");
  }

  if (!report.compliance_checklist) {
    errors.push("Missing compliance_checklist");
  }

  if (!Array.isArray(report.leverage_points)) {
    errors.push("leverage_points must be an array");
  }

  if (!Array.isArray(report.statutory_references)) {
    errors.push("statutory_references must be an array");
  }

  if (!report.disclaimers || !report.disclaimers.primary) {
    errors.push("Missing disclaimers.primary");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  buildCaseAnalysisReport,
  validateReport
};
