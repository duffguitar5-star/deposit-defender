'use strict';

/**
 * DepositDefender — Phase 3 Reporter Job
 *
 * Queries BigQuery for the latest test run results, detects failures,
 * and generates a Markdown summary report uploaded to Cloud Storage.
 *
 * Exits with code 1 if critical failures are detected (any crashes, or
 * >10% detector misfire rate), so Cloud Run marks the job as failed
 * and triggers alerts.
 */

const { BigQuery } = require('@google-cloud/bigquery');
const { Storage }  = require('@google-cloud/storage');

// ─── Configuration ────────────────────────────────────────────────────────────
const PROJECT_ID     = process.env.GCP_PROJECT_ID    || 'deposit-defender-testing';
const DATASET_ID     = process.env.BQ_DATASET_ID     || 'dd_pipeline';
const REPORTS_BUCKET = process.env.REPORTS_BUCKET    || 'dd-pipeline-reports';
const LOOKBACK_DAYS  = parseInt(process.env.LOOKBACK_DAYS || '7');

// ─── GCP Clients ──────────────────────────────────────────────────────────────
const bq      = new BigQuery({ projectId: PROJECT_ID });
const storage = new Storage({ projectId: PROJECT_ID });

// ─── Utilities ────────────────────────────────────────────────────────────────

function log(msg) {
  process.stdout.write(`[${new Date().toISOString()}] ${msg}\n`);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function query(sql) {
  const [rows] = await bq.query({ query: sql });
  return rows;
}

// ─── Markdown Helpers ─────────────────────────────────────────────────────────

function mdHeader(level, text) {
  return `${'#'.repeat(level)} ${text}\n\n`;
}

function mdTable(headers, rows) {
  if (rows.length === 0) return '_No data._\n\n';
  const cols = headers.map(h => h.length);
  for (const row of rows) {
    headers.forEach((_, i) => {
      const cell = String(row[i] ?? '');
      if (cell.length > cols[i]) cols[i] = cell.length;
    });
  }
  const pad = (s, n) => String(s ?? '').padEnd(n);
  const sep = cols.map(n => '-'.repeat(n));
  const lines = [
    '| ' + headers.map((h, i) => pad(h, cols[i])).join(' | ') + ' |',
    '| ' + sep.map((s, i) => pad(s, cols[i])).join(' | ') + ' |',
    ...rows.map(r => '| ' + headers.map((_, i) => pad(r[i], cols[i])).join(' | ') + ' |'),
  ];
  return lines.join('\n') + '\n\n';
}

function statusBadge(passing) {
  return passing ? '🟢 PASS' : '🔴 FAIL';
}

// ─── Queries ──────────────────────────────────────────────────────────────────

async function fetchOverallHealth() {
  return query(`
    SELECT
      COUNT(DISTINCT test_run_id)                               AS total_runs,
      COUNT(DISTINCT lease_id)                                  AS leases_tested,
      COUNT(*)                                                  AS total_scenarios,
      COUNTIF(error_thrown != '')                               AS crashes,
      COUNTIF(NOT report_valid AND error_thrown = '')           AS struct_failures,
      COUNTIF(NOT detector_fired_correctly AND error_thrown='') AS detector_misfires,
      COUNTIF(NOT position_correct AND error_thrown='')         AS position_mismatches,
      COUNTIF(case_strength_score IS NULL AND error_thrown='')  AS null_scores,
      ROUND(AVG(case_strength_score), 1)                        AS avg_score,
      MIN(case_strength_score)                                  AS min_score,
      MAX(case_strength_score)                                  AS max_score
    FROM \`${PROJECT_ID}.${DATASET_ID}.test_results\`
    WHERE processed_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${LOOKBACK_DAYS} DAY)
  `);
}

async function fetchScenarioBreakdown() {
  return query(`
    SELECT
      scenario_name,
      expected_position,
      COUNT(*)                                                   AS n,
      ROUND(AVG(case_strength_score), 1)                         AS avg_score,
      MIN(case_strength_score)                                   AS min_score,
      MAX(case_strength_score)                                   AS max_score,
      COUNTIF(position_correct)                                  AS correct,
      COUNTIF(NOT position_correct)                              AS wrong,
      COUNTIF(error_thrown != '')                                AS errors,
      ROUND(COUNTIF(position_correct) / COUNT(*) * 100, 1)       AS pct_correct
    FROM \`${PROJECT_ID}.${DATASET_ID}.test_results\`
    WHERE processed_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${LOOKBACK_DAYS} DAY)
    GROUP BY scenario_name, expected_position
    ORDER BY scenario_name
  `);
}

async function fetchCrashes() {
  return query(`
    SELECT
      r.result_id,
      r.lease_id,
      r.scenario_name,
      LEFT(r.error_thrown, 200) AS error_thrown,
      FORMAT_TIMESTAMP('%Y-%m-%d %H:%M', r.processed_at) AS processed_at
    FROM \`${PROJECT_ID}.${DATASET_ID}.test_results\` r
    WHERE r.error_thrown != ''
      AND r.processed_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${LOOKBACK_DAYS} DAY)
    ORDER BY r.processed_at DESC
    LIMIT 20
  `);
}

async function fetchDetectorMisfires() {
  return query(`
    SELECT
      scenario_name,
      expected_detector,
      ARRAY_TO_STRING(detected_issue_ids, ', ') AS actual_detectors,
      case_strength_score,
      strategic_position,
      LEFT(lease_id, 16)                         AS lease_id_prefix,
      FORMAT_TIMESTAMP('%Y-%m-%d', processed_at) AS date
    FROM \`${PROJECT_ID}.${DATASET_ID}.test_results\`
    WHERE NOT detector_fired_correctly
      AND error_thrown = ''
      AND processed_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${LOOKBACK_DAYS} DAY)
    ORDER BY scenario_name, processed_at DESC
    LIMIT 30
  `);
}

async function fetchScoreAnomalies() {
  return query(`
    SELECT
      r.scenario_name,
      r.case_strength_score,
      r.leverage_grade,
      r.strategic_position,
      LEFT(r.lease_id, 16) AS lease_id_prefix,
      LEFT(r.error_thrown, 100) AS error
    FROM \`${PROJECT_ID}.${DATASET_ID}.test_results\` r
    WHERE (r.case_strength_score IS NULL OR r.case_strength_score = 0)
      AND r.scenario_name != 'control_deposit_returned_full'
      AND r.error_thrown = ''
      AND r.processed_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${LOOKBACK_DAYS} DAY)
    ORDER BY r.processed_at DESC
    LIMIT 20
  `);
}

async function fetchBandCrossings() {
  return query(`
    SELECT
      scenario_name,
      expected_position,
      strategic_position AS actual_position,
      case_strength_score,
      ARRAY_TO_STRING(detected_issue_ids, ', ') AS detectors,
      LEFT(lease_id, 16)                         AS lease_id_prefix
    FROM \`${PROJECT_ID}.${DATASET_ID}.test_results\`
    WHERE NOT position_correct
      AND error_thrown = ''
      AND case_strength_score IS NOT NULL
      AND processed_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${LOOKBACK_DAYS} DAY)
    ORDER BY ABS(
      CASE expected_position
        WHEN 'STRONG'   THEN 75
        WHEN 'MODERATE' THEN 50
        WHEN 'WEAK'     THEN 25
        ELSE 0
      END - case_strength_score
    ) DESC
    LIMIT 20
  `);
}

async function fetchRecoveryAnomalies() {
  return query(`
    SELECT
      scenario_name,
      case_strength_score,
      strategic_position,
      recovery_likely_case,
      recovery_best_case,
      LEFT(lease_id, 16) AS lease_id_prefix
    FROM \`${PROJECT_ID}.${DATASET_ID}.test_results\`
    WHERE error_thrown = ''
      AND case_strength_score >= 60
      AND (recovery_likely_case = '$0' OR recovery_likely_case IS NULL)
      AND processed_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${LOOKBACK_DAYS} DAY)
    ORDER BY case_strength_score DESC
    LIMIT 10
  `);
}

async function fetchLeaseQuality() {
  return query(`
    SELECT
      source_domain,
      COUNT(*)                              AS total_found,
      COUNTIF(is_valid_tx_lease)            AS valid_tx,
      ROUND(AVG(text_length), 0)            AS avg_text_len,
      ROUND(AVG(gemini_confidence), 2)      AS avg_confidence
    FROM \`${PROJECT_ID}.${DATASET_ID}.leases\`
    GROUP BY source_domain
    ORDER BY valid_tx DESC, total_found DESC
    LIMIT 20
  `);
}

async function fetchLatestRun() {
  return query(`
    SELECT
      test_run_id,
      FORMAT_TIMESTAMP('%Y-%m-%d %H:%M UTC', started_at)   AS started,
      FORMAT_TIMESTAMP('%Y-%m-%d %H:%M UTC', completed_at) AS completed,
      leases_processed,
      scenarios_generated,
      results_logged,
      analysis_failures,
      detector_misfires,
      position_mismatches
    FROM \`${PROJECT_ID}.${DATASET_ID}.test_runs\`
    ORDER BY started_at DESC
    LIMIT 1
  `);
}

// ─── Report Builder ───────────────────────────────────────────────────────────

async function buildReport() {
  log('Fetching data from BigQuery...');

  const [
    [health],
    scenarios,
    crashes,
    misfires,
    scoreAnomalies,
    bandCrossings,
    recoveryAnomalies,
    leaseQuality,
    [latestRun],
  ] = await Promise.all([
    fetchOverallHealth(),
    fetchScenarioBreakdown(),
    fetchCrashes(),
    fetchDetectorMisfires(),
    fetchScoreAnomalies(),
    fetchBandCrossings(),
    fetchRecoveryAnomalies(),
    fetchLeaseQuality(),
    fetchLatestRun(),
  ]);

  // ─── Determine overall pass/fail ──────────────────────────────────────────
  const hasCrashes          = health && health.crashes > 0;
  const misFireRate         = health && health.total_scenarios > 0
    ? health.detector_misfires / health.total_scenarios
    : 0;
  const hasHighMisfireRate  = misFireRate > 0.10; // >10% threshold
  const hasStructFailures   = health && health.struct_failures > 0;
  const hasNullScores       = health && health.null_scores > 0;
  const overallPass         = !hasCrashes && !hasHighMisfireRate && !hasStructFailures && !hasNullScores;

  // ─── Build Markdown ────────────────────────────────────────────────────────
  let md = '';

  md += mdHeader(1, `DepositDefender Pipeline Report — ${today()}`);
  md += `**Overall Status: ${statusBadge(overallPass)}**\n\n`;
  md += `_Lookback window: last ${LOOKBACK_DAYS} days. Generated: ${new Date().toISOString()}_\n\n`;

  // Latest run summary
  if (latestRun) {
    md += mdHeader(2, 'Latest Test Run');
    md += mdTable(
      ['Run ID', 'Started', 'Completed', 'Leases', 'Scenarios', 'Results', 'Failures', 'Misfires', 'Band Mismatches'],
      [[
        latestRun.test_run_id?.slice(0, 8) + '...',
        latestRun.started,
        latestRun.completed,
        latestRun.leases_processed,
        latestRun.scenarios_generated,
        latestRun.results_logged,
        latestRun.analysis_failures,
        latestRun.detector_misfires,
        latestRun.position_mismatches,
      ]],
    );
  }

  // Overall health
  md += mdHeader(2, `Health Summary (last ${LOOKBACK_DAYS} days)`);
  if (health) {
    const flags = [];
    if (hasCrashes)         flags.push(`⚠️ ${health.crashes} crash(es) detected`);
    if (hasHighMisfireRate) flags.push(`⚠️ Detector misfire rate ${(misFireRate * 100).toFixed(1)}% > 10% threshold`);
    if (hasStructFailures)  flags.push(`⚠️ ${health.struct_failures} report structure failure(s)`);
    if (hasNullScores)      flags.push(`⚠️ ${health.null_scores} unexpected null/zero score(s)`);
    if (flags.length === 0) flags.push('✅ All checks passing');

    md += flags.map(f => `- ${f}`).join('\n') + '\n\n';

    md += mdTable(
      ['Metric', 'Value'],
      [
        ['Test runs', health.total_runs],
        ['Leases tested', health.leases_tested],
        ['Total scenarios', health.total_scenarios],
        ['Crashes', `${health.crashes} ${health.crashes > 0 ? '🔴' : '✅'}`],
        ['Structure failures', `${health.struct_failures} ${health.struct_failures > 0 ? '🔴' : '✅'}`],
        ['Detector misfires', `${health.detector_misfires} (${(misFireRate * 100).toFixed(1)}%) ${hasHighMisfireRate ? '🔴' : '✅'}`],
        ['Position mismatches', health.position_mismatches],
        ['Null/zero scores', `${health.null_scores} ${health.null_scores > 0 ? '🔴' : '✅'}`],
        ['Avg score', health.avg_score],
        ['Score range', `${health.min_score} – ${health.max_score}`],
      ],
    );
  } else {
    md += '_No data in lookback window._\n\n';
  }

  // Scenario breakdown
  md += mdHeader(2, 'Score Accuracy by Scenario');
  md += mdTable(
    ['Scenario', 'Expected', 'N', 'Avg Score', 'Min', 'Max', 'Correct', 'Wrong', 'Errors', '% Correct'],
    scenarios.map(r => [
      r.scenario_name,
      r.expected_position,
      r.n,
      r.avg_score,
      r.min_score,
      r.max_score,
      r.correct,
      r.wrong,
      r.errors,
      r.pct_correct != null ? `${r.pct_correct}%` : 'N/A',
    ]),
  );

  // Crashes
  md += mdHeader(2, `Crashes (${crashes.length})`);
  if (crashes.length > 0) {
    md += mdTable(
      ['Result ID', 'Scenario', 'Error (truncated)', 'Timestamp'],
      crashes.map(r => [
        r.result_id?.slice(0, 8) + '...',
        r.scenario_name,
        r.error_thrown,
        r.processed_at,
      ]),
    );
  } else {
    md += '_No crashes. ✅_\n\n';
  }

  // Detector misfires
  md += mdHeader(2, `Detector Misfires (${misfires.length})`);
  if (misfires.length > 0) {
    md += mdTable(
      ['Scenario', 'Expected Detector', 'Actual Detectors', 'Score', 'Position', 'Lease (prefix)', 'Date'],
      misfires.map(r => [
        r.scenario_name,
        r.expected_detector,
        r.actual_detectors || '(none)',
        r.case_strength_score,
        r.strategic_position,
        r.lease_id_prefix,
        r.date,
      ]),
    );
  } else {
    md += '_No detector misfires. ✅_\n\n';
  }

  // Band crossings (position mismatches)
  md += mdHeader(2, `Position Band Mismatches (${bandCrossings.length})`);
  if (bandCrossings.length > 0) {
    md += mdTable(
      ['Scenario', 'Expected', 'Actual', 'Score', 'Detectors', 'Lease (prefix)'],
      bandCrossings.map(r => [
        r.scenario_name,
        r.expected_position,
        r.actual_position,
        r.case_strength_score,
        r.detectors || '(none)',
        r.lease_id_prefix,
      ]),
    );
  } else {
    md += '_No position mismatches. ✅_\n\n';
  }

  // Score anomalies (null/zero on non-control scenarios)
  md += mdHeader(2, `Score Anomalies — Null/Zero on Non-Control Scenarios (${scoreAnomalies.length})`);
  if (scoreAnomalies.length > 0) {
    md += mdTable(
      ['Scenario', 'Score', 'Grade', 'Position', 'Lease (prefix)'],
      scoreAnomalies.map(r => [
        r.scenario_name,
        r.case_strength_score ?? 'NULL',
        r.leverage_grade,
        r.strategic_position,
        r.lease_id_prefix,
      ]),
    );
  } else {
    md += '_No score anomalies. ✅_\n\n';
  }

  // Recovery estimate anomalies
  md += mdHeader(2, `Recovery Estimate Anomalies — High-Score Cases with $0 Recovery (${recoveryAnomalies.length})`);
  if (recoveryAnomalies.length > 0) {
    md += mdTable(
      ['Scenario', 'Score', 'Position', 'Likely', 'Best', 'Lease (prefix)'],
      recoveryAnomalies.map(r => [
        r.scenario_name,
        r.case_strength_score,
        r.strategic_position,
        r.recovery_likely_case ?? 'NULL',
        r.recovery_best_case ?? 'NULL',
        r.lease_id_prefix,
      ]),
    );
  } else {
    md += '_No recovery anomalies. ✅_\n\n';
  }

  // Lease quality
  md += mdHeader(2, 'Lease Source Quality (all-time)');
  md += mdTable(
    ['Domain', 'Total Found', 'Valid TX', 'Avg Text Len', 'Avg Confidence'],
    leaseQuality.map(r => [
      r.source_domain,
      r.total_found,
      r.valid_tx,
      r.avg_text_len,
      r.avg_confidence,
    ]),
  );

  // Footer
  md += '---\n\n';
  md += `_Report generated by dd-reporter. BigQuery project: \`${PROJECT_ID}\`, dataset: \`${DATASET_ID}\`._\n`;

  return { md, overallPass, hasCrashes, hasHighMisfireRate };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log('=== DepositDefender Reporter Job Starting ===');
  log(`Project: ${PROJECT_ID} | Dataset: ${DATASET_ID} | Bucket: ${REPORTS_BUCKET} | Lookback: ${LOOKBACK_DAYS}d`);

  const { md, overallPass, hasCrashes, hasHighMisfireRate } = await buildReport();

  const filename = `summary-${today()}.md`;
  const gcsPath  = `gs://${REPORTS_BUCKET}/${filename}`;

  log(`\nUploading report to ${gcsPath}...`);
  const file = storage.bucket(REPORTS_BUCKET).file(filename);
  await file.save(md, { contentType: 'text/markdown; charset=utf-8', resumable: false });
  log(`Report uploaded: ${gcsPath}`);

  // Also write a "latest.md" pointer for easy access
  await storage.bucket(REPORTS_BUCKET).file('latest.md').save(md, {
    contentType: 'text/markdown; charset=utf-8',
    resumable: false,
  });
  log('Updated: gs://' + REPORTS_BUCKET + '/latest.md');

  log('\n=== Reporter Job Complete ===');
  log(`Overall status: ${overallPass ? 'PASS' : 'FAIL'}`);

  if (!overallPass) {
    if (hasCrashes)         log('FAIL REASON: Analysis crashes detected');
    if (hasHighMisfireRate) log('FAIL REASON: Detector misfire rate > 10%');
    log('\nReport: ' + gcsPath);
    process.exit(1); // Signal Cloud Run that this job run is a failure
  }

  log('Report: ' + gcsPath);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
