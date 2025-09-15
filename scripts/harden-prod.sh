#!/usr/bin/env bash
set -euo pipefail

# Purpose: Lock down runtime diagnostics for production.

PROJ="${PROJ:-involuted-box-469105-r0}"
REGION="${REGION:-asia-southeast2}"
SERVICE="${SERVICE:-zantara-bridge-v2-prod}"

echo "Project: $PROJ"; echo "Region: $REGION"; echo "Service: $SERVICE";

echo "Disabling diagnostics (ENABLE_DIAG=false)..."
gcloud run services update "$SERVICE" \
  --region "$REGION" --project "$PROJ" \
  --update-env-vars="ENABLE_DIAG=false"

echo "Removing test-only env vars if present..."
gcloud run services update "$SERVICE" \
  --region "$REGION" --project "$PROJ" \
  --remove-env-vars=TEST_SUBJECT,TEST_DRIVE_ID,DEFAULT_DWD || true

echo "Current env after harden:"
gcloud run services describe "$SERVICE" \
  --region "$REGION" --project "$PROJ" \
  --format='value(spec.template.spec.containers[0].env.list())'

echo "Harden complete."

