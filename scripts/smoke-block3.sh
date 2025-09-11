#!/usr/bin/env bash
set -euo pipefail

PROJ="${PROJ:-involuted-box-469105-r0}"
REGION="${REGION:-asia-southeast2}"
SERVICE="${SERVICE:-zantara-chat-v3-1064094238013}"

green() { printf "\033[32m%s\033[0m\n" "$1"; }
red()   { printf "\033[31m%s\033[0m\n" "$1"; }

echo "Project: $PROJ"
echo "Region:  $REGION"
echo "Service: $SERVICE"

URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJ" --format='value(status.url)')
KEY=$(gcloud secrets versions access latest --secret=ZANTARA_PLUGIN_API_KEY --project="$PROJ" | tr -d '\n\r')

if [[ -z "$URL" || -z "$KEY" ]]; then
  red "Missing URL or API key"; exit 1
fi

PASS=true

echo "==> GET /diag/auth"
TMP=$(mktemp)
CODE=$(curl -sS -o "$TMP" -w "%{http_code}" -H "X-API-KEY: $KEY" "$URL/diag/auth" || echo "000")
cat "$TMP"; echo
if [[ "$CODE" =~ ^2 ]]; then green "OK /diag/auth (HTTP $CODE)"; else red "KO /diag/auth (HTTP $CODE)"; PASS=false; fi
rm -f "$TMP"

echo "==> GET /diag/google"
TMP=$(mktemp)
CODE=$(curl -sS -o "$TMP" -w "%{http_code}" -H "X-API-KEY: $KEY" "$URL/diag/google" || echo "000")
cat "$TMP"; echo
if [[ "$CODE" =~ ^2 ]]; then green "OK /diag/google (HTTP $CODE)"; else red "KO /diag/google (HTTP $CODE)"; PASS=false; fi
rm -f "$TMP"

echo "==> GET /api/drive/_whoami"
TMP=$(mktemp)
CODE=$(curl -sS -o "$TMP" -w "%{http_code}" -H "X-API-KEY: $KEY" -H "X-BZ-USER: boss" "$URL/api/drive/_whoami" || echo "000")
cat "$TMP"; echo
if [[ "$CODE" =~ ^2 ]]; then green "OK /api/drive/_whoami (HTTP $CODE)"; else red "KO /api/drive/_whoami (HTTP $CODE)"; PASS=false; fi
rm -f "$TMP"

if [[ "$PASS" == true ]]; then
  green "Smoke OK"; exit 0
else
  red "Smoke FAILED"; exit 1
fi
