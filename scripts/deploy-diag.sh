#!/usr/bin/env bash
set -euo pipefail

# Defaults
PROJ="${PROJ:-involuted-box-469105-r0}"
REGION="${REGION:-asia-southeast2}"
REPO="${REPO:-zantara-repo}"
SERVICE="${SERVICE:-zantara-chat-v3-1064094238013}"
SUBJECT="${DRIVE_SUBJECT:-zero@balizero.com}"
SHARE_ID="${DRIVE_ID_AMBARADAM:-0AMxvxuad5E_0Uk9PVA}"

echo "Project: $PROJ"; echo "Region: $REGION"; echo "Service: $SERVICE"; echo "Repo: $REPO";

echo "Ensuring diagnostics and env..."
gcloud run services update "$SERVICE" \
  --region "$REGION" --project "$PROJ" \
  --update-env-vars="ENABLE_DIAG=true,DRIVE_SUBJECT=$SUBJECT,DRIVE_ID_AMBARADAM=$SHARE_ID"

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
  --allow-unauthenticated \
  --update-env-vars="ENABLE_DIAG=true,DRIVE_SUBJECT=$SUBJECT,DRIVE_ID_AMBARADAM=$SHARE_ID"

echo "Running smoke..."
PROJ="$PROJ" REGION="$REGION" SERVICE="$SERVICE" npm run smoke

echo "Done."

