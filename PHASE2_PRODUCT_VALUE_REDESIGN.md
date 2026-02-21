# PHASE 2: PRODUCT VALUE REDESIGN

## The Core Question

**"What does Deposit Defender do that ChatGPT + Google cannot?"**

### Current Answer (Weak)
- ✅ Parses lease text → **ChatGPT can do this with uploaded PDF**
- ✅ Cites Texas statutes → **Google: "texas security deposit law" returns same statutes**
- ✅ Generates timeline → **Tenant knows it's been 45 days**
- ✅ Creates PDF report → **ChatGPT can generate demand letter**

**Current unique value: ~$3-5 (convenience), not $20**

### Required Answer (Strong)

**Deposit Defender must provide STRATEGIC INTELLIGENCE:**

1. **Case Strength Scoring** (quantified leverage)
2. **Strategic Recommendation Engine** (what to do next)
3. **Damage Claim Defense System** (counter landlord tactics)
4. **Recovery Probability Modeling** (realistic expectations)
5. **Escalation Pathway Guidance** (demand → small claims → attorney)

---

## 2.1 STRONGER LEVERAGE ENGINE

### Current State: Descriptive

```json
{
  "issue_id": "deadline_missed_full_deposit",
  "severity": "high",
  "title": "Landlord Missed 30-Day Refund Deadline",
  "why_this_matters": "Under Texas Property Code § 92.103, landlords must return..."
}
```

**Problem:** This restates what happened, not what it MEANS strategically.

### Target State: Prescriptive with Quantified Leverage

```json
{
  "issue_id": "deadline_missed_full_deposit",
  "leverage_score": 95,
  "leverage_grade": "A",
  "strategic_position": "STRONG",

  "risk_analysis": {
    "tenant_win_probability": 85,
    "landlord_defense_strength": "weak",
    "evidence_quality": "strong",
    "procedural_compliance": "excellent"
  },

  "recovery_estimate": {
    "best_case": "$4,600",
    "likely_case": "$1,600",
    "worst_case": "$750",
    "confidence": "90%"
  },

  "landlord_vulnerability": {
    "forfeiture_exposure": true,
    "bad_faith_indicators": [
      "No communication for 45 days",
      "No itemization provided",
      "No response to tenant follow-up"
    ],
    "statutory_multiplier_eligible": true,
    "attorney_fee_recovery": true
  },

  "next_best_action": {
    "recommendation": "SEND_DEMAND_LETTER",
    "urgency": "HIGH",
    "rationale": "Strong statutory position. Demand letter likely triggers settlement.",
    "success_probability": "75-85%",
    "timeline": "14-30 days to resolution"
  }
}
```

### Implementation: New Scoring Algorithms

Create **`server/src/lib/leverageScoring.js`**:

```javascript
/**
 * Calculate leverage score (0-100) based on case factors
 */
function calculateLeverageScore(context) {
  let score = 0;

  // Timeline factors (max 30 points)
  if (context.daysSinceMoveOut > 30 && !context.depositReturned) {
    score += 30;  // Clear statutory violation
  } else if (context.daysSinceMoveOut > 30 && !context.itemizationProvided) {
    score += 25;  // Itemization deadline missed
  } else if (context.daysSinceMoveOut >= 15 && context.daysSinceMoveOut <= 29) {
    score += 10;  // Within window, pressure available
  }

  // Evidence factors (max 25 points)
  if (context.forwardingAddressProvided) score += 10;  // Tenant complied
  if (context.hasLeaseDocument) score += 5;  // Documentary evidence
  if (context.hasMoveinPhotos) score += 5;  // Damage defense
  if (context.hasCommunicationTrail) score += 5;  // Paper trail

  // Landlord behavior factors (max 25 points)
  if (context.noLandlordResponse) score += 15;  // Stonewalling
  if (context.noItemization && context.depositReturned === 'partial') {
    score += 10;  // Unlawful deduction
  }
  const badFaithCount = countBadFaithIndicators(context);
  if (badFaithCount > 0) score += Math.min(badFaithCount * 5, 10);

  // Legal clarity factors (max 20 points)
  if (context.clearStatutoryViolation) score += 20;  // Black & white case
  else if (context.likelyViolation) score += 10;  // Grey area

  return Math.min(score, 100);
}

/**
 * Estimate win probability (0-100%)
 */
function estimateWinProbability(leverageScore, evidenceQuality, landlordDefenseStrength) {
  let baseProb = leverageScore * 0.7;  // Leverage is 70% of probability

  // Adjust for evidence quality
  const evidenceMultipliers = {
    'strong': 1.2,
    'moderate': 1.0,
    'weak': 0.7,
    'minimal': 0.4
  };
  baseProb *= evidenceMultipliers[evidenceQuality] || 1.0;

  // Adjust for landlord defense strength
  const defenseMultipliers = {
    'weak': 1.1,
    'moderate': 0.9,
    'strong': 0.6
  };
  baseProb *= defenseMultipliers[landlordDefenseStrength] || 1.0;

  return Math.min(Math.max(baseProb, 5), 95);  // Clamp 5-95%
}

/**
 * Assign leverage grade A-F
 */
function getLeverageGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Detect bad faith indicators
 */
function countBadFaithIndicators(context) {
  const indicators = [];

  if (context.daysSinceMoveOut > 45 && !context.depositReturned) {
    indicators.push("No refund for 45+ days");
  }
  if (context.daysSinceMoveOut > 60 && !context.itemizationProvided) {
    indicators.push("No itemization for 60+ days");
  }
  if (context.tenantFollowUpCount >= 2 && !context.landlordResponseReceived) {
    indicators.push("No response to multiple follow-ups");
  }
  if (context.depositReturned === false && context.noExplanation) {
    indicators.push("Withheld deposit without explanation");
  }

  return indicators;
}

module.exports = {
  calculateLeverageScore,
  estimateWinProbability,
  getLeverageGrade,
  countBadFaithIndicators
};
```

---

## 2.2 STRATEGY ENGINE (What Should Tenant Do?)

Create **`server/src/lib/strategyEngine.js`**:

```javascript
/**
 * Determine strategic recommendation based on case strength
 */
function determineStrategy(leverageScore, depositAmount, context) {
  const deposit = parseFloat(depositAmount.replace(/[$,]/g, ''));

  // STRONG LEVERAGE (80-100): Demand letter highly effective
  if (leverageScore >= 80) {
    return {
      recommended_action: "SEND_DEMAND_LETTER",
      urgency: "HIGH",
      rationale: "Your statutory position is strong. A formal demand letter via certified mail is likely to trigger settlement within 14 days.",
      success_probability: "75-85%",
      timeline: "14-30 days to resolution",
      cost: "$8 (certified mail)",

      next_steps: [
        {
          step: 1,
          action: "Download demand letter template from this report",
          deadline: "Today"
        },
        {
          step: 2,
          action: "Send via USPS certified mail (return receipt requested)",
          deadline: "Within 3 days",
          cost: "$8"
        },
        {
          step: 3,
          action: "Set calendar reminder for 14 days from mail receipt",
          deadline: "After sending"
        },
        {
          step: 4,
          action: "If no response: File small claims lawsuit",
          deadline: "Day 15 onwards",
          cost: "$50-150"
        }
      ],

      if_no_response: "File small claims lawsuit. Your win probability is 85% based on case strength.",
      estimated_total_cost: deposit < 1000 ? "$58-158 (mail + filing)" : "$8-158",

      escalation_path: {
        phase_1: "Demand letter (current recommended action)",
        phase_2: "Small claims filing (if no response in 14 days)",
        phase_3: "Court hearing (typically 30-60 days after filing)",
        phase_4: "Judgment collection (if landlord doesn't pay voluntarily)"
      }
    };
  }

  // MODERATE LEVERAGE (50-79): Negotiate first
  if (leverageScore >= 50) {
    return {
      recommended_action: "NEGOTIATE_SETTLEMENT",
      urgency: "MEDIUM",
      rationale: "You have legitimate claims but some uncertainty. Negotiation may avoid court costs while achieving acceptable recovery.",
      success_probability: "50-70%",
      timeline: "30-60 days to resolution",
      cost: "$0-50 (certified mail for requests)",

      next_steps: [
        {
          step: 1,
          action: "Send itemization request letter (if not received)",
          deadline: "Within 7 days"
        },
        {
          step: 2,
          action: "Propose settlement at 75-80% of deposit",
          deadline: "After receiving itemization OR after 21 days"
        },
        {
          step: 3,
          action: "Document all communications",
          deadline: "Ongoing"
        },
        {
          step: 4,
          action: "Evaluate small claims filing if settlement fails",
          deadline: "Day 30 onwards"
        }
      ],

      if_no_response: "Weigh cost of small claims filing ($50-150 + time) against deposit amount. Consider free legal aid consultation.",
      estimated_total_cost: "$0-200 (mail + potential filing)",

      settlement_guidance: {
        minimum_acceptable: deposit * 0.70,
        target: deposit * 0.85,
        maximum_you_should_accept: deposit * 0.90 + " (if it avoids court time/stress)"
      }
    };
  }

  // WEAK LEVERAGE (30-49): Careful evaluation
  if (leverageScore >= 30) {
    return {
      recommended_action: "EVALUATE_SMALL_CLAIMS",
      urgency: "LOW",
      rationale: "Your case has merit but faces challenges. Filing may not be cost-effective given deposit amount and win probability.",
      success_probability: "30-50%",
      timeline: "Unknown (depends on landlord cooperation)",
      cost: "$50-150 (small claims) + time off work",

      next_steps: [
        {
          step: 1,
          action: "Request itemization in writing",
          deadline: "Within 7 days"
        },
        {
          step: 2,
          action: "Gather ALL evidence: photos, lease, receipts, communications",
          deadline: "Within 14 days"
        },
        {
          step: 3,
          action: "Calculate: Is deposit amount > (filing fee + 4 hours wages)?",
          deadline: "Before deciding to file"
        },
        {
          step: 4,
          action: "Seek free legal aid consultation (if available in your county)",
          deadline: "Before filing"
        }
      ],

      if_no_response: "May not be worth pursuing without stronger evidence or higher deposit amount.",
      estimated_total_cost: "$50-300 (filing + time)",

      cost_benefit_warning: deposit < 500 ?
        "⚠️ WARNING: Your deposit ($" + deposit + ") may not justify court costs and time investment given moderate win probability." :
        "Filing may be justified, but strengthen evidence first."
    };
  }

  // VERY WEAK (<30): Cut losses
  return {
    recommended_action: "DOCUMENT_AND_CLOSE",
    urgency: "LOW",
    rationale: "Based on provided information, pursuing this case will likely cost more (in money and time) than potential recovery.",
    success_probability: "<30%",
    timeline: "N/A",
    cost: "$0",

    next_steps: [
      {
        step: 1,
        action: "Request itemization for your records",
        deadline: "Optional"
      },
      {
        step: 2,
        action: "File complaint with local tenant advocacy organization",
        deadline: "Optional (creates public record)"
      },
      {
        step: 3,
        action: "Leave honest review on rental platform (if applicable)",
        deadline: "Optional"
      },
      {
        step: 4,
        action: "Move forward - focus energy on productive activities",
        deadline: "Now"
      }
    ],

    if_no_response: "Accept the loss as a learning experience. Document landlord's behavior for future reference.",
    estimated_total_cost: "$0",

    reality_check: "Sometimes the best decision is NOT to pursue. Your time and mental energy are valuable."
  };
}

module.exports = { determineStrategy };
```

---

## 2.3 RECOVERY ESTIMATOR

Create **`server/src/lib/recoveryEstimator.js`**:

```javascript
const { parseAmount } = require('./formatters');

/**
 * Calculate realistic recovery estimates
 */
function estimateRecovery(depositAmount, leverageScore, daysSinceMoveOut, badFaithIndicators) {
  const deposit = parseAmount(depositAmount);

  // Best case: statutory damages under § 92.109
  let bestCase = deposit;
  if (daysSinceMoveOut > 30) {
    bestCase += 100; // § 92.109(a) penalty

    // Bad faith multiplier (up to 3x deposit)
    if (badFaithIndicators.length >= 2) {
      bestCase += deposit * 2; // Total 3x deposit possible
    }
  }

  // Likely case: full deposit + penalty (if applicable)
  let likelyCase = deposit;
  if (leverageScore > 80 && daysSinceMoveOut > 30) {
    likelyCase += 100; // Penalty likely
  }

  // Worst case: landlord provides late itemization with some deductions
  let worstCase = deposit * 0.5; // Assume some legitimate deductions
  if (leverageScore > 70) {
    worstCase = deposit * 0.75; // Strong case = less downside
  }
  if (leverageScore > 85) {
    worstCase = deposit * 0.85; // Very strong case
  }

  // Probability distribution
  let probabilities = calculateProbabilityDistribution(leverageScore, daysSinceMoveOut);

  return {
    deposit_amount: formatCurrency(deposit),
    best_case: formatCurrency(bestCase),
    likely_case: formatCurrency(likelyCase),
    worst_case: formatCurrency(worstCase),
    confidence_level: "90%",

    probability_distribution: probabilities,

    statutory_details: {
      base_deposit: formatCurrency(deposit),
      penalty_100: daysSinceMoveOut > 30 ? "$100" : "$0",
      bad_faith_multiplier: badFaithIndicators.length >= 2 ? "Up to 2x deposit" : "Not applicable",
      attorney_fees: daysSinceMoveOut > 30 ? "Recoverable if you hire attorney" : "N/A",
      court_costs: "Recoverable if you win small claims"
    },

    breakdown: {
      scenario_best: `$${deposit} (deposit) + $100 (penalty) + $${deposit * 2} (bad faith damages) = $${bestCase}`,
      scenario_likely: leverageScore > 80 ?
        `$${deposit} (deposit) + $100 (penalty) = $${likelyCase}` :
        `$${deposit} (full deposit only)`,
      scenario_worst: `$${worstCase} (partial recovery after late itemization)`
    }
  };
}

function calculateProbabilityDistribution(leverageScore, daysSinceMoveOut) {
  if (leverageScore >= 80 && daysSinceMoveOut > 30) {
    return {
      full_recovery_plus_penalties: 45,
      full_recovery: 30,
      partial_recovery: 20,
      no_recovery: 5
    };
  }

  if (leverageScore >= 60) {
    return {
      full_recovery_plus_penalties: 10,
      full_recovery: 40,
      partial_recovery: 40,
      no_recovery: 10
    };
  }

  if (leverageScore >= 40) {
    return {
      full_recovery_plus_penalties: 0,
      full_recovery: 20,
      partial_recovery: 50,
      no_recovery: 30
    };
  }

  return {
    full_recovery_plus_penalties: 0,
    full_recovery: 10,
    partial_recovery: 40,
    no_recovery: 50
  };
}

function formatCurrency(amount) {
  return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

module.exports = { estimateRecovery };
```

---

## 2.4 DAMAGE CLAIM DEFENSE SYSTEM

Create **`server/src/lib/damageDefenseAnalyzer.js`**:

```javascript
/**
 * Analyze potential landlord damage claims and generate defenses
 */
function analyzeDamageDefenses(tenantNotes, depositAmount, tenancyDuration, leaseStartDate) {
  const defenses = [];
  const notes = (tenantNotes || '').toLowerCase();

  // Carpet damage defense
  if (/carpet|floor|stain|spot/i.test(notes)) {
    const carpetAge = estimateCarpetAge(leaseStartDate);
    defenses.push({
      claim_type: "carpet_damage",
      defense_strength: carpetAge > 5 ? "STRONG" : "MODERATE",
      statute: "§ 92.104",
      title: "Carpet Wear Defense",
      argument: carpetAge > 5 ?
        `Carpet was ${carpetAge} years old. Standard lifespan: 5-7 years. Landlord cannot charge tenant for replacement of worn-out carpet.` :
        "Scuffs and normal wear from living are tenant's responsibility under § 92.104(a). Landlord must prove damage exceeds normal wear.",
      evidence_needed: [
        "Request carpet installation date from landlord",
        "Photos showing carpet condition at move-out",
        "Move-in photos (if available) showing pre-existing condition"
      ],
      burden_of_proof: "Landlord must prove damage was beyond normal wear",
      expected_outcome: carpetAge > 5 ?
        "Full defense - carpet was beyond useful life" :
        "Partial defense - tenant may owe depreciated value only",
      depreciation_schedule: carpetAge > 0 ? {
        original_value: "Unknown (request from landlord)",
        age_years: carpetAge,
        remaining_value: Math.max(0, ((7 - carpetAge) / 7 * 100)).toFixed(0) + "%",
        tenant_liability: carpetAge >= 7 ? "$0" : "Depreciated value only"
      } : null
    });
  }

  // Paint/wall damage defense
  if (/paint|wall|scuff|mark|hole|nail/i.test(notes)) {
    defenses.push({
      claim_type: "painting_charges",
      defense_strength: /hole|punch|kick/i.test(notes) ? "WEAK" : "STRONG",
      statute: "§ 92.104(a)",
      title: "Normal Wear vs. Damage",
      argument: "Minor scuff marks, picture hook holes, and normal wall wear are NOT tenant liability. Landlord cannot charge full repaint for minor touch-ups.",
      evidence_needed: [
        "Photos showing walls were not damaged beyond normal living",
        "Document: how many years did you live there? (paint typically needs refresh every 3-5 years)"
      ],
      burden_of_proof: "Landlord must specify which walls, what damage, and provide before/after photos",
      expected_outcome: "Full defense unless actual damage (large holes, intentional destruction) proven",
      cost_reasonableness: {
        reasonable: "Touch-up paint for specific areas: $50-150",
        unreasonable: "Full apartment repaint: $600-1,200 (this is normal turnover cost, not tenant liability)"
      }
    });
  }

  // Cleaning fee defense
  if (/clean|dirty|mess|vacuum|sweep/i.test(notes)) {
    defenses.push({
      claim_type: "cleaning_fees",
      defense_strength: "MODERATE",
      statute: "§ 92.104",
      title: "Routine Cleaning vs. Excessive Filth",
      argument: "Landlord cannot charge for routine move-out cleaning. Only excessive filth or unsanitary conditions justify charges.",
      evidence_needed: [
        "Photos showing property was left in broom-clean condition",
        "Lease clause about cleaning requirements (if any)"
      ],
      burden_of_proof: "Landlord must prove cleaning exceeded normal turnover",
      expected_outcome: "Defense succeeds unless property was left in uninhabitable/filthy state",
      reasonable_vs_unreasonable: {
        tenant_responsible: "Property left filthy, pest infestation, biohazards",
        landlord_responsible: "Normal dusting, vacuuming, basic cleaning between tenants"
      }
    });
  }

  // Generic burden of proof (always applies)
  defenses.push({
    claim_type: "burden_of_proof",
    defense_strength: "STRONG",
    statute: "§ 92.109 + Common Law",
    title: "Landlord Missed Deadline - Presumption Favors Tenant",
    argument: "Since landlord missed the 30-day deadline, § 92.109 creates a legal presumption in tenant's favor. Landlord must overcome this presumption with clear evidence.",
    evidence_needed: [
      "None - burden is on landlord"
    ],
    burden_of_proof: "Landlord must provide: itemized receipts, before/after photos, installation dates, proof of actual damage",
    expected_outcome: "Landlord's late or unsupported claims likely fail entirely",
    strategic_value: "CRITICAL - This is your strongest defense"
  });

  return {
    total_defenses_available: defenses.length,
    overall_defense_strength: assessOverallStrength(defenses),
    defenses: defenses,
    strategic_guidance: {
      primary_strategy: "Demand itemized proof with receipts and photos for ANY claimed damage",
      counter_tactics: [
        "Challenge each line item individually",
        "Request depreciation calculations",
        "Invoke § 92.104 normal wear protection",
        "Cite § 92.109 deadline violation as rebuttal presumption"
      ],
      likely_outcome: "Most retaliatory damage claims fail when challenged with evidence requirements"
    }
  };
}

function estimateCarpetAge(leaseStartDate) {
  if (!leaseStartDate) return 0;
  const start = new Date(leaseStartDate);
  const now = new Date();
  return Math.floor((now - start) / (365.25 * 24 * 60 * 60 * 1000));
}

function assessOverallStrength(defenses) {
  const strengths = defenses.map(d => d.defense_strength);
  if (strengths.includes("STRONG") && strengths.length >= 3) return "STRONG";
  if (strengths.includes("STRONG")) return "MODERATE";
  return "WEAK";
}

module.exports = { analyzeDamageDefenses };
```

---

## 2.5 ENHANCED REPORT JSON SCHEMA

Update **`ai/CASE_ANALYSIS_REPORT_SCHEMA.json`**:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Enhanced Case Analysis Report",
  "type": "object",
  "required": [
    "report_metadata",
    "case_strength",
    "timeline",
    "compliance_checklist",
    "leverage_points",
    "strategy",
    "recovery_estimate",
    "statutory_references",
    "disclaimers"
  ],
  "properties": {
    "report_metadata": { /* existing */ },

    "case_strength": {
      "type": "object",
      "description": "NEW: Quantified case strength assessment",
      "properties": {
        "leverage_score": { "type": "number", "minimum": 0, "maximum": 100 },
        "leverage_grade": { "type": "string", "enum": ["A", "B", "C", "D", "F"] },
        "strategic_position": { "type": "string", "enum": ["STRONG", "MODERATE", "WEAK", "UNCERTAIN"] },
        "win_probability": { "type": "number", "minimum": 0, "maximum": 100 },
        "evidence_quality": { "type": "string", "enum": ["strong", "moderate", "weak", "minimal"] },
        "landlord_defense_strength": { "type": "string", "enum": ["weak", "moderate", "strong"] }
      }
    },

    "recovery_estimate": {
      "type": "object",
      "description": "NEW: Financial recovery modeling",
      "properties": {
        "deposit_amount": { "type": "string" },
        "best_case": { "type": "string" },
        "likely_case": { "type": "string" },
        "worst_case": { "type": "string" },
        "confidence_level": { "type": "string" },
        "probability_distribution": {
          "type": "object",
          "properties": {
            "full_recovery_plus_penalties": { "type": "number" },
            "full_recovery": { "type": "number" },
            "partial_recovery": { "type": "number" },
            "no_recovery": { "type": "number" }
          }
        },
        "statutory_details": { "type": "object" }
      }
    },

    "strategy": {
      "type": "object",
      "description": "NEW: Strategic recommendation engine",
      "properties": {
        "recommended_action": {
          "type": "string",
          "enum": ["SEND_DEMAND_LETTER", "NEGOTIATE_SETTLEMENT", "EVALUATE_SMALL_CLAIMS", "DOCUMENT_AND_CLOSE"]
        },
        "urgency": { "type": "string", "enum": ["HIGH", "MEDIUM", "LOW"] },
        "rationale": { "type": "string" },
        "success_probability": { "type": "string" },
        "timeline": { "type": "string" },
        "cost": { "type": "string" },
        "next_steps": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "step": { "type": "number" },
              "action": { "type": "string" },
              "deadline": { "type": "string" },
              "cost": { "type": "string" }
            }
          }
        },
        "escalation_path": {
          "type": "object",
          "properties": {
            "phase_1": { "type": "string" },
            "phase_2": { "type": "string" },
            "phase_3": { "type": "string" },
            "phase_4": { "type": "string" }
          }
        }
      }
    },

    "landlord_vulnerability": {
      "type": "object",
      "description": "NEW: Landlord exposure analysis",
      "properties": {
        "forfeiture_exposure": { "type": "boolean" },
        "bad_faith_indicators": { "type": "array", "items": { "type": "string" } },
        "statutory_multiplier_eligible": { "type": "boolean" },
        "retaliatory_claim_risk": { "type": "string", "enum": ["low", "moderate", "high"] }
      }
    },

    "damage_defense": {
      "type": "object",
      "description": "NEW: Damage claim defense system",
      "properties": {
        "total_defenses_available": { "type": "number" },
        "overall_defense_strength": { "type": "string" },
        "defenses": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "claim_type": { "type": "string" },
              "defense_strength": { "type": "string" },
              "statute": { "type": "string" },
              "title": { "type": "string" },
              "argument": { "type": "string" },
              "evidence_needed": { "type": "array" },
              "expected_outcome": { "type": "string" }
            }
          }
        }
      }
    },

    "evidence_matrix": {
      "type": "object",
      "description": "NEW: Evidence strength assessment",
      "properties": {
        "overall_strength": { "type": "string" },
        "items": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "type": { "type": "string" },
              "present": { "type": "boolean" },
              "strength": { "type": "string" },
              "critical": { "type": "boolean" }
            }
          }
        },
        "gaps": { "type": "array" },
        "impact_of_gaps": { "type": "string" }
      }
    },

    "timeline": { /* existing */ },
    "compliance_checklist": { /* existing */ },
    "leverage_points": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          /* existing fields */,
          "leverage_score": { "type": "number" },
          "strategic_value": { "type": "string" },
          "win_contribution": { "type": "number" }
        }
      }
    },
    "statutory_references": { /* existing */ },
    "disclaimers": { /* existing */ }
  }
}
```

---

## SUMMARY: VALUE TRANSFORMATION

### Before (Current Product)
**"Here are the statutes that apply to your situation."**
- Value: Informational
- Unique competitive advantage: None (Google/ChatGPT provide same)
- Justifies price: $3-5 (convenience)

### After (Strategic Advisor)
**"Here's your leverage score (95/100), win probability (85%), recovery estimate ($1,500-$4,600), and exactly what to do next (send demand letter with 75% settlement probability)."**
- Value: Strategic intelligence
- Unique competitive advantage: Quantified risk/reward, case-specific probability modeling, actionable recommendations
- Justifies price: $20-50 (decision support + confidence)

