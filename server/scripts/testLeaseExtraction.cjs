#!/usr/bin/env node
/**
 * CLI test harness for lease extraction pipeline.
 *
 * Usage:
 *   node server/scripts/testLeaseExtraction.cjs <path-to-pdf>
 *
 * Outputs structured extracted fields as JSON plus a text preview.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: node server/scripts/testLeaseExtraction.cjs <path-to-pdf>');
  process.exit(1);
}

const absolutePath = path.resolve(filePath);

if (!fs.existsSync(absolutePath)) {
  console.error(`File not found: ${absolutePath}`);
  process.exit(1);
}

// ── Inline copies of extractStructuredData / extractSections so this script
//    is self-contained and does not depend on route-level code ────────────────

const TOPIC_DEFINITIONS = [
  {
    key: 'security_deposit',
    label: 'Security deposit',
    keywords: ['security deposit', 'securitydeposit', 'deposit amount', 'deposit is', 'deposit of', 'refundable', 'damage deposit', 'pet deposit', 'deposit paid', 'deposit will', 'deposit shall'],
  },
  {
    key: 'cleaning',
    label: 'Cleaning',
    keywords: ['cleaning', 'clean', 'cleaned', 'carpet', 'janitorial'],
  },
  {
    key: 'damage',
    label: 'Damage',
    keywords: ['damage', 'damages', 'repair', 'repairs', 'wear and tear'],
  },
  {
    key: 'move_out',
    label: 'Move-out obligations',
    keywords: ['move out', 'move-out', 'moveout', 'vacate', 'surrender', 'keys', 'forwarding address'],
  },
];

function normalizeDate(dateStr) {
  if (!dateStr) return null;
  const monthNames = {
    january: '01', jan: '01', february: '02', feb: '02',
    march: '03', mar: '03', april: '04', apr: '04', may: '05',
    june: '06', jun: '06', july: '07', jul: '07', august: '08', aug: '08',
    september: '09', sep: '09', sept: '09', october: '10', oct: '10',
    november: '11', nov: '11', december: '12', dec: '12',
  };
  const writtenMatch = dateStr.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (writtenMatch) {
    const month = monthNames[writtenMatch[1].toLowerCase()];
    if (month) return `${writtenMatch[3]}-${month}-${writtenMatch[2].padStart(2, '0')}`;
  }
  const isoMatch = dateStr.match(/(\d{4})[\/\-\.](\d{2})[\/\-\.](\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const parts = dateStr.split(/[\/\-\.]/);
  if (parts.length === 3) {
    let [month, day, year] = parts;
    if (year.length === 2) {
      const century = Math.floor(new Date().getFullYear() / 100) * 100;
      year = String(century + parseInt(year, 10));
    }
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return null;
}

function extractStructuredData(text, sections) {
  if (!text || text.trim().length < 20) return null;
  const normalized = text.replace(/\s+/g, ' ').trim();
  const extracted = {};

  // Deposit amount
  if (sections && sections.length > 0) {
    const depositSection = sections.find((s) => s.topic === 'Security deposit');
    if (depositSection?.excerpts?.length > 0) {
      const amountMatch = depositSection.excerpts[0].match(/\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?/);
      if (amountMatch) extracted.deposit_amount = amountMatch[0].replace(/\s+/g, '');
    }
  }
  if (!extracted.deposit_amount) {
    const depositPatterns = [
      /security\s*deposit[:\s]+(?:amount[:\s]+)?(\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
      /deposit[:\s]+(?:amount[:\s]+)?(\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
    ];
    for (const p of depositPatterns) {
      const m = p.exec(normalized);
      if (m && m[1]) { extracted.deposit_amount = m[1].replace(/\s+/g, '').trim(); break; }
    }
  }

  // Property address
  const addressPatterns = [
    /(?:property\s*(?:address)?|premises|leased\s*premises|rental\s*property)[:\s]+([0-9]+[A-Za-z0-9\s#.,'/-]+?)(?:,\s*[A-Z][a-z]+|$|\n)/gi,
    /(?:located\s+at|address\s*(?:is)?|residing\s+at)[:\s]+([0-9]+[A-Za-z0-9\s#.,'/-]+?)(?:,\s*[A-Z][a-z]+|$|\n)/gi,
    /\b([0-9]+\s+[A-Za-z0-9\s#.'-]+?(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Way|Place|Pl|Circle|Cir|Parkway|Pkwy|Terrace|Ter|Trail|Trl)\.?\s*(?:#?\s*\d+)?)/gi,
    /\b([0-9]+\s+[A-Za-z][A-Za-z\s]+?)\s*,\s*[A-Z][a-z]+\s*,?\s*(?:TX|Texas)/gi,
  ];
  for (const p of addressPatterns) {
    p.lastIndex = 0;
    const m = p.exec(normalized);
    if (m && m[1]) {
      const addr = m[1].trim().replace(/\s+/g, ' ').replace(/[,;:]+$/, '').trim();
      if (addr.length > 5 && addr.length < 150 && /^\d/.test(addr)) {
        extracted.property_address = addr; break;
      }
    }
  }

  // City and ZIP
  const cityPatterns = [
    /,\s*([A-Za-z][A-Za-z\s]{1,30}),\s*(?:TX|Texas)\s*(\d{5}(?:-\d{4})?)/gi,
    /([A-Za-z][A-Za-z\s]{1,30}),\s*(?:TX|Texas)\s*(\d{5}(?:-\d{4})?)/gi,
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*,\s*TX\s*(\d{5})/gi,
  ];
  for (const p of cityPatterns) {
    p.lastIndex = 0;
    const m = p.exec(normalized);
    if (m && m[1] && m[2]) {
      const city = m[1].trim();
      if (city.length >= 3 && !['the', 'and', 'for', 'that', 'this'].includes(city.toLowerCase())) {
        extracted.city = city; extracted.zip_code = m[2].trim(); break;
      }
    }
  }

  // Dates
  const allDates = [];
  const numericDatePat = /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/g;
  const writtenDatePat = /\b([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})\b/g;
  let dm;
  while ((dm = numericDatePat.exec(normalized)) !== null) {
    const parsed = normalizeDate(dm[1]);
    if (parsed) allDates.push({ raw: dm[1], parsed, index: dm.index });
  }
  while ((dm = writtenDatePat.exec(text)) !== null) {
    const parsed = normalizeDate(dm[1]);
    if (parsed) allDates.push({ raw: dm[1], parsed, index: dm.index });
  }

  const startDatePatterns = [
    /(?:lease|term|rental)\s*(?:period|term|begins?|commences?|start)[:\s]+(?:on\s+)?([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4})/gi,
    /(?:commence|begin|start)(?:s|ing)?[:\s]+(?:on\s+)?([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4})/gi,
    /from[:\s]+([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4})\s*(?:to|through|until|-)/gi,
    /(?:commence|begin|start|effective|from)[:\s]+([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/gi,
  ];
  for (const p of startDatePatterns) {
    p.lastIndex = 0;
    const m = p.exec(normalized);
    if (m && m[1]) {
      const d = normalizeDate(m[1]);
      if (d && d.length === 10) { extracted.lease_start_date = d; break; }
    }
  }
  if (!extracted.lease_start_date && allDates.length > 0) extracted.lease_start_date = allDates[0].parsed;

  const endDatePatterns = [
    /(?:to|through|until|thru|ending)[:\s]+(?:on\s+)?([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4})/gi,
    /(?:end|expir|terminat)[a-z]*[:\s]+(?:on\s+)?([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4})/gi,
    /(?:to|through|until|ending|expires?)[:\s]+([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/gi,
  ];
  for (const p of endDatePatterns) {
    p.lastIndex = 0;
    const m = p.exec(normalized);
    if (m && m[1]) {
      const d = normalizeDate(m[1]);
      if (d && d.length === 10) { extracted.lease_end_date = d; break; }
    }
  }
  if (!extracted.lease_end_date && allDates.length > 1) extracted.lease_end_date = allDates[1].parsed;

  // Tenant name
  const tenantPatterns = [
    /(?:tenant|lessee)[:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*(?:,|\(|$)/gi,
    /between[^,]{0,50}and[:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)\s*\(/gi,
  ];
  for (const p of tenantPatterns) {
    p.lastIndex = 0;
    const m = p.exec(text);
    if (m && m[1]) {
      const name = m[1].trim();
      const bad = ['agrees', 'shall', 'must', 'will', 'landlord', 'owner', 'manager', 'property'];
      if (!bad.some((w) => name.toLowerCase().includes(w)) && name.length >= 5 && name.length <= 50 && name.split(/\s+/).length >= 2) {
        extracted.tenant_name = name; break;
      }
    }
  }

  // Landlord name
  const landlordPatterns = [
    /(?:landlord|lessor|owner|property\s*manager)[:\s]+([A-Z][A-Za-z\s.,'&-]+?)(?:\s*,|\s*\(|\s*whose|\s*located|\s*at|\s*address|$)/gi,
    /between\s+([A-Z][A-Za-z\s.,'&-]+?)\s*(?:,|\()?\s*(?:hereinafter|as|the)?\s*["']?(?:landlord|lessor|owner)/gi,
  ];
  for (const p of landlordPatterns) {
    p.lastIndex = 0;
    const m = p.exec(text);
    if (m && m[1]) {
      let name = m[1].trim().replace(/[,;:]+$/, '').replace(/^["']+|["']+$/g, '').trim();
      const bad = ['agrees', 'shall', 'must', 'will', 'tenant', 'lessee', 'this', 'the', 'agreement'];
      if (!bad.some((w) => name.toLowerCase() === w || name.toLowerCase().startsWith(w + ' ')) && name.length >= 3 && name.length <= 100) {
        extracted.landlord_name = name; break;
      }
    }
  }

  // County
  const countyPatterns = [
    /([A-Za-z]+)\s+county\s*,\s*(?:TX|Texas)/gi,
    /county\s+of\s+([A-Za-z]+)\s*,\s*(?:TX|Texas)/gi,
  ];
  for (const p of countyPatterns) {
    p.lastIndex = 0;
    const m = p.exec(normalized);
    if (m && m[1]) {
      const c = m[1].trim();
      if (c.length >= 3 && c.length <= 30) { extracted.county = c; break; }
    }
  }

  return Object.keys(extracted).length > 0 ? extracted : null;
}

function extractSections(text) {
  if (!text) {
    return TOPIC_DEFINITIONS.map((t) => ({ topic: t.label, summary: 'Nothing noted.', excerpts: [] }));
  }
  const normalized = text.replace(/\s+/g, ' ').trim();
  const lineSegments = text.split(/\r?\n+/).map((s) => s.trim()).filter(Boolean);
  const sentenceSegments = normalized.split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter(Boolean);
  const chunkSegments = [];
  for (let i = 0; i < normalized.length; i += 300) chunkSegments.push(normalized.slice(i, i + 300));
  let segments = lineSegments.length > 1 ? lineSegments : sentenceSegments;
  if (segments.length <= 1) segments = chunkSegments;
  const lowerSegments = segments.map((s) => s.toLowerCase());
  const lowerChunks = chunkSegments.map((s) => s.toLowerCase());
  const normalizedLower = normalized.toLowerCase();

  const snippet = (seg, kw, w = 140) => {
    const idx = seg.toLowerCase().indexOf(kw);
    if (idx === -1) return seg.slice(0, 260);
    return seg.slice(Math.max(0, idx - w), Math.min(seg.length, idx + kw.length + w)).trim();
  };

  return TOPIC_DEFINITIONS.map((topic) => {
    if (topic.key === 'security_deposit') {
      const amounts = [];
      const amtPats = [
        /security\s*deposit\s*amount[^$]{0,40}(\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
        /security\s*deposit[^$]{0,40}(\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
      ];
      amtPats.forEach((p) => {
        let m;
        while ((m = p.exec(normalizedLower)) !== null) {
          if (m[1]) amounts.push(m[1].replace(/\s+/g, ' ').trim());
        }
      });
      if (amounts.length === 0) {
        lowerChunks.forEach((chunk, i) => {
          if (!chunk.includes('security deposit')) return;
          const lp = /security\s*deposit[^$]{0,80}(\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi;
          let m;
          while ((m = lp.exec(chunkSegments[i])) !== null) {
            if (m[1]) amounts.push(m[1].replace(/\s+/g, ' ').trim());
          }
        });
      }
      const unique = [...new Set(amounts)];
      return {
        topic: topic.label,
        summary: unique.length > 0 ? 'The lease references a security deposit amount.' : 'Nothing noted.',
        excerpts: unique.length > 0 ? [unique[0]] : [],
      };
    }
    const matches = [];
    lowerSegments.forEach((seg, i) => {
      if (matches.length >= 3 || seg.includes('security deposit')) return;
      const kw = topic.keywords.find((k) => seg.includes(k));
      if (kw) matches.push(snippet(segments[i], kw));
    });
    return {
      topic: topic.label,
      summary: matches.length > 0 ? `Found relevant clauses.` : 'Nothing noted.',
      excerpts: matches,
    };
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nLease Extraction Test Harness`);
  console.log(`File: ${absolutePath}`);
  console.log('─'.repeat(60));

  const buffer = fs.readFileSync(absolutePath);
  console.log(`Buffer size: ${buffer.length} bytes`);

  // Step 1: Extract text
  console.log('\n[1] Extracting text via pdfjs-dist...');
  let text = '';
  try {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = Uint8Array.from(buffer);
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdf = await loadingTask.promise;
    const pageCount = Math.min(pdf.numPages, 10);
    console.log(`    Pages: ${pdf.numPages} (processing up to ${pageCount})`);
    for (let pageIndex = 1; pageIndex <= pageCount; pageIndex += 1) {
      const page = await pdf.getPage(pageIndex);
      const content = await page.getTextContent();
      const pageText = content.items.map((item) => item.str).join(' ');
      text += `${pageText}\n`;
    }
    text = text.trim();
    console.log(`    Text length: ${text.length} chars`);
  } catch (err) {
    console.warn(`    pdfjs-dist failed: ${err.message}`);
    console.log('    Falling back to pdf-parse...');
    try {
      const pdfParse = require('pdf-parse');
      const result = await pdfParse(buffer, { max: 10 });
      text = result.text || '';
      console.log(`    pdf-parse text length: ${text.length} chars`);
    } catch (fallbackErr) {
      console.error(`    Both extractors failed: ${fallbackErr.message}`);
      process.exit(1);
    }
  }

  if (text.length < 40) {
    console.warn('\n[!] Very short text — this may be a scanned PDF. OCR not available in V1.');
  }

  // Step 2: Extract sections
  console.log('\n[2] Extracting sections...');
  const sections = extractSections(text);
  sections.forEach((s) => {
    console.log(`    ${s.topic}: ${s.excerpts.length} excerpt(s)`);
    s.excerpts.slice(0, 1).forEach((e) => console.log(`      → ${e.slice(0, 100)}...`));
  });

  // Step 3: Extract structured data
  console.log('\n[3] Extracting structured fields...');
  const extractedData = extractStructuredData(text, sections);

  // Step 4: Output
  console.log('\n[4] RESULT\n' + '─'.repeat(60));
  console.log('\nExtracted fields:');
  console.log(JSON.stringify(extractedData || {}, null, 2));

  console.log('\nText preview (first 500 chars):');
  console.log(text.slice(0, 500));

  console.log('\nMove-out section excerpts:');
  const moveOut = sections.find((s) => s.topic === 'Move-out obligations');
  console.log(JSON.stringify(moveOut?.excerpts || [], null, 2));

  const forwarding = moveOut?.excerpts?.some((e) => /forwarding/i.test(e));
  console.log(`\nForwarding address clause detected: ${forwarding ? 'YES' : 'NO'}`);

  console.log('\n' + '─'.repeat(60));
  console.log(`Fields detected: ${extractedData ? Object.keys(extractedData).length : 0}`);
  console.log('Done.\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
