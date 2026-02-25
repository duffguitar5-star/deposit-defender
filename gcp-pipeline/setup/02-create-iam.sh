#!/usr/bin/env bash
# 02-create-iam.sh — Create the pipeline service account and bind all required roles.
set -euo pipefail

PROJECT_ID="deposit-defender-testing"
SA_NAME="dd-pipeline"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "=== Creating service account: $SA_EMAIL ==="

gcloud iam service-accounts create "$SA_NAME" \
  --display-name="DepositDefender Pipeline Runner" \
  --description="Service account for the DD GCP automated testing pipeline" \
  --project="$PROJECT_ID" \
  || echo "  (service account may already exist — continuing)"

echo ""
echo "Binding IAM roles..."

ROLES=(
  "roles/storage.objectAdmin"       # Cloud Storage: read/write raw leases + reports
  "roles/bigquery.dataEditor"       # BigQuery: INSERT into tables
  "roles/bigquery.jobUser"          # BigQuery: run queries
  "roles/aiplatform.user"           # Vertex AI: call Gemini
  "roles/run.invoker"               # Cloud Run: trigger jobs (used by Cloud Scheduler)
  "roles/secretmanager.secretAccessor" # Secret Manager: read API keys
)

for ROLE in "${ROLES[@]}"; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$ROLE" \
    --quiet
  echo "  ✓ Bound: $ROLE"
done

echo ""
echo "Service account ready: $SA_EMAIL"
echo "Next step: run 03-create-storage.sh"
