#!/usr/bin/env bash
# 03-create-storage.sh — Create GCS buckets with cost-control lifecycle policies.
set -euo pipefail

PROJECT_ID="deposit-defender-testing"
REGION="us-central1"

BUCKETS=(
  "dd-raw-leases"       # Stores valid TX lease PDFs scraped from the web
  "dd-pipeline-reports" # Stores Markdown summary reports from the reporter job
)

for BUCKET in "${BUCKETS[@]}"; do
  echo "Creating bucket: gs://${BUCKET}"
  gsutil mb \
    -p "$PROJECT_ID" \
    -l "$REGION" \
    -b on \
    "gs://${BUCKET}" \
    2>/dev/null || echo "  (bucket already exists — continuing)"

  # Auto-delete objects after 90 days to control storage costs.
  # Extend this if you want to retain leases longer.
  cat > /tmp/lifecycle-${BUCKET}.json <<'LIFECYCLE'
{
  "rule": [
    {
      "action": { "type": "Delete" },
      "condition": { "age": 90 }
    }
  ]
}
LIFECYCLE

  gsutil lifecycle set "/tmp/lifecycle-${BUCKET}.json" "gs://${BUCKET}"
  echo "  ✓ 90-day auto-delete lifecycle set"
done

echo ""
echo "Buckets ready. Next step: run 04-create-bigquery.sh"
