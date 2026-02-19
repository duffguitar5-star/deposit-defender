/**
 * Lease Text Extraction
 *
 * Primary: pdfjs-dist (installed) — extracts text page-by-page, preserving
 *          line structure so that regex patterns in extractStructuredData work.
 * Fallback: pdf-parse — used if pdfjs-dist throws.
 * OCR:      Stubbed — tesseract.js not installed in V1. Scanned PDFs degrade
 *           gracefully; user fills any un-detected fields manually.
 *
 * Address extraction (extractAddressFromText, extractLandlordNoticeAddress):
 *   Uses multi-candidate scoring rather than single-pattern matching.
 *   Each anchor phrase yields a capture window; candidates are scored on
 *   street number, suffix, state, zip, and penalized for false-positive
 *   signals (sq ft, money, deposit). The highest-scoring candidate above
 *   the threshold is selected and parsed into components.
 */

const { withTimeout, TIMEOUTS } = require('./timeoutWrapper');
const logger = require('./logger');

// ─────────────────────────────────────────────────────────────
// Shared address helpers
// ─────────────────────────────────────────────────────────────

const ADDR_SUFFIX_RE = /\b(St\.?|Street|Ave\.?|Avenue|Rd\.?|Road|Dr\.?|Drive|Blvd\.?|Boulevard|Ln\.?|Lane|Ct\.?|Court|Pl\.?|Place|Way|Pkwy\.?|Parkway|Cir\.?|Circle|Ter\.?|Terrace|Hwy\.?|Highway)\b/i;

// State abbreviations for scoring; TX gets a higher bonus below
const STATE_RE = /\b(TX|Texas|AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|UT|VT|VA|WA|WV|WI|WY)\b/;

/**
 * Score an address candidate string.
 * Returns a numeric score; callers use >= MIN_SCORE (5) as the threshold.
 *
 * Scoring table:
 *   +3  starts with a street number (e.g. "123 ")
 *   +3  contains a street suffix token
 *   +2  contains "TX" or "Texas"
 *   +1  contains another US state abbreviation
 *   +2  contains a 5-digit zip code
 *   +1  contains ", CityName" separator pattern
 *   -5  contains square footage language
 *   -5  contains a dollar amount
 *   -5  contains the word "deposit"
 *   -3  contains the word "rent"
 *   -5  looks like a section number header (e.g. "Section 12", "§ 3.1")
 *   -2  does not start with a digit (less likely to be a street address)
 */
function scoreAddressCandidate(text) {
  let score = 0;
  const t = text.trim();

  if (/^\d{1,5}\s/.test(t))                         score += 3;
  if (ADDR_SUFFIX_RE.test(t))                        score += 3;
  if (/\b(TX|Texas)\b/i.test(t))                    score += 2;
  else if (STATE_RE.test(t))                         score += 1;
  if (/\b\d{5}(-\d{4})?\b/.test(t))                 score += 2;
  if (/,\s*[A-Z][a-z]/.test(t))                     score += 1;

  if (/square\s*f(?:eet|oot|t)|\bsq\.?\s*ft\b|\bSF\b/i.test(t)) score -= 5;
  if (/\$\s*\d/.test(t))                            score -= 5;
  if (/\bdeposit\b/i.test(t))                       score -= 5;
  if (/\brent\b/i.test(t))                          score -= 3;
  if (/^(?:section|§|\d+\.\d)/i.test(t))            score -= 5;
  if (!/^\d/.test(t))                               score -= 2;

  return score;
}

/**
 * Parse a raw address string into { street, city, state, zip }.
 *
 * Strategy: locate city/state/zip working backward from the end of the
 * string (they're typically the last tokens), then treat everything before
 * that block as the street line.
 */
function parseAddressComponents(addressText) {
  const text = addressText.trim();

  // Match: optional comma, city name (1-25 chars), optional comma,
  //        state abbreviation or "Texas", optional zip
  const CSZ_RE = /,?\s*([A-Za-z][A-Za-z .]{1,24}?)\s*,?\s*\b(TX|Texas|AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|UT|VT|VA|WA|WV|WI|WY)\b\s*(\d{5}(-\d{4})?)?/i;
  const csz = text.match(CSZ_RE);

  let city = null;
  let state = null;
  let zip = null;
  let streetEnd = text.length;

  if (csz) {
    city = csz[1].trim().replace(/\s+/g, ' ');
    state = csz[2].replace(/texas/i, 'TX').toUpperCase();
    zip = csz[3] ? csz[3].trim() : null;
    streetEnd = csz.index;
  } else {
    // No city/state — try to at least find a zip code
    const zm = text.match(/\b(\d{5}(-\d{4})?)\b/);
    if (zm) { zip = zm[1]; streetEnd = zm.index; }
  }

  let street = text.slice(0, streetEnd).replace(/[,\s]+$/, '').trim();

  // If the "street" slice doesn't start with a digit, try extracting
  // the street address directly from the full text instead
  if (!street || !/^\d/.test(street)) {
    const SM = text.match(
      /\b(\d{1,5}\s+[A-Za-z][A-Za-z0-9 #.,'‐-]{3,60}?(?:St\.?|Street|Ave\.?|Avenue|Rd\.?|Road|Dr\.?|Drive|Blvd\.?|Boulevard|Ln\.?|Lane|Ct\.?|Court|Pl\.?|Place|Way|Pkwy\.?|Parkway|Cir\.?|Circle|Ter\.?|Terrace|Hwy\.?|Highway)\.?(?:\s+(?:Apt|Suite|Unit|Ste|#)\s*[A-Za-z0-9-]+)?)\b/i
    );
    if (SM) street = SM[1].trim();
  }

  return { street: street || null, city, state, zip };
}

/**
 * Build a capture window from anchor match position in the text.
 * Captures up to 3 lines or 140 chars after the anchor end position,
 * normalizes whitespace, and trims trailing punctuation.
 */
function captureAfterAnchor(text, anchorEnd) {
  const window = text.slice(anchorEnd, anchorEnd + 140);
  // Take first 3 lines (pages produce \n boundaries; within a page text is spaced).
  // Stop at any line whose trimmed start looks like a new field label (Word:)
  // to avoid capturing the next field (e.g., "Deposit: $800") into the address.
  const lines = window.split('\n');
  const addrLines = [];
  for (const line of lines) {
    if (addrLines.length > 0 && /^[A-Za-z][A-Za-z ]{2,25}:\s/.test(line.trim())) break;
    addrLines.push(line);
    if (addrLines.length >= 3) break;
  }
  let captured = addrLines.join(' ').replace(/\s+/g, ' ').trim();
  // Dollar amounts are never part of a street address — cut there if seen
  captured = captured.replace(/\s*\$[\d,. ]+.*$/, '').trim();
  // Stop at a sentence boundary followed by a capital letter (next clause)
  captured = captured.replace(/[.]\s+[A-Z].*$/, '').trim();
  // Strip trailing punctuation
  captured = captured.replace(/[;:]+$/, '').replace(/[,\s]+$/, '').trim();
  return captured;
}

// ─────────────────────────────────────────────────────────────
// Property address extraction
// ─────────────────────────────────────────────────────────────

/**
 * Extract property (rental) address from lease text using multi-candidate
 * scoring. Works with text produced by pdfjs-dist (spaces within pages,
 * \n between pages) and plain-text leases.
 *
 * @param {string} leaseText  Full text of the lease
 * @returns {{
 *   property_address_full: string|null,
 *   property_street: string|null,
 *   property_city: string|null,
 *   property_state: string|null,
 *   property_zip: string|null,
 *   property_address_confidence: 'high'|'medium'|'low'|'none',
 *   _candidates: Array<{text, anchor, anchorPos, score, reason}>
 * }}
 */
function extractAddressFromText(leaseText) {
  const EMPTY = {
    property_address_full: null,
    property_street: null,
    property_city: null,
    property_state: null,
    property_zip: null,
    property_address_confidence: 'none',
    _candidates: [],
  };
  if (!leaseText || leaseText.trim().length < 20) return EMPTY;

  // Collapse horizontal whitespace but preserve newlines (page boundaries)
  const text = leaseText.replace(/[ \t]+/g, ' ');

  // Anchor patterns — ordered roughly most-specific to least-specific.
  // Each pattern is applied globally; all matches are collected, scored,
  // and the best one wins.
  const PROPERTY_ANCHORS = [
    // Explicit labeled section headers
    /(?:property\s+address|rental\s+(?:property\s+)?address|address\s+of\s+(?:the\s+)?premises?)\s*[:\-]\s*/gi,
    /(?:leased?\s+premises?|rental\s+unit)\s*[:\-]\s*/gi,
    /(?:premises?\s+address|street\s+address)\s*[:\-]\s*/gi,
    // Conveyance / location language
    /(?:located\s+at|situate[d]?\s+at|residing\s+at)\s*/gi,
    /(?:the\s+premises?\s+(?:is|are|described\s+as|located\s+at))\s*/gi,
    // "PROPERTY:" stays case-sensitive — prevents "ABC Property Management LLC" false match.
    // "Premises:" can be case-insensitive because the required colon stops prose uses
    // ("on the premises of…" never has a colon) and "Premises LLC" is rare.
    /\bpremises?\s*:\s*/gi,
    /\bPROPERTY:\s*/g,
  ];

  const candidates = [];

  for (const anchorRe of PROPERTY_ANCHORS) {
    anchorRe.lastIndex = 0;
    let match;
    while ((match = anchorRe.exec(text)) !== null) {
      const captured = captureAfterAnchor(text, match.index + match[0].length);
      if (captured.length >= 6 && captured.length <= 150) {
        candidates.push({
          text: captured,
          anchor: match[0].trim(),
          anchorPos: match.index,
          score: 0,
          reason: '',
        });
      }
    }
  }

  // Score each candidate
  const reasons = [];
  for (const c of candidates) {
    const sc = scoreAddressCandidate(c.text);
    // Build human-readable reason string for CLI debug output
    const r = [];
    const t = c.text.trim();
    if (/^\d{1,5}\s/.test(t))                              r.push('+3 street#');
    if (ADDR_SUFFIX_RE.test(t))                            r.push('+3 suffix');
    if (/\b(TX|Texas)\b/i.test(t))                        r.push('+2 TX');
    else if (STATE_RE.test(t))                             r.push('+1 state');
    if (/\b\d{5}(-\d{4})?\b/.test(t))                     r.push('+2 zip');
    if (/,\s*[A-Z][a-z]/.test(t))                         r.push('+1 city-sep');
    if (/square\s*f(?:eet|oot|t)|\bsq\.?\s*ft\b/i.test(t)) r.push('-5 sqft');
    if (/\$\s*\d/.test(t))                                r.push('-5 money');
    if (/\bdeposit\b/i.test(t))                           r.push('-5 deposit');
    if (/\brent\b/i.test(t))                              r.push('-3 rent');
    if (/^(?:section|§|\d+\.\d)/i.test(t))                r.push('-5 section');
    if (!/^\d/.test(t))                                   r.push('-2 no#');
    c.score = sc;
    c.reason = r.join(' ');
  }
  void reasons; // suppress unused warning

  // Sort: highest score first; break ties by document position (earlier = better)
  candidates.sort((a, b) => b.score - a.score || a.anchorPos - b.anchorPos);

  logger.debug('Lease address candidates', {
    count: candidates.length,
    top3: candidates.slice(0, 3).map(c => ({ text: c.text, score: c.score, anchor: c.anchor })),
  });

  const MIN_SCORE = 5;
  const best = candidates.find(
    (c) => c.score >= MIN_SCORE && ADDR_SUFFIX_RE.test(c.text) && /^\d/.test(c.text.trim())
  );

  if (!best) {
    logger.debug('Lease address: no qualifying candidate (min score 5)', {
      bestScore: candidates[0]?.score ?? 'n/a',
    });
    return { ...EMPTY, _candidates: candidates.slice(0, 3) };
  }

  const { street, city, state, zip } = parseAddressComponents(best.text);

  // Build canonical full address string
  let full = street || '';
  if (city) full += (full ? ', ' : '') + city;
  if (state) full += (full ? ', ' : '') + state;
  if (zip) full += ' ' + zip;
  full = full.trim() || null;

  // Confidence: high requires zip; medium requires suffix; low = something matched
  let confidence;
  if (best.score >= 8 && zip)   confidence = 'high';
  else if (best.score >= 5)     confidence = 'medium';
  else                          confidence = 'low';

  logger.debug('Lease address selected', {
    full, street, city, state, zip, confidence, score: best.score,
  });

  return {
    property_address_full: full,
    property_street: street,
    property_city: city,
    property_state: state,
    property_zip: zip,
    property_address_confidence: confidence,
    _candidates: candidates.slice(0, 3),
  };
}

// ─────────────────────────────────────────────────────────────
// Landlord notice address extraction
// ─────────────────────────────────────────────────────────────

/**
 * Extract the landlord's notice / service address from lease text.
 * Targets "Notices to Landlord:", "Landlord's Address:", "Owner/Agent for
 * Service:", and similar labeled blocks.
 *
 * @param {string} leaseText  Full text of the lease
 * @returns {{
 *   landlord_notice_street: string|null,
 *   landlord_notice_city: string|null,
 *   landlord_notice_state: string|null,
 *   landlord_notice_zip: string|null,
 *   _candidates: Array<{text, anchor, anchorPos, score, reason}>
 * }}
 */
function extractLandlordNoticeAddress(leaseText) {
  const EMPTY = {
    landlord_notice_street: null,
    landlord_notice_city: null,
    landlord_notice_state: null,
    landlord_notice_zip: null,
    _candidates: [],
  };
  if (!leaseText || leaseText.trim().length < 20) return EMPTY;

  const text = leaseText.replace(/[ \t]+/g, ' ');

  const LANDLORD_ANCHORS = [
    /(?:notices?\s+to\s+(?:landlord|owner|lessor))\s*[:\-]\s*/gi,
    /(?:landlord[''s]{0,2}\s+(?:notice\s+)?address|notice\s+address)\s*[:\-]\s*/gi,
    /(?:owner[''s]{0,2}\s*(?:\/\s*agent)?\s*(?:for\s+service|address))\s*[:\-]\s*/gi,
    /(?:send\s+(?:notices?|correspondence)\s+to)\s*[:\-]?\s*/gi,
    /(?:landlord|lessor|owner)\s+(?:is\s+)?(?:located\s+at|address)\s*[:\-]\s*/gi,
  ];

  const candidates = [];

  for (const anchorRe of LANDLORD_ANCHORS) {
    anchorRe.lastIndex = 0;
    let match;
    while ((match = anchorRe.exec(text)) !== null) {
      const captured = captureAfterAnchor(text, match.index + match[0].length);
      if (captured.length >= 6 && captured.length <= 150) {
        candidates.push({
          text: captured,
          anchor: match[0].trim(),
          anchorPos: match.index,
          score: 0,
          reason: '',
        });
      }
    }
  }

  for (const c of candidates) {
    c.score = scoreAddressCandidate(c.text);
    const r = [];
    const t = c.text.trim();
    if (/^\d{1,5}\s/.test(t))   r.push('+3 street#');
    if (ADDR_SUFFIX_RE.test(t)) r.push('+3 suffix');
    if (/\b(TX|Texas)\b/i.test(t)) r.push('+2 TX');
    else if (STATE_RE.test(t))  r.push('+1 state');
    if (/\b\d{5}\b/.test(t))    r.push('+2 zip');
    if (/,\s*[A-Z][a-z]/.test(t)) r.push('+1 city-sep');
    if (/\$\s*\d/.test(t))      r.push('-5 money');
    if (/\bdeposit\b/i.test(t)) r.push('-5 deposit');
    if (!/^\d/.test(t))         r.push('-2 no#');
    c.reason = r.join(' ');
  }

  candidates.sort((a, b) => b.score - a.score || a.anchorPos - b.anchorPos);

  const MIN_SCORE = 5;
  const best = candidates.find(
    (c) => c.score >= MIN_SCORE && ADDR_SUFFIX_RE.test(c.text)
  );

  if (!best) return { ...EMPTY, _candidates: candidates.slice(0, 3) };

  const { street, city, state, zip } = parseAddressComponents(best.text);

  return {
    landlord_notice_street: street,
    landlord_notice_city: city,
    landlord_notice_state: state,
    landlord_notice_zip: zip,
    _candidates: candidates.slice(0, 3),
  };
}

// ─────────────────────────────────────────────────────────────
// PDF / image text extraction
// ─────────────────────────────────────────────────────────────

/**
 * Extract text from a text-based PDF buffer.
 * Uses pdfjs-dist (page-by-page text items) for maximum regex compatibility.
 * Falls back to pdf-parse if pdfjs-dist throws.
 */
async function extractTextFromPdf(buffer) {
  const operation = async () => {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = Uint8Array.from(buffer);
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdf = await loadingTask.promise;
    const pageCount = Math.min(pdf.numPages, 10);
    let combinedText = '';

    for (let pageIndex = 1; pageIndex <= pageCount; pageIndex += 1) {
      const page = await pdf.getPage(pageIndex);
      const content = await page.getTextContent();
      const pageText = content.items.map((item) => item.str).join(' ');
      combinedText += `${pageText}\n`;
    }

    return combinedText.trim();
  };

  try {
    return await withTimeout(operation(), TIMEOUTS.PDF_EXTRACTION, 'PDF text extraction');
  } catch (primaryError) {
    logger.warn('pdfjs-dist extraction failed, falling back to pdf-parse', {
      error: primaryError.message,
    });
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer, { max: 10 });
      return data.text || '';
    } catch {
      return '';
    }
  }
}

/**
 * OCR fallback for scanned PDFs.
 * Not available in V1 — tesseract.js is not installed.
 * Returns empty string; caller falls through to raw buffer decode.
 */
async function extractTextFromPdfOcr() {
  return '';
}

/**
 * Extract text from an image buffer.
 * Not available in V1 — tesseract.js is not installed.
 */
async function extractTextFromImage() {
  return '';
}

module.exports = {
  extractTextFromPdf,
  extractTextFromPdfOcr,
  extractTextFromImage,
  extractAddressFromText,
  extractLandlordNoticeAddress,
};
