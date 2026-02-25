'use strict';

/**
 * DepositDefender — Phase 1 Scraper Job
 *
 * Discovers publicly accessible Texas residential lease PDFs via Google Custom
 * Search API, extracts their text, classifies them with Gemini, and stores
 * valid leases in BigQuery + Cloud Storage for the test harness to consume.
 *
 * robots.txt compliance: every URL is checked before download.
 * Rate limiting: 2-second minimum gap between downloads (configurable).
 * Deduplication: SHA-256 of raw PDF bytes; skip if already in BigQuery.
 * No redistribution: PDFs stored in private GCS bucket, not made public.
 */

const crypto  = require('crypto');
const { URL } = require('url');

const { BigQuery }   = require('@google-cloud/bigquery');
const { Storage }    = require('@google-cloud/storage');
const { VertexAI }   = require('@google-cloud/vertexai');
const axios          = require('axios');
const pdfParse       = require('pdf-parse');
const robotsParser   = require('robots-parser');

// ─── Configuration ────────────────────────────────────────────────────────────
const PROJECT_ID    = process.env.GCP_PROJECT_ID           || 'deposit-defender-testing';
const REGION        = process.env.GCP_REGION               || 'us-central1';
const BUCKET_NAME   = process.env.GCS_BUCKET_NAME          || 'dd-raw-leases';
const DATASET_ID    = process.env.BQ_DATASET_ID            || 'dd_pipeline';
const GEMINI_MODEL  = process.env.GEMINI_MODEL_ID          || 'gemini-3-flash';
const SEARCH_KEY    = process.env.CUSTOM_SEARCH_API_KEY;
const SEARCH_CX     = process.env.CUSTOM_SEARCH_ENGINE_ID;
const MAX_PDFS      = parseInt(process.env.MAX_PDFS_PER_RUN || '100');
const RATE_LIMIT_MS = parseInt(process.env.RATE_LIMIT_MS   || '2000');

// NOTE: gemini-3-flash is in public preview on Vertex AI as of early 2026.
// If you get a 404 / model-not-found error, set GEMINI_MODEL_ID=gemini-2.5-flash
// and redeploy. Verify the exact model ID at:
// https://console.cloud.google.com/vertex-ai/model-garden?project=deposit-defender-testing

const USER_AGENT = 'DepositDefenderTestBot/1.0 (+https://github.com/duffguitar5-star/deposit-defender; automated-testing-only)';

// Search queries designed to surface publicly available Texas residential leases.
// "filetype:pdf" is embedded in the search engine config; we use text queries only.
const SEARCH_QUERIES = [
  '"texas residential lease agreement" "security deposit" "30 days"',
  '"apartment lease agreement" "state of texas" "security deposit"',
  '"texas lease agreement" "tenant" "landlord" "deposit" "forwarding address"',
  '"residential lease" "texas property code" "chapter 92"',
  '"lease agreement" "state of texas" "normal wear and tear" "security deposit"',
  '"texas apartment association" lease agreement security deposit',
  '"HAR residential lease" texas security deposit',
  '"TREC" OR "texas real estate commission" lease "security deposit"',
  'site:.edu texas residential lease agreement security deposit filetype:pdf',
  'site:.gov texas tenant lease security deposit filetype:pdf',
];

// ─── GCP Clients ──────────────────────────────────────────────────────────────
const bq       = new BigQuery({ projectId: PROJECT_ID });
const storage  = new Storage({ projectId: PROJECT_ID });
const vertexai = new VertexAI({ project: PROJECT_ID, location: REGION });

// ─── Utilities ────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function log(msg) {
  process.stdout.write(`[${new Date().toISOString()}] ${msg}\n`);
}

// ─── robots.txt Check ─────────────────────────────────────────────────────────

const robotsCache = new Map(); // hostname → robots parser instance

async function isAllowedByRobots(pdfUrl) {
  try {
    const parsed   = new URL(pdfUrl);
    const hostname = parsed.hostname;

    if (!robotsCache.has(hostname)) {
      const robotsUrl = `${parsed.protocol}//${hostname}/robots.txt`;
      try {
        const res   = await axios.get(robotsUrl, { timeout: 5000, headers: { 'User-Agent': USER_AGENT } });
        robotsCache.set(hostname, robotsParser(robotsUrl, res.data));
      } catch {
        // robots.txt unreachable — treat as permissive
        robotsCache.set(hostname, null);
      }
    }

    const parser = robotsCache.get(hostname);
    if (!parser) return true; // no robots.txt = allowed

    const allowed = parser.isAllowed(pdfUrl, USER_AGENT);
    return allowed !== false; // undefined (not mentioned) counts as allowed
  } catch {
    return true; // parse error = allow
  }
}

// ─── PDF Download ─────────────────────────────────────────────────────────────

async function downloadPdf(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
    maxContentLength: 20 * 1024 * 1024, // 20 MB hard limit
    headers: { 'User-Agent': USER_AGENT },
  });

  const ct = (res.headers['content-type'] || '').toLowerCase();
  if (!ct.includes('pdf') && !url.toLowerCase().endsWith('.pdf')) {
    throw new Error(`Unexpected content-type: ${ct}`);
  }

  // Verify PDF magic bytes (%PDF)
  const buf = Buffer.from(res.data);
  if (buf.length < 4 || buf.slice(0, 4).toString('ascii') !== '%PDF') {
    throw new Error('File does not start with %PDF magic bytes');
  }

  return buf;
}

// ─── Text Extraction ──────────────────────────────────────────────────────────

async function extractText(buffer) {
  try {
    const data = await pdfParse(buffer, { max: 10 }); // first 10 pages only
    return (data.text || '').trim();
  } catch (err) {
    log(`    pdf-parse failed: ${err.message}`);
    return '';
  }
}

// ─── Gemini Classification ────────────────────────────────────────────────────

async function classifyLease(text, url) {
  const model = vertexai.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      maxOutputTokens: 256,
      temperature: 0.0,
    },
  });

  const truncated = text.slice(0, 8000);

  const prompt = `Classify the following document extracted from a PDF.
Source URL: ${url}

Document text (first 8000 characters):
---
${truncated}
---

Answer ONLY with valid JSON in this exact format:
{
  "is_residential_lease": true or false,
  "is_texas": true or false,
  "confidence": 0.0 to 1.0,
  "reason": "one sentence explanation"
}

Rules:
- is_residential_lease: true ONLY if this is a residential (not commercial) lease agreement between a landlord and tenant for a dwelling unit. False for forms, checklists, court documents, manuals, or lease addenda alone.
- is_texas: true ONLY if the document explicitly mentions Texas, TX, or Texas Property Code, or names a Texas city/county.
- confidence: your certainty 0.0–1.0`;

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    const raw  = result.response.candidates[0].content.parts[0].text;
    const data = JSON.parse(raw);
    return {
      is_residential_lease: data.is_residential_lease === true,
      is_texas:             data.is_texas === true,
      confidence:           parseFloat(data.confidence) || 0.5,
      reason:               String(data.reason || '').slice(0, 500),
      raw_response:         raw,
    };
  } catch (err) {
    log(`    Gemini classification error: ${err.message}`);
    return {
      is_residential_lease: false,
      is_texas:             false,
      confidence:           0,
      reason:               `Classification error: ${err.message}`.slice(0, 500),
      raw_response:         '',
    };
  }
}

// ─── Deduplication Check ──────────────────────────────────────────────────────

async function alreadyExists(leaseId) {
  const q = `
    SELECT lease_id
    FROM \`${PROJECT_ID}.${DATASET_ID}.leases\`
    WHERE lease_id = @leaseId
    LIMIT 1
  `;
  const [rows] = await bq.query({ query: q, params: { leaseId } });
  return rows.length > 0;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

async function storePdf(leaseId, buffer) {
  const file = storage.bucket(BUCKET_NAME).file(`leases/${leaseId}.pdf`);
  await file.save(buffer, { contentType: 'application/pdf', resumable: false });
  return `gs://${BUCKET_NAME}/leases/${leaseId}.pdf`;
}

async function insertLease(row) {
  await bq.dataset(DATASET_ID).table('leases').insert([row]);
}

// ─── Search ───────────────────────────────────────────────────────────────────

async function searchPdfs(query) {
  const results = [];
  for (let start = 1; start <= 21; start += 10) {
    try {
      const res = await axios.get('https://www.googleapis.com/customsearch/v1', {
        params: {
          key:      SEARCH_KEY,
          cx:       SEARCH_CX,
          q:        query,
          num:      10,
          start:    start,
          fileType: 'pdf',
        },
        timeout: 10000,
      });
      const items = res.data.items || [];
      for (const item of items) {
        if (item.link && item.link.toLowerCase().endsWith('.pdf')) {
          results.push({ url: item.link, title: item.title || '' });
        }
      }
      if (items.length < 10) break; // no more pages
      await sleep(500);
    } catch (err) {
      log(`  Search error (query="${query}", start=${start}): ${err.message}`);
      break;
    }
  }
  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!SEARCH_KEY || !SEARCH_CX) {
    console.error('FATAL: CUSTOM_SEARCH_API_KEY and CUSTOM_SEARCH_ENGINE_ID must be set.');
    process.exit(1);
  }

  log('=== DepositDefender Scraper Job Starting ===');
  log(`Project: ${PROJECT_ID} | Bucket: ${BUCKET_NAME} | Dataset: ${DATASET_ID}`);
  log(`Gemini model: ${GEMINI_MODEL} | Max PDFs: ${MAX_PDFS}`);

  let processed   = 0;
  let validTx     = 0;
  let skipped     = 0;
  let failed      = 0;
  const seen      = new Set(); // in-memory dedup within this run

  queryLoop:
  for (const query of SEARCH_QUERIES) {
    if (processed >= MAX_PDFS) break;

    log(`\nSearch query: "${query}"`);
    const candidates = await searchPdfs(query);
    log(`  Found ${candidates.length} PDF URLs`);

    for (const { url } of candidates) {
      if (processed >= MAX_PDFS) break queryLoop;
      if (seen.has(url)) { skipped++; continue; }
      seen.add(url);

      log(`  → ${url}`);

      // robots.txt gate
      const allowed = await isAllowedByRobots(url);
      if (!allowed) {
        log(`    Skipped: robots.txt disallows`);
        skipped++;
        continue;
      }

      await sleep(RATE_LIMIT_MS);

      let buffer;
      try {
        buffer = await downloadPdf(url);
      } catch (err) {
        log(`    Download failed: ${err.message}`);
        failed++;
        continue;
      }

      const leaseId = sha256(buffer);
      log(`    lease_id: ${leaseId.slice(0, 16)}... (${buffer.length} bytes)`);

      // BigQuery dedup
      if (await alreadyExists(leaseId)) {
        log(`    Skipped: already in BigQuery`);
        skipped++;
        continue;
      }

      const text       = await extractText(buffer);
      const textLength = text.length;
      log(`    Extracted ${textLength} chars`);

      if (textLength < 200) {
        log(`    Skipped: too little text (likely scanned-only PDF)`);
        skipped++;
        await insertLease({
          lease_id:             leaseId,
          source_url:           url,
          source_domain:        new URL(url).hostname,
          file_size_bytes:      buffer.length,
          extracted_text:       text,
          text_length:          textLength,
          gemini_classification: 'SKIPPED_NO_TEXT',
          gemini_confidence:    0,
          gemini_reason:        'Less than 200 chars extracted — likely scanned PDF without text layer',
          is_valid_tx_lease:    false,
          gcs_path:             null,
          scraped_at:           new Date().toISOString(),
        });
        continue;
      }

      // Classify
      const cls = await classifyLease(text, url);
      const isValid = cls.is_residential_lease && cls.is_texas;
      const classification = `${cls.is_residential_lease ? 'RESIDENTIAL' : 'NOT_RESIDENTIAL'}_${cls.is_texas ? 'TX' : 'NOT_TX'}`;

      log(`    Classification: ${classification} (conf=${cls.confidence.toFixed(2)}) — ${cls.reason}`);

      // Only store PDFs in GCS if they're valid TX leases (cost + privacy)
      let gcsPath = null;
      if (isValid) {
        gcsPath = await storePdf(leaseId, buffer);
        validTx++;
        log(`    ✓ Stored to GCS: ${gcsPath}`);
      }

      await insertLease({
        lease_id:             leaseId,
        source_url:           url,
        source_domain:        new URL(url).hostname,
        file_size_bytes:      buffer.length,
        // Store full text for valid leases; first 1500 chars for rejects (for debugging)
        extracted_text:       isValid ? text : text.slice(0, 1500),
        text_length:          textLength,
        gemini_classification: classification,
        gemini_confidence:    cls.confidence,
        gemini_reason:        cls.reason,
        is_valid_tx_lease:    isValid,
        gcs_path:             gcsPath,
        scraped_at:           new Date().toISOString(),
      });

      processed++;
      await sleep(500); // brief pause after GCS/BQ writes
    }

    await sleep(2000); // polite gap between search queries
  }

  log('\n=== Scraper Job Complete ===');
  log(`PDFs processed:       ${processed}`);
  log(`Valid TX leases:      ${validTx}`);
  log(`Skipped (dup/robots): ${skipped}`);
  log(`Failed (download):    ${failed}`);

  if (validTx === 0) {
    log('\nWARNING: No valid TX leases found. Check:');
    log('  1. CUSTOM_SEARCH_ENGINE_ID points to the correct search engine');
    log('  2. The search engine is set to search the entire web (not just specific sites)');
    log('  3. CUSTOM_SEARCH_API_KEY has quota remaining');
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
