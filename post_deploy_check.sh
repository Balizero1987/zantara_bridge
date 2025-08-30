#!/usr/bin/env bash
set -euo pipefail

OUT=${OUT:-post_deploy_results.txt}
SERVICE_URL=${SERVICE_URL:-}

echo "Zantara post-deploy checks" > "$OUT"

step() { echo -e "\n== $1 ==" | tee -a "$OUT"; }

if [[ -z "${SERVICE_URL}" ]]; then
  echo "Missing SERVICE_URL" | tee -a "$OUT"
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
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" | tee -a "$OUT" >/dev/null || true

echo -e "\nDone. Results saved to $OUT"
