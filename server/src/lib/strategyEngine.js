/**
 * Strategy Engine
 *
 * Determines the recommended strategic action based on case strength.
 * action and urgency are derived from SCORE_BANDS in leverageScoring —
 * no threshold constants live here.
 *
 * IMPORTANT: Informational and educational purposes only.
 * Not legal advice. Tenant should consult a licensed Texas attorney
 * for advice specific to their situation.
 */

const { getScoreBand } = require('./leverageScoring');

// ─────────────────────────────────────────────────────────────────────────────
// Per-action content (rationale, steps, escalation paths).
// This map is keyed on the action strings defined in SCORE_BANDS and is the
// only place action-specific text lives. Adding a new action means adding one
// entry here — the threshold that triggers it is set in SCORE_BANDS.
// ─────────────────────────────────────────────────────────────────────────────

const ACTION_CONTENT = {
  SEND_DEMAND_LETTER: {
    rationale:
      'Your case has strong statutory standing. A formal written demand sent via certified mail is ' +
      'typically the most effective first step—it creates a paper trail, demonstrates you know your rights, ' +
      'and often prompts landlords to settle rather than face small claims court.',
    success_rate_note: 'Demand letters resolve the majority of strong-leverage cases before court filing.',
    timeline:      '14-30 days',
    cost_estimate: '$8-15 (certified mail with return receipt)',
    next_steps: [
      {
        step:     1,
        action:   'Write or download a demand letter',
        deadline: 'As soon as possible',
        notes:    'Include your name, former address, move-out date, deposit amount, and a specific request for return or itemization.',
      },
      {
        step:     2,
        action:   'Send via USPS certified mail (return receipt requested)',
        deadline: 'Within 3 days of writing letter',
        notes:    'Keep the tracking receipt and certified mail receipt—they prove delivery date.',
      },
      {
        step:     3,
        action:   'Set a follow-up reminder for 14 days after delivery',
        deadline: 'After mailing',
        notes:    'Give the landlord a reasonable window to respond before escalating.',
      },
      {
        step:     4,
        action:   'If no response: evaluate small claims court filing',
        deadline: '14+ days after delivery',
        notes:    'Texas Justice of the Peace courts handle small claims up to $20,000. Filing fees are typically under $100 and may be recoverable if you prevail.',
      },
    ],
    if_no_response:
      'If the landlord does not respond within 14-21 days, filing in small claims (Justice of the Peace) court is a common next step. ' +
      'Filing fees are typically $50-100 and are often recovered if you win.',
    escalation_path: {
      phase_1: 'Demand letter (current recommended step)',
      phase_2: 'Small claims filing if no response within 14-21 days',
      phase_3: 'Court hearing (typically scheduled 30-60 days after filing)',
      phase_4: 'Judgment collection if landlord does not pay voluntarily',
    },
  },

  REQUEST_ITEMIZATION_OR_NEGOTIATE: {
    rationale:
      'Your case has legitimate claims but some factors create uncertainty. Requesting a written ' +
      'itemization (if not received) and/or proposing a direct resolution may be more practical ' +
      'than immediate court filing.',
    success_rate_note: 'Cases with moderate leverage often resolve through direct negotiation.',
    timeline:      '21-45 days',
    cost_estimate: '$8-50 (certified mail, minimal up-front cost)',
    next_steps: [
      {
        step:     1,
        action:   'Send a written request for itemization (if not received)',
        deadline: 'Within 7 days',
        notes:    'Request in writing via certified mail. Reference § 92.104 if helpful to include.',
      },
      {
        step:     2,
        action:   'Review the itemization once received',
        deadline: 'Upon receipt',
        notes:    'Compare claimed deductions against your move-out condition. Normal wear and tear is not a legitimate deduction.',
      },
      {
        step:     3,
        action:   'Gather supporting evidence (photos, communications)',
        deadline: 'Within 14 days',
        notes:    'Document the condition you left the property in. Organize all correspondence.',
      },
      {
        step:     4,
        action:   'Consider proposing a direct resolution if communication is open',
        deadline: 'After reviewing itemization',
        notes:    'Sometimes direct negotiation produces faster results than court proceedings.',
      },
    ],
    if_no_response:
      'If the landlord does not respond to your written request, you may want to evaluate whether filing in small claims court makes sense given the deposit amount and your available time.',
    escalation_path: {
      phase_1: 'Written request/negotiation (current step)',
      phase_2: 'Demand letter if negotiation fails',
      phase_3: 'Small claims filing as a last resort',
      phase_4: 'Court hearing and judgment',
    },
  },

  GATHER_EVIDENCE_THEN_EVALUATE: {
    rationale:
      'Based on the information provided, your case has some merit but also faces uncertainty. ' +
      'Gathering additional evidence and fully understanding the situation before taking formal action is advisable.',
    success_rate_note: 'Cases with limited information are harder to evaluate—more documentation typically improves your position.',
    timeline:      'Unclear without additional information',
    cost_estimate: '$0 (no immediate costs)',
    next_steps: [
      {
        step:     1,
        action:   'Organize all documents: lease, photos, communications, receipts',
        deadline: 'Within 7 days',
        notes:    'A complete record helps you (and anyone advising you) assess the situation accurately.',
      },
      {
        step:     2,
        action:   'Provide your forwarding address in writing if not already done',
        deadline: 'Immediately if not yet done',
        notes:    'This is required to start the 30-day refund deadline under § 92.107.',
      },
      {
        step:     3,
        action:   'Consider a free legal aid consultation if available in your county',
        deadline: 'Within 14 days',
        notes:    'Many Texas counties have free or low-cost legal aid for tenant rights questions.',
      },
    ],
    if_no_response:
      'Before taking formal action, it may be worth consulting free tenant rights resources (TexasLawHelp.org) or a legal aid organization to understand your options.',
    escalation_path: {
      phase_1: 'Gather evidence and assess situation',
      phase_2: 'Written demand if case facts support it',
      phase_3: 'Small claims if demand is ignored and deposit amount justifies it',
      phase_4: 'Court hearing',
    },
  },

  REVIEW_SITUATION: {
    rationale:
      'Based on the information provided, the specific situation does not yet point to a clear compliance issue. ' +
      'This may be because the 30-day deadline has not passed, a refund is in process, or additional facts are needed.',
    success_rate_note: 'The information available does not indicate a clear violation at this time.',
    timeline:      'Depends on situation',
    cost_estimate: '$0',
    next_steps: [
      {
        step:     1,
        action:   'Confirm whether the 30-day deadline has passed from your forwarding address delivery date',
        deadline: 'Now',
        notes:    'Under § 92.107, the clock runs from when the landlord receives your forwarding address.',
      },
      {
        step:     2,
        action:   'Document any communications you have with the landlord about your deposit',
        deadline: 'Ongoing',
        notes:    'Keep records of all communications in case the situation changes.',
      },
    ],
    if_no_response: 'If circumstances change (deadline passes, no refund received), revisit this analysis.',
    escalation_path: {
      phase_1: 'Monitor timeline and document communications',
      phase_2: 'Re-evaluate if deadline passes without action from landlord',
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determine recommended strategy based on leverage score.
 * action and urgency are read from SCORE_BANDS (via getScoreBand) —
 * no threshold comparison lives in this function.
 *
 * @param {number} leverageScore  0-100 case_strength_score
 * @param {string} depositAmount  raw deposit amount string (e.g. "$1,500")
 * @param {object} intake         full intake data
 * @param {object} timeline       computed timeline data
 * @returns {object}              strategy recommendation
 */
function determineStrategy(leverageScore, depositAmount, intake, timeline) {
  const band    = getScoreBand(leverageScore);
  const content = ACTION_CONTENT[band.action];

  return {
    recommended_action: band.action,
    urgency:            band.urgency,
    ...content,
  };
}

/**
 * Map recommended_action to human-readable label.
 */
function formatActionLabel(action) {
  const labels = {
    SEND_DEMAND_LETTER:               'Send Demand Letter',
    REQUEST_ITEMIZATION_OR_NEGOTIATE: 'Request Itemization / Negotiate',
    GATHER_EVIDENCE_THEN_EVALUATE:    'Gather Evidence, Then Evaluate',
    REVIEW_SITUATION:                 'Review Situation',
  };
  return labels[action] || action;
}

module.exports = { determineStrategy, formatActionLabel };
