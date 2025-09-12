#!/usr/bin/env bash
set -euo pipefail

# Update Cloud Run service with required Drive secrets and env vars.
# Usage:
#   PROJ=involuted-box-469105-r0 REGION=asia-southeast2 \
#   SERVICE=zantara-chat-v3-1064094238013 \
#   FOLDER_ID=1UGbm5er6Go351S57GQKUjmxMxHyT4QZb \
#   IMP_USER=zero@balizero.com \
#   ENABLE_DIAG=true \
#   ./scripts/update-cloudrun-env.sh

PROJ="${PROJ:-}"
REGION="${REGION:-asia-southeast2}"
SERVICE="${SERVICE:-zantara-chat-v3-1064094238013}"
FOLDER_ID="${FOLDER_ID:-}"
IMP_USER="${IMP_USER:-}"
ENABLE_DIAG="${ENABLE_DIAG:-true}"

if [[ -z "$PROJ" || -z "$SERVICE" || -z "$FOLDER_ID" ]]; then
  echo "Usage: PROJ=<project> SERVICE=<service> FOLDER_ID=<folderId> [REGION=...] [IMP_USER=...] [ENABLE_DIAG=true|false] $0" >&2
  exit 2
fi

echo "Project: $PROJ"
echo "Region:  $REGION"
echo "Service: $SERVICE"
echo "FolderID: $FOLDER_ID"
echo "Impersonate: ${IMP_USER:-<none>}"
echo "Enable diag: $ENABLE_DIAG"

gcloud run services update "$SERVICE" \
  --project "$PROJ" \
  --region "$REGION" \
  --set-secrets "GOOGLE_SERVICE_ACCOUNT_KEY=GOOGLE_SERVICE_ACCOUNT_KEY:latest,ZANTARA_PLUGIN_API_KEY=ZANTARA_PLUGIN_API_KEY:latest" \
  --set-env-vars "DRIVE_FOLDER_AMBARADAM=$FOLDER_ID,DEFAULT_FOLDER_ROOT=AMBARADAM,ENABLE_DIAG=$ENABLE_DIAG${IMP_USER:+,IMPERSONATE_USER=$IMP_USER}"

echo "Done."
