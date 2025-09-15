#!/usr/bin/env bash
set -euo pipefail

PROJ="${PROJ:-involuted-box-469105-r0}"
REGION="${REGION:-asia-southeast2}"
SERVICE="${SERVICE:-zantara-bridge-v2-prod}"

URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJ" --format='value(status.url)')
KEY=$(gcloud secrets versions access latest --secret=ZANTARA_PLUGIN_API_KEY --project="$PROJ" | tr -d '\r\n')

echo "Project: $PROJ"; echo "Region: $REGION"; echo "Service: $SERVICE"; echo "URL: $URL";

echo "==> POST /api/drive/_write_smoke"
curl -sS -X POST "$URL/api/drive/_write_smoke" \
  -H "X-API-KEY: $KEY" -H "X-BZ-USER: boss" \
  -H "Content-Type: application/json" \
  --data '{}' | tee out.json

cat out.json | jq -e '.ok == true' > /dev/null
echo "Smoke Drive Write OK"

