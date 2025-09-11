#!/usr/bin/env bash
set -euo pipefail

PROJ="${PROJ:-involuted-box-469105-r0}"
REGION="${REGION:-asia-southeast2}"
SERVICE="${SERVICE:-zantara-chat-v3-1064094238013}"

URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJ" --format='value(status.url)')
KEY=$(gcloud secrets versions access latest --secret=ZANTARA_PLUGIN_API_KEY --project="$PROJ" | tr -d '\r\n')

echo "Project: $PROJ"; echo "Region: $REGION"; echo "Service: $SERVICE"; echo "URL: $URL";

echo "==> GET /diag/drive"
if curl -sS "$URL/diag/drive" | jq . ; then
  echo "OK /diag/drive"
else
  echo "KO /diag/drive"; exit 1
fi

echo "==> GET /api/drive/_whoami"
if curl -sS -H "X-API-KEY: $KEY" -H "X-BZ-USER: boss" "$URL/api/drive/_whoami" | jq . ; then
  echo "OK /api/drive/_whoami"
else
  echo "KO /api/drive/_whoami"; exit 1
fi

echo "Smoke Drive completed"

