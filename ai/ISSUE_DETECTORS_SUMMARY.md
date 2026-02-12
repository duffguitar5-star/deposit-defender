# Issue Detectors Upgrade Summary

## Files Created/Modified

| File | Change |
|------|--------|
| `server/src/lib/issueDetectors.js` | **NEW** - Enriched issue detection with full outputs |
| `server/src/lib/CaseAnalysisService.js` | **UPDATED** - Now uses issue detectors for leverage points, procedural steps, and statutory refs |

---

## Enriched Leverage Point Structure

Each detected issue now includes:

```json
{
  "rank": 1,
  "point_id": "deadline_missed_no_refund",
  "title": "30-day timeline observation (no refund)",
  "observation": "Based on the information provided: Move-out date: 2024-05-31...",

  "why_this_matters": "According to publicly available Texas guidance, landlords are generally expected to return security deposits or provide an itemized list of deductions within 30 days...",

  "supporting_facts": [
    { "fact": "Move-out date: 2024-05-31", "source": "tenant_intake" },
    { "fact": "Days since move-out: 611", "source": "computed" },
    { "fact": "Deposit amount: $1,500.00", "source": "tenant_intake" }
  ],

  "statute_citations": [
    { "rule_id": "92.103", "citation": "Tex. Prop. Code § 92.103", "title": "Obligation to Refund" },
    { "rule_id": "92.109", "citation": "Tex. Prop. Code § 92.109", "title": "Liability of Landlord" }
  ],

  "lease_citations": [
    { "clause_id": "lease_clause_1", "topic": "security_deposit", "excerpt": "Tenant shall pay a security deposit of $1,500.00.", "source": "Character offset 48" }
  ],

  "recommended_steps": [
    { "action": "document_timeline", "description": "Some tenants choose to create a written timeline..." },
    { "action": "written_request", "description": "Some tenants choose to send written correspondence..." }
  ],

  "severity": "high"
}
```

---

## How Procedural Steps Are Now Derived

```
┌────────────────────────────────────────────────────────────────────────────┐
│                      ISSUE-DRIVEN STEP DERIVATION                          │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  1. Detect Issues                                                          │
│     ├─ deadline_missed_no_refund (HIGH)                                    │
│     ├─ deadline_missed_no_itemization (HIGH)                               │
│     ├─ normal_wear_deduction_concern (MEDIUM)                              │
│     └─ written_communication_exists (LOW)                                  │
│                                                                            │
│  2. Collect recommended_steps from each issue                              │
│     ├─ document_timeline      (from deadline_missed_no_refund)             │
│     ├─ written_request        (from deadline_missed_no_refund)             │
│     ├─ request_itemization    (from deadline_missed_no_itemization)        │
│     ├─ preserve_evidence      (from deadline_missed_no_itemization)        │
│     ├─ document_condition     (from normal_wear_deduction_concern)         │
│     ├─ review_lease_terms     (from normal_wear_deduction_concern)         │
│     └─ preserve_communications (from written_communication_exists)         │
│                                                                            │
│  3. Deduplicate and add general step                                       │
│     └─ organize_records (always first)                                     │
│                                                                            │
│  4. Check severity - only add attorney/court if HIGH severity exists       │
│     ├─ consult_attorney       (HIGH severity detected → included)          │
│     └─ small_claims_info      (HIGH severity detected → included)          │
│                                                                            │
│  5. Number steps sequentially                                              │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

**Key rule:** Attorney and court steps only appear when `severity === 'high'` issues are detected.

---

## Issue Detectors Implemented

| Issue ID | Severity | Trigger |
|----------|----------|---------|
| `deadline_missed_no_refund` | HIGH | 30+ days, deposit not returned |
| `deadline_missed_no_itemization` | HIGH | 30+ days, no itemization received |
| `partial_return_no_itemization` | MEDIUM | Partial return, no itemization |
| `normal_wear_deduction_concern` | MEDIUM | Notes mention wear/tear keywords |
| `cleaning_deduction_concern` | MEDIUM | Notes mention cleaning keywords |
| `lease_extended_timeline` | MEDIUM | Lease clause mentions > 30 days |
| `no_forwarding_address` | LOW | No forwarding address provided |
| `written_communication_exists` | LOW | Email or mail communication used |

---

## Cross-Referencing

Lease clauses are now **automatically linked** to leverage points:

```
detector.evaluate(ctx) → detector.build(ctx)
                              ↓
                         ctx.findLeaseClausesByTopic(['security_deposit', 'move_out'])
                              ↓
                         Returns matching indexed clauses
```

If no clauses match, returns `"none_found"` (explicit placeholder per requirements).

---

## Example Enriched Output

### Leverage Point #1 (High Severity)

```json
{
  "rank": 1,
  "point_id": "deadline_missed_no_refund",
  "title": "30-day timeline observation (no refund)",
  "observation": "Based on the information provided: Move-out date: 2024-05-31. Days since move-out: 611. Deposit amount: $1,500.00. Deposit returned: No. Forwarding address provided: 2024-06-01.",
  "why_this_matters": "According to publicly available Texas guidance, landlords are generally expected to return security deposits or provide an itemized list of deductions within 30 days after the tenant surrenders the premises and provides a forwarding address. When this timeline passes without action, publicly available guidance indicates this may be a significant factor in deposit disputes.",
  "supporting_facts": [
    { "fact": "Move-out date: 2024-05-31", "source": "tenant_intake" },
    { "fact": "Days since move-out: 611", "source": "computed" },
    { "fact": "Deposit amount: $1,500.00", "source": "tenant_intake" },
    { "fact": "Deposit returned: No", "source": "tenant_intake" },
    { "fact": "Forwarding address provided: 2024-06-01", "source": "tenant_intake" }
  ],
  "statute_citations": [
    { "rule_id": "92.103", "citation": "Tex. Prop. Code § 92.103", "title": "Obligation to Refund" },
    { "rule_id": "92.109", "citation": "Tex. Prop. Code § 92.109", "title": "Liability of Landlord" }
  ],
  "lease_citations": [
    { "clause_id": "lease_clause_1", "topic": "security_deposit", "excerpt": "Tenant shall pay a security deposit of $1,500.00.", "source": "Character offset 48" },
    { "clause_id": "lease_clause_2", "topic": "move_out", "excerpt": "The deposit shall be returned within 30 days after vacating, less deductions for damages beyond normal wear and tear.", "source": "Character offset 130" }
  ],
  "recommended_steps": [
    { "action": "document_timeline", "description": "Some tenants choose to create a written timeline documenting key dates: move-out, forwarding address delivery, and days elapsed." },
    { "action": "written_request", "description": "Some tenants choose to send written correspondence requesting the deposit refund or itemized deduction list, keeping copies for their records." }
  ],
  "severity": "high"
}
```

### Issue-Derived Procedural Steps

```json
[
  {
    "step_number": 1,
    "title": "Organize documentation",
    "description": "Some tenants choose to organize all relevant documents (lease, payment records, photos, communications) in one place for easy reference.",
    "category": "documentation",
    "resources": [],
    "applicability_note": null
  },
  {
    "step_number": 2,
    "title": "Document the timeline",
    "description": "Some tenants choose to create a written timeline documenting key dates: move-out, forwarding address delivery, and days elapsed.",
    "category": "documentation",
    "resources": [],
    "applicability_note": "Relevant to: deadline missed no refund"
  },
  {
    "step_number": 9,
    "title": "Consult a licensed Texas attorney",
    "description": "A licensed Texas attorney can provide legal advice specific to individual circumstances. The State Bar of Texas provides a lawyer referral service.",
    "category": "legal_consultation",
    "resources": [
      { "title": "State Bar of Texas Lawyer Referral", "url": "https://www.texasbar.com/AM/Template.cfm?Section=Lawyer_Referral_Service_LRIS_", "description": "Official lawyer referral service provided by the State Bar of Texas." }
    ],
    "applicability_note": null
  },
  {
    "step_number": 10,
    "title": "Learn about small claims court",
    "description": "Texas Justice of the Peace courts handle small claims matters up to $20,000. Information about filing procedures is available through local JP courts. This is informational only and not a recommendation to file.",
    "category": "court_information",
    "resources": [
      { "title": "Texas Justice Courts", "url": "https://www.txcourts.gov/about-texas-courts/trial-courts/justice-of-the-peace-courts/", "description": "Information about Texas Justice of the Peace courts." },
      { "title": "TexasLawHelp.org - Small Claims", "url": "https://texaslawhelp.org/article/small-claims-court", "description": "Free legal information about small claims procedures in Texas." }
    ],
    "applicability_note": null
  }
]
```

---

## Next Steps / Areas for Future Enhancement

1. Add more issue detectors for edge cases
2. Enhance lease clause conflict detection
3. Add severity escalation logic based on combined factors
4. Create letter templates that consume leverage points
