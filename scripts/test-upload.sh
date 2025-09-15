#!/usr/bin/env bash
set -euo pipefail

# Inputs: SERVICE_URL, KEY, FOLDER_ID
SERVICE_URL="${SERVICE_URL:-}"
KEY="${KEY:-}"
FOLDER_ID="${FOLDER_ID:-}" # DRIVE_FOLDER_AMBARADAM
USER_HEADER="${USER_HEADER:-boss}"

if [[ -z "$SERVICE_URL" || -z "$KEY" || -z "$FOLDER_ID" ]]; then
  echo "Usage: SERVICE_URL=<url> KEY=<api_key> FOLDER_ID=<folder> $0" >&2
  exit 2
fi

LOG=${LOG:-test-upload.log}
: > "$LOG"
echo "▶ Testing /actions/drive/upload against $SERVICE_URL" | tee -a "$LOG"

NAME="ci-upload-$(date -u +%Y%m%dT%H%M%SZ).txt"
CONTENT="Zantara CI test $(date -u)"

RESP=$(curl -sS -w "\n%{http_code}" -X POST "$SERVICE_URL/actions/drive/upload" \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: $KEY" -H "X-BZ-USER: $USER_HEADER" \
  -d "$(jq -n --arg fn "$NAME" --arg c "$CONTENT" --arg fid "$FOLDER_ID" '{filename:$fn,content:$c,mimeType:"text/plain",folderId:$fid}')")

CODE=$(printf '%s' "$RESP" | tail -n1)
BODY=$(printf '%s\n' "$RESP" | sed '$d')
echo "HTTP $CODE — $BODY" | tee -a "$LOG"

if [[ "$CODE" != "200" ]]; then
  echo "Upload failed" | tee -a "$LOG"
  exit 0
fi

ID=$(echo "$BODY" | jq -r '.id // .file.id // empty')
if [[ -z "$ID" ]]; then
  echo "No file id in response" | tee -a "$LOG"
  exit 0
fi

echo "Created file id: $ID" | tee -a "$LOG"

# Optional: verify via Drive API using gcloud SA impersonation if SA_EMAIL provided
if [[ -n "${SA_EMAIL:-}" ]]; then
  echo "Verifying via Drive API as SA $SA_EMAIL" | tee -a "$LOG"
  ACCESS_TOKEN=$(gcloud auth print-access-token --impersonate-service-account="$SA_EMAIL")
  META=$(curl -sS -H "Authorization: Bearer $ACCESS_TOKEN" "https://www.googleapis.com/drive/v3/files/$ID?fields=id,name,parents,webViewLink&supportsAllDrives=true")
  echo "Meta: $META" | tee -a "$LOG"
  DEL=$(curl -sS -o /dev/null -w "%{http_code}" -X DELETE -H "Authorization: Bearer $ACCESS_TOKEN" "https://www.googleapis.com/drive/v3/files/$ID?supportsAllDrives=true")
  echo "Delete status: $DEL" | tee -a "$LOG"
fi

echo "Done." | tee -a "$LOG"

