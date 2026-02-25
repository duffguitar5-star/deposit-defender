-- DepositDefender GCP Pipeline — Failure Detection Queries
-- Run these manually in BigQuery console or use in the reporter job.
-- Replace 'deposit-defender-testing' with your project ID if different.

-- ─── 1. OVERALL HEALTH DASHBOARD (last 7 days) ──────────────────────────────
SELECT
  COUNT(DISTINCT test_run_id)                              AS total_runs,
  COUNT(DISTINCT lease_id)                                 AS leases_tested,
  COUNT(*)                                                 AS total_scenarios,
  COUNTIF(error_thrown != '')                              AS crashes,
  COUNTIF(NOT report_valid AND error_thrown = '')          AS struct_failures,
  COUNTIF(NOT detector_fired_correctly)                    AS detector_misfires,
  COUNTIF(NOT position_correct)                            AS position_mismatches,
  COUNTIF(case_strength_score IS NULL AND error_thrown='') AS null_scores,
  ROUND(AVG(case_strength_score), 1)                       AS avg_score,
  MIN(case_strength_score)                                 AS min_score,
  MAX(case_strength_score)                                 AS max_score
FROM `deposit-defender-testing.dd_pipeline.test_results`
WHERE processed_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY);


-- ─── 2. SCORE DISTRIBUTION BY SCENARIO (correctness table) ─────────────────
-- Expected positions: deadline_missed=STRONG, partial_refund=STRONG,
-- approaching_deadline=MODERATE, no_forwarding=WEAK, control=UNCERTAIN
SELECT
  scenario_name,
  expected_position,
  COUNT(*)                           AS n,
  ROUND(AVG(case_strength_score), 1) AS avg_score,
  MIN(case_strength_score)           AS min_score,
  MAX(case_strength_score)           AS max_score,
  COUNTIF(position_correct)          AS correct,
  COUNTIF(NOT position_correct)      AS wrong,
  COUNTIF(error_thrown != '')        AS errors,
  ROUND(COUNTIF(position_correct) / COUNT(*) * 100, 1) AS pct_correct
FROM `deposit-defender-testing.dd_pipeline.test_results`
WHERE processed_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
GROUP BY scenario_name, expected_position
ORDER BY scenario_name;


-- ─── 3. ALL CRASH DETAILS ───────────────────────────────────────────────────
SELECT
  result_id,
  lease_id,
  scenario_name,
  error_thrown,
  processed_at,
  -- Join to get the intake that caused the crash
  s.intake_json
FROM `deposit-defender-testing.dd_pipeline.test_results` r
JOIN `deposit-defender-testing.dd_pipeline.test_scenarios` s USING (scenario_id)
WHERE r.error_thrown != ''
ORDER BY r.processed_at DESC
LIMIT 50;


-- ─── 4. DETECTOR MISFIRE ANALYSIS ───────────────────────────────────────────
SELECT
  scenario_name,
  expected_detector,
  ARRAY_TO_STRING(detected_issue_ids, ', ') AS actual_detectors,
  case_strength_score,
  strategic_position,
  lease_id,
  processed_at
FROM `deposit-defender-testing.dd_pipeline.test_results`
WHERE NOT detector_fired_correctly
  AND error_thrown = ''
  AND processed_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
ORDER BY scenario_name, processed_at DESC
LIMIT 100;


-- ─── 5. NULL / ZERO SCORE ANOMALIES ─────────────────────────────────────────
-- Zero scores on non-control scenarios indicate scoring logic is broken
SELECT
  r.result_id,
  r.lease_id,
  r.scenario_name,
  r.case_strength_score,
  r.leverage_grade,
  r.strategic_position,
  r.error_thrown,
  s.intake_json
FROM `deposit-defender-testing.dd_pipeline.test_results` r
JOIN `deposit-defender-testing.dd_pipeline.test_scenarios` s USING (scenario_id)
WHERE (r.case_strength_score IS NULL OR r.case_strength_score = 0)
  AND r.scenario_name != 'control_deposit_returned'
  AND r.error_thrown = ''
ORDER BY r.processed_at DESC
LIMIT 50;


-- ─── 6. REPORT STRUCTURE VALIDATION FAILURES ────────────────────────────────
SELECT
  result_id,
  lease_id,
  scenario_name,
  case_strength_score,
  TO_JSON_STRING(validation_errors) AS errors,
  processed_at
FROM `deposit-defender-testing.dd_pipeline.test_results`
WHERE NOT report_valid
  AND error_thrown = ''
  AND processed_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
ORDER BY processed_at DESC
LIMIT 50;


-- ─── 7. SCORE DISTRIBUTION HISTOGRAM ────────────────────────────────────────
SELECT
  FLOOR(case_strength_score / 10) * 10 AS score_bucket,
  COUNT(*) AS count,
  ROUND(COUNT(*) / SUM(COUNT(*)) OVER () * 100, 1) AS pct
FROM `deposit-defender-testing.dd_pipeline.test_results`
WHERE error_thrown = ''
  AND case_strength_score IS NOT NULL
  AND processed_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
GROUP BY score_bucket
ORDER BY score_bucket;


-- ─── 8. EDGE CASES: SCORES THAT CROSS BAND BOUNDARIES UNEXPECTEDLY ──────────
-- These cases scored in a different band than expected — worth investigating
SELECT
  scenario_name,
  expected_position,
  strategic_position AS actual_position,
  case_strength_score,
  ARRAY_TO_STRING(detected_issue_ids, ', ') AS detectors,
  lease_id,
  processed_at
FROM `deposit-defender-testing.dd_pipeline.test_results`
WHERE NOT position_correct
  AND error_thrown = ''
  AND case_strength_score IS NOT NULL
ORDER BY ABS(
  CASE expected_position
    WHEN 'STRONG'    THEN 75
    WHEN 'MODERATE'  THEN 50
    WHEN 'WEAK'      THEN 25
    ELSE 0
  END - case_strength_score
) DESC
LIMIT 100;


-- ─── 9. LEASE QUALITY OVERVIEW ──────────────────────────────────────────────
SELECT
  source_domain,
  COUNT(*)                          AS total_found,
  COUNTIF(is_valid_tx_lease)        AS valid_tx,
  ROUND(AVG(text_length), 0)        AS avg_text_len,
  ROUND(AVG(file_size_bytes/1024),1) AS avg_kb,
  ROUND(AVG(gemini_confidence), 2)  AS avg_confidence
FROM `deposit-defender-testing.dd_pipeline.leases`
GROUP BY source_domain
ORDER BY valid_tx DESC, total_found DESC;


-- ─── 10. RECOVERY ESTIMATE SANITY CHECK ─────────────────────────────────────
-- Verify recovery estimates are non-zero for high-score cases
SELECT
  scenario_name,
  case_strength_score,
  strategic_position,
  recovery_likely_case,
  recovery_best_case,
  lease_id
FROM `deposit-defender-testing.dd_pipeline.test_results`
WHERE error_thrown = ''
  AND case_strength_score >= 60
  AND (recovery_likely_case = '$0' OR recovery_likely_case IS NULL)
  AND processed_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
ORDER BY case_strength_score DESC
LIMIT 25;
