'use strict';

/**
 * DepositDefender — Phase 2 Test Harness
 *
 * For each valid TX lease in BigQuery, generates 7 test scenarios covering all
 * critical code paths in the analysis pipeline, then calls buildCaseAnalysisReport()
 * DIRECTLY (no HTTP) and logs every result to BigQuery.
 *
 * Key design decisions:
 *   - Scenario dates are computed at runtime relative to new Date() because
 *     buildCaseAnalysisReport uses differenceInCalendarDays(new Date(), moveOutDate)
 *     internally. Hardcoded dates would cause timeline logic to break silently.
 *   - Gemini is used ONLY to extract realistic lease details (deposit amount,
 *     address, parties). The 7 scenario templates are code-defined to give
 *     deterministic expected outputs for correctness validation.
 *   - full report_json is stored only for anomalous rows to limit BQ storage.
 */

const path = require('path');
const { BigQuery }   = require('@google-cloud/bigquery');
const { VertexAI }   = require('@google-cloud/vertexai');
const { v4: uuidv4 } = require('uuid');

// ── Import the analysis pipeline directly from app source ──────────────────
// The Dockerfile maintains /app/server/src/lib/ and /app/ai/ at these paths.
const { buildCaseAnalysisReport, validateReport } =
  require('./server/src/lib/CaseAnalysisService');

// ─── Configuration ────────────────────────────────────────────────────────────
const PROJECT_ID   = process.env.GCP_PROJECT_ID  || 'deposit-defender-testing';
const REGION       = process.env.GCP_REGION      || 'us-central1';
const DATASET_ID   = process.env.BQ_DATASET_ID   || 'dd_pipeline';
const GEMINI_MODEL = process.env.GEMINI_MODEL_ID || 'gemini-3-flash';
const MAX_LEASES   = parseInt(process.env.MAX_LEASES || '100');
const TEST_RUN_ID  = process.env.TEST_RUN_ID     || uuidv4();

// ─── GCP Clients ──────────────────────────────────────────────────────────────
const bq       = new BigQuery({ projectId: PROJECT_ID });
const vertexai = new VertexAI({ project: PROJECT_ID, location: REGION });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(msg) {
  process.stdout.write(`[${new Date().toISOString()}] ${msg}\n`);
}

/**
 * Returns a YYYY-MM-DD date string for N days ago.
 * Called at scenario-build time so dates are always current.
 */
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

// ─── Scenario Templates ───────────────────────────────────────────────────────
//
// These 7 templates cover every significant branch in:
//   issueDetectors.js   (all 4 detectors + no-issue control)
//   leverageScoring.js  (all 5 SCORE_BANDS)
//   strategyEngine.js   (all 4 ACTION_CONTENT keys)
//
// expected_position tolerance: we assert the actual strategic_position falls
// within the expected_position OR one band adjacent (scoring has ±5pt variance
// from Gemini-extracted deposit amounts). See positionWithinTolerance().

const SCENARIO_TEMPLATES = [
  {
    index:              0,
    name:               'deadline_missed_full_withhold',
    move_out_days_ago:  45,
    deposit_returned:   'no',
    amount_returned:    '',
    itemized:           'no',
    forwarding:         'yes',
    comm_methods:       ['certified mail', 'email'],
    tenant_notes_extra: 'I moved out 45 days ago and have heard nothing from the landlord.',
    // Scoring path: past30Days=true, depositReturned=false, itemized=false
    // → timeline: +40, forwardingProvided: +10+8, badFaith: +8 (past45days), issues: +10+10
    // Expected score: ~86 → STRONG
    expected_detector:  'deadline_missed_full_deposit',
    expected_position:  'STRONG',
  },
  {
    index:              1,
    name:               'partial_refund_no_itemization',
    move_out_days_ago:  38,
    deposit_returned:   'partial',
    amount_returned_pct: 0.40, // 40% returned, 60% withheld
    itemized:           'no',
    forwarding:         'yes',
    comm_methods:       ['email', 'text'],
    tenant_notes_extra: 'They returned $480 but kept the rest with no explanation.',
    // Scoring path: past30Days=true, partial, itemized=false → timeline: +30
    expected_detector:  'deadline_missed_no_itemization_only',
    expected_position:  'STRONG',
  },
  {
    index:              2,
    name:               'approaching_deadline_forwarding_provided',
    move_out_days_ago:  22,
    deposit_returned:   'no',
    amount_returned:    '',
    itemized:           'no',
    forwarding:         'yes',
    comm_methods:       ['text'],
    tenant_notes_extra: 'I texted the landlord but got no reply.',
    // past30Days=false, daysSinceMoveOut=22 >=20: timeline +40 (imminent)
    // forwardingProvided: +10+15
    expected_detector:  'within_30_days_deposit_withheld',
    expected_position:  'STRONG',
  },
  {
    index:              3,
    name:               'approaching_deadline_no_forwarding',
    move_out_days_ago:  15,
    deposit_returned:   'no',
    amount_returned:    '',
    itemized:           'no',
    forwarding:         'no',
    comm_methods:       [],
    tenant_notes_extra: 'I have not sent my forwarding address yet.',
    // past30Days=false, daysSinceMoveOut=15 (1<=x<20): timeline +20
    // no forwarding: +0, issues: no_forwarding=MEDIUM +3
    // Expected score: ~23 → WEAK (boundary; accept WEAK or UNCERTAIN)
    expected_detector:  'no_forwarding_address',
    expected_position:  'WEAK',
  },
  {
    index:              4,
    name:               'itemization_received_wear_tear_dispute',
    move_out_days_ago:  50,
    deposit_returned:   'partial',
    amount_returned_pct: 0.50,
    itemized:           'yes',
    forwarding:         'yes',
    comm_methods:       ['email'],
    tenant_notes_extra: 'They gave me an itemized list but charged for carpet wear and paint scuffs. Normal wear and tear.',
    // past30Days=true, partial, itemized=YES: timeline +18 (weaker violation)
    // forwarding: +10+8, badFaith: +8, issues: normal_wear=MEDIUM +3
    // Expected: ~47 → WEAK (accept WEAK or MODERATE)
    expected_detector:  'normal_wear_concern',
    expected_position:  'WEAK',
  },
  {
    index:              5,
    name:               'extended_bad_faith_silence',
    move_out_days_ago:  65,
    deposit_returned:   'no',
    amount_returned:    '',
    itemized:           'no',
    forwarding:         'yes',
    comm_methods:       ['certified mail', 'email', 'text'],
    tenant_notes_extra: 'I have sent multiple certified letters and emails with zero response for over 2 months.',
    // past30Days=true, 65 days: +5 extended silence bonus
    // multiple comm methods + past30Days + no return → 2 bad faith indicators (+16)
    // Expected: ~100 → STRONG, A grade
    expected_detector:  'deadline_missed_full_deposit',
    expected_position:  'STRONG',
  },
  {
    index:              6,
    name:               'control_deposit_returned_full',
    move_out_days_ago:  10,
    deposit_returned:   'yes',
    amount_returned:    '',
    itemized:           'no',
    forwarding:         'yes',
    comm_methods:       [],
    tenant_notes_extra: 'Deposit was returned in full. No issues.',
    // No detectors should fire; score should be low
    expected_detector:  null, // no issue expected
    expected_position:  'UNCERTAIN',
  },
];

// ─── Position Tolerance ───────────────────────────────────────────────────────
// Allow one band of tolerance for boundary cases (scores near 25/50/75 thresholds)

const POSITION_ORDER = ['UNCERTAIN', 'WEAK', 'MODERATE', 'STRONG'];

function positionWithinTolerance(actual, expected) {
  if (actual === expected) return true;
  const ai = POSITION_ORDER.indexOf(actual);
  const ei = POSITION_ORDER.indexOf(expected);
  return Math.abs(ai - ei) <= 1;
}

// ─── Gemini Lease Detail Extraction ──────────────────────────────────────────

async function extractLeaseDetails(leaseText, leaseId) {
  const model = vertexai.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      maxOutputTokens: 600,
      temperature: 0.2,
    },
  });

  const truncated = leaseText.slice(0, 6000);

  const prompt = `Extract structured data from this Texas lease agreement text.
Return ONLY valid JSON matching the schema below.

Lease text:
---
${truncated}
---

JSON schema (return exactly these fields):
{
  "deposit_amount": "dollar amount as string, e.g. '$1,200'. Use '$1,200' if not found.",
  "pet_deposit_amount": "dollar amount or null",
  "property_address": "street address. Use '123 Main St' if not found.",
  "city": "Texas city name. Use 'Austin' if not found.",
  "zip_code": "5-digit ZIP. Use '78701' if not found.",
  "county": "county name. Use 'Travis' if not found.",
  "landlord_name": "landlord or property management company name. Use 'Unknown Landlord LLC' if not found.",
  "lease_type": "written"
}

Rules:
- All fields must be present — use the default values shown if the field cannot be found.
- Do NOT include tenant name or email — those are generated by the harness.
- zip_code must be exactly 5 digits.
- deposit_amount must be non-zero.`;

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    const raw  = result.response.candidates[0].content.parts[0].text;
    const data = JSON.parse(raw);

    return {
      deposit_amount:    validateDepositAmount(data.deposit_amount),
      pet_deposit_amount: data.pet_deposit_amount || null,
      property_address:  data.property_address || '123 Main Street',
      city:              data.city              || 'Austin',
      zip_code:          validateZip(data.zip_code),
      county:            data.county            || 'Travis',
      landlord_name:     data.landlord_name     || 'Unknown Landlord LLC',
      lease_type:        'written',
    };
  } catch (err) {
    log(`  Lease detail extraction failed (${leaseId.slice(0, 8)}): ${err.message}`);
    return {
      deposit_amount:    '$1,200',
      pet_deposit_amount: null,
      property_address:  '123 Main Street',
      city:              'Austin',
      zip_code:          '78701',
      county:            'Travis',
      landlord_name:     'Unknown Landlord LLC',
      lease_type:        'written',
    };
  }
}

function validateDepositAmount(raw) {
  if (!raw) return '$1,200';
  const clean = String(raw).replace(/[^0-9.]/g, '');
  const num   = parseFloat(clean);
  if (isNaN(num) || num <= 0) return '$1,200';
  return raw; // keep original formatted string
}

function validateZip(raw) {
  if (!raw) return '78701';
  const digits = String(raw).replace(/\D/g, '').slice(0, 5);
  return digits.length === 5 ? digits : '78701';
}

// ─── Intake Builder ───────────────────────────────────────────────────────────

function buildIntake(template, leaseDetails, runIndex) {
  const moveOutDate = daysAgo(template.move_out_days_ago);
  // Synthetic but plausible lease dates around the move-out
  const leaseEndDate   = daysAgo(template.move_out_days_ago - 1);
  const leaseStartDate = daysAgo(template.move_out_days_ago + 364);

  // Compute partial refund amount
  let amountReturned = template.amount_returned || '';
  if (template.deposit_returned === 'partial' && template.amount_returned_pct) {
    const depositNum = parseFloat(String(leaseDetails.deposit_amount).replace(/[^0-9.]/g, ''));
    if (!isNaN(depositNum) && depositNum > 0) {
      amountReturned = String(Math.round(depositNum * template.amount_returned_pct));
    } else {
      amountReturned = '480'; // sensible fallback
    }
  }

  // Synthetic tenant identity (not real PII — clearly test data)
  const tenantName  = `Test Tenant ${runIndex + 1}`;
  const tenantEmail = `test-tenant-${runIndex + 1}@depositdefender-testing.invalid`;

  return {
    jurisdiction: 'TX',
    acknowledgements: {
      texas_only_confirmation:        true,
      non_legal_service_acknowledged: true,
    },
    tenant_information: {
      full_name: tenantName,
      email:     tenantEmail,
      phone:     '',
    },
    property_information: {
      property_address: leaseDetails.property_address,
      city:             leaseDetails.city,
      zip_code:         leaseDetails.zip_code,
      county:           leaseDetails.county,
    },
    lease_information: {
      lease_start_date: leaseStartDate,
      lease_end_date:   leaseEndDate,
      lease_type:       leaseDetails.lease_type,
    },
    move_out_information: {
      move_out_date:               moveOutDate,
      forwarding_address_provided: template.forwarding,
      forwarding_address_date:     template.forwarding === 'yes' ? moveOutDate : '',
    },
    security_deposit_information: {
      deposit_amount:     leaseDetails.deposit_amount,
      pet_deposit_amount: leaseDetails.pet_deposit_amount || '',
      deposit_paid_date:  leaseStartDate,
      deposit_returned:   template.deposit_returned,
      amount_returned:    amountReturned,
    },
    post_move_out_communications: {
      itemized_deductions_received:  template.itemized,
      date_itemized_list_received:   '',
      communication_methods_used:    template.comm_methods,
    },
    additional_notes: {
      tenant_notes: [
        `Property: ${leaseDetails.property_address}, ${leaseDetails.city}, TX ${leaseDetails.zip_code}.`,
        `Landlord: ${leaseDetails.landlord_name}.`,
        template.tenant_notes_extra,
      ].join(' '),
    },
  };
}

// ─── Analysis Runner ──────────────────────────────────────────────────────────

function runAnalysis(intake, leaseText) {
  // Pass leaseText at the top level so CaseAnalysisService injects it as _leaseText
  // (increases evidence_quality score for leases that have text)
  const caseData = { intake, leaseText: leaseText || null };
  try {
    const report     = buildCaseAnalysisReport(caseData);
    const validation = validateReport(report);
    return { success: true, report, validation, error: null };
  } catch (err) {
    return { success: false, report: null, validation: null, error: err.message };
  }
}

// ─── BigQuery Writers ─────────────────────────────────────────────────────────

async function insertScenario(row) {
  await bq.dataset(DATASET_ID).table('test_scenarios').insert([row]);
}

async function insertResult(row) {
  await bq.dataset(DATASET_ID).table('test_results').insert([row]);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log('=== DepositDefender Test Harness Starting ===');
  log(`Test run ID: ${TEST_RUN_ID}`);
  log(`Gemini model: ${GEMINI_MODEL} | Max leases: ${MAX_LEASES}`);

  // Fetch valid TX leases from BigQuery
  const q = `
    SELECT lease_id, extracted_text, source_url, text_length
    FROM \`${PROJECT_ID}.${DATASET_ID}.leases\`
    WHERE is_valid_tx_lease = TRUE
      AND text_length > 500
    ORDER BY scraped_at DESC
    LIMIT @maxLeases
  `;
  const [leases] = await bq.query({ query: q, params: { maxLeases: MAX_LEASES } });
  log(`Found ${leases.length} valid TX leases to test`);

  if (leases.length === 0) {
    log('No leases found. Run the scraper job first.');
    return;
  }

  let totalScenarios = 0;
  let totalResults   = 0;
  let crashes        = 0;
  let detectorMiss   = 0;
  let positionMiss   = 0;

  for (let li = 0; li < leases.length; li++) {
    const { lease_id: leaseId, extracted_text: leaseText, source_url: sourceUrl } = leases[li];
    log(`\n[${li + 1}/${leases.length}] Lease: ${leaseId.slice(0, 12)}... | ${sourceUrl}`);

    // Extract realistic details from lease text using Gemini
    const leaseDetails = await extractLeaseDetails(leaseText, leaseId);
    log(`  Details: deposit=${leaseDetails.deposit_amount} | ${leaseDetails.city}, TX ${leaseDetails.zip_code}`);

    for (const template of SCENARIO_TEMPLATES) {
      const scenarioId = uuidv4();
      const intake     = buildIntake(template, leaseDetails, li);

      // Persist scenario for traceability
      await insertScenario({
        scenario_id:       scenarioId,
        lease_id:          leaseId,
        test_run_id:       TEST_RUN_ID,
        scenario_index:    template.index,
        scenario_name:     template.name,
        expected_detector: template.expected_detector || null,
        expected_position: template.expected_position,
        intake_json:       JSON.stringify(intake),
        lease_details_json: JSON.stringify(leaseDetails),
        generated_at:      new Date().toISOString(),
      });
      totalScenarios++;

      // Run analysis — direct function call, no HTTP
      const { success, report, validation, error } = runAnalysis(intake, leaseText);

      // Extract metrics
      let score          = null;
      let grade          = null;
      let position       = null;
      let probability    = null;
      let action         = null;
      let issueIds       = [];
      let reportValid    = null;
      let validErrors    = [];
      let likelyCase     = null;
      let bestCase       = null;

      if (success && report) {
        const cs        = report.case_strength || {};
        score           = cs.case_strength_score    ?? null;
        grade           = cs.leverage_grade         ?? null;
        position        = cs.strategic_position     ?? null;
        probability     = cs.win_probability        ?? null;
        action          = report.strategy?.recommended_action ?? null;
        issueIds        = (report.leverage_points || []).map(lp => lp.point_id).filter(Boolean);
        reportValid     = validation?.valid          ?? null;
        validErrors     = (validation?.errors || []).map(e => `${e.path}: ${e.message}`);
        likelyCase      = report.recovery_estimate?.likely_case ?? null;
        bestCase        = report.recovery_estimate?.best_case   ?? null;
      }

      // Correctness assertions
      const expectedDet = template.expected_detector;
      const detFired    = expectedDet
        ? issueIds.includes(expectedDet)
        : issueIds.length === 0; // control: no issues expected
      const posOk       = position ? positionWithinTolerance(position, template.expected_position) : false;

      if (!success)  crashes++;
      if (!detFired) detectorMiss++;
      if (!posOk)    positionMiss++;

      // Store full report JSON only for anomalous cases (saves BQ storage)
      const isAnomalous = !success || !reportValid || !detFired || !posOk || score === null;
      const reportJson  = isAnomalous && success ? JSON.stringify(report) : '';

      await insertResult({
        result_id:              uuidv4(),
        scenario_id:            scenarioId,
        lease_id:               leaseId,
        test_run_id:            TEST_RUN_ID,
        scenario_name:          template.name,
        case_strength_score:    score,
        leverage_grade:         grade,
        strategic_position:     position,
        win_probability:        probability,
        recommended_action:     action,
        detected_issue_ids:     issueIds,
        expected_detector:      expectedDet || '',
        expected_position:      template.expected_position,
        detector_fired_correctly: detFired,
        position_correct:       posOk,
        report_valid:           reportValid,
        validation_errors:      validErrors,
        error_thrown:           error || '',
        recovery_likely_case:   likelyCase,
        recovery_best_case:     bestCase,
        report_json:            reportJson,
        processed_at:           new Date().toISOString(),
      });
      totalResults++;

      // Console summary line
      const icon = !success ? '💥' : (!detFired || !posOk) ? '⚠️ ' : '✓ ';
      log(`  ${icon} [${template.name}] score=${score ?? 'ERR'} pos=${position ?? 'ERR'}(exp:${template.expected_position}) det_ok=${detFired} pos_ok=${posOk}`);
    }
  }

  log('\n=== Harness Job Complete ===');
  log(`Leases processed:    ${leases.length}`);
  log(`Scenarios run:       ${totalScenarios}`);
  log(`Results logged:      ${totalResults}`);
  log(`Analysis crashes:    ${crashes}`);
  log(`Detector misfires:   ${detectorMiss}`);
  log(`Position mismatches: ${positionMiss}`);

  // Exit non-zero if meaningful failures — lets Cloud Run mark the job as failed
  if (crashes > 0) {
    log('\nERROR: analysis crashes detected — inspect test_results WHERE error_thrown != \'\'');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
