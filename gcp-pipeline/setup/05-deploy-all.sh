#!/usr/bin/env bash
# 05-deploy-all.sh — Build, push, and deploy all three Cloud Run Jobs.
#                    Creates Cloud Scheduler triggers for weekly execution.
#
# PREREQUISITES:
#   - Run scripts 01–04 first
#   - Set CUSTOM_SEARCH_API_KEY and CUSTOM_SEARCH_ENGINE_ID env vars (see README)
#   - Run from the REPO ROOT (deposit-defender/), not from gcp-pipeline/setup/
#
# USAGE:
#   export CUSTOM_SEARCH_API_KEY="AIza..."
#   export CUSTOM_SEARCH_ENGINE_ID="017576662512468239..."
#   bash gcp-pipeline/setup/05-deploy-all.sh
set -euo pipefail

PROJECT_ID="deposit-defender-testing"
REGION="us-central1"
SA_EMAIL="dd-pipeline@${PROJECT_ID}.iam.gserviceaccount.com"
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/dd-pipeline"
GEMINI_MODEL="gemini-3-flash"          # fallback: gemini-2.5-flash
GCS_LEASES_BUCKET="dd-raw-leases"
GCS_REPORTS_BUCKET="dd-pipeline-reports"
BQ_DATASET="dd_pipeline"

# Validate required env vars
if [[ -z "${CUSTOM_SEARCH_API_KEY:-}" ]]; then
  echo "ERROR: CUSTOM_SEARCH_API_KEY is not set. See README for Custom Search Engine setup."
  exit 1
fi
if [[ -z "${CUSTOM_SEARCH_ENGINE_ID:-}" ]]; then
  echo "ERROR: CUSTOM_SEARCH_ENGINE_ID is not set. See README for Custom Search Engine setup."
  exit 1
fi

# Verify we're in the repo root
if [[ ! -f "gcp-pipeline/setup/05-deploy-all.sh" ]]; then
  echo "ERROR: Run this script from the repo root (deposit-defender/), not from gcp-pipeline/setup/"
  exit 1
fi

echo "=== DepositDefender Pipeline Deploy ==="
echo "Project:  $PROJECT_ID"
echo "Region:   $REGION"
echo "Registry: $REGISTRY"
echo ""

# ─── Step 1: Create Artifact Registry repository ─────────────────────────────
echo "--- Creating Artifact Registry repository ---"
gcloud artifacts repositories create dd-pipeline \
  --repository-format=docker \
  --location="$REGION" \
  --description="DepositDefender testing pipeline images" \
  --project="$PROJECT_ID" \
  2>/dev/null || echo "  (repository already exists)"

gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

# ─── Step 2: Build and push images ───────────────────────────────────────────

# Scraper: build context is gcp-pipeline/scraper/ (no app code needed)
echo ""
echo "--- Building scraper image ---"
docker build \
  -t "${REGISTRY}/scraper:latest" \
  -f gcp-pipeline/scraper/Dockerfile \
  gcp-pipeline/scraper/
docker push "${REGISTRY}/scraper:latest"
echo "  ✓ scraper pushed"

# Harness: build context is repo root (needs server/src/ and ai/ directories)
echo ""
echo "--- Building harness image (repo root context — may take a minute) ---"
docker build \
  -t "${REGISTRY}/harness:latest" \
  -f gcp-pipeline/harness/Dockerfile \
  .
docker push "${REGISTRY}/harness:latest"
echo "  ✓ harness pushed"

# Reporter: build context is gcp-pipeline/reporter/ (only BQ + GCS needed)
echo ""
echo "--- Building reporter image ---"
docker build \
  -t "${REGISTRY}/reporter:latest" \
  -f gcp-pipeline/reporter/Dockerfile \
  gcp-pipeline/reporter/
docker push "${REGISTRY}/reporter:latest"
echo "  ✓ reporter pushed"

# ─── Step 3: Create Cloud Run Jobs ───────────────────────────────────────────

echo ""
echo "--- Creating Cloud Run Jobs ---"

# Store API key in Secret Manager (avoids plaintext in Cloud Run env vars)
echo "  Storing CUSTOM_SEARCH_API_KEY in Secret Manager..."
printf '%s' "$CUSTOM_SEARCH_API_KEY" | gcloud secrets create dd-search-api-key \
  --data-file=- \
  --project="$PROJECT_ID" \
  2>/dev/null || \
printf '%s' "$CUSTOM_SEARCH_API_KEY" | gcloud secrets versions add dd-search-api-key \
  --data-file=- \
  --project="$PROJECT_ID"
echo "    ✓ Secret stored: dd-search-api-key"

# SCRAPER JOB
gcloud run jobs create dd-scraper \
  --image="${REGISTRY}/scraper:latest" \
  --region="$REGION" \
  --service-account="$SA_EMAIL" \
  --memory="1Gi" \
  --cpu="1" \
  --task-timeout="3600s" \
  --max-retries=1 \
  --set-env-vars="\
GCP_PROJECT_ID=${PROJECT_ID},\
GCP_REGION=${REGION},\
CUSTOM_SEARCH_ENGINE_ID=${CUSTOM_SEARCH_ENGINE_ID},\
GEMINI_MODEL_ID=${GEMINI_MODEL},\
GCS_BUCKET_NAME=${GCS_LEASES_BUCKET},\
BQ_DATASET_ID=${BQ_DATASET},\
MAX_PDFS_PER_RUN=100,\
RATE_LIMIT_MS=2000" \
  --set-secrets="CUSTOM_SEARCH_API_KEY=dd-search-api-key:latest" \
  --project="$PROJECT_ID" \
  2>/dev/null || \
gcloud run jobs update dd-scraper \
  --image="${REGISTRY}/scraper:latest" \
  --region="$REGION" \
  --project="$PROJECT_ID"
echo "  ✓ Job ready: dd-scraper"

# HARNESS JOB
gcloud run jobs create dd-harness \
  --image="${REGISTRY}/harness:latest" \
  --region="$REGION" \
  --service-account="$SA_EMAIL" \
  --memory="2Gi" \
  --cpu="2" \
  --task-timeout="7200s" \
  --max-retries=1 \
  --set-env-vars="\
GCP_PROJECT_ID=${PROJECT_ID},\
GCP_REGION=${REGION},\
GEMINI_MODEL_ID=${GEMINI_MODEL},\
BQ_DATASET_ID=${BQ_DATASET},\
MAX_LEASES=100" \
  --project="$PROJECT_ID" \
  2>/dev/null || \
gcloud run jobs update dd-harness \
  --image="${REGISTRY}/harness:latest" \
  --region="$REGION" \
  --project="$PROJECT_ID"
echo "  ✓ Job ready: dd-harness"

# REPORTER JOB
gcloud run jobs create dd-reporter \
  --image="${REGISTRY}/reporter:latest" \
  --region="$REGION" \
  --service-account="$SA_EMAIL" \
  --memory="512Mi" \
  --cpu="1" \
  --task-timeout="600s" \
  --max-retries=1 \
  --set-env-vars="\
GCP_PROJECT_ID=${PROJECT_ID},\
BQ_DATASET_ID=${BQ_DATASET},\
REPORTS_BUCKET=${GCS_REPORTS_BUCKET}" \
  --project="$PROJECT_ID" \
  2>/dev/null || \
gcloud run jobs update dd-reporter \
  --image="${REGISTRY}/reporter:latest" \
  --region="$REGION" \
  --project="$PROJECT_ID"
echo "  ✓ Job ready: dd-reporter"

# ─── Step 4: Create Cloud Scheduler triggers ─────────────────────────────────

echo ""
echo "--- Creating Cloud Scheduler jobs (weekly, Sundays UTC) ---"

BASE_URL="https://run.googleapis.com/v2/projects/${PROJECT_ID}/locations/${REGION}/jobs"
OAUTH_SCOPE="https://www.googleapis.com/auth/cloud-platform"

# Scraper: Sunday 02:00 UTC
gcloud scheduler jobs create http dd-scraper-schedule \
  --location="$REGION" \
  --schedule="0 2 * * 0" \
  --uri="${BASE_URL}/dd-scraper:run" \
  --http-method=POST \
  --oauth-service-account-email="$SA_EMAIL" \
  --oauth-token-scope="$OAUTH_SCOPE" \
  --description="Weekly scrape of Texas lease PDFs" \
  --project="$PROJECT_ID" \
  2>/dev/null || echo "  (dd-scraper-schedule already exists)"
echo "  ✓ dd-scraper-schedule: Sundays 02:00 UTC"

# Harness: Sunday 04:00 UTC (2h after scraper starts, giving it time to complete)
gcloud scheduler jobs create http dd-harness-schedule \
  --location="$REGION" \
  --schedule="0 4 * * 0" \
  --uri="${BASE_URL}/dd-harness:run" \
  --http-method=POST \
  --oauth-service-account-email="$SA_EMAIL" \
  --oauth-token-scope="$OAUTH_SCOPE" \
  --description="Weekly test harness run against scraped leases" \
  --project="$PROJECT_ID" \
  2>/dev/null || echo "  (dd-harness-schedule already exists)"
echo "  ✓ dd-harness-schedule: Sundays 04:00 UTC"

# Reporter: Sunday 07:00 UTC (3h after harness starts)
gcloud scheduler jobs create http dd-reporter-schedule \
  --location="$REGION" \
  --schedule="0 7 * * 0" \
  --uri="${BASE_URL}/dd-reporter:run" \
  --http-method=POST \
  --oauth-service-account-email="$SA_EMAIL" \
  --oauth-token-scope="$OAUTH_SCOPE" \
  --description="Weekly test failure report generation" \
  --project="$PROJECT_ID" \
  2>/dev/null || echo "  (dd-reporter-schedule already exists)"
echo "  ✓ dd-reporter-schedule: Sundays 07:00 UTC"

echo ""
echo "========================================="
echo "Deployment complete."
echo ""
echo "To run the full pipeline manually RIGHT NOW:"
echo "  gcloud run jobs execute dd-scraper  --region=$REGION --project=$PROJECT_ID --wait"
echo "  gcloud run jobs execute dd-harness  --region=$REGION --project=$PROJECT_ID --wait"
echo "  gcloud run jobs execute dd-reporter --region=$REGION --project=$PROJECT_ID --wait"
echo ""
echo "View reports at: https://console.cloud.google.com/storage/browser/dd-pipeline-reports"
echo "View results at: https://console.cloud.google.com/bigquery?project=$PROJECT_ID"
echo "========================================="
