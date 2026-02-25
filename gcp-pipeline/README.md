# DepositDefender GCP Testing Pipeline

Autonomous weekly testing pipeline that:
1. **Scrapes** publicly available Texas residential lease PDFs from the web
2. **Runs** Deposit Defender's analysis logic against realistic dispute scenarios
3. **Reports** failures, score anomalies, and detector misfires to Cloud Storage

All three stages run as Google Cloud Run Jobs on a weekly schedule, storing all results in BigQuery.

---

## Architecture

```
Cloud Scheduler (Sunday)
    ├── 02:00 UTC → dd-scraper  (Cloud Run Job)
    │     Finds TX lease PDFs → GCS + BigQuery
    │
    ├── 04:00 UTC → dd-harness  (Cloud Run Job)
    │     Reads leases from BQ → runs analysis → writes test_results to BQ
    │
    └── 07:00 UTC → dd-reporter (Cloud Run Job)
          Queries BQ → generates Markdown report → uploads to GCS
```

**GCP Resources:**
| Resource | Name | Purpose |
|----------|------|---------|
| Cloud Run Jobs | `dd-scraper`, `dd-harness`, `dd-reporter` | Batch job execution |
| Cloud Storage | `dd-raw-leases` | Raw lease PDFs |
| Cloud Storage | `dd-pipeline-reports` | Weekly Markdown reports |
| BigQuery dataset | `dd_pipeline` | All pipeline data |
| BigQuery table | `dd_pipeline.leases` | Discovered leases + classification |
| BigQuery table | `dd_pipeline.test_scenarios` | Generated test scenarios |
| BigQuery table | `dd_pipeline.test_results` | Analysis results + pass/fail |
| BigQuery table | `dd_pipeline.test_runs` | Per-run summaries |
| Artifact Registry | `dd-pipeline` | Docker images |
| Secret Manager | `dd-search-api-key` | Custom Search API key |
| Service Account | `dd-pipeline@...` | IAM identity for all jobs |

**Estimated cost:** ~$5–15/month (mostly BigQuery and Vertex AI calls). Well within the $200 target.

---

## Prerequisites

### Tools
- [gcloud CLI](https://cloud.google.com/sdk/docs/install) — authenticated to `deposit-defender-testing`
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — running locally
- `bash` shell (Git Bash, WSL, or macOS/Linux terminal)

### GCP Authentication

**For local runs and script execution:**
```bash
export GOOGLE_APPLICATION_CREDENTIALS="C:\Users\DJT\Downloads\deposit-defender-testing-32a38da1b8df.json"
```

**For gcloud CLI:**
```bash
gcloud auth login
gcloud config set project deposit-defender-testing
```

**For Docker pushes:**
```bash
gcloud auth configure-docker us-central1-docker.pkg.dev
```

### Custom Search Engine Setup (required for the scraper)

The scraper uses Google's Programmable Search Engine API. You need to create one first:

1. Go to [Programmable Search Engine](https://programmablesearchengine.google.com/controlpanel/create)
2. **Sites to search:** Enter `*` (asterisk) to search the entire web
3. **Search engine name:** `DepositDefender Lease Finder`
4. Click **Create**, then **Customize**
5. Under **Basics**, enable **Search the entire web**
6. Note your **Search engine ID** (looks like `017576662512468239...`)

**Get an API Key:**
1. Go to [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
2. Click **Create credentials → API key**
3. Restrict the key to **Custom Search API**
4. Note the key (starts with `AIza...`)

**Set as environment variables before running setup:**
```bash
export CUSTOM_SEARCH_API_KEY="AIza..."
export CUSTOM_SEARCH_ENGINE_ID="017576662512..."
```

---

## First-Time Deployment

Run the setup scripts **in order**, from the **repository root** (`deposit-defender/`):

```bash
cd /path/to/deposit-defender
```

### Step 1 — Enable GCP APIs
```bash
bash gcp-pipeline/setup/01-enable-apis.sh
```
Enables: Cloud Run, Storage, BigQuery, Cloud Scheduler, Custom Search, Vertex AI, Cloud Build, Artifact Registry, Secret Manager, IAM.

*Takes ~2 minutes. Safe to re-run.*

### Step 2 — Create Service Account + IAM Bindings
```bash
bash gcp-pipeline/setup/02-create-iam.sh
```
Creates `dd-pipeline@deposit-defender-testing.iam.gserviceaccount.com` with the following roles:
- `storage.objectAdmin` — read/write GCS buckets
- `bigquery.dataEditor` — read/write BQ tables
- `bigquery.jobUser` — run BQ queries
- `aiplatform.user` — call Vertex AI / Gemini
- `run.invoker` — trigger Cloud Run jobs (for Cloud Scheduler)
- `secretmanager.secretAccessor` — read the API key secret

*Safe to re-run.*

### Step 3 — Create Cloud Storage Buckets
```bash
bash gcp-pipeline/setup/03-create-storage.sh
```
Creates:
- `dd-raw-leases` — stores valid TX lease PDFs (private, 90-day auto-delete)
- `dd-pipeline-reports` — stores weekly Markdown reports (private, 90-day auto-delete)

*Safe to re-run.*

### Step 4 — Create BigQuery Dataset + Tables
```bash
bash gcp-pipeline/setup/04-create-bigquery.sh
```
Creates dataset `dd_pipeline` and all 4 tables using the schemas in `gcp-pipeline/bigquery/`.

*Safe to re-run.*

### Step 5 — Build Images, Create Jobs, Schedule
```bash
export CUSTOM_SEARCH_API_KEY="AIza..."
export CUSTOM_SEARCH_ENGINE_ID="017576662512..."
bash gcp-pipeline/setup/05-deploy-all.sh
```

This script:
- Creates Artifact Registry repository `dd-pipeline`
- Builds and pushes 3 Docker images
- Stores `CUSTOM_SEARCH_API_KEY` in Secret Manager
- Creates Cloud Run Jobs (`dd-scraper`, `dd-harness`, `dd-reporter`)
- Creates Cloud Scheduler triggers (weekly, Sundays UTC)

> **Note on build contexts:**
> The **harness** image uses the repo root as its Docker build context because it needs to copy both `server/src/` and `ai/` into the image. The build may take 1–2 minutes.

---

## Running the Pipeline Manually

After deployment, trigger any job manually:

```bash
# Run the full pipeline right now (sequential, each waits for the previous)
gcloud run jobs execute dd-scraper  --region=us-central1 --project=deposit-defender-testing --wait
gcloud run jobs execute dd-harness  --region=us-central1 --project=deposit-defender-testing --wait
gcloud run jobs execute dd-reporter --region=us-central1 --project=deposit-defender-testing --wait
```

Or trigger a single job:
```bash
gcloud run jobs execute dd-harness --region=us-central1 --project=deposit-defender-testing --wait
```

---

## Viewing Results

### BigQuery Console
[Open BigQuery →](https://console.cloud.google.com/bigquery?project=deposit-defender-testing)

Run any of the pre-built analytical queries from [gcp-pipeline/bigquery/failure_queries.sql](bigquery/failure_queries.sql):

```sql
-- Quick health check
SELECT
  COUNT(*) AS total_scenarios,
  COUNTIF(error_thrown != '') AS crashes,
  COUNTIF(NOT detector_fired_correctly) AS detector_misfires,
  ROUND(AVG(case_strength_score), 1) AS avg_score
FROM `deposit-defender-testing.dd_pipeline.test_results`
WHERE processed_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY);
```

### Weekly Reports
[Open GCS Reports Bucket →](https://console.cloud.google.com/storage/browser/dd-pipeline-reports)

Reports are uploaded as:
- `summary-YYYY-MM-DD.md` — dated report
- `latest.md` — always the most recent report

Download the latest:
```bash
gsutil cp gs://dd-pipeline-reports/latest.md ./latest-report.md
```

---

## Updating the Pipeline

### Redeploy after code changes to harness or app logic:
```bash
# Rebuild and push just the harness image
docker build -t us-central1-docker.pkg.dev/deposit-defender-testing/dd-pipeline/harness:latest \
  -f gcp-pipeline/harness/Dockerfile .
docker push us-central1-docker.pkg.dev/deposit-defender-testing/dd-pipeline/harness:latest

# Update the Cloud Run Job to use the new image
gcloud run jobs update dd-harness \
  --image=us-central1-docker.pkg.dev/deposit-defender-testing/dd-pipeline/harness:latest \
  --region=us-central1 \
  --project=deposit-defender-testing
```

### Redeploy everything:
```bash
export CUSTOM_SEARCH_API_KEY="AIza..."
export CUSTOM_SEARCH_ENGINE_ID="017576662512..."
bash gcp-pipeline/setup/05-deploy-all.sh
```

---

## Gemini Model Configuration

The scraper and harness use `gemini-3-flash` by default (Vertex AI public preview, early 2026).

**If you get a model-not-found / 404 error**, the model ID may have changed. Verify at:
[Vertex AI Model Garden →](https://console.cloud.google.com/vertex-ai/model-garden?project=deposit-defender-testing)

To switch models without redeploying:
```bash
gcloud run jobs update dd-scraper \
  --update-env-vars=GEMINI_MODEL_ID=gemini-2.5-flash \
  --region=us-central1 --project=deposit-defender-testing

gcloud run jobs update dd-harness \
  --update-env-vars=GEMINI_MODEL_ID=gemini-2.5-flash \
  --region=us-central1 --project=deposit-defender-testing
```

---

## Troubleshooting

### "CUSTOM_SEARCH_API_KEY and CUSTOM_SEARCH_ENGINE_ID must be set"
These env vars are required before running `05-deploy-all.sh`. The API key is stored in Secret Manager after the first deploy.

### Scraper finds 0 valid TX leases
1. Verify the Programmable Search Engine is set to **search the entire web** (not just specific sites)
2. Check Custom Search API quota: [API Console Quotas →](https://console.cloud.google.com/apis/api/customsearch.googleapis.com/quotas?project=deposit-defender-testing)
3. Free tier allows 100 queries/day. Each scraper run uses up to 30 search requests (10 queries × 3 pages).

### Harness job fails with module not found errors
The harness image requires the exact directory structure:
```
/app/
  server/src/lib/     ← app analysis code
  server/node_modules/ ← date-fns, pdf-parse, etc.
  ai/                  ← tx_security_deposit_rules.json
  node_modules/        ← @google-cloud/* packages
  harness.js
```
Rebuild the harness image from the **repo root**, not from `gcp-pipeline/harness/`.

### BigQuery "table not found" errors
Run scripts 01–04 first. Or re-run `04-create-bigquery.sh` to create any missing tables.

### Cloud Scheduler triggers not firing
```bash
# Check scheduler job status
gcloud scheduler jobs list --location=us-central1 --project=deposit-defender-testing

# Manually trigger the scheduler
gcloud scheduler jobs run dd-scraper-schedule --location=us-central1 --project=deposit-defender-testing
```

### Checking job logs
```bash
# View logs for the most recent harness execution
gcloud logging read \
  'resource.type="cloud_run_job" AND resource.labels.job_name="dd-harness"' \
  --limit=100 \
  --project=deposit-defender-testing \
  --format='value(textPayload)'
```

---

## Repository Structure

```
gcp-pipeline/
├── bigquery/
│   ├── leases.json            BigQuery schema — scraped leases
│   ├── test_scenarios.json    BigQuery schema — generated test scenarios
│   ├── test_results.json      BigQuery schema — analysis results
│   ├── test_runs.json         BigQuery schema — per-run summaries
│   └── failure_queries.sql    10 analytical queries for BigQuery console
│
├── setup/
│   ├── 01-enable-apis.sh      Enable required GCP APIs
│   ├── 02-create-iam.sh       Service account + role bindings
│   ├── 03-create-storage.sh   GCS buckets
│   ├── 04-create-bigquery.sh  BigQuery dataset + tables
│   └── 05-deploy-all.sh       Build images + create jobs + set schedules
│
├── scraper/
│   ├── Dockerfile
│   ├── package.json
│   └── scraper.js             Phase 1: PDF discovery + classification
│
├── harness/
│   ├── Dockerfile             Build context: repo root
│   ├── package.json
│   └── harness.js             Phase 2: scenario generation + analysis
│
├── reporter/
│   ├── Dockerfile
│   ├── package.json
│   └── reporter.js            Phase 3: failure detection + report generation
│
└── README.md                  This file
```

---

## Cost Monitoring

Set a budget alert to avoid surprise charges:
```bash
# Open billing alerts
# https://console.cloud.google.com/billing/budgets?project=deposit-defender-testing
```

Estimated weekly costs:
| Service | Estimated Cost |
|---------|---------------|
| Cloud Run Jobs (3 × weekly) | ~$0.10 |
| Vertex AI Gemini calls | ~$0.50–2.00 |
| BigQuery storage + queries | ~$0.10 |
| Cloud Storage | ~$0.05 |
| Cloud Scheduler | Free tier |
| Custom Search API | Free (100 req/day) |
| **Total weekly** | **~$1–3** |

To pause the pipeline without deleting anything:
```bash
gcloud scheduler jobs pause dd-scraper-schedule  --location=us-central1 --project=deposit-defender-testing
gcloud scheduler jobs pause dd-harness-schedule  --location=us-central1 --project=deposit-defender-testing
gcloud scheduler jobs pause dd-reporter-schedule --location=us-central1 --project=deposit-defender-testing
```
