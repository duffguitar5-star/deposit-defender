const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { ERROR_CODES, createErrorResponse } = require('../lib/errorCodes');
const { fileUploadLimiter, caseCreationLimiter } = require('../middleware/rateLimiter');
const logger = require('../lib/logger');
const { validateIntake } = require('../lib/intakeValidation');
const { saveCase, getCase, updateCaseLeaseData } = require('../lib/caseStore');
const {
  extractTextFromImage,
  extractTextFromPdf,
  extractTextFromPdfOcr,
} = require('../lib/leaseExtraction');
const { associateCaseWithSession, requireCaseOwnership } = require('../middleware/sessionAuth');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Magic byte signatures for file type validation
const FILE_SIGNATURES = {
  pdf: Buffer.from([0x25, 0x50, 0x44, 0x46]), // %PDF
  png: Buffer.from([0x89, 0x50, 0x4e, 0x47]), // PNG
  jpg: Buffer.from([0xff, 0xd8, 0xff]),         // JPEG
};

function validateFileType(buffer, declaredMimetype) {
  if (!buffer || buffer.length < 4) return false;
  if (declaredMimetype === 'application/pdf') return buffer.slice(0, 4).equals(FILE_SIGNATURES.pdf);
  if (declaredMimetype === 'image/png') return buffer.slice(0, 4).equals(FILE_SIGNATURES.png);
  if (declaredMimetype.includes('jpeg') || declaredMimetype.includes('jpg')) return buffer.slice(0, 3).equals(FILE_SIGNATURES.jpg);
  return false;
}

const TOPIC_DEFINITIONS = [
  {
    key: 'security_deposit',
    label: 'Security deposit',
    keywords: ['security deposit', 'securitydeposit', 'deposit amount', 'deposit is', 'deposit of', 'refundable', 'damage deposit', 'pet deposit', 'deposit paid', 'deposit will', 'deposit shall'],
    summary: 'The lease text references security deposits.',
  },
  {
    key: 'cleaning',
    label: 'Cleaning',
    keywords: ['cleaning', 'clean', 'cleaned', 'carpet', 'janitorial'],
    summary: 'The lease text references cleaning expectations.',
  },
  {
    key: 'damage',
    label: 'Damage',
    keywords: ['damage', 'damages', 'repair', 'repairs', 'wear and tear'],
    summary: 'The lease text references damage-related terms.',
  },
  {
    key: 'move_out',
    label: 'Move-out obligations',
    keywords: ['move out', 'move-out', 'moveout', 'vacate', 'surrender', 'keys', 'forwarding address'],
    summary: 'The lease text references move-out expectations.',
  },
];

function extractTextFromBuffer(buffer) {
  const utf8Text = buffer.toString('utf8');
  const cleaned = utf8Text.replace(/[^ -~\n\r\t]+/g, ' ');
  return cleaned.replace(/\s+/g, ' ').trim();
}

function getLeaseExtractionErrorMessage(error, isImage) {
  const msg = error && error.message ? error.message.toLowerCase() : '';
  if (msg.includes('invalid pdf') || msg.includes('corrupted') || msg.includes('damaged')) {
    return 'The file appears to be corrupted. Please try uploading a different copy of your lease.';
  }
  if (msg.includes('password') || msg.includes('encrypted')) {
    return 'This PDF is password-protected. Please remove the password and try again.';
  }
  if (isImage) {
    return 'Unable to extract text from this image. Please upload a PDF for best results, or fill in the fields manually.';
  }
  return 'Unable to process this file. Please verify it is a valid PDF and try again.';
}

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
      year = String(century + parseInt(year));
    }
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return null;
}

function extractStructuredData(text, sections) {
  if (!text || text.trim().length < 20) return null;
  const normalized = text.replace(/\s+/g, ' ').trim();
  const extracted = {};

  // ── Address validation helpers ─────────────────────────────────────────────
  const STREET_SUFFIX_RE = /\b(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Lane|Ln|Court|Ct|Way|Place|Pl|Circle|Cir|Parkway|Pkwy|Terrace|Ter|Trail|Trl)\b\.?/i;
  const SQ_FT_RE = /square\s*f(?:eet|oot|t)|\bsq\.?\s*ft\b/i;
  const MONEY_RE = /\$\s*\d|\d{1,3}(?:,\d{3})+(?:\.\d{2})?$/;
  const SECTION_NUM_RE = /^(?:section|§)\s*\d+/i;
  // Street suffix fragment for embedding in new RegExp() strings
  const SF = '(?:Street|St\\.?|Avenue|Ave\\.?|Road|Rd\\.?|Drive|Dr\\.?|Boulevard|Blvd\\.?|Lane|Ln\\.?|Court|Ct\\.?|Way|Place|Pl\\.?|Circle|Cir\\.?|Parkway|Pkwy\\.?|Terrace|Ter\\.?|Trail|Trl\\.?)';
  const UNIT_SUFFIX = '(?:\\s*,?\\s*(?:Apt|Suite|Ste|Unit|#)\\s*[A-Za-z0-9]+)?';

  /** Confidence: high = suffix+zip, medium = suffix only, low = partial */
  function addrConfidence(addr) {
    const hasSuffix = STREET_SUFFIX_RE.test(addr);
    const hasStateZip = /(?:TX|Texas)\s*\d{5}/.test(addr);
    const hasZip = /\d{5}/.test(addr);
    if (hasSuffix && (hasStateZip || hasZip)) return 'high';
    if (hasSuffix) return 'medium';
    return 'low';
  }

  /** Validate address candidate; logs rejection reason on failure */
  function validateAddr(addr, label) {
    if (!addr || addr.length < 6 || addr.length > 150) {
      logger.debug('Lease extraction: address rejected — length', { label, len: addr?.length });
      return false;
    }
    if (SQ_FT_RE.test(addr)) {
      logger.debug('Lease extraction: address rejected — square footage', { label, candidate: addr });
      return false;
    }
    if (MONEY_RE.test(addr)) {
      logger.debug('Lease extraction: address rejected — monetary value', { label, candidate: addr });
      return false;
    }
    if (SECTION_NUM_RE.test(addr)) {
      logger.debug('Lease extraction: address rejected — section number', { label, candidate: addr });
      return false;
    }
    if (!STREET_SUFFIX_RE.test(addr)) {
      logger.debug('Lease extraction: address rejected — no street suffix', { label, candidate: addr });
      return false;
    }
    if (!/^\d/.test(addr)) {
      logger.debug('Lease extraction: address rejected — no leading number', { label, candidate: addr });
      return false;
    }
    if (addr.trim().split(/\s+/).length < 3) {
      logger.debug('Lease extraction: address rejected — fewer than 3 words', { label, candidate: addr });
      return false;
    }
    return true;
  }

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
  if (extracted.deposit_amount) extracted.deposit_amount_confidence = 'high';

  // Property address — tightened: requires street suffix, excludes sq ft / money / section numbers.
  // Patterns ordered most-specific to least-specific to prevent landlord address bleed.
  const propertyAddrPatterns = [
    // 1. Explicit labeled section: "property address:" / "leased premises:" / "rental unit:"
    new RegExp(
      `(?:property\\s*address|leased\\s*premises\\s*(?:is|are)?|rental\\s*(?:property|unit|address))[:\\s]+` +
      `([0-9]+\\s+[A-Za-z0-9\\s#.,'-]*?${SF}${UNIT_SUFFIX})`,
      'gi'
    ),
    // 2. Section header "PROPERTY:" (requires colon — prevents matching "Property Management LLC")
    new RegExp(
      `\\bPROPERTY\\s*:[^\\n]{0,120}?([0-9]+\\s+[A-Za-z][A-Za-z0-9\\s#.,'-]*?${SF}${UNIT_SUFFIX})`,
      'g'  // NOT 'i' — must be uppercase PROPERTY to avoid "ABC Property Management LLC" false match
    ),
    // 3. "leases/rents to tenant/lessee … <address>" — conveyance language
    new RegExp(
      `(?:leases?|rents?)\\s+to\\s+(?:tenant|lessee)[^.]{0,120}?([0-9]+\\s+[A-Za-z][A-Za-z0-9\\s#.,'-]*?${SF}${UNIT_SUFFIX})`,
      'gi'
    ),
    // 4. Generic: street address followed unambiguously by TX city + zip
    new RegExp(
      `\\b([0-9]+\\s+[A-Za-z][A-Za-z0-9\\s#.,'-]*?${SF}${UNIT_SUFFIX})\\s*,\\s*[A-Z][a-z]+\\s*,\\s*(?:TX|Texas)`,
      'gi'
    ),
  ];
  for (const p of propertyAddrPatterns) {
    p.lastIndex = 0;
    const m = p.exec(normalized);
    if (m && m[1]) {
      const candidate = m[1].trim().replace(/\s+/g, ' ').replace(/[,;:]+$/, '').trim();
      logger.debug('Lease extraction: property_address candidate', { candidate });
      if (validateAddr(candidate, 'property_address')) {
        extracted.property_address = candidate;
        extracted.property_address_confidence = addrConfidence(candidate);
        break;
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

  // Landlord address — structured: { street, city, state, zip }
  // Looks for sections labeled "Landlord/Owner/Management Address" or "Notice to Landlord".
  const landlordAddrPatterns = [
    // Labeled block: "Landlord Address: 456 Oak Ave, Austin, TX 78702"
    new RegExp(
      `(?:landlord|lessor|owner|management|notice\\s+to\\s+(?:landlord|owner|lessor))\\s*(?:address|contact|information)?[:\\s]+` +
      `([0-9]+\\s+[A-Za-z0-9\\s#.,'-]*?${SF}${UNIT_SUFFIX})`,
      'gi'
    ),
    // Inline: "landlord ... located at 456 Oak Ave ..."
    new RegExp(
      `(?:landlord|lessor|owner|management)[^.]{0,60}?(?:address|located\\s+at)[:\\s]+` +
      `([0-9]+\\s+[A-Za-z0-9\\s#.,'-]*?${SF}${UNIT_SUFFIX})`,
      'gi'
    ),
  ];
  for (const p of landlordAddrPatterns) {
    p.lastIndex = 0;
    const m = p.exec(normalized);
    if (m && m[1]) {
      const streetCandidate = m[1].trim().replace(/\s+/g, ' ').replace(/[,;:]+$/, '').trim();
      logger.debug('Lease extraction: landlord_address candidate', { candidate: streetCandidate });

      if (validateAddr(streetCandidate, 'landlord_address')) {
        // Check for city/state/zip embedded inside the captured street
        const embedded = streetCandidate.match(/,\s*([A-Za-z][A-Za-z\s]{1,25}?)\s*,\s*(TX|Texas)\s*(\d{5}(?:-\d{4})?)/i);
        let street = streetCandidate;
        let city = null;
        let state = null;
        let zip = null;

        if (embedded) {
          street = streetCandidate.slice(0, embedded.index).trim();
          city   = embedded[1].trim();
          state  = 'TX';
          zip    = embedded[3].trim();
        } else {
          // Look in the 100 chars immediately after the match
          const after = normalized.slice(m.index + m[0].length, m.index + m[0].length + 100);
          const trailing = after.match(/,?\s*([A-Za-z][A-Za-z\s]{1,25}?)\s*,\s*(TX|Texas)\s*(\d{5}(?:-\d{4})?)/i);
          if (trailing) {
            city  = trailing[1].trim();
            state = 'TX';
            zip   = trailing[3].trim();
          }
        }

        extracted.landlord_address = { street, city, state, zip };
        extracted.landlord_address_confidence = addrConfidence(
          zip ? `${street}, ${city}, TX ${zip}` : street
        );
        break;
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
    return TOPIC_DEFINITIONS.map((t) => ({ topic: t.label, summary: 'Nothing noted for this topic.', excerpts: [] }));
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
        summary: unique.length > 0 ? 'The lease references a security deposit amount.' : 'Nothing noted for this topic.',
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
      summary: matches.length > 0 ? topic.summary : 'Nothing noted for this topic.',
      excerpts: matches,
    };
  });
}

// ─── Routes ────────────────────────────────────────────────────────────────────

router.post('/', caseCreationLimiter, async (req, res) => {
  // Separate lease_text (optional, not part of intake schema) from intake payload
  const { lease_text: leaseText, ...payload } = req.body;
  const { valid, errors } = validateIntake(payload);

  if (!valid) {
    return res.status(400).json(createErrorResponse(ERROR_CODES.INVALID_INPUT, null, errors));
  }

  const caseId = uuidv4();
  await saveCase(caseId, payload);
  associateCaseWithSession(req, caseId);

  // Persist extracted lease text if provided (runs before analysis is generated)
  if (leaseText && typeof leaseText === 'string' && leaseText.trim().length > 0) {
    try {
      await updateCaseLeaseData(caseId, leaseText);
      logger.info('Lease text persisted with case', {
        caseId,
        leaseTextLength: leaseText.length,
      });
    } catch (leaseErr) {
      // Non-fatal — case is still valid without lease text
      logger.warn('Failed to persist lease text', { caseId, error: leaseErr.message });
    }
  }

  logger.logCaseOperation('Intake received', caseId, {
    jurisdiction: payload.jurisdiction,
    leaseType: payload.lease_information?.lease_type,
    depositReturned: payload.security_deposit_information?.deposit_returned,
    hasLeaseText: !!(leaseText && leaseText.trim().length > 0),
  });

  return res.status(201).json({
    status: 'ok',
    data: { caseId },
    message: 'Intake received for document preparation. No legal advice is provided.',
  });
});

router.get('/:caseId', requireCaseOwnership, async (req, res) => {
  const storedCase = await getCase(req.params.caseId);
  if (!storedCase) return res.status(404).json(createErrorResponse(ERROR_CODES.CASE_NOT_FOUND));
  return res.json({ status: 'ok', data: { case: storedCase } });
});

router.post('/lease-extract', fileUploadLimiter, upload.single('lease'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json(createErrorResponse(ERROR_CODES.INVALID_FILE_TYPE, 'Lease file is required.'));
  }

  const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
  if (!allowedTypes.includes(req.file.mimetype)) {
    return res.status(400).json(createErrorResponse(ERROR_CODES.INVALID_FILE_TYPE));
  }

  if (!validateFileType(req.file.buffer, req.file.mimetype)) {
    return res.status(400).json(createErrorResponse(ERROR_CODES.FILE_CONTENT_MISMATCH));
  }

  const isImage = req.file.mimetype.startsWith('image/');
  let text = '';

  try {
    if (isImage) {
      text = await extractTextFromImage(req.file.buffer);
    } else {
      text = await extractTextFromPdf(req.file.buffer);
      if (!text || text.trim().length < 40) {
        text = await extractTextFromPdfOcr(req.file.buffer);
      }
      if (!text) {
        text = extractTextFromBuffer(req.file.buffer);
      }
    }
  } catch (error) {
    logger.error('Lease extraction failed', {
      route: '/api/cases/lease-extract',
      error,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    });
    return res.status(500).json(
      createErrorResponse(ERROR_CODES.LEASE_EXTRACTION_FAILED, getLeaseExtractionErrorMessage(error, isImage))
    );
  }

  const sections = extractSections(text);
  const preview = text ? text.slice(0, 600).trim() : '';
  const extractedData = extractStructuredData(text, sections);

  // Minimal extraction logging
  logger.info('Lease extraction complete', {
    route: '/api/cases/lease-extract',
    textLength: text ? text.length : 0,
    extractedDeposit: extractedData?.deposit_amount || null,
    extractedMoveOutTerms: sections.find((s) => s.topic === 'Move-out obligations')?.excerpts?.length ?? 0,
    extractedForwardingAddressClause: sections
      .find((s) => s.topic === 'Move-out obligations')
      ?.excerpts?.some((e) => /forwarding/i.test(e)) ?? false,
    fieldsDetected: extractedData ? Object.keys(extractedData).length : 0,
    isImage,
  });

  return res.json({
    status: 'ok',
    data: {
      sections,
      preview,
      leaseText: text || '',
      extractedData: extractedData || {},
    },
    message: extractedData
      ? 'Lease text extracted. Review the auto-filled fields below and correct anything that looks wrong.'
      : isImage
        ? 'Image uploaded. Please fill in your lease details below — image text extraction is not available yet.'
        : 'Lease processed. Please fill in any fields not auto-detected below.',
  });
});

module.exports = router;
