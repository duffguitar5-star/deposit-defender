const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { ERROR_CODES, createErrorResponse } = require('../lib/errorCodes');
const { fileUploadLimiter, caseCreationLimiter } = require('../middleware/rateLimiter');
const logger = require('../lib/logger');
const { validateIntake } = require('../lib/intakeValidation');
const { saveCase, getCase, updateCaseLeaseData, getCaseByEmail } = require('../lib/caseStore');
const { sendReportEmail } = require('../lib/emailService');

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:3000';
const {
  extractTextFromImage,
  extractTextFromPdf,
  extractTextFromPdfOcr,
  extractAddressFromText,
  extractLandlordNoticeAddress,
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

  // Property address — multi-candidate scoring via extractAddressFromText.
  // Pass raw text (with newlines) so multi-line block capture works correctly.
  const propAddr = extractAddressFromText(text);
  if (propAddr.property_street) {
    extracted.property_address       = propAddr.property_street;   // form field name
    extracted.property_address_full  = propAddr.property_address_full;
    extracted.property_address_confidence = propAddr.property_address_confidence;
  }
  // City and ZIP — use address parse result first; fall back to standalone scan
  if (propAddr.property_city) {
    extracted.city     = propAddr.property_city;
    extracted.zip_code = propAddr.property_zip || null;
    if (propAddr.property_state) extracted.state = propAddr.property_state;
  } else {
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
  // NOTE: patterns use gi so anchors match "Tenant"/"TENANT"/"tenant".
  // We then validate each word starts with uppercase in JS (rules out lowercase
  // common phrases like "of all terms" that the i-flag would otherwise match).
  const tenantPatterns = [
    /(?:tenant|lessee)[:\s]+([A-Za-z]+(?:\s+[A-Za-z]+){1,2})\s*(?:,|\(|$)/gi,
    /between[^,]{0,50}and[:\s]+([A-Za-z]+\s+[A-Za-z]+)\s*\(/gi,
  ];
  for (const p of tenantPatterns) {
    p.lastIndex = 0;
    const m = p.exec(text);
    if (m && m[1]) {
      const name = m[1].trim();
      const words = name.split(/\s+/);
      // Each word must begin with an uppercase letter — filters out "of all terms" etc.
      if (!words.every(w => /^[A-Z]/.test(w))) continue;
      const bad = ['agrees', 'shall', 'must', 'will', 'landlord', 'owner', 'manager', 'property',
                   'terms', 'conditions', 'herein', 'above', 'below', 'said', 'tenant', 'lessee',
                   'lessor', 'this', 'that', 'any', 'each', 'lease', 'agreement', 'notice'];
      if (!bad.some((w) => name.toLowerCase().includes(w)) && name.length >= 4 && name.length <= 50 && words.length >= 2) {
        extracted.tenant_name = name; break;
      }
    }
  }

  // Pet deposit
  const petDepositPatterns = [
    /pet\s*(?:deposit|fee)[:\s]+(?:amount[:\s]+)?(\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
    /(?:non[- ]?refundable\s+)?pet\s*(?:deposit|fee)\s+of\s+(\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
    /animal\s*(?:deposit|fee)[:\s]+(\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
  ];
  for (const p of petDepositPatterns) {
    p.lastIndex = 0;
    const m = p.exec(normalized);
    if (m && m[1]) { extracted.pet_deposit_amount = m[1].replace(/\s+/g, '').trim(); break; }
  }

  // Landlord name
  const landlordPatterns = [
    // "Landlord: ABC Properties, LLC" — stops at address/location cues
    /(?:landlord|lessor|owner|property\s*manager)[:\s]+([A-Z][A-Za-z\s.,'&-]+?)(?:\s*,|\s*\(|\s*whose|\s*located|\s*at\b|\s*address|[\r\n]|$)/gi,
    // "between [Landlord Name], hereinafter called 'Landlord'"
    /between\s+([A-Z][A-Za-z\s.,'&-]+?)\s*(?:,|\()?\s*(?:hereinafter|as|the)?\s*["']?(?:landlord|lessor|owner)/gi,
    // All-caps entity: "LANDLORD: XYZ PROPERTIES LLC" — normalized by caller
    /(?:LANDLORD|LESSOR|OWNER)\s*:\s*([A-Z][A-Z0-9\s.,'&-]+?)(?:\n|,\s*\d|\s{2,}|$)/g,
    // Entity suffix cue: captures company names ending in LLC, LP, Inc, Corp, etc.
    /(?:landlord|lessor|owner)\s+is\s+([A-Za-z][A-Za-z\s.,'&-]+?(?:LLC|L\.L\.C\.|LP|L\.P\.|Inc\.?|Corp\.?|Ltd\.?|Properties|Management|Realty|Investments?))\b/gi,
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

  // Landlord notice address — structured: { street, city, state, zip }
  // Delegated to extractLandlordNoticeAddress for anchor-based multi-candidate scoring.
  const landlordAddr = extractLandlordNoticeAddress(text);
  if (landlordAddr.landlord_notice_street) {
    extracted.landlord_address = {
      street: landlordAddr.landlord_notice_street,
      city:   landlordAddr.landlord_notice_city,
      state:  landlordAddr.landlord_notice_state,
      zip:    landlordAddr.landlord_notice_zip,
    };
    // Confidence: high if zip present, medium if street-only
    extracted.landlord_address_confidence = landlordAddr.landlord_notice_zip ? 'high' : 'medium';
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

/**
 * Determine whether an extracted address confidence value clears the merge
 * threshold.  Handles both numeric (form-field mode: 0.95) and string
 * (anchor-based: 'high' | 'medium' | 'low' | 'none') values.
 */
function isAddressConfident(confidence) {
  if (typeof confidence === 'number') return confidence >= 0.6;
  return confidence === 'high' || confidence === 'medium';
}

/**
 * Merge high-confidence lease-extracted address data into the (already
 * validated) intake payload.  Mutates property_information in place —
 * payload is a plain spread copy of req.body so this is safe.
 *
 * Returns a string describing which source won for each field ('lease' or 'form').
 */
function mergeLeaseAddress(payload, extractedData) {
  const pi = payload.property_information;
  const conf = extractedData.property_address_confidence;
  const confident = isAddressConfident(conf);

  const formSnapshot = {
    property_address: pi.property_address,
    city:             pi.city,
    zip_code:         pi.zip_code,
    county:           pi.county,
  };

  const leaseSnapshot = {
    property_address: extractedData.property_address  || null,
    city:             extractedData.city              || null,
    zip_code:         extractedData.zip_code          || null,
    county:           extractedData.county            || null,
  };

  console.log('[merge] Extracted address:', leaseSnapshot);
  console.log('[merge] Form address     :', formSnapshot);
  console.log('[merge] Confidence       :', conf, '→ source wins:', confident ? 'lease' : 'form');

  if (confident) {
    if (leaseSnapshot.property_address) pi.property_address = leaseSnapshot.property_address;
    if (leaseSnapshot.city)             pi.city             = leaseSnapshot.city;
    if (leaseSnapshot.zip_code)         pi.zip_code         = leaseSnapshot.zip_code;
    if (leaseSnapshot.county)           pi.county           = leaseSnapshot.county;
  }

  console.log('[merge] Final property_information:', {
    property_address: pi.property_address,
    city:             pi.city,
    zip_code:         pi.zip_code,
    county:           pi.county,
  });

  return confident ? 'lease' : 'form';
}

router.post('/', caseCreationLimiter, async (req, res) => {
  // Separate lease_text (optional, not part of intake schema) from intake payload
  const { lease_text: leaseText, ...payload } = req.body;
  const { valid, errors } = validateIntake(payload);

  if (!valid) {
    return res.status(400).json(createErrorResponse(ERROR_CODES.INVALID_INPUT, null, errors));
  }

  // ── Lease-data precedence merge ───────────────────────────────────────────
  // If the client submitted lease text, re-run extraction here on the server
  // and let high-confidence lease values override what the user typed into the
  // property_information fields (which may be stale defaults or placeholder
  // values from before they uploaded the lease).
  if (leaseText && typeof leaseText === 'string' && leaseText.trim().length > 0) {
    try {
      const sections = extractSections(leaseText);
      const extractedData = extractStructuredData(leaseText, sections);
      if (extractedData && extractedData.property_address) {
        mergeLeaseAddress(payload, extractedData);
      } else {
        console.log('[merge] No extracted address — form values kept as-is');
      }
    } catch (mergeErr) {
      // Non-fatal: log and continue with whatever the form submitted
      logger.warn('Lease-data merge failed', { error: mergeErr.message });
    }
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

/**
 * POST /api/cases/resend-report
 * Looks up the most recent paid case for the given email and re-sends the link.
 * Rate-limited by the existing caseCreationLimiter (reused for simplicity).
 */
router.post('/resend-report', caseCreationLimiter, async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ status: 'error', message: 'A valid email address is required.' });
  }

  try {
    const caseData = await getCaseByEmail(email.trim());

    // Always return 200 — don't leak whether an email exists in the system
    if (!caseData) {
      logger.info('Resend-report: no paid case found for email', { email });
      return res.status(200).json({ status: 'ok', message: 'If we have a report on file for that email, we\'ve sent the link.' });
    }

    await sendReportEmail(email.trim(), caseData.id, CLIENT_ORIGIN);
    logger.info('Resend-report email sent', { caseId: caseData.id });

    return res.status(200).json({ status: 'ok', message: 'If we have a report on file for that email, we\'ve sent the link.' });
  } catch (err) {
    logger.error('Resend-report failed', { error: err.message });
    return res.status(500).json({ status: 'error', message: 'Unable to process your request. Please try again.' });
  }
});

module.exports = router;
