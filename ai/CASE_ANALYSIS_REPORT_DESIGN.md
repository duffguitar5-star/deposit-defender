# Case Analysis Report Design

## Overview

The Case Analysis Report replaces the current "Security Deposit Summary" which merely restates extracted fields. The new design produces **actionable guidance, leverage points, and citations** while maintaining strict compliance with the project's non-legal service constraints.

### Design Philosophy

1. **Compute, don't restate** — Every section derives new value from raw inputs
2. **Cite everything** — Statutory references and lease excerpts are pinpointed
3. **Rank by relevance** — Help users focus on what matters most
4. **Feed downstream systems** — Structured outputs enable letter generation
5. **Safety first** — Language constraints baked into the schema itself

---

## Section-by-Section Justification

### 1. `report_metadata`

**Purpose:** Traceability and versioning.

| Field | Why It Exists |
|-------|---------------|
| `case_id` | Links report to intake data; enables audit trail |
| `generated_at` | Timestamps for legal record-keeping; proves when analysis was run |
| `schema_version` | Future-proofs the system; allows migration logic when schema evolves |
| `jurisdiction` | Hardcoded to `TX`; enforces Texas-only constraint at the data level |

---

### 2. `timeline`

**Purpose:** Transform raw dates into computed deadlines and status indicators.

The current system collects dates but does nothing with them. This section:

- **Computes the 30-day deadline** per Tex. Prop. Code § 92.103
- **Determines if deadlines have passed** (factual, not legal conclusion)
- **Shows days remaining** for time-sensitive awareness

| Subsection | Why It Exists |
|------------|---------------|
| `key_dates` | Normalized dates from intake; single source of truth |
| `computed_deadlines` | The core value—users see actual dates, not just "30 days" |
| `current_status` | At-a-glance understanding of where the case stands |

**Compliance note:** Language uses "commonly referenced" and "publicly available" framing per LANGUAGE_CONSTRAINTS.md.

---

### 3. `compliance_checklist`

**Purpose:** Factual pass/fail assessment of landlord actions based on user-provided information.

This is NOT a legal determination. It answers: "Based on what the tenant told us, did X happen?"

| Field | Why It Exists |
|-------|---------------|
| `item_id` | Machine-readable for downstream logic (e.g., highlighting in UI) |
| `status` | Clear yes/no/partial/unknown—avoids ambiguity |
| `basis` | Explains the determination; shows reasoning |
| `reference` | Links to statutory section when applicable |
| `relevance` | Helps prioritize which items matter most |

**Example items:**
- "Deposit returned" → `no` → basis: "Tenant indicated deposit was not returned"
- "Itemized list provided" → `unknown` → basis: "Tenant selected 'unknown'"

---

### 4. `leverage_points`

**Purpose:** Ranked factual observations that strengthen the tenant's position.

This is the analytical core of the report. Instead of just listing facts, we identify which facts are most relevant based on publicly available Texas guidance.

| Field | Why It Exists |
|-------|---------------|
| `rank` | Priority ordering—#1 is most relevant |
| `point_id` | Categorizes the type of leverage (e.g., `deadline_missed`) |
| `observation` | Neutral, factual statement—no legal conclusions |
| `supporting_facts` | Traceable back to intake or lease extraction |
| `statutory_context` | Links to public Texas guidance |
| `lease_clause_link` | Cross-references relevant lease excerpts |

**Example leverage point:**
```json
{
  "rank": 1,
  "point_id": "deadline_missed",
  "title": "Timeline observation",
  "observation": "According to the dates provided, more than 30 days have passed since the stated move-out date without the tenant receiving a refund or itemized list.",
  "statutory_context": "Publicly available Texas guidance commonly references a 30-day timeline. See Tex. Prop. Code § 92.103."
}
```

---

### 5. `statutory_references`

**Purpose:** Provide Texas Property Code citations for user awareness.

Users need to know which statutes are relevant. This section:

- Lists applicable Tex. Prop. Code sections
- Provides neutral summaries (not interpretations)
- Explains why each is referenced for this specific case

| Field | Why It Exists |
|-------|---------------|
| `citation` | Proper legal citation format |
| `title` | Human-readable section name |
| `summary` | High-level description (not legal interpretation) |
| `relevance_to_case` | Why it's included—ties back to case facts |
| `url` | Link to official source for user verification |

**Common citations:**
- § 92.101 (Security Deposit definition)
- § 92.103 (Obligation to Refund)
- § 92.104 (Retention of Security Deposit)
- § 92.109 (Liability of Landlord)

---

### 6. `lease_clause_citations`

**Purpose:** Pinpoint excerpts from the uploaded lease document.

The current system extracts lease text but doesn't cite it in the output. This section:

- Preserves verbatim excerpts
- Categorizes by topic (deposit, cleaning, damage, etc.)
- Notes potential conflicts with Texas guidance

| Field | Why It Exists |
|-------|---------------|
| `topic` | Categorization for filtering/display |
| `excerpt` | Verbatim text—no paraphrasing |
| `source_context` | Page/section reference when available |
| `relevance_note` | Why this clause matters |
| `potential_conflict` | Flags clauses that may conflict with public guidance |

**Example conflict detection:**
```json
{
  "topic": "security_deposit",
  "excerpt": "Landlord shall return deposit within 60 days...",
  "potential_conflict": "This clause references a 60-day timeline. Publicly available Texas guidance commonly references 30 days."
}
```

---

### 7. `procedural_steps`

**Purpose:** Informational list of steps a tenant might consider.

This replaces vague advice with structured, categorized steps. All language uses "some tenants choose to" framing per LANGUAGE_CONSTRAINTS.md.

| Field | Why It Exists |
|-------|---------------|
| `step_number` | Logical ordering |
| `category` | Groups steps by type (documentation, communication, etc.) |
| `description` | Informational, non-directive language |
| `resources` | Links to public resources (Texas Bar, courts, etc.) |
| `applicability_note` | When this step is relevant based on case facts |

**Categories:**
- `documentation` — Gathering records
- `communication` — Written correspondence
- `legal_consultation` — Attorney referral
- `court_information` — Small claims / JP court info (Texas-specific)

---

### 8. `evidence_checklist`

**Purpose:** Help tenants understand what documentation might be useful.

Organized by category with importance ratings and provision status.

| Field | Why It Exists |
|-------|---------------|
| `category_id` | Groups related evidence |
| `status` | Tracks what's been provided vs. missing |
| `importance` | Helps prioritize gathering efforts |
| `high_importance_missing` | Quick view of critical gaps |

**Categories:**
- Lease documents (lease, amendments, addenda)
- Financial records (deposit receipt, bank records)
- Move-out documentation (inspection report, photos)
- Communication records (emails, texts, letters)
- Property condition (photos, videos, timestamps)

---

### 9. `letter_generator_inputs`

**Purpose:** Structured data for downstream letter template generation.

This is the bridge between analysis and document output. Contains everything needed to populate an informational letter template.

| Subsection | Why It Exists |
|------------|---------------|
| `tenant` | Sender information |
| `landlord` | Recipient information |
| `property` | Property details |
| `facts` | Key facts in structured format |
| `timeline_summary` | Pre-formatted for letter inclusion |
| `document_references` | Citations to include |
| `letter_type` | Selects template variant |

**Letter types:**
- `informational_summary` — Facts-only document
- `factual_record` — More detailed record of events

---

### 10. `disclaimers`

**Purpose:** Enforce mandatory disclaimers at the schema level.

The primary disclaimer is a `const` value—it cannot be omitted or altered. Section-specific disclaimers can be added for nuanced warnings.

| Field | Why It Exists |
|-------|---------------|
| `primary` | Hardcoded, prominent disclaimer |
| `sections` | Additional disclaimers for specific sections |

**Example section disclaimers:**
- `compliance_checklist` → "These determinations are based solely on information provided by the user and do not constitute legal findings."
- `leverage_points` → "These observations are informational only and do not predict legal outcomes."

---

## Data Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Tenant Intake  │────▶│  Case Analysis  │────▶│  Letter Output  │
│  (raw facts)    │     │  Report Engine  │     │  (PDF/document) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │
         │              ┌────────┴────────┐
         │              │                 │
         ▼              ▼                 ▼
┌─────────────────┐  ┌──────────────┐  ┌──────────────────┐
│ Lease Extraction│  │  Deadline    │  │ Compliance       │
│ (clauses)       │  │  Computation │  │ Evaluation       │
└─────────────────┘  └──────────────┘  └──────────────────┘
```

---

## Compliance Matrix

| Schema Section | LEGAL_SAFETY_RULES Compliance | LANGUAGE_CONSTRAINTS Compliance |
|----------------|-------------------------------|--------------------------------|
| timeline | Uses "commonly referenced" framing | No directive language |
| compliance_checklist | "Based on information provided" | No legal conclusions |
| leverage_points | "Factual observations" only | Neutral, informational |
| statutory_references | "Publicly available guidance" | No interpretation |
| procedural_steps | "Some tenants choose to" | No "should" or "must" |
| disclaimers | Hardcoded primary disclaimer | Fixed, compliant text |

---

## Non-Goals (Explicitly Excluded)

1. **No legal advice** — Schema does not support "you should" statements
2. **No outcome predictions** — No fields for likelihood or success rates
3. **No demand language** — Letter type is `informational_summary`, not `demand_letter`
4. **No multi-state support** — Jurisdiction is `const: "TX"`
5. **No landlord contact** — No fields for automated outreach

---

## Future Extensions (Not In Scope)

These could be added later with owner approval:

- `court_filing_inputs` — Data for small claims forms
- `attorney_referral` — Structured attorney finder integration
- `follow_up_timeline` — Tracking subsequent communications
- `case_outcome` — Post-resolution tracking

---

## Schema Version

**Version:** 1.0.0

Changes to this schema affecting user-facing language or scope require explicit owner approval per CHANGE_CONTROL_RULES.md.
