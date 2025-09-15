#!/usr/bin/env bash
set -euo pipefail

# Purpose: Temporarily enable diagnostics endpoints on Cloud Run.

PROJ="${PROJ:-involuted-box-469105-r0}"
REGION="${REGION:-asia-southeast2}"
SERVICE="${SERVICE:-zantara-bridge-v2-prod}"

echo "Project: $PROJ"; echo "Region: $REGION"; echo "Service: $SERVICE";

gcloud run services update "$SERVICE" \
  --region "$REGION" --project "$PROJ" \
  --update-env-vars="ENABLE_DIAG=true"

URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJ" --format='value(status.url)')
echo "Diagnostics enabled at: $URL"

