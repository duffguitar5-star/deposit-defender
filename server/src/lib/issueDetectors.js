/**
 * Issue Detectors
 *
 * Detects issues from case data and produces enriched leverage points
 * with statute citations, lease clause links, and procedural recommendations.
 *
 * IMPORTANT: All outputs use informational language only.
 * No legal advice or conclusions.
 */

const path = require('path');
const fs = require('fs');
const { parseISO, differenceInCalendarDays, addDays, format, isValid } = require('date-fns');
const { utcToZonedTime } = require('date-fns-tz');

// Load TX rules knowledge base
const rulesPath = path.join(__dirname, '..', '..', '..', 'ai', 'tx_security_deposit_rules.json');
const TX_RULES = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));

/**
 * Severity levels for issues
 */
const SEVERITY = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

/**
 * Format a currency amount for display
 */
function formatCurrency(amount) {
  if (!amount) return '$0';
  const num = parseFloat(String(amount).replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return String(amount);
  return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/**
 * Calculate deadline date with timezone-aware calendar day arithmetic
 * Uses Central Time (America/Chicago) for Texas-based calculations
 */
function calculateDeadlineDate(moveOutDate, daysToAdd) {
  if (!moveOutDate) return 'unknown';

  try {
    // Parse as ISO date string (YYYY-MM-DD)
    let date = parseISO(moveOutDate);

    // If invalid, try Date constructor fallback
    if (!isValid(date)) {
      date = new Date(moveOutDate);
      if (!isValid(date)) return 'unknown';
    }

    // Convert to Central Time (Texas timezone)
    const texasTime = utcToZonedTime(date, 'America/Chicago');

    // Add calendar days
    const deadline = addDays(texasTime, daysToAdd);

    // Format consistently
    return format(deadline, 'MMM d, yyyy');
  } catch (error) {
    console.error('Date calculation error:', error);
    return 'unknown';
  }
}

/**
 * Issue detector definitions
 * Each detector evaluates case data and produces an enriched issue if triggered
 *
 * Design principles:
 * - Titles are specific to case facts (include amounts, dates when relevant)
 * - "Why this matters" is persuasive and explains practical implications
 * - Each issue includes statute + lease citations (or explicit none_found)
 * - Recommended steps are concrete with specific actions
 * - No legal advice language; informational only
 */
const ISSUE_DETECTORS = [
  {
    id: 'deadline_missed_full_deposit',
    severity: SEVERITY.HIGH,
    rank_weight: 100,
    title: 'Landlord has not returned deposit or provided itemization',

    evaluate: (ctx) => {
      // Only fire if: past 30 days, no refund at all, AND no itemization
      return ctx.past30Days &&
             ctx.depositReturned === 'no' &&
             ctx.itemizedReceived === 'no';
    },

    build: (ctx) => {
      const depositDisplay = formatCurrency(ctx.depositAmount);
      const daysOver = ctx.daysSinceMoveOut - 30;

      return {
        why_this_matters:
          `Your landlord has held your ${depositDisplay} deposit for ${ctx.daysSinceMoveOut} days ` +
          `without returning it or explaining why. Texas Property Code § 92.103 states landlords must ` +
          `act within 30 days—that deadline passed ${daysOver} days ago. ` +
          `Under § 92.109, a landlord who fails to meet this deadline may forfeit the right to ` +
          `withhold any portion of the deposit and could be liable for additional amounts.`,

        supporting_facts: [
          { fact: `You moved out on ${ctx.moveOutDate}`, source: 'tenant_intake' },
          { fact: `${ctx.daysSinceMoveOut} days have passed (30-day deadline exceeded by ${daysOver} days)`, source: 'computed' },
          { fact: `Your deposit was ${depositDisplay}`, source: 'tenant_intake' },
          { fact: 'No refund received', source: 'tenant_intake' },
          { fact: 'No itemized deduction list received', source: 'tenant_intake' },
          ctx.forwardingProvided === 'yes'
            ? { fact: `You provided a forwarding address${ctx.forwardingDate ? ' on ' + ctx.forwardingDate : ''}`, source: 'tenant_intake' }
            : null,
        ].filter(Boolean),

        statute_citations: ['92.103', '92.104', '92.109'],

        lease_citations: ctx.findLeaseClausesByTopic(['security_deposit', 'move_out', 'deductions']),

        recommended_steps: [
          {
            action: 'send_written_demand',
            description:
              `Send a written request to your landlord via certified mail (return receipt requested). ` +
              `Include: (1) your name and former address, (2) your move-out date (${ctx.moveOutDate}), ` +
              `(3) the deposit amount (${depositDisplay}), (4) that ${ctx.daysSinceMoveOut} days have passed, ` +
              `(5) your current mailing address, and (6) a request for immediate return of the full deposit ` +
              `or a written itemization of any claimed deductions. Keep a copy of everything you send.`,
          },
          {
            action: 'document_timeline',
            description:
              `Create a simple written timeline: move-out date, when you gave your forwarding address, ` +
              `any communications with the landlord, and today's date. This helps you (and anyone reviewing ` +
              `your situation) see the full picture at a glance.`,
          },
        ],
      };
    },
  },

  {
    id: 'deadline_missed_no_itemization_only',
    severity: SEVERITY.HIGH,
    rank_weight: 90,
    title: 'Partial refund received but no itemization provided',

    evaluate: (ctx) => {
      // Fire if: past 30 days, partial refund, but NO itemization
      // (The full-deposit detector handles the "no refund" case)
      return ctx.past30Days &&
             ctx.depositReturned === 'partial' &&
             ctx.itemizedReceived === 'no';
    },

    build: (ctx) => {
      const depositDisplay = formatCurrency(ctx.depositAmount);
      const returnedDisplay = formatCurrency(ctx.amountReturned);
      const withheldDisplay = calculateWithheld(ctx.depositAmount, ctx.amountReturned);

      return {
        why_this_matters:
          `Your landlord returned ${returnedDisplay} of your ${depositDisplay} deposit but kept ` +
          `${withheldDisplay}—and never explained why. Texas Property Code § 92.104 requires landlords ` +
          `to provide a written, itemized list of deductions when keeping any part of a deposit. ` +
          `Without this itemization, you have no way to verify whether the deductions were legitimate. ` +
          `Under § 92.109, failure to provide itemization may mean the landlord forfeits the right ` +
          `to keep any of your deposit.`,

        supporting_facts: [
          { fact: `You moved out on ${ctx.moveOutDate}`, source: 'tenant_intake' },
          { fact: `Original deposit: ${depositDisplay}`, source: 'tenant_intake' },
          { fact: `Amount returned: ${returnedDisplay}`, source: 'tenant_intake' },
          { fact: `Amount withheld: ${withheldDisplay}`, source: 'computed' },
          { fact: 'No itemized deduction list received', source: 'tenant_intake' },
          { fact: `${ctx.daysSinceMoveOut} days since move-out (30-day deadline passed)`, source: 'computed' },
        ],

        statute_citations: ['92.104', '92.109'],

        lease_citations: ctx.findLeaseClausesByTopic(['security_deposit', 'deductions']),

        recommended_steps: [
          {
            action: 'request_itemization_letter',
            description:
              `Send a written request via certified mail asking for the itemized list of deductions. ` +
              `State that you received ${returnedDisplay} but have not received any explanation for ` +
              `the ${withheldDisplay} withheld. Reference Texas Property Code § 92.104. ` +
              `Keep a copy and the certified mail receipt.`,
          },
          {
            action: 'gather_move_out_evidence',
            description:
              `Collect any photos you took at move-out, your move-in condition report, and any ` +
              `communications with the landlord about the property's condition. These may help you ` +
              `evaluate whether any future itemization is reasonable.`,
          },
        ],
      };
    },
  },

  {
    id: 'within_30_days_no_response',
    severity: SEVERITY.MEDIUM,
    rank_weight: 60,
    title: 'Still within 30-day window—no response yet',

    evaluate: (ctx) => {
      // Within 30 days, no refund, no itemization
      return !ctx.past30Days &&
             ctx.daysSinceMoveOut >= 15 &&
             ctx.depositReturned === 'no' &&
             ctx.itemizedReceived === 'no';
    },

    build: (ctx) => {
      const depositDisplay = formatCurrency(ctx.depositAmount);
      const daysRemaining = 30 - ctx.daysSinceMoveOut;

      return {
        why_this_matters:
          `You moved out ${ctx.daysSinceMoveOut} days ago and haven't heard anything about your ` +
          `${depositDisplay} deposit. The landlord still has ${daysRemaining} days to comply with ` +
          `the 30-day deadline under Texas Property Code § 92.103. While the deadline hasn't passed yet, ` +
          `now is a good time to make sure your landlord has your correct forwarding address and ` +
          `to document that you're waiting.`,

        supporting_facts: [
          { fact: `You moved out on ${ctx.moveOutDate}`, source: 'tenant_intake' },
          { fact: `${ctx.daysSinceMoveOut} days elapsed, ${daysRemaining} days until deadline`, source: 'computed' },
          { fact: `Deposit amount: ${depositDisplay}`, source: 'tenant_intake' },
          ctx.forwardingProvided === 'yes'
            ? { fact: 'Forwarding address provided', source: 'tenant_intake' }
            : { fact: 'Forwarding address not yet provided', source: 'tenant_intake' },
        ],

        statute_citations: ['92.103', '92.107'],

        lease_citations: ctx.findLeaseClausesByTopic(['security_deposit', 'forwarding_address']),

        recommended_steps: [
          {
            action: 'confirm_forwarding_address',
            description:
              ctx.forwardingProvided === 'yes'
                ? `You've provided a forwarding address. Consider sending a brief follow-up via email ` +
                  `or text confirming your current address so there's no confusion.`
                : `Send your forwarding address in writing (certified mail or email) immediately. ` +
                  `The 30-day clock may not start until the landlord has this address.`,
          },
          {
            action: 'set_reminder',
            description:
              `Mark day 31 on your calendar (${calculateDeadlineDate(ctx.moveOutDate, 31)}). ` +
              `If you haven't received your deposit or an itemization by then, the landlord has ` +
              `missed the deadline.`,
          },
        ],
      };
    },
  },

  {
    id: 'no_forwarding_address',
    severity: SEVERITY.MEDIUM,
    rank_weight: 55,
    title: 'Forwarding address not provided—deadline may not have started',

    evaluate: (ctx) => {
      return ctx.forwardingProvided === 'no' && ctx.depositReturned === 'no';
    },

    build: (ctx) => {
      const depositDisplay = formatCurrency(ctx.depositAmount);

      return {
        why_this_matters:
          `Texas Property Code § 92.107 says the 30-day deadline doesn't start until you give ` +
          `your landlord a forwarding address in writing. Without this, your landlord may not ` +
          `yet be obligated to return your ${depositDisplay} deposit. Providing this address ` +
          `immediately starts the clock and creates a clear paper trail.`,

        supporting_facts: [
          { fact: `You moved out on ${ctx.moveOutDate}`, source: 'tenant_intake' },
          { fact: `Deposit amount: ${depositDisplay}`, source: 'tenant_intake' },
          { fact: 'No forwarding address provided yet', source: 'tenant_intake' },
        ],

        statute_citations: ['92.107', '92.103'],

        lease_citations: ctx.findLeaseClausesByTopic(['forwarding_address', 'notice', 'security_deposit']),

        recommended_steps: [
          {
            action: 'send_forwarding_address_now',
            description:
              `Send your forwarding address today via certified mail with return receipt. ` +
              `Include your full name, the rental property address, your move-out date (${ctx.moveOutDate}), ` +
              `and your new mailing address. Keep the certified mail receipt—it proves when you sent it.`,
          },
          {
            action: 'note_30_day_start',
            description:
              `The 30-day deadline starts when the landlord receives your forwarding address. ` +
              `Note the delivery date from your certified mail receipt and count 30 days from there.`,
          },
        ],
      };
    },
  },

  {
    id: 'normal_wear_concern',
    severity: SEVERITY.MEDIUM,
    rank_weight: 70,
    title: 'Possible normal wear and tear issue',

    evaluate: (ctx) => {
      if (ctx.depositReturned !== 'no' && ctx.depositReturned !== 'partial') {
        return false;
      }
      const wearTearKeywords = ['wear', 'tear', 'normal', 'carpet', 'paint', 'scuff', 'faded', 'age'];
      const notesLower = (ctx.tenantNotes || '').toLowerCase();
      return wearTearKeywords.some(kw => notesLower.includes(kw));
    },

    build: (ctx) => ({
      why_this_matters:
        `Your notes mention wear, carpet, paint, or similar issues. Texas Property Code § 92.104 ` +
        `prohibits landlords from deducting for "normal wear and tear"—the gradual deterioration ` +
        `that happens from ordinary use. Faded paint, minor carpet wear, and small scuffs typically ` +
        `fall into this category. If your landlord tries to charge you for these, you may have ` +
        `grounds to dispute those deductions.`,

      supporting_facts: [
        { fact: 'Your notes reference wear, carpet, paint, or similar concerns', source: 'tenant_intake' },
        { fact: `Deposit status: ${ctx.depositReturned === 'partial' ? 'Partially returned' : 'Not returned'}`, source: 'tenant_intake' },
      ],

      statute_citations: ['92.104'],

      lease_citations: ctx.findLeaseClausesByTopic(['normal_wear_and_tear', 'damages', 'cleaning', 'carpet_painting']),

      recommended_steps: [
        {
          action: 'compare_photos',
          description:
            `Gather your move-in photos (or condition report) and any move-out photos. ` +
            `Compare them side-by-side. Minor changes from living in a unit for months or years ` +
            `are typically normal wear—not damage you should pay for.`,
        },
        {
          action: 'research_normal_wear',
          description:
            `Texas courts and tenant resources have examples of normal wear vs. damage. ` +
            `Generally: small nail holes, minor carpet wear paths, faded paint = normal wear. ` +
            `Large holes, stains, burns, broken fixtures = possible damage.`,
        },
      ],
    }),
  },

  {
    id: 'cleaning_deduction_concern',
    severity: SEVERITY.MEDIUM,
    rank_weight: 65,
    title: 'Cleaning charges may be questionable',

    evaluate: (ctx) => {
      if (ctx.depositReturned !== 'no' && ctx.depositReturned !== 'partial') {
        return false;
      }
      const cleaningKeywords = ['cleaning', 'clean', 'dirty', 'filthy', 'maid', 'professional'];
      const notesLower = (ctx.tenantNotes || '').toLowerCase();
      return cleaningKeywords.some(kw => notesLower.includes(kw));
    },

    build: (ctx) => ({
      why_this_matters:
        `Your notes mention cleaning. Landlords can only charge for cleaning beyond normal wear—` +
        `not routine cleaning that would happen between any tenants. If the unit was reasonably ` +
        `clean when you left (swept, no trash, appliances wiped down), charges for "professional ` +
        `cleaning" may not be justified. Check your lease for specific cleaning requirements.`,

      supporting_facts: [
        { fact: 'Your notes mention cleaning-related concerns', source: 'tenant_intake' },
        { fact: `Deposit status: ${ctx.depositReturned === 'partial' ? 'Partially returned' : 'Not returned'}`, source: 'tenant_intake' },
      ],

      statute_citations: ['92.104'],

      lease_citations: ctx.findLeaseClausesByTopic(['cleaning', 'move_out']),

      recommended_steps: [
        {
          action: 'check_lease_cleaning_clause',
          description:
            `Look for any lease clause about cleaning. Does it require "professional cleaning" ` +
            `or just "broom clean"? What condition did you actually leave the unit in? ` +
            `Take note of the specific language.`,
        },
        {
          action: 'document_move_out_condition',
          description:
            `Gather any photos from move-out day. Did you clean before leaving? ` +
            `Write down what you did (vacuumed, wiped counters, etc.) while it's fresh in your memory.`,
        },
      ],
    }),
  },

  {
    id: 'lease_extended_timeline',
    severity: SEVERITY.MEDIUM,
    rank_weight: 68,
    title: 'Lease mentions a timeline longer than 30 days',

    evaluate: (ctx) => {
      const depositClauses = ctx.findLeaseClausesByTopic(['security_deposit']);
      if (depositClauses === 'none_found') return false;
      for (const clause of depositClauses) {
        const dayMatch = clause.excerpt.match(/(\d+)\s*(?:day|days)/i);
        if (dayMatch && parseInt(dayMatch[1], 10) > 30) {
          ctx._leaseTimelineDays = parseInt(dayMatch[1], 10);
          ctx._leaseTimelineClause = clause;
          return true;
        }
      }
      return false;
    },

    build: (ctx) => ({
      why_this_matters:
        `Your lease appears to reference a ${ctx._leaseTimelineDays}-day timeline for deposit matters. ` +
        `However, Texas Property Code § 92.103 sets a 30-day deadline. Texas law generally takes ` +
        `precedence over lease terms that try to give landlords more time. A lease cannot override ` +
        `the statutory 30-day requirement.`,

      supporting_facts: [
        { fact: `Lease excerpt: "${ctx._leaseTimelineClause?.excerpt?.slice(0, 120)}..."`, source: 'lease_extraction' },
        { fact: `Lease timeline: ${ctx._leaseTimelineDays} days`, source: 'lease_extraction' },
        { fact: 'Texas Property Code: 30 days', source: 'statutory' },
      ],

      statute_citations: ['92.103'],

      lease_citations: [{ ...ctx._leaseTimelineClause, is_conflict: true }],

      recommended_steps: [
        {
          action: 'note_statutory_deadline',
          description:
            `Regardless of what your lease says, the 30-day deadline under Texas law applies. ` +
            `Calculate 30 days from when you provided your forwarding address—that's your deadline.`,
        },
      ],
    }),
  },
];

/**
 * Evaluation context - provides helper methods to detectors
 */
class EvaluationContext {
  constructor(intake, timeline, leaseClauses) {
    this.intake = intake;
    this.timeline = timeline;
    this.leaseClauses = leaseClauses || [];

    // Extract commonly used values
    this.depositReturned = intake.security_deposit_information?.deposit_returned;
    this.depositAmount = intake.security_deposit_information?.deposit_amount;
    this.amountReturned = intake.security_deposit_information?.amount_returned;
    this.itemizedReceived = intake.post_move_out_communications?.itemized_deductions_received;
    this.forwardingProvided = intake.move_out_information?.forwarding_address_provided;
    this.forwardingDate = intake.move_out_information?.forwarding_address_date;
    this.moveOutDate = intake.move_out_information?.move_out_date;
    this.commMethods = intake.post_move_out_communications?.communication_methods_used || [];
    this.tenantNotes = intake.additional_notes?.tenant_notes || '';

    // Timeline values (support both nested current_status and flat formats)
    this.daysSinceMoveOut = timeline?.current_status?.days_since_move_out
      ?? timeline?.days_since_move_out
      ?? 0;
    this.past30Days = timeline?.current_status?.timeline_phase === 'past_30_days'
      || timeline?.past_30_days === true;
  }

  /**
   * Find lease clauses by topic
   */
  findLeaseClausesByTopic(topics) {
    const matches = this.leaseClauses.filter(c => topics.includes(c.topic || c.clause_type));
    if (matches.length === 0) {
      return 'none_found';
    }
    return matches.map(c => ({
      clause_id: c.item_id,
      topic: c.topic || c.clause_type,
      excerpt: c.excerpt,
      source: c.source_context,
    }));
  }
}

/**
 * Run all issue detectors and return enriched leverage points
 */
function detectIssues(intake, timeline, leaseClauses) {
  const ctx = new EvaluationContext(intake, timeline, leaseClauses);
  const detectedIssues = [];

  for (const detector of ISSUE_DETECTORS) {
    try {
      if (detector.evaluate(ctx)) {
        const enrichedData = detector.build(ctx);

        detectedIssues.push({
          issue_id: detector.id,
          severity: detector.severity,
          rank_weight: detector.rank_weight,
          title: detector.title,
          ...enrichedData,
        });
      }
    } catch (err) {
      console.error(`Issue detector ${detector.id} failed:`, err.message);
    }
  }

  // Sort by rank_weight descending
  detectedIssues.sort((a, b) => b.rank_weight - a.rank_weight);

  return detectedIssues;
}

/**
 * Build leverage points from detected issues
 */
function buildEnrichedLeveragePoints(detectedIssues) {
  if (detectedIssues.length === 0) {
    return [{
      rank: 1,
      point_id: 'no_issues_detected',
      title: 'No specific issues identified',
      observation: 'Based on the information provided, no specific issues were identified. This may indicate the deposit was returned, the timeline has not passed, or additional information is needed.',
      why_this_matters: null,
      supporting_facts: [],
      statute_citations: [],
      lease_citations: 'none_found',
      recommended_steps: [],
      severity: 'low',
    }];
  }

  return detectedIssues.map((issue, index) => ({
    rank: index + 1,
    point_id: issue.issue_id,
    title: issue.title,
    observation: buildObservation(issue),
    why_this_matters: issue.why_this_matters,
    supporting_facts: issue.supporting_facts,
    statute_citations: issue.statute_citations.map(id => ({
      rule_id: id,
      citation: TX_RULES.statutes[id]?.citation || `Tex. Prop. Code § ${id}`,
      title: TX_RULES.statutes[id]?.title || '',
    })),
    lease_citations: issue.lease_citations,
    recommended_steps: issue.recommended_steps,
    severity: issue.severity,
  }));
}

/**
 * Build observation text from issue
 */
function buildObservation(issue) {
  const facts = issue.supporting_facts || [];
  const factSummary = facts.map(f => f.fact).join('. ');
  return `Based on the information provided: ${factSummary}.`;
}

/**
 * Derive procedural steps from detected issues
 * Generates concrete, actionable checklist items
 */
function deriveProceduralSteps(detectedIssues) {
  const steps = [];
  const addedActions = new Set();
  const hasHighSeverity = detectedIssues.some(i => i.severity === SEVERITY.HIGH);

  // Step 1: Always start with organizing documentation
  steps.push({
    action_id: 'organize_records',
    title: 'Gather Your Documents',
    description:
      'Collect and organize everything related to your rental in one folder (physical or digital). ' +
      'Include: (1) your signed lease, (2) move-in condition report or photos, (3) move-out photos, ' +
      '(4) deposit payment receipt, (5) any emails/texts/letters with your landlord, ' +
      '(6) proof of forwarding address delivery if you sent one.',
    category: 'documentation',
    checklist: [
      'Lease agreement',
      'Move-in photos or condition report',
      'Move-out photos',
      'Deposit payment receipt',
      'Landlord communications (emails, texts, letters)',
      'Forwarding address proof (certified mail receipt)',
    ],
  });
  addedActions.add('organize_records');

  // Collect unique recommended steps from all issues
  for (const issue of detectedIssues) {
    for (const step of issue.recommended_steps || []) {
      if (!addedActions.has(step.action)) {
        addedActions.add(step.action);
        steps.push({
          action_id: step.action,
          title: formatActionTitle(step.action),
          description: step.description,
          derived_from: issue.issue_id,
          category: categorizeAction(step.action),
        });
      }
    }
  }

  // Add timeline documentation for high-severity cases
  if (hasHighSeverity && !addedActions.has('create_timeline')) {
    steps.push({
      action_id: 'create_timeline',
      title: 'Write Down Your Timeline',
      description:
        'Create a simple dated list of key events: lease start date, lease end date, ' +
        'move-out date, when you provided forwarding address, any communications about the deposit, ' +
        'and any refund or itemization received. This one-page summary helps anyone reviewing ' +
        'your situation understand it quickly.',
      category: 'documentation',
    });
  }

  // Only add attorney/court steps if HIGH severity issues exist
  if (hasHighSeverity) {
    steps.push({
      action_id: 'send_formal_letter',
      title: 'Send a Written Request',
      description:
        'Send a formal written request to your landlord via certified mail with return receipt. ' +
        'Include your name, the property address, move-out date, deposit amount, ' +
        'your forwarding address, and a clear request for return of your deposit or a written ' +
        'itemization of deductions. Keep a copy of the letter and the certified mail receipt. ' +
        'This creates a paper trail.',
      category: 'communication',
      checklist: [
        'Your full name',
        'Property address you rented',
        'Move-out date',
        'Deposit amount',
        'Your current mailing address',
        'Clear request for deposit return or itemization',
        'Keep copy of letter',
        'Keep certified mail receipt',
      ],
    });

    steps.push({
      action_id: 'learn_options',
      title: 'Learn About Your Options',
      description:
        'If your landlord doesn\'t respond to a written request, you have options. ' +
        'Texas Justice of the Peace courts handle small claims up to $20,000—filing fees ' +
        'are typically under $100 and you don\'t need a lawyer. You can also consult with ' +
        'a licensed Texas attorney for advice specific to your situation.',
      category: 'next_steps',
      resources: [
        {
          title: 'TexasLawHelp.org - Security Deposits',
          url: 'https://texaslawhelp.org/article/security-deposits',
          description: 'Free guide to Texas security deposit rights.',
        },
        {
          title: 'Texas Justice Courts',
          url: 'https://www.txcourts.gov/about-texas-courts/trial-courts/justice-of-the-peace-courts/',
          description: 'Find your local JP court for small claims.',
        },
        {
          title: 'State Bar of Texas Lawyer Referral',
          url: 'https://www.texasbar.com/AM/Template.cfm?Section=Lawyer_Referral_Service_LRIS_',
          description: 'Find a licensed Texas attorney.',
        },
      ],
    });
  }

  // Number the steps
  return steps.map((step, index) => ({
    step_number: index + 1,
    title: step.title,
    description: step.description,
    category: step.category,
    checklist: step.checklist || [],
    resources: step.resources || [],
    applicability_note: step.derived_from
      ? `Relevant to: ${step.derived_from.replace(/_/g, ' ')}`
      : null,
  }));
}

/**
 * Categorize action into step category
 */
function categorizeAction(action) {
  const categories = {
    // Documentation
    document_timeline: 'documentation',
    document_condition: 'documentation',
    preserve_evidence: 'documentation',
    preserve_communications: 'documentation',
    organize_records: 'documentation',
    gather_photos: 'documentation',
    create_timeline: 'documentation',
    gather_move_out_evidence: 'documentation',
    compare_photos: 'documentation',
    document_move_out_condition: 'documentation',

    // Communication
    send_written_demand: 'communication',
    send_formal_letter: 'communication',
    written_request: 'communication',
    request_itemization: 'communication',
    request_itemization_letter: 'communication',
    provide_forwarding_address: 'communication',
    send_forwarding_address_now: 'communication',
    confirm_forwarding_address: 'communication',

    // Review
    review_lease_terms: 'review',
    review_lease: 'review',
    review_cleaning_requirements: 'review',
    check_lease_cleaning_clause: 'review',
    research_normal_wear: 'review',
    note_statutory_deadline: 'review',

    // Calendar
    set_reminder: 'planning',
    note_30_day_start: 'planning',

    // Next steps
    learn_options: 'next_steps',
    consult_attorney: 'next_steps',
    small_claims_info: 'next_steps',
  };
  return categories[action] || 'documentation';
}

/**
 * Format action ID as human-readable title
 */
function formatActionTitle(actionId) {
  const titles = {
    // Documentation actions
    document_timeline: 'Document Your Timeline',
    document_condition: 'Document Property Condition',
    preserve_evidence: 'Preserve Your Evidence',
    preserve_communications: 'Save All Communications',
    organize_records: 'Gather Your Documents',
    gather_photos: 'Collect Your Photos',
    create_timeline: 'Write Down Your Timeline',
    gather_move_out_evidence: 'Collect Move-Out Evidence',
    compare_photos: 'Compare Move-In and Move-Out Photos',
    research_normal_wear: 'Learn About Normal Wear vs. Damage',

    // Communication actions
    send_written_demand: 'Send a Written Request',
    send_formal_letter: 'Send a Formal Letter',
    request_itemization: 'Request an Itemized List',
    request_itemization_letter: 'Request Itemization in Writing',
    provide_forwarding_address: 'Provide Your Forwarding Address',
    send_forwarding_address_now: 'Send Your Forwarding Address Now',
    confirm_forwarding_address: 'Confirm Your Forwarding Address',

    // Review actions
    review_lease_terms: 'Review Lease Terms',
    review_lease: 'Review Your Lease',
    review_cleaning_requirements: 'Check Lease Cleaning Requirements',
    check_lease_cleaning_clause: 'Check Lease Cleaning Clause',
    document_move_out_condition: 'Document Your Move-Out Condition',
    note_statutory_deadline: 'Note the 30-Day Deadline',

    // Calendar/reminder actions
    set_reminder: 'Set a Calendar Reminder',
    note_30_day_start: 'Mark When the 30-Day Clock Started',

    // Next steps
    learn_options: 'Learn About Your Options',
    consult_attorney: 'Consult a Licensed Texas Attorney',
    small_claims_info: 'Learn About Small Claims Court',
  };
  return titles[actionId] || actionId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Calculate amount withheld from deposit
 */
function calculateWithheld(depositAmount, amountReturned) {
  if (!depositAmount || !amountReturned) {
    return 'Unable to calculate';
  }

  const parseAmount = (str) => {
    const match = String(str).match(/[\d,]+\.?\d*/);
    return match ? parseFloat(match[0].replace(/,/g, '')) : null;
  };

  const deposit = parseAmount(depositAmount);
  const returned = parseAmount(amountReturned);

  if (deposit === null || returned === null) {
    return 'Unable to calculate';
  }

  const withheld = deposit - returned;
  return `$${withheld.toFixed(2)}`;
}

/**
 * Get applicable statutory references based on detected issues
 */
function getApplicableStatutes(detectedIssues) {
  const statuteIds = new Set();

  // Always include foundational statutes
  statuteIds.add('92.101');
  statuteIds.add('92.103');

  // Add statutes from detected issues
  for (const issue of detectedIssues) {
    for (const id of issue.statute_citations || []) {
      statuteIds.add(id);
    }
  }

  // Build full statute references
  return Array.from(statuteIds)
    .filter(id => TX_RULES.statutes[id])
    .map(id => ({
      citation: TX_RULES.statutes[id].citation,
      title: TX_RULES.statutes[id].title,
      summary: TX_RULES.statutes[id].summary,
      relevance_to_case: buildStatuteRelevance(id, detectedIssues),
      url: TX_RULES.statutes[id].full_text_url,
    }));
}

/**
 * Build relevance explanation for a statute
 */
function buildStatuteRelevance(statuteId, detectedIssues) {
  const relevanceMap = {
    '92.101': 'Referenced as the foundational definition of security deposits in Texas.',
    '92.103': 'Referenced because the tenant\'s situation involves security deposit timeline questions.',
    '92.104': 'Referenced because the situation involves deductions or retention of the deposit.',
    '92.107': 'Referenced because forwarding address status may affect timeline calculations.',
    '92.109': 'Referenced because the 30-day timeline has passed, which may be relevant to landlord obligations.',
  };

  // Check if any detected issue cites this statute
  const citingIssues = detectedIssues.filter(i =>
    (i.statute_citations || []).includes(statuteId)
  );

  if (citingIssues.length > 0) {
    return relevanceMap[statuteId] || `Referenced in connection with: ${citingIssues.map(i => i.title).join(', ')}.`;
  }

  return relevanceMap[statuteId] || 'Referenced for general context.';
}

module.exports = {
  detectIssues,
  buildEnrichedLeveragePoints,
  deriveProceduralSteps,
  getApplicableStatutes,
  SEVERITY,
};
