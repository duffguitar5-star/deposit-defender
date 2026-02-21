/**
 * Issue Detectors (V1 Core — 4 detectors)
 *
 * Detects compliance issues from case data and produces enriched leverage points.
 * Each detector evaluates one specific scenario and returns structured output.
 *
 * Removed in V1: within_30_days_no_response, cleaning_deduction_concern,
 *                lease_extended_timeline (lease extraction removed)
 *
 * IMPORTANT: All outputs use informational language only. Not legal advice.
 */

const path = require('path');
const fs = require('fs');
const { parseISO, addDays, format, isValid } = require('date-fns');
const { utcToZonedTime } = require('date-fns-tz');
const logger = require('./logger');

// Load TX rules knowledge base
const rulesPath = path.join(__dirname, '..', '..', '..', 'ai', 'tx_security_deposit_rules.json');
const TX_RULES = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));

const SEVERITY = { HIGH: 'high', MEDIUM: 'medium', LOW: 'low' };

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────

function formatCurrency(amount) {
  if (!amount) return '$0';
  const num = parseFloat(String(amount).replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return String(amount);
  return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function parseRawAmount(str) {
  if (!str) return null;
  const match = String(str).match(/[\d,]+\.?\d*/);
  return match ? parseFloat(match[0].replace(/,/g, '')) : null;
}

function calculateDeadlineDate(moveOutDate, daysToAdd) {
  if (!moveOutDate) return 'unknown';
  try {
    let date = parseISO(moveOutDate);
    if (!isValid(date)) date = new Date(moveOutDate);
    if (!isValid(date)) return 'unknown';
    const texasTime = utcToZonedTime(date, 'America/Chicago');
    return format(addDays(texasTime, daysToAdd), 'MMM d, yyyy');
  } catch {
    return 'unknown';
  }
}

// ─────────────────────────────────────────────
// Evaluation Context
// Normalizes all intake booleans in one place
// ─────────────────────────────────────────────
class EvaluationContext {
  constructor(intake, timeline) {
    this.intake = intake;
    this.timeline = timeline;

    // Raw values for display
    this.depositAmount = intake.security_deposit_information?.deposit_amount;
    this.petDepositAmount = intake.security_deposit_information?.pet_deposit_amount || null;
    this.amountReturned = intake.security_deposit_information?.amount_returned;
    this.forwardingDate = intake.move_out_information?.forwarding_address_date;
    this.moveOutDate = intake.move_out_information?.move_out_date;
    this.tenantNotes = intake.additional_notes?.tenant_notes || '';

    // Timeline
    this.daysSinceMoveOut = timeline?.days_since_move_out ?? 0;
    this.past30Days = timeline?.past_30_days === true;

    // Canonical booleans — normalized from various input formats
    const depositRaw = intake.security_deposit_information?.deposit_returned;
    this.depositReturned = depositRaw === true || depositRaw === 'yes' || depositRaw === 'partial';
    this.isFullyReturned = depositRaw === 'yes';
    this.depositReturnedRaw = depositRaw;

    const itemizationRaw = intake.post_move_out_communications?.itemized_deductions_received;
    this.itemizationProvided = itemizationRaw === true || itemizationRaw === 'yes';

    const forwardingRaw = intake.move_out_information?.forwarding_address_provided;
    this.forwardingAddressProvided = forwardingRaw === true || forwardingRaw === 'yes';
  }
}

// ─────────────────────────────────────────────
// Core Detectors (4 for V1)
// ─────────────────────────────────────────────
const ISSUE_DETECTORS = [

  // ─────────────────────────────────────────────────────────────
  // DETECTOR 1: Deadline missed — no return AND no itemization
  // Highest priority: clearest statutory violation
  // ─────────────────────────────────────────────────────────────
  {
    id: 'deadline_missed_full_deposit',
    severity: SEVERITY.HIGH,
    rank_weight: 100,

    evaluate: (ctx) =>
      ctx.past30Days === true &&
      ctx.depositReturned === false &&
      ctx.itemizationProvided === false,

    build: (ctx) => {
      const depositDisplay = formatCurrency(ctx.depositAmount);
      const daysOver = ctx.daysSinceMoveOut - 30;

      return {
        title: `30-Day Deadline Passed — No Return or Itemization of ${depositDisplay} Deposit`,
        why_this_matters:
          `Your landlord has held your ${depositDisplay} deposit for ${ctx.daysSinceMoveOut} days ` +
          `without returning it or providing any written explanation of deductions. ` +
          `Texas Property Code § 92.103 requires landlords to act within 30 calendar days—` +
          `that deadline passed ${daysOver} day${daysOver !== 1 ? 's' : ''} ago. ` +
          `Under § 92.109, a landlord who fails to meet this deadline may lose the right to ` +
          `withhold any portion of the deposit and may be liable for additional amounts.`,

        supporting_facts: [
          { fact: `Move-out date: ${ctx.moveOutDate}`, source: 'tenant_intake' },
          { fact: `${ctx.daysSinceMoveOut} days have elapsed (deadline exceeded by ${daysOver} days)`, source: 'computed' },
          { fact: `Security deposit: ${depositDisplay}`, source: 'tenant_intake' },
          { fact: 'No refund received', source: 'tenant_intake' },
          { fact: 'No itemized deduction list received', source: 'tenant_intake' },
          ctx.forwardingAddressProvided
            ? { fact: `Forwarding address provided${ctx.forwardingDate ? ' on ' + ctx.forwardingDate : ''}`, source: 'tenant_intake' }
            : null,
        ].filter(Boolean),

        statute_citations: ['92.103', '92.104', '92.109'],

        recommended_steps: [
          {
            action: 'send_written_demand',
            description:
              `Send a written demand letter to your landlord via certified mail (return receipt requested). ` +
              `Include: your name, former property address, move-out date (${ctx.moveOutDate}), ` +
              `deposit amount (${depositDisplay}), your current mailing address, and a request for ` +
              `immediate return of the full deposit or a complete written itemization of any deductions. ` +
              `Keep copies of the letter and your certified mail receipt.`,
          },
          {
            action: 'document_timeline',
            description:
              `Write out a simple timeline: your move-out date, when you provided your forwarding ` +
              `address, any communications with your landlord, and today's date. This is important ` +
              `documentation if you need to escalate.`,
          },
        ],
      };
    },
  },

  // ─────────────────────────────────────────────────────────────
  // DETECTOR 2: Partial return received but no written itemization
  // ─────────────────────────────────────────────────────────────
  {
    id: 'deadline_missed_no_itemization_only',
    severity: SEVERITY.HIGH,
    rank_weight: 90,

    evaluate: (ctx) => {
      const depositNum = parseRawAmount(ctx.depositAmount);
      const returnedNum = parseRawAmount(ctx.amountReturned);
      const isPartialRefund =
        ctx.depositReturnedRaw === 'partial' ||
        (ctx.depositReturned && returnedNum !== null && depositNum !== null && returnedNum < depositNum);
      return ctx.past30Days === true && isPartialRefund && ctx.itemizationProvided === false;
    },

    build: (ctx) => {
      const depositDisplay = formatCurrency(ctx.depositAmount);
      const returnedDisplay = formatCurrency(ctx.amountReturned);
      const depositNum = parseRawAmount(ctx.depositAmount) || 0;
      const returnedNum = parseRawAmount(ctx.amountReturned) || 0;
      const withheld = formatCurrency(depositNum - returnedNum);

      return {
        title: `Partial Refund of ${returnedDisplay} Received — ${withheld} Withheld Without Itemization`,
        why_this_matters:
          `Your landlord returned ${returnedDisplay} of your ${depositDisplay} deposit but kept ` +
          `${withheld}—without providing a written explanation of what the deductions were for. ` +
          `Texas Property Code § 92.104 requires landlords to provide a written, itemized list of ` +
          `deductions when keeping any portion of a deposit. Without this itemization, you cannot ` +
          `verify whether the deductions were legitimate. Under § 92.109, failure to provide ` +
          `proper itemization may affect the landlord's right to retain those funds.`,

        supporting_facts: [
          { fact: `Move-out date: ${ctx.moveOutDate}`, source: 'tenant_intake' },
          { fact: `Original deposit: ${depositDisplay}`, source: 'tenant_intake' },
          { fact: `Amount returned: ${returnedDisplay}`, source: 'tenant_intake' },
          { fact: `Amount withheld without explanation: ${withheld}`, source: 'computed' },
          { fact: 'No itemized deduction list received', source: 'tenant_intake' },
          { fact: `${ctx.daysSinceMoveOut} days since move-out (past 30-day deadline)`, source: 'computed' },
        ],

        statute_citations: ['92.104', '92.109'],

        recommended_steps: [
          {
            action: 'request_itemization_letter',
            description:
              `Send a written request for the itemized list of deductions via certified mail. ` +
              `State that you received ${returnedDisplay} but have not received any written ` +
              `explanation for the ${withheld} withheld. Reference Texas Property Code § 92.104. ` +
              `Keep copies of your request and the certified mail receipt.`,
          },
          {
            action: 'gather_move_out_evidence',
            description:
              `Gather any photos from move-out, your move-in condition report, and any communications ` +
              `with the landlord about the property's condition. These will help you evaluate whether ` +
              `any itemization the landlord eventually provides is reasonable.`,
          },
        ],
      };
    },
  },

  // ─────────────────────────────────────────────────────────────
  // DETECTOR 2.5: Approaching deadline — deposit withheld, no itemization
  // Fires within the 30-day window when deposit is clearly being held.
  // HIGH severity because a § 92.103 violation is imminent and documentable.
  // ─────────────────────────────────────────────────────────────
  {
    id: 'within_30_days_deposit_withheld',
    severity: SEVERITY.HIGH,
    rank_weight: 95,

    evaluate: (ctx) =>
      ctx.past30Days === false &&
      ctx.daysSinceMoveOut >= 1 &&
      ctx.depositReturned === false &&
      ctx.itemizationProvided === false,

    build: (ctx) => {
      const depositDisplay = formatCurrency(ctx.depositAmount);
      const daysRemaining = Math.max(0, 30 - ctx.daysSinceMoveOut);
      const deadlineDate = calculateDeadlineDate(ctx.moveOutDate, 30);

      return {
        title: `${depositDisplay} Deposit Withheld — ${daysRemaining} Day${daysRemaining !== 1 ? 's' : ''} Until Statutory Deadline`,
        why_this_matters:
          `Your landlord has not returned your ${depositDisplay} deposit or provided any written ` +
          `explanation of deductions. Texas Property Code § 92.103 gives landlords 30 calendar days ` +
          `to return the deposit or provide a written itemization of deductions. That deadline is ` +
          `${deadlineDate}—${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} from now. ` +
          `Under § 92.109, a landlord who fails to meet this deadline in bad faith may lose the ` +
          `right to withhold any portion of the deposit and may face additional liability.`,

        supporting_facts: [
          { fact: `Move-out date: ${ctx.moveOutDate}`, source: 'tenant_intake' },
          { fact: `${ctx.daysSinceMoveOut} days elapsed — statutory deadline: ${deadlineDate}`, source: 'computed' },
          { fact: `Security deposit: ${depositDisplay}`, source: 'tenant_intake' },
          { fact: 'No refund received', source: 'tenant_intake' },
          { fact: 'No itemized deduction list received', source: 'tenant_intake' },
          ctx.forwardingAddressProvided
            ? { fact: `Forwarding address provided${ctx.forwardingDate ? ' on ' + ctx.forwardingDate : ''}`, source: 'tenant_intake' }
            : null,
        ].filter(Boolean),

        statute_citations: ['92.103', '92.104', '92.109'],

        recommended_steps: [
          {
            action: 'confirm_forwarding_address',
            description:
              `If you have not already done so, send your forwarding address to your landlord in ` +
              `writing today—certified mail is best. Under § 92.107, your landlord's 30-day clock ` +
              `runs from when they receive your forwarding address. Sending it now creates a clear ` +
              `paper trail and ensures the deadline is unambiguous.`,
          },
          {
            action: 'document_timeline',
            description:
              `Write out a simple timeline now: your move-out date, when you provided your forwarding ` +
              `address, any communications with your landlord, and the statutory deadline (${deadlineDate}). ` +
              `If the deadline passes without a refund or itemization, this documentation will ` +
              `support a written demand or small claims filing.`,
          },
        ],
      };
    },
  },

  // ─────────────────────────────────────────────────────────────
  // DETECTOR 3: Forwarding address not provided
  // May affect when 30-day clock started
  // ─────────────────────────────────────────────────────────────
  {
    id: 'no_forwarding_address',
    severity: SEVERITY.MEDIUM,
    rank_weight: 55,

    evaluate: (ctx) =>
      ctx.forwardingAddressProvided === false && ctx.depositReturned === false,

    build: (ctx) => {
      const depositDisplay = formatCurrency(ctx.depositAmount);

      return {
        title: 'Forwarding Address Not Yet Provided — 30-Day Clock May Not Have Started',
        why_this_matters:
          `Texas Property Code § 92.107 indicates that a landlord's obligation to return a deposit ` +
          `is tied to receiving the tenant's forwarding address. If you have not provided a ` +
          `forwarding address in writing, the 30-day refund deadline may not yet have started. ` +
          `Sending your address now creates a clear paper trail and starts the clock.`,

        supporting_facts: [
          { fact: `Move-out date: ${ctx.moveOutDate}`, source: 'tenant_intake' },
          { fact: `Security deposit: ${depositDisplay}`, source: 'tenant_intake' },
          { fact: 'Forwarding address not yet provided to landlord in writing', source: 'tenant_intake' },
        ],

        statute_citations: ['92.107', '92.103'],

        recommended_steps: [
          {
            action: 'send_forwarding_address_now',
            description:
              `Send your forwarding address today via certified mail with return receipt. ` +
              `Include your full name, the former property address, your move-out date (${ctx.moveOutDate}), ` +
              `and your new mailing address. Keep the certified mail receipt—it documents ` +
              `when you sent it and when the landlord received it.`,
          },
          {
            action: 'note_30_day_start',
            description:
              `The 30-day deadline runs from when the landlord receives your forwarding address. ` +
              `Note the delivery date on your certified mail receipt and count 30 days from that date. ` +
              `If no refund or itemization arrives by day 30, a written demand would be appropriate.`,
          },
        ],
      };
    },
  },

  // ─────────────────────────────────────────────────────────────
  // DETECTOR 4: Normal wear and tear concern
  // Tenant notes suggest potential wear/tear dispute
  // ─────────────────────────────────────────────────────────────
  {
    id: 'normal_wear_concern',
    severity: SEVERITY.MEDIUM,
    rank_weight: 70,

    evaluate: (ctx) => {
      // Only relevant if deposit was not fully returned
      if (ctx.isFullyReturned) return false;
      const wearKeywords = ['wear', 'tear', 'carpet', 'paint', 'scuff', 'faded', 'age', 'old', 'normal'];
      return wearKeywords.some(kw => ctx.tenantNotes.toLowerCase().includes(kw));
    },

    build: (ctx) => ({
      title: 'Potential Normal Wear and Tear Dispute',
      why_this_matters:
        `Your notes mention wear, carpet, paint, or similar items. Texas Property Code § 92.104(a) ` +
        `states that landlords cannot deduct for "normal wear and tear"—the gradual deterioration ` +
        `from ordinary, reasonable use. Faded paint, minor carpet wear from foot traffic, small ` +
        `scuff marks, and standard picture-hanging nail holes generally fall into this category. ` +
        `If your landlord charges for these items, you may have grounds to dispute those deductions.`,

      supporting_facts: [
        { fact: 'Your notes reference wear, carpet, paint, or similar items', source: 'tenant_intake' },
        {
          fact: ctx.depositReturnedRaw === 'partial'
            ? 'Deposit was partially returned'
            : 'Deposit was not returned',
          source: 'tenant_intake'
        },
      ],

      statute_citations: ['92.104'],

      recommended_steps: [
        {
          action: 'compare_photos',
          description:
            `Compare your move-in photos (or condition report, if you have one) with your move-out ` +
            `photos. Changes from normal daily living over months or years are typically normal wear, ` +
            `not damage you should pay for. Document this comparison in case you need it later.`,
        },
        {
          action: 'research_normal_wear',
          description:
            `Texas courts and tenant resources distinguish normal wear from damage. Examples: ` +
            `small nail holes, worn carpet paths, minor scuff marks = typically normal wear. ` +
            `Large holes, burns, intentional damage, or excessive filth = potentially chargeable damage. ` +
            `Keep this distinction in mind when reviewing any itemization you receive.`,
        },
      ],
    }),
  },
];

// ─────────────────────────────────────────────
// Main detection function
// ─────────────────────────────────────────────
function detectIssues(intake, timeline) {
  const ctx = new EvaluationContext(intake, timeline);
  const detected = [];

  for (const detector of ISSUE_DETECTORS) {
    try {
      if (detector.evaluate(ctx)) {
        const data = detector.build(ctx);
        detected.push({
          issue_id: detector.id,
          severity: detector.severity,
          rank_weight: detector.rank_weight,
          ...data,
        });
      }
    } catch (err) {
      logger.error('Issue detector failed', { detectorId: detector.id, error: err.message });
    }
  }

  // Sort by rank weight descending
  detected.sort((a, b) => b.rank_weight - a.rank_weight);

  logger.info(`Detected ${detected.length} issues:`, detected.map(i => i.issue_id));

  return detected;
}

// ─────────────────────────────────────────────
// Build enriched leverage points for report
// ─────────────────────────────────────────────
function buildEnrichedLeveragePoints(detectedIssues) {
  if (detectedIssues.length === 0) {
    return [{
      rank: 1,
      point_id: 'no_issues_detected',
      title: 'No Specific Issues Identified',
      why_this_matters: 'Based on the information provided, no specific compliance issues were detected. This may indicate the deposit was returned, the 30-day deadline has not yet passed, or additional information is needed.',
      supporting_facts: [],
      statute_citations: [],
      recommended_steps: [],
      severity: 'low',
    }];
  }

  return detectedIssues.map((issue, index) => ({
    rank: index + 1,
    point_id: issue.issue_id,
    title: issue.title,
    why_this_matters: issue.why_this_matters,
    supporting_facts: issue.supporting_facts,
    statute_citations: issue.statute_citations.map(id => ({
      rule_id: id,
      citation: TX_RULES.statutes?.[id]?.citation || `Tex. Prop. Code § ${id}`,
      title: TX_RULES.statutes?.[id]?.title || '',
    })),
    recommended_steps: issue.recommended_steps,
    severity: issue.severity,
  }));
}

// ─────────────────────────────────────────────
// Build procedural steps from detected issues
// ─────────────────────────────────────────────
function deriveProceduralSteps(detectedIssues) {
  const steps = [];
  const addedActions = new Set();
  const hasHighSeverity = detectedIssues.some(i => i.severity === SEVERITY.HIGH);

  // Step 1: Always gather documents
  steps.push({
    step_number: 1,
    title: 'Gather Your Documents',
    description:
      'Collect everything related to your rental in one place: ' +
      '(1) your signed lease, (2) move-in condition report or photos, (3) move-out photos, ' +
      '(4) deposit payment receipt, (5) any emails, texts, or letters with your landlord, ' +
      '(6) proof of forwarding address delivery if sent.',
    category: 'documentation',
    checklist: [
      'Lease agreement',
      'Move-in photos or condition report',
      'Move-out photos',
      'Deposit payment receipt',
      'All landlord communications (emails, texts, letters)',
      'Forwarding address proof (certified mail receipt if applicable)',
    ],
    resources: [],
  });
  addedActions.add('organize_records');

  // Add steps from detected issues
  for (const issue of detectedIssues) {
    for (const step of issue.recommended_steps || []) {
      if (!addedActions.has(step.action)) {
        addedActions.add(step.action);
        steps.push({
          step_number: steps.length + 1,
          title: formatActionTitle(step.action),
          description: step.description,
          category: categorizeAction(step.action),
          checklist: [],
          resources: [],
        });
      }
    }
  }

  // Add resources step for high severity cases
  if (hasHighSeverity) {
    steps.push({
      step_number: steps.length + 1,
      title: 'Learn About Your Options',
      description:
        'If your written demand is not resolved, Texas Justice of the Peace courts handle small claims ' +
        'up to $20,000. Filing fees are typically $50-100. You may also consult with a licensed Texas attorney.',
      category: 'next_steps',
      checklist: [],
      resources: [
        {
          title: 'TexasLawHelp.org — Security Deposits',
          url: 'https://texaslawhelp.org/article/security-deposits',
          description: 'Free guide to Texas security deposit rights',
        },
        {
          title: 'Texas JP Courts (Small Claims)',
          url: 'https://www.txcourts.gov/about-texas-courts/trial-courts/justice-of-the-peace-courts/',
          description: 'Find your local JP court',
        },
      ],
    });
  }

  // Re-number after all steps are added
  return steps.map((s, i) => ({ ...s, step_number: i + 1 }));
}

// ─────────────────────────────────────────────
// Get applicable statutes
// ─────────────────────────────────────────────
function getApplicableStatutes(detectedIssues) {
  const ids = new Set(['92.101', '92.103']);
  for (const issue of detectedIssues) {
    for (const id of issue.statute_citations || []) ids.add(id);
  }

  return Array.from(ids)
    .filter(id => TX_RULES.statutes?.[id])
    .map(id => ({
      citation: TX_RULES.statutes[id].citation,
      title: TX_RULES.statutes[id].title,
      summary: TX_RULES.statutes[id].summary,
      url: TX_RULES.statutes[id].full_text_url,
    }));
}

// ─────────────────────────────────────────────
// Action title / category helpers
// ─────────────────────────────────────────────
function formatActionTitle(actionId) {
  const titles = {
    send_written_demand: 'Send a Written Demand Letter',
    document_timeline: 'Document Your Timeline',
    request_itemization_letter: 'Request Itemization in Writing',
    gather_move_out_evidence: 'Collect Move-Out Evidence',
    send_forwarding_address_now: 'Send Your Forwarding Address',
    note_30_day_start: 'Mark the 30-Day Start Date',
    compare_photos: 'Compare Move-In and Move-Out Photos',
    research_normal_wear: 'Learn About Normal Wear vs. Damage',
    confirm_forwarding_address: 'Confirm Your Forwarding Address',
  };
  return titles[actionId] || actionId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function categorizeAction(action) {
  const map = {
    send_written_demand: 'communication',
    document_timeline: 'documentation',
    request_itemization_letter: 'communication',
    gather_move_out_evidence: 'documentation',
    send_forwarding_address_now: 'communication',
    note_30_day_start: 'planning',
    compare_photos: 'documentation',
    research_normal_wear: 'review',
    confirm_forwarding_address: 'communication',
  };
  return map[action] || 'documentation';
}

module.exports = {
  detectIssues,
  buildEnrichedLeveragePoints,
  deriveProceduralSteps,
  getApplicableStatutes,
  SEVERITY,
};
