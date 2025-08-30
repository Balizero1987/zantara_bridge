#!/usr/bin/env bash
set -euo pipefail

OUT=${OUT:-post_deploy_results.txt}
SERVICE_URL=${SERVICE_URL:-}
API_KEY=${API_KEY:-}

echo "Zantara post-deploy checks" > "$OUT"

step() { echo -e "\n== $1 ==" | tee -a "$OUT"; }

if [[ -z "${SERVICE_URL}" || -z "${API_KEY}" ]]; then
  echo "Missing SERVICE_URL" | tee -a "$OUT"
  echo "Missing API_KEY" | tee -a "$OUT"
  exit 2
fi

step "Health check (/health)"
curl -s "$SERVICE_URL/health" | tee -a "$OUT" >/dev/null || true

step "Calendar smoke test (/actions/calendar/create)"
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
IN1H=$(python3 - <<'PY'
from datetime import datetime, timedelta, timezone
print((datetime.now(timezone.utc)+timedelta(hours=1)).strftime('%Y-%m-%dT%H:%M:%SZ'))
PY
)
PAYLOAD=$(jq -n --arg t "Evento Test Zantara" --arg s "$NOW" --arg e "$IN1H" --arg a "zero@balizero.com, info@balizero.com" '{title:$t,start:$s,end:$e,attendees:$a}')
curl -s -X POST "$SERVICE_URL/actions/calendar/create" \
  -H "Content-Type: application/json" -H "X-Api-Key: $API_KEY" \
  -d "$PAYLOAD" | tee -a "$OUT" >/dev/null || true

step "Drive upload smoke (/actions/drive/upload)"
UPLOAD_PAYLOAD=$(jq -n --arg fn "smoke-$(date -u +%Y%m%dT%H%M%SZ).txt" --arg ct "text/plain" --arg c "Zantara smoke test $(date -u)" '{filename:$fn,mimeType:$ct,content:$c}')
curl -s -X POST "$SERVICE_URL/actions/drive/upload" \
  -H "Content-Type: application/json" -H "X-Api-Key: $API_KEY" \
  -d "$UPLOAD_PAYLOAD" | tee -a "$OUT" >/dev/null || true

step "Gmail draft smoke (/actions/email/draft)"
DRAFT_PAYLOAD=$(jq -n --arg to "info@balizero.com" --arg s "Smoke Draft Zantara" --arg t "Bozza generata automaticamente" '{to:$to,subject:$s,text:$t}')
curl -s -X POST "$SERVICE_URL/actions/email/draft" \
  -H "Content-Type: application/json" -H "X-Api-Key: $API_KEY" \
  -d "$DRAFT_PAYLOAD" | tee -a "$OUT" >/dev/null || true

step "Memory save smoke (/actions/memory/save)"
MEM_PAYLOAD=$(jq -n --arg title "PostDeploy Check" --arg content "Nota automatica post-deploy" --argjson tags '["deploy","smoke"]' '{title:$title,content:$content,tags:$tags}')
curl -s -X POST "$SERVICE_URL/actions/memory/save" \
  -H "Content-Type: application/json" -H "X-Api-Key: $API_KEY" \
  -d "$MEM_PAYLOAD" | tee -a "$OUT" >/dev/null || true

echo -e "\nDone. Results saved to $OUT"
