#!/usr/bin/env bash
# 01-enable-apis.sh — Enable all GCP APIs required by the DD testing pipeline.
# Run once before any other setup step.
set -euo pipefail

PROJECT_ID="deposit-defender-testing"

echo "=== Enabling GCP APIs for project: $PROJECT_ID ==="

gcloud services enable \
  run.googleapis.com \
  storage.googleapis.com \
  bigquery.googleapis.com \
  cloudscheduler.googleapis.com \
  customsearch.googleapis.com \
  aiplatform.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  iam.googleapis.com \
  --project="$PROJECT_ID"

echo ""
echo "All APIs enabled. Next step: run 02-create-iam.sh"
