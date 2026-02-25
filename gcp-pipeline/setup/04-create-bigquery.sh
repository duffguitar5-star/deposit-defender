#!/usr/bin/env bash
# 04-create-bigquery.sh — Create the BigQuery dataset and all four tables.
set -euo pipefail

PROJECT_ID="deposit-defender-testing"
DATASET_ID="dd_pipeline"
LOCATION="US"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCHEMA_DIR="${SCRIPT_DIR}/../bigquery"

echo "=== Creating BigQuery dataset: ${PROJECT_ID}:${DATASET_ID} ==="

bq --project_id="$PROJECT_ID" mk \
  --dataset \
  --location="$LOCATION" \
  --description="DepositDefender automated testing pipeline — scraped leases, test scenarios, and analysis results" \
  "${PROJECT_ID}:${DATASET_ID}" \
  2>/dev/null || echo "  (dataset already exists — continuing)"

echo ""
echo "Creating tables..."

TABLES=("leases" "test_scenarios" "test_results" "test_runs")

for TABLE in "${TABLES[@]}"; do
  SCHEMA_FILE="${SCHEMA_DIR}/${TABLE}.json"
  if [[ ! -f "$SCHEMA_FILE" ]]; then
    echo "  ERROR: schema file not found: $SCHEMA_FILE"
    exit 1
  fi

  bq --project_id="$PROJECT_ID" mk \
    --table \
    "${PROJECT_ID}:${DATASET_ID}.${TABLE}" \
    "$SCHEMA_FILE" \
    2>/dev/null || echo "  (table ${TABLE} already exists — continuing)"

  echo "  ✓ Table ready: ${TABLE}"
done

echo ""
echo "BigQuery setup complete. Tables in ${PROJECT_ID}:${DATASET_ID}:"
bq --project_id="$PROJECT_ID" ls "${DATASET_ID}"
echo ""
echo "Next step: run 05-deploy-all.sh"
