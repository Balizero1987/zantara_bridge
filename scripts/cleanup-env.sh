#!/usr/bin/env bash
set -euo pipefail

# Purpose: Remove legacy env/secret aliases from the Cloud Run service to reduce confusion.

PROJ="${PROJ:-involuted-box-469105-r0}"
REGION="${REGION:-asia-southeast2}"
SERVICE="${SERVICE:-zantara-chat-v3-1064094238013}"
REMOVE_API_KEYS="${REMOVE_API_KEYS:-false}"

echo "Project: $PROJ"; echo "Region: $REGION"; echo "Service: $SERVICE";

echo "Removing legacy secret refs (PLUGIN_API_KEY, BACKEND_API_KEY, API_KEY) if present..."
gcloud run services update "$SERVICE" \
  --region "$REGION" --project "$PROJ" \
  --remove-secrets=PLUGIN_API_KEY,BACKEND_API_KEY,API_KEY || true

if [[ "$REMOVE_API_KEYS" == "true" ]]; then
  echo "Removing API_KEYS CSV env var (on request)..."
  gcloud run services update "$SERVICE" \
    --region "$REGION" --project "$PROJ" \
    --remove-env-vars=API_KEYS || true
fi

echo "Current env after cleanup:"
gcloud run services describe "$SERVICE" \
  --region "$REGION" --project "$PROJ" \
  --format='value(spec.template.spec.containers[0].env.list())'

echo "Cleanup complete."

