# Lease Clause Indexer

Deterministic indexer for extracting citable clause references from lease documents.

## Purpose

This module processes raw lease text and produces structured clause objects that can be used for:
- Populating the `lease_clause_citations` section of Case Analysis Reports
- Cross-referencing with leverage points
- Letter generation inputs

**IMPORTANT:** This module performs **indexing only**. It does not:
- Interpret legal meaning
- Compare clauses to statutes
- Draw conclusions about validity
- Provide legal analysis

---

## Usage

```javascript
const { indexLeaseClauses } = require('./leaseClauseIndexer');

const leaseText = `
SECTION 8. SECURITY DEPOSIT

Tenant shall pay a security deposit of $1,500.00 upon execution of this lease.
The security deposit shall be returned within 30 days after Tenant vacates
the premises, less any deductions for damages beyond normal wear and tear.
`;

const clauses = indexLeaseClauses(leaseText);
// Returns array of clause objects
```

### With Page Markers

```javascript
const pageMarkers = [
  { page: 1, offset: 0 },
  { page: 2, offset: 2500 },
  { page: 3, offset: 5000 },
];

const clauses = indexLeaseClauses(leaseText, pageMarkers);
// Clause objects will include page_number field
```

---

## Output Format

Each clause object contains:

| Field | Type | Description |
|-------|------|-------------|
| `clause_type` | string | Enum value (see supported types below) |
| `title` | string | Best available heading or formatted type |
| `excerpt` | string | ≤25 words from the matched text |
| `start_offset` | number | Character position in source text |
| `end_offset` | number | End character position |
| `page_number` | number\|null | Page number if markers provided |
| `confidence_score` | number | 0–1 confidence rating |

### Example Output

```json
{
  "clause_type": "security_deposit",
  "title": "Security Deposit",
  "excerpt": "Tenant shall pay a security deposit of $1,500.00 upon execution of this lease. The security deposit shall be returned within...",
  "start_offset": 0,
  "end_offset": 245,
  "page_number": 1,
  "confidence_score": 0.85
}
```

---

## Supported Clause Types

| Type | Description |
|------|-------------|
| `security_deposit` | Deposit amount, terms, return conditions |
| `deductions` | Itemization, withholding, deduction lists |
| `cleaning` | Cleaning fees, requirements, conditions |
| `repairs` | Repair obligations, costs, responsibilities |
| `normal_wear_and_tear` | Wear/tear exceptions, definitions |
| `move_out` | Move-out procedures, vacating requirements |
| `surrender` | Surrender of premises, key return |
| `notice` | Notice periods, notification requirements |
| `forwarding_address` | Address requirements for refund |
| `damages` | Property damage, liability clauses |
| `carpet_painting` | Carpet, flooring, painting terms |
| `fees_or_charges` | Additional fees, late charges, penalties |

---

## Indexing Strategy

### 1. Heading Detection (High Confidence)

The indexer first searches for section headings that match clause types:

```
SECTION 8. SECURITY DEPOSIT     → security_deposit (conf: 0.85+)
14. Cleaning Requirements       → cleaning (conf: 0.85+)
NORMAL WEAR AND TEAR           → normal_wear_and_tear (conf: 0.85+)
```

Heading matches receive baseline confidence of 0.70, boosted by keyword presence.

### 2. Keyword Matching (Variable Confidence)

If no heading is found, the indexer searches for keyword clusters:

**Primary keywords** (weight: 2x):
- Strong indicators of clause type
- Example: "security deposit", "return of deposit"

**Secondary keywords** (weight: 1x):
- Supporting terms that increase confidence
- Example: "deposit", "refund", "30 days"

**Exclusion keywords** (negative weight):
- Terms that suggest a different clause type
- Example: "pet deposit" excludes from security_deposit

Keyword-only matches are capped at 0.70 confidence.

### 3. Context Extraction

For each match:
1. Extract 300 characters before and after the match point
2. Adjust boundaries to sentence/paragraph breaks
3. Generate excerpt (truncated to 25 words)

### 4. Deduplication

Overlapping matches of the same clause type are deduplicated, keeping the highest confidence match.

---

## Confidence Scoring

| Match Type | Base Score | Max Score |
|------------|------------|-----------|
| Heading + keywords | 0.70 | 1.00 |
| Heading only | 0.70 | 0.85 |
| Keywords only | 0.30 | 0.70 |

Factors that increase confidence:
- Multiple primary keyword matches
- Presence of section heading
- Secondary keyword support

Factors that decrease confidence:
- Exclusion keyword presence
- Minimal keyword matches
- No heading detected

---

## Known Limitations

### OCR Quality Issues

- Poorly scanned documents may have garbled text
- Character substitution (e.g., "0" vs "O") can break keyword matching
- Missing spaces between words may prevent detection

**Mitigation:** The indexer uses case-insensitive matching and tolerates common OCR artifacts.

### Unconventional Formatting

- Leases without section headings will rely on keyword matching only
- Multi-column layouts may produce fragmented text
- Tables may not extract cleanly

**Mitigation:** Context window extraction attempts to find sentence boundaries.

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| No matches found | Returns empty array |
| Multiple clause types in one paragraph | Returns multiple clauses with overlapping ranges |
| Very short lease | May produce few or no matches |
| Non-English text | Not supported |

### False Positives

The indexer may match:
- Boilerplate text that mentions keywords incidentally
- References to other documents
- Definitions sections

**Mitigation:** Confidence scores help filter weak matches. Downstream consumers should consider filtering by confidence threshold (recommended: ≥0.5).

---

## Examples of Supported Lease Language

### Security Deposit

```
✓ "Security Deposit: $1,200.00"
✓ "The tenant shall pay a refundable security deposit..."
✓ "SECTION 5. SECURITY DEPOSIT AND FEES"
✓ "deposit amount of One Thousand Dollars ($1,000)"
```

### Deductions

```
✓ "Landlord may deduct from the deposit for..."
✓ "itemized list of deductions shall be provided"
✓ "The following may be withheld from the security deposit:"
✓ "Deductions: unpaid rent, damages, cleaning costs"
```

### Normal Wear and Tear

```
✓ "normal wear and tear excepted"
✓ "excluding ordinary wear and tear"
✓ "Landlord shall not charge for normal wear"
✓ "reasonable wear from ordinary use"
```

### Move-Out / Surrender

```
✓ "Upon vacating the premises, tenant shall..."
✓ "Move-out inspection will be conducted..."
✓ "Tenant must surrender all keys upon termination"
✓ "at the end of the lease term, tenant shall leave..."
```

### Forwarding Address

```
✓ "Tenant shall provide a forwarding address in writing"
✓ "Address for deposit refund: _______________"
✓ "The refund will be mailed to the forwarding address"
```

### Cleaning

```
✓ "professional carpet cleaning required at move-out"
✓ "Premises must be left in broom-clean condition"
✓ "Cleaning fee of $150 will be deducted if..."
✓ "steam cleaning of carpets at tenant's expense"
```

### Damages

```
✓ "Tenant is liable for damage to the property"
✓ "damage beyond normal wear and tear"
✓ "cost of repairs for tenant-caused damage"
✓ "any damage to walls, floors, or fixtures"
```

---

## Integration with Case Analysis Report

The indexed clauses can be transformed to match the `lease_clause_citations` schema:

```javascript
const clauses = indexLeaseClauses(leaseText, pageMarkers);

const citations = clauses.map(clause => ({
  item_id: `lease_clause_${clause.start_offset}`,
  topic: clause.clause_type,
  excerpt: clause.excerpt,
  source_context: clause.page_number
    ? `Page ${clause.page_number}`
    : `Character offset ${clause.start_offset}`,
  relevance_note: `Clause detected with ${Math.round(clause.confidence_score * 100)}% confidence.`,
  potential_conflict: null  // To be populated by downstream analysis
}));
```

---

## File Structure

```
server/src/lib/
├── leaseClauseIndexer.js      # Main indexing function
├── clausePatterns.js          # Keyword sets and patterns
└── leaseClauseIndexer.README.md  # This file
```

---

## Version

**1.0.0** - Initial implementation

No modifications to this module should change clause type enums without updating downstream schema consumers.
