'use strict';
// Direct test of updated patterns (matches what's now in cases.js)

const text = [
  'RESIDENTIAL LEASE AGREEMENT',
  'This Residential Lease Agreement is entered into on January 15, 2024, between ABC Property',
  'Management LLC (Landlord), located at 456 Oak Avenue, Austin, TX 78702, and Jane Smith (Tenant).',
  'PROPERTY: The Landlord hereby leases to Tenant the premises located at 123 Main Street, Apt 4,',
  'Austin, TX 78701, Travis County, Texas.',
  'TERM: The lease term commences on 01/15/2024 and ends on 01/14/2025.',
  'SECURITY DEPOSIT: Tenant shall pay a security deposit in the amount of $1,200.00 upon signing this agreement.',
  'The security deposit shall be held in accordance with Texas Property Code Section 92.101 et seq.',
  'MOVE-OUT OBLIGATIONS: Upon vacating the premises, Tenant must provide Landlord with a written forwarding address.',
  'Tenant must surrender the keys and return all property to its original condition, less normal wear and tear.',
  'CLEANING: Tenant agrees to return the premises in a clean condition.',
  'DAMAGE: Tenant is responsible for any damage beyond normal wear and tear.',
  'Landlord will provide an itemized list of deductions within 30 days of move-out.',
].join('  ');

const normalized = text.replace(/\s+/g, ' ').trim();

const STREET_SUFFIX_RE = /\b(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Lane|Ln|Court|Ct|Way|Place|Pl|Circle|Cir|Parkway|Pkwy|Terrace|Ter|Trail|Trl)\b\.?/i;
const SQ_FT_RE = /square\s*f(?:eet|oot|t)|\bsq\.?\s*ft\b/i;
const MONEY_RE = /\$\s*\d|\d{1,3}(?:,\d{3})+(?:\.\d{2})?$/;
const SECTION_NUM_RE = /^(?:section|§)\s*\d+/i;

const SF = '(?:Street|St\\.?|Avenue|Ave\\.?|Road|Rd\\.?|Drive|Dr\\.?|Boulevard|Blvd\\.?|Lane|Ln\\.?|Court|Ct\\.?|Way|Place|Pl\\.?|Circle|Cir\\.?|Parkway|Pkwy\\.?|Terrace|Ter\\.?|Trail|Trl\\.?)';
const UNIT_SUFFIX = '(?:\\s*,?\\s*(?:Apt|Suite|Ste|Unit|#)\\s*[A-Za-z0-9]+)?';

function addrConfidence(addr) {
  const hasSuffix = STREET_SUFFIX_RE.test(addr);
  const hasStateZip = /(?:TX|Texas)\s*\d{5}/.test(addr);
  const hasZip = /\d{5}/.test(addr);
  if (hasSuffix && (hasStateZip || hasZip)) return 'high';
  if (hasSuffix) return 'medium';
  return 'low';
}

function validateAddr(addr, label) {
  if (!addr || addr.length < 6 || addr.length > 150) return { ok: false, reason: 'length' };
  if (SQ_FT_RE.test(addr)) return { ok: false, reason: 'square footage' };
  if (MONEY_RE.test(addr)) return { ok: false, reason: 'monetary value' };
  if (SECTION_NUM_RE.test(addr)) return { ok: false, reason: 'section number' };
  if (!STREET_SUFFIX_RE.test(addr)) return { ok: false, reason: 'no street suffix' };
  if (!/^\d/.test(addr)) return { ok: false, reason: 'no leading number' };
  if (addr.trim().split(/\s+/).length < 3) return { ok: false, reason: 'fewer than 3 words' };
  return { ok: true };
}

const propertyAddrPatterns = [
  new RegExp(
    `(?:property\\s*address|leased\\s*premises\\s*(?:is|are)?|rental\\s*(?:property|unit|address))[:\\s]+` +
    `([0-9]+\\s+[A-Za-z0-9\\s#.,'-]*?${SF}${UNIT_SUFFIX})`,
    'gi'
  ),
  new RegExp(
    `\\bPROPERTY\\s*:[^\\n]{0,120}?([0-9]+\\s+[A-Za-z][A-Za-z0-9\\s#.,'-]*?${SF}${UNIT_SUFFIX})`,
    'g'  // no 'i' — requires uppercase PROPERTY: to avoid "ABC Property Management LLC" false match
  ),
  new RegExp(
    `(?:leases?|rents?)\\s+to\\s+(?:tenant|lessee)[^.]{0,120}?([0-9]+\\s+[A-Za-z][A-Za-z0-9\\s#.,'-]*?${SF}${UNIT_SUFFIX})`,
    'gi'
  ),
  new RegExp(
    `\\b([0-9]+\\s+[A-Za-z][A-Za-z0-9\\s#.,'-]*?${SF}${UNIT_SUFFIX})\\s*,\\s*[A-Z][a-z]+\\s*,\\s*(?:TX|Texas)`,
    'gi'
  ),
];

const landlordAddrPatterns = [
  new RegExp(
    `(?:landlord|lessor|owner|management|notice\\s+to\\s+(?:landlord|owner|lessor))\\s*(?:address|contact|information)?[:\\s]+` +
    `([0-9]+\\s+[A-Za-z0-9\\s#.,'-]*?${SF}${UNIT_SUFFIX})`,
    'gi'
  ),
  new RegExp(
    `(?:landlord|lessor|owner|management)[^.]{0,60}?(?:address|located\\s+at)[:\\s]+` +
    `([0-9]+\\s+[A-Za-z0-9\\s#.,'-]*?${SF}${UNIT_SUFFIX})`,
    'gi'
  ),
];

console.log('═'.repeat(60));
console.log('PROPERTY ADDRESS PATTERNS');
console.log('─'.repeat(60));
let propertyAddress = null;
for (let i = 0; i < propertyAddrPatterns.length; i++) {
  const p = propertyAddrPatterns[i];
  p.lastIndex = 0;
  const m = p.exec(normalized);
  if (m && m[1]) {
    const candidate = m[1].trim().replace(/\s+/g, ' ').replace(/[,;:]+$/, '').trim();
    const v = validateAddr(candidate, 'property_address');
    console.log(`Pattern ${i + 1}: candidate = "${candidate}"`);
    if (v.ok) {
      console.log(`  → ACCEPTED, confidence: ${addrConfidence(candidate)}`);
      propertyAddress = candidate;
      break;
    } else {
      console.log(`  → REJECTED: ${v.reason}`);
    }
  } else {
    console.log(`Pattern ${i + 1}: no match`);
  }
}

console.log('\n' + '─'.repeat(60));
console.log('LANDLORD ADDRESS PATTERNS');
console.log('─'.repeat(60));
let landlordAddress = null;
for (let i = 0; i < landlordAddrPatterns.length; i++) {
  const p = landlordAddrPatterns[i];
  p.lastIndex = 0;
  const m = p.exec(normalized);
  if (m && m[1]) {
    const streetCandidate = m[1].trim().replace(/\s+/g, ' ').replace(/[,;:]+$/, '').trim();
    const v = validateAddr(streetCandidate, 'landlord_address');
    console.log(`Pattern ${i + 1}: candidate = "${streetCandidate}"`);
    if (v.ok) {
      const embedded = streetCandidate.match(/,\s*([A-Za-z][A-Za-z\s]{1,25}?)\s*,\s*(TX|Texas)\s*(\d{5}(?:-\d{4})?)/i);
      let street = streetCandidate, city = null, state = null, zip = null;
      if (embedded) {
        street = streetCandidate.slice(0, embedded.index).trim();
        city = embedded[1].trim(); state = 'TX'; zip = embedded[3].trim();
      } else {
        const after = normalized.slice(m.index + m[0].length, m.index + m[0].length + 100);
        const trailing = after.match(/,?\s*([A-Za-z][A-Za-z\s]{1,25}?)\s*,\s*(TX|Texas)\s*(\d{5}(?:-\d{4})?)/i);
        if (trailing) { city = trailing[1].trim(); state = 'TX'; zip = trailing[3].trim(); }
      }
      landlordAddress = { street, city, state, zip };
      console.log(`  → ACCEPTED:`, JSON.stringify(landlordAddress));
      break;
    } else {
      console.log(`  → REJECTED: ${v.reason}`);
    }
  } else {
    console.log(`Pattern ${i + 1}: no match`);
  }
}

console.log('\n' + '═'.repeat(60));
console.log('FINAL OUTPUT');
console.log('─'.repeat(60));
console.log(JSON.stringify({
  deposit_amount: '$1,200.00',
  deposit_amount_confidence: 'high',
  property_address: propertyAddress,
  property_address_confidence: propertyAddress ? addrConfidence(propertyAddress) : null,
  landlord_address: landlordAddress,
  landlord_address_confidence: landlordAddress ? addrConfidence(
    landlordAddress.zip ? `${landlordAddress.street}, ${landlordAddress.city}, TX ${landlordAddress.zip}` : landlordAddress.street
  ) : null,
  city: 'Austin',
  zip_code: '78701',
  lease_start_date: '2024-01-15',
  lease_end_date: '2025-01-14',
  county: 'Travis',
}, null, 2));
