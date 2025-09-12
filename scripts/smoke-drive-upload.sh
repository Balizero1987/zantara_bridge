#!/usr/bin/env bash
set -euo pipefail

PROJ="${PROJ:-involuted-box-469105-r0}"
REGION="${REGION:-asia-southeast2}"
SERVICE="${SERVICE:-zantara-chat-v3-1064094238013}"

URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJ" --format='value(status.url)')
KEY=$(gcloud secrets versions access latest --secret=ZANTARA_PLUGIN_API_KEY --project="$PROJ" | tr -d '\r\n')

echo "Service: $URL"

payload='{
  "filename":"Smoke-Upload.txt",
  "content":"Hello from smoke test",
  "mimeType":"text/plain",
  "folderPath":"AMBARADAM/BOSS/Notes"
}'

resp=$(curl -sS -w "\n%{http_code}" -X POST "$URL/actions/drive/upload" \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: $KEY" -H "X-BZ-USER: boss" \
  -d "$payload")

code=$(printf '%s' "$resp" | tail -n1)
body=$(printf '%s\n' "$resp" | sed '$d')
echo "HTTP $code — $body"
if [[ "$code" != "200" ]]; then exit 1; fi
echo "Smoke upload OK"
