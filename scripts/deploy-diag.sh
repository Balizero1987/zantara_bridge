#!/usr/bin/env bash
set -euo pipefail

# Defaults (override via environment)
PROJ="${PROJ:-involuted-box-469105-r0}"
REGION="${REGION:-asia-southeast2}"
REPO="${REPO:-zantara-repo}"
SERVICE="${SERVICE:-zantara-bridge-v2-prod}"
FOLDER_ID="${DRIVE_FOLDER_AMBARADAM:-}"  # required

echo "Project: $PROJ"; echo "Region: $REGION"; echo "Service: $SERVICE"; echo "Repo: $REPO";

echo "Ensuring diagnostics and minimal env (SA-only)..."
# Remove legacy secret refs that may conflict (ignore errors)
gcloud run services update "$SERVICE" \
  --region "$REGION" --project "$PROJ" \
  --remove-secrets=DRIVE_SUBJECT || true

# Set secrets and diag flag
gcloud run services update "$SERVICE" \
  --region "$REGION" --project "$PROJ" \
  --update-secrets="GOOGLE_SERVICE_ACCOUNT_KEY=GOOGLE_SERVICE_ACCOUNT_KEY:latest,ZANTARA_PLUGIN_API_KEY=ZANTARA_PLUGIN_API_KEY:latest" \
  --update-env-vars="ENABLE_DIAG=true"

# Optionally set Shared Drive ID
if [[ -n "${SHARE_ID}" ]]; then
  gcloud run services update "$SERVICE" \
    --region "$REGION" --project "$PROJ" \
    --update-env-vars="DRIVE_FOLDER_AMBARADAM=${FOLDER_ID}"
fi

echo "Building TypeScript..."
npm run build

TS=$(date +%s)
IMG="$REGION-docker.pkg.dev/$PROJ/$REPO/zantara-chat:diag-$TS"
echo "Building image: $IMG"
docker buildx create --use 2>/dev/null || true
docker buildx build --platform linux/amd64 -t "$IMG" --push .

echo "Deploying to Cloud Run..."
gcloud run deploy "$SERVICE" \
  --image "$IMG" \
  --region "$REGION" --project "$PROJ" \
  --allow-unauthenticated

URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJ" --format='value(status.url)')
KEY=$(gcloud secrets versions access latest --secret=ZANTARA_PLUGIN_API_KEY --project="$PROJ" | tr -d '\r\n')

echo "\n==> GET /diag/google"
curl -sS "$URL/diag/google" | jq . || true

echo "\n==> GET /api/drive/_whoami"
curl -sS -H "X-API-KEY: $KEY" -H "X-BZ-USER: boss" "$URL/api/drive/_whoami" | jq . || true

echo "\nDone."
