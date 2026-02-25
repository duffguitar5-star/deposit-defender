# DepositDefender Pipeline — Cheat Sheet

---

## 1. Open the Terminal (Cloud Shell)

Go to this URL in your browser:

**https://shell.cloud.google.com**

Sign in with **duffguitar5@gmail.com** (your Google account).

When the terminal loads, paste this first every time to set up the session:

```
gcloud config set project deposit-defender-testing
cd deposit-defender
export CUSTOM_SEARCH_API_KEY="AIzaSy..."   ← put your current API key here
export CUSTOM_SEARCH_ENGINE_ID="a5aa1c4bc1cdc43c9"
```

> **Note:** Cloud Shell resets every time you close it. You always need to `cd deposit-defender` and re-export those two variables when you start a new session.

---

## 2. Run the Pipeline Manually

Copy and paste all three lines at once. Each step waits for the previous one to finish.
**Total time: roughly 30–60 minutes.**

```
gcloud run jobs execute dd-scraper  --region=us-central1 --project=deposit-defender-testing --wait
gcloud run jobs execute dd-harness  --region=us-central1 --project=deposit-defender-testing --wait
gcloud run jobs execute dd-reporter --region=us-central1 --project=deposit-defender-testing --wait
```

The pipeline also runs automatically every **Sunday night** (02:00 AM UTC = Sunday 8 PM Central / 9 PM Eastern).

---

## 3. See the Results Report

After the pipeline finishes, run this to download and read the report:

```
gsutil cp gs://dd-pipeline-reports/latest.md ./latest-report.md && cat latest-report.md
```

Or open the report in your browser here:

**https://console.cloud.google.com/storage/browser/dd-pipeline-reports?project=deposit-defender-testing**

Click **latest.md** → click **Download**.

---

## 4. Check If the Pipeline Passed or Failed

**Cloud Run Jobs (did each step run? did it fail?):**
https://console.cloud.google.com/run/jobs?project=deposit-defender-testing

You'll see `dd-scraper`, `dd-harness`, and `dd-reporter` listed.
- Green checkmark = passed
- Red X = failed (click it to see the logs)

**Raw results data (BigQuery):**
https://console.cloud.google.com/bigquery?project=deposit-defender-testing

Click **dd_pipeline** in the left sidebar to see the tables.

**Stored lease PDFs (Cloud Storage):**
https://console.cloud.google.com/storage/browser/dd-raw-leases?project=deposit-defender-testing

---

## 5. Check the Automatic Schedule

To see when the next automatic run is scheduled:

**https://console.cloud.google.com/cloudscheduler?project=deposit-defender-testing**

You'll see three jobs:
| Job | Runs |
|-----|------|
| dd-scraper-schedule | Sunday 2:00 AM UTC |
| dd-harness-schedule | Sunday 4:00 AM UTC |
| dd-reporter-schedule | Sunday 7:00 AM UTC |

---

## 6. If Something Goes Wrong

**To see what went wrong with a job**, go to:
https://console.cloud.google.com/run/jobs?project=deposit-defender-testing

Click the failed job → click the failed execution → click **Logs**.

**To re-run just one step** (e.g. if the harness failed but the scraper succeeded):
```
gcloud run jobs execute dd-harness  --region=us-central1 --project=deposit-defender-testing --wait
gcloud run jobs execute dd-reporter --region=us-central1 --project=deposit-defender-testing --wait
```

---

## 7. Pause/Resume the Automatic Schedule

**To pause** (stop the Sunday auto-runs without deleting anything):
```
gcloud scheduler jobs pause dd-scraper-schedule  --location=us-central1 --project=deposit-defender-testing
gcloud scheduler jobs pause dd-harness-schedule  --location=us-central1 --project=deposit-defender-testing
gcloud scheduler jobs pause dd-reporter-schedule --location=us-central1 --project=deposit-defender-testing
```

**To resume:**
```
gcloud scheduler jobs resume dd-scraper-schedule  --location=us-central1 --project=deposit-defender-testing
gcloud scheduler jobs resume dd-harness-schedule  --location=us-central1 --project=deposit-defender-testing
gcloud scheduler jobs resume dd-reporter-schedule --location=us-central1 --project=deposit-defender-testing
```

---

## Quick Reference — Links

| What | URL |
|------|-----|
| Terminal (Cloud Shell) | https://shell.cloud.google.com |
| Job status & logs | https://console.cloud.google.com/run/jobs?project=deposit-defender-testing |
| Reports (Markdown files) | https://console.cloud.google.com/storage/browser/dd-pipeline-reports?project=deposit-defender-testing |
| Raw data (BigQuery) | https://console.cloud.google.com/bigquery?project=deposit-defender-testing |
| Auto-schedule | https://console.cloud.google.com/cloudscheduler?project=deposit-defender-testing |
| Lease PDFs | https://console.cloud.google.com/storage/browser/dd-raw-leases?project=deposit-defender-testing |
