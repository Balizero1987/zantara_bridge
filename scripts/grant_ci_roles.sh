#!/usr/bin/env bash
set -euo pipefail

# scripts/grant_ci_roles.sh
# Grants minimal IAM for CI/CD deploy via GitHub OIDC.
# Usage:
#   PROJECT_ID=... \
#   DEPLOY_SA=...    # e.g., github-deployer@<project>.iam.gserviceaccount.com
#   RUNTIME_SA=...   # Cloud Run runtime SA email
#   SA_JSON_SECRET_NAME=...         # Secret Manager name (not ARN) for SA JSON
#   OPENAI_API_KEY_SM_NAME=...      # Secret Manager name for OpenAI key
#   REGION=asia-southeast2 REPO=zantara-repo ./scripts/grant_ci_roles.sh

req() { if [[ -z "${!1:-}" ]]; then echo "Missing required env: $1"; MISSING=1; fi; }
MISSING=0
for v in PROJECT_ID DEPLOY_SA RUNTIME_SA SA_JSON_SECRET_NAME OPENAI_API_KEY_SM_NAME; do req "$v"; done
REGION=${REGION:-asia-southeast2}
REPO=${REPO:-zantara-repo}
if [[ "$MISSING" -eq 1 ]]; then exit 2; fi

echo "Grant deployer actAs on runtime SA"
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --project "$PROJECT_ID" \
  --member "serviceAccount:$DEPLOY_SA" \
  --role "roles/iam.serviceAccountUser"

echo "Grant deployer Cloud Run admin"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member "serviceAccount:$DEPLOY_SA" \
  --role "roles/run.admin"

echo "Grant runtime SA access to Secret Manager secrets"
gcloud secrets add-iam-policy-binding "$SA_JSON_SECRET_NAME" \
  --project "$PROJECT_ID" \
  --member "serviceAccount:$RUNTIME_SA" \
  --role "roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding "$OPENAI_API_KEY_SM_NAME" \
  --project "$PROJECT_ID" \
  --member "serviceAccount:$RUNTIME_SA" \
  --role "roles/secretmanager.secretAccessor"

echo "Grant Cloud Run service agent read on Artifact Registry (image pulls)"
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
SERVICE_AGENT="service-$PROJECT_NUMBER@serverless-robot-prod.iam.gserviceaccount.com"
gcloud artifacts repositories add-iam-policy-binding "$REPO" \
  --location "$REGION" \
  --member "serviceAccount:$SERVICE_AGENT" \
  --role "roles/artifactregistry.reader"

echo "Done."

