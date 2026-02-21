/**
 * Damage Defense Analyzer (Basic)
 *
 * Detects potential landlord damage claims from tenant notes and
 * generates informational defense talking points.
 *
 * Focuses on the core defense principles:
 * 1. Burden of proof is on the landlord
 * 2. Normal wear and tear is not deductible (§ 92.104)
 * 3. Late or unsupported claims are harder to enforce (§ 92.109)
 *
 * IMPORTANT: Informational and educational only. Not legal advice.
 */

/**
 * Analyze tenant notes for potential damage claim defense points
 *
 * @param {string} tenantNotes - Free-text notes from tenant intake
 * @param {string} depositReturnedStatus - 'yes' | 'no' | 'partial'
 * @param {boolean} past30Days - Whether 30-day deadline has passed
 * @returns {object} damage defense analysis
 */
function analyzeDamageDefenses(tenantNotes, depositReturnedStatus, past30Days) {
  const notes = (tenantNotes || '').toLowerCase();
  const defenses = [];

  // ─────────────────────────────────────────────────────────────
  // CARPET / FLOORING
  // ─────────────────────────────────────────────────────────────
  if (/carpet|floor|stain|hardwood|tile|rug/i.test(notes)) {
    defenses.push({
      claim_type: 'flooring_or_carpet',
      title: 'Carpet / Flooring Claim',
      defense_strength: 'MODERATE',
      statute: 'Tex. Prop. Code § 92.104(a)',
      key_point:
        'Normal carpet wear from ordinary use (wear paths, minor fading, small stains from regular living) ' +
        'is generally considered normal wear and tear under § 92.104. Landlords may only charge for ' +
        'damage that exceeds ordinary use.',
      what_to_ask_landlord: [
        'When was the carpet installed? (Carpet typically has a 5-7 year lifespan)',
        'What specific damage is claimed? (General wear vs. burns, tears, or major staining)',
        'What is the replacement cost for the remaining useful life only?'
      ],
      evidence_helpful: [
        'Move-in condition report or photos showing carpet condition when you moved in',
        'Move-out photos showing condition when you left'
      ]
    });
  }

  // ─────────────────────────────────────────────────────────────
  // PAINT / WALLS
  // ─────────────────────────────────────────────────────────────
  if (/paint|wall|scuff|mark|hole|patch|crayon|permanent marker/i.test(notes)) {
    defenses.push({
      claim_type: 'paint_or_walls',
      title: 'Paint / Wall Claim',
      defense_strength: 'MODERATE',
      statute: 'Tex. Prop. Code § 92.104(a)',
      key_point:
        'Small scuff marks, minor discoloration, and standard nail holes from hanging pictures ' +
        'are generally normal wear. Landlords are typically expected to repaint between tenants ' +
        'as routine turnover. Charges for full repainting of a unit occupied for 1+ years may not ' +
        'be appropriate as a damage charge unless significant damage (large holes, stains, ' +
        'intentional damage) is documented.',
      what_to_ask_landlord: [
        'When was the unit last painted before you moved in?',
        'What specific damage is claimed on which walls?',
        'Is this a full repaint or targeted touch-up?'
      ],
      evidence_helpful: [
        'Move-in photos showing wall condition',
        'Move-out photos showing condition when you left'
      ]
    });
  }

  // ─────────────────────────────────────────────────────────────
  // CLEANING
  // ─────────────────────────────────────────────────────────────
  if (/clean|cleaning|dirty|maid|professional clean|smell|odor/i.test(notes)) {
    defenses.push({
      claim_type: 'cleaning',
      title: 'Cleaning Charge',
      defense_strength: 'MODERATE',
      statute: 'Tex. Prop. Code § 92.104',
      key_point:
        'Landlords can only charge for cleaning beyond what is reasonably expected. ' +
        'Standard move-out cleaning (sweeping, wiping surfaces, cleaning appliances) is ' +
        'often tenant responsibility per lease terms, but charges for "professional cleaning" ' +
        'when the unit was left in reasonable condition may not be justified.',
      what_to_ask_landlord: [
        'What was the specific condition that required professional cleaning?',
        'What does your lease say about cleaning requirements?',
        'Is there photographic evidence of the claimed condition?'
      ],
      evidence_helpful: [
        'Move-out photos showing clean condition',
        'Lease language about cleaning requirements'
      ]
    });
  }

  // ─────────────────────────────────────────────────────────────
  // APPLIANCES / FIXTURES
  // ─────────────────────────────────────────────────────────────
  if (/appliance|refrigerator|stove|oven|dishwasher|faucet|fixture|blinds|window/i.test(notes)) {
    defenses.push({
      claim_type: 'appliances_fixtures',
      title: 'Appliance / Fixture Claim',
      defense_strength: 'MODERATE',
      statute: 'Tex. Prop. Code § 92.104',
      key_point:
        'Appliances and fixtures have useful lifespans. Normal wear from regular use is ' +
        'generally not a tenant\'s financial responsibility. Ask for proof that damage was ' +
        'beyond ordinary use and request receipts showing the repair or replacement cost.',
      what_to_ask_landlord: [
        'How old was the appliance or fixture?',
        'What is the claimed damage vs. normal wear?',
        'Please provide the repair/replacement receipt'
      ],
      evidence_helpful: [
        'Photos of appliance/fixture condition at move-out',
        'Move-in condition report noting any existing issues'
      ]
    });
  }

  // ─────────────────────────────────────────────────────────────
  // ALWAYS INCLUDED: Burden of proof defense
  // ─────────────────────────────────────────────────────────────
  const burdenDefense = {
    claim_type: 'burden_of_proof',
    title: 'Landlord Must Prove Claims',
    defense_strength: 'STRONG',
    statute: 'Tex. Prop. Code §§ 92.104, 92.109',
    key_point:
      'Under Texas law, a landlord who withholds or deducts from a deposit must provide ' +
      'a written itemized list of deductions (§ 92.104). The burden is on the landlord to ' +
      'document and justify each charge. General or vague claims without itemization or ' +
      'supporting receipts are difficult to enforce.' +
      (past30Days
        ? ' Additionally, since the 30-day deadline has passed, any belated itemization ' +
          'may be viewed less favorably under § 92.109.'
        : ''),
    what_to_ask_landlord: [
      'Please provide a written, itemized list of all deductions with specific amounts',
      'Please provide receipts for any repairs or professional services charged',
      'Please provide before and after photos documenting the claimed damage'
    ],
    evidence_helpful: [
      'All documentation showing you left the property in reasonable condition',
      'Lease agreement showing what you agreed to'
    ]
  };

  defenses.push(burdenDefense);

  // ─────────────────────────────────────────────────────────────
  // Build summary
  // ─────────────────────────────────────────────────────────────
  const strongDefenses = defenses.filter(d => d.defense_strength === 'STRONG').length;
  const moderateDefenses = defenses.filter(d => d.defense_strength === 'MODERATE').length;

  let overallStrength;
  if (strongDefenses >= 1 && defenses.length >= 2) overallStrength = 'STRONG';
  else if (moderateDefenses >= 2) overallStrength = 'MODERATE';
  else overallStrength = 'LIMITED';

  const claimsDetected = defenses.filter(d => d.claim_type !== 'burden_of_proof').length > 0;

  return {
    potential_claims_detected: claimsDetected,
    total_defenses: defenses.length,
    overall_defense_strength: overallStrength,
    defenses,
    strategic_note:
      claimsDetected
        ? 'Your notes suggest the landlord may raise damage claims. The key response is to request ' +
          'a detailed written itemization with receipts for every charge. Vague or undocumented ' +
          'claims are difficult to enforce.'
        : 'No specific damage concerns detected from your notes. The burden-of-proof defense applies ' +
          'to any deductions the landlord may claim.',
    disclaimer:
      'These defense points are informational only and based on general principles. ' +
      'Specific legal strategies should be discussed with a licensed Texas attorney.'
  };
}

module.exports = { analyzeDamageDefenses };
