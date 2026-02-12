# Texas Security Deposit Rules → Schema Mapping

## Overview

The `tx_security_deposit_rules.json` knowledge base provides deterministic rules for populating four sections of the Case Analysis Report schema. Each rule has machine-evaluable trigger conditions that reference intake fields directly.

---

## 1. Compliance Checklist Mapping

**Schema target:** `compliance_checklist.items[]`

| Rule ID | Schema `item_id` | Trigger | Status Logic |
|---------|------------------|---------|--------------|
| `deposit_returned` | `deposit_returned` | `security_deposit_information.deposit_returned` | Direct field mapping: yes→yes, no→no, partial→partial |
| `itemized_list_provided` | `itemized_list_provided` | `post_move_out_communications.itemized_deductions_received` | Direct field mapping |
| `refund_within_30_days` | `refund_within_30_days` | Computed: `days_since_move_out <= 30 AND (deposit OR itemization received)` | True→yes, False→no, Missing data→unknown |
| `forwarding_address_provided` | `forwarding_address_received` | `move_out_information.forwarding_address_provided` | Direct field mapping with template variable for date |
| `itemization_within_30_days` | `itemization_within_30_days` | Computed: `itemization_date - move_out_date <= 30` | True→yes, False→no, No itemization→not_applicable |

### Field Population

```
Schema Field          ← Rule Field
─────────────────────────────────────────
item_id               ← rule_id
label                 ← label
status                ← status_mapping[input_value].status
basis                 ← status_mapping[input_value].basis_template (with variable substitution)
reference             ← reference
relevance             ← relevance
```

### Example Evaluation

**Input:**
```json
{
  "security_deposit_information": { "deposit_returned": "no" },
  "move_out_information": { "move_out_date": "2024-12-01" }
}
```

**Rule `deposit_returned` produces:**
```json
{
  "item_id": "deposit_returned",
  "label": "Security deposit returned",
  "status": "no",
  "basis": "Tenant indicated the security deposit was not returned.",
  "reference": "Tex. Prop. Code § 92.103(a)",
  "relevance": "high"
}
```

---

## 2. Leverage Points Mapping

**Schema target:** `leverage_points[]`

| Rule ID | Trigger Condition | Rank Weight |
|---------|-------------------|-------------|
| `deadline_missed_no_refund` | `days_since_move_out > 30 AND deposit_returned == "no"` | 100 (highest) |
| `deadline_missed_no_itemization` | `days > 30 AND deposit ∈ [no, partial] AND itemized == "no"` | 95 |
| `partial_return_no_itemization` | `deposit_returned == "partial" AND itemized == "no"` | 85 |
| `lease_clause_extended_timeline` | Lease extraction shows > 30 day timeline | 75 |
| `normal_wear_deduction_concern` | Deposit not returned AND notes contain wear/tear keywords | 60 |
| `no_forwarding_address_timeline` | `forwarding_address == "no" AND deposit_returned == "no"` | 50 |
| `written_communication_exists` | Communication methods include email or mail | 40 |

### Ranking Algorithm

1. Evaluate all rules against intake data
2. Filter to rules where trigger condition is true
3. Sort by `rank_weight` descending
4. Assign `rank` field (1, 2, 3...) in sorted order

### Field Population

```
Schema Field          ← Rule Field
─────────────────────────────────────────
rank                  ← Computed from rank_weight ordering
point_id              ← point_id
title                 ← title
observation           ← observation_template (with variable substitution)
supporting_facts      ← supporting_facts_template (with variable substitution)
statutory_context     ← statutory_context
lease_clause_link     ← lease_clause_link (if present)
```

---

## 3. Statutory References Mapping

**Schema target:** `statutory_references[]`

| Reference ID | Citation | Include Condition |
|--------------|----------|-------------------|
| `92.103` | Tex. Prop. Code § 92.103 | **Always** (core statute) |
| `92.101` | Tex. Prop. Code § 92.101 | **Always** (foundational) |
| `92.104` | Tex. Prop. Code § 92.104 | `deposit_returned ∈ [no, partial]` |
| `92.107` | Tex. Prop. Code § 92.107 | `forwarding_address ∈ [no, unknown]` |
| `92.109` | Tex. Prop. Code § 92.109 | `days_since_move_out > 30 AND deposit ∈ [no, partial]` |

### Field Population

```
Schema Field          ← Rule Field
─────────────────────────────────────────
citation              ← citation
title                 ← title
summary               ← summary
relevance_to_case     ← relevance_template
url                   ← statutes[reference_id].full_text_url
```

### Inclusion Logic

```
if include_when.type == "always":
    include = True
elif include_when.type == "conditional":
    include = evaluate(include_when.conditions)
```

---

## 4. Procedural Steps Mapping

**Schema target:** `procedural_steps[]`

| Step ID | Category | Include Condition |
|---------|----------|-------------------|
| `gather_lease` | documentation | **Always** |
| `gather_deposit_proof` | documentation | **Always** |
| `gather_move_out_docs` | documentation | **Always** |
| `gather_communications` | documentation | **Always** |
| `provide_forwarding_address` | communication | `forwarding_address ∈ [no, unknown]` |
| `written_correspondence` | communication | `deposit_returned ∈ [no, partial]` |
| `consult_attorney` | legal_consultation | **Always** |
| `small_claims_info` | court_information | `days > 30 AND deposit ∈ [no, partial]` |

### Field Population

```
Schema Field          ← Rule Field
─────────────────────────────────────────
step_number           ← step_number (renumbered based on included steps)
title                 ← title
description           ← description
category              ← category
resources             ← resources[]
applicability_note    ← applicability_note
```

### Step Numbering

Steps are renumbered sequentially based on which steps are included:

1. Evaluate all step inclusion conditions
2. Filter to included steps
3. Renumber `step_number` from 1..N

---

## Trigger Condition Syntax

### Direct Field Comparison

```json
{
  "field": "security_deposit_information.deposit_returned",
  "operator": "equals",
  "value": "no"
}
```

### Computed Conditions

```json
{
  "type": "computed",
  "computation": "days_since_move_out > 30",
  "requires": ["move_out_information.move_out_date"]
}
```

### Compound Conditions (AND/OR)

```json
{
  "type": "compound",
  "operator": "AND",
  "conditions": [
    { "field": "computed.days_since_move_out", "operator": "gt", "value": 30 },
    { "field": "security_deposit_information.deposit_returned", "operator": "equals", "value": "no" }
  ]
}
```

### Supported Operators

| Operator | Meaning |
|----------|---------|
| `equals` | Exact match |
| `in` | Value in array |
| `gt` | Greater than |
| `gte` | Greater than or equal |
| `lt` | Less than |
| `lte` | Less than or equal |
| `exists` | Field is not null/undefined |
| `contains` | Array contains value |
| `contains_any` | String contains any of the keywords |

---

## Template Variable Substitution

Templates use `{variable_name}` syntax for dynamic content:

```
"basis_template": "Tenant indicated the security deposit was partially returned. Amount returned: {amount_returned}."
```

### Available Variables

| Variable | Source |
|----------|--------|
| `{move_out_date}` | `move_out_information.move_out_date` |
| `{deposit_amount}` | `security_deposit_information.deposit_amount` |
| `{amount_returned}` | `security_deposit_information.amount_returned` |
| `{days_since_move_out}` | Computed from move_out_date |
| `{forwarding_address_date}` | `move_out_information.forwarding_address_date` |
| `{date_itemized_list_received}` | `post_move_out_communications.date_itemized_list_received` |
| `{communication_methods_list}` | Joined array from `communication_methods_used` |
| `{deposit_returned}` | `security_deposit_information.deposit_returned` |

---

## Deadline Computation

Two deadline rules compute actual dates:

### 30-Day from Move-Out

```
base = move_out_information.move_out_date
deadline = base + 30 days
```

### 30-Day from Forwarding Address

```
base = move_out_information.forwarding_address_date
deadline = base + 30 days (if date exists)
```

Both deadlines populate `timeline.computed_deadlines[]` with:
- `date`: The computed deadline date
- `days_remaining`: (deadline - today)
- `has_passed`: (today > deadline)

---

## Evidence Checklist Generation

The `evidence_checklist_template` provides static structure. Status is determined by:

1. If `detection_field` is defined and has a value → `"provided"`
2. If `detection_field` is defined but null/empty → `"not_provided"`
3. If `detection_field` is null → `"unknown"` (user hasn't indicated)

---

## Language Compliance

All templates use approved language patterns:

| Pattern | Example |
|---------|---------|
| Factual statement | "Tenant indicated..." |
| Informational framing | "According to publicly available Texas guidance..." |
| Non-directive | "Some tenants choose to..." |
| Neutral reference | "...commonly referenced in Texas guidance" |

No templates contain prohibited language:
- ❌ "You are entitled to"
- ❌ "The landlord must"
- ❌ "You should"
- ❌ "Demand"
- ❌ "Violation"
