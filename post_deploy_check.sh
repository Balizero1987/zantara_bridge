#!/bin/bash
# post_deploy_check.sh - Zantara post-deploy validation
# Esegue health, env, self-check, whoami, drive, calendar, gmail, memory e salva tutto su file

SERVICE_URL="${SERVICE_URL:-https://zantara-chat-<region>.a.run.app}"
API_KEY="${API_KEY:-inserisci_api_key}"
OUT="${OUT:-post_deploy_results.txt}"

function step() {
  echo -e "\n== $1 =="
  echo -e "\n== $1 ==" >> "$OUT"
}

if [[ -z "$SERVICE_URL" || -z "$API_KEY" ]]; then
  echo "Missing env: SERVICE_URL or API_KEY" >&2
  exit 2
fi

rm -f "$OUT"

step "Health check (/health)"
curl -s "$SERVICE_URL/health" | tee >(jq .) >> "$OUT"

step "Env check (/debug/env)"
curl -s "$SERVICE_URL/debug/env" | tee >(jq .) >> "$OUT"

step "Self-check integrazioni Google (/debug/self-check)"
curl -s "$SERVICE_URL/debug/self-check" | tee >(jq .) >> "$OUT"

step "Whoami (Drive/Calendar/Gmail/SharedDrive) (/debug/whoami)"
curl -s -H "X-Api-Key: $API_KEY" "$SERVICE_URL/debug/whoami" | tee >(jq .) >> "$OUT"

step "Drive smoke test (/actions/drive/create)"
curl -s -X POST "$SERVICE_URL/actions/drive/create" \
  -H "Content-Type: application/json" -H "X-Api-Key: $API_KEY" \
  -d '{"name":"SmokeTest Zantara"}' | tee >(jq .) >> "$OUT"


step "Calendar smoke test (/actions/calendar/create)"
curl -s -X POST "$SERVICE_URL/actions/calendar/create" \
  -H "Content-Type: application/json" -H "X-Api-Key: $API_KEY" \
  -d '{"summary":"Evento Test Zantara","start":"2025-08-29T10:00:00+08:00","end":"2025-08-29T11:00:00+08:00","attendees":["zero@balizero.com"]}' | tee >(jq .) >> "$OUT"

step "Gmail smoke test (/actions/gmail/send)"
curl -s -X POST "$SERVICE_URL/actions/gmail/send" \
  -H "Content-Type: application/json" -H "X-Api-Key: $API_KEY" \
  -d '{"to":"info@balizero.com","subject":"SmokeTest Zantara","text":"Questa è una mail di test automatica dal post_deploy_check.sh"}' | tee >(jq .) >> "$OUT"

step "Memory smart-save (/memory/smart-save)"
curl -s -X POST "$SERVICE_URL/memory/smart-save" \
  -H "Content-Type: application/json" -H "X-Api-Key: $API_KEY" \
  -d '{"title":"PostDeploy Check","content":"Nota di post-deploy","owner":"BOSS"}' | tee >(jq .) >> "$OUT"

step "Memory legacy alias (/memory/save)"
curl -s -X POST "$SERVICE_URL/memory/save" \
  -H "Content-Type: application/json" -H "X-Api-Key: $API_KEY" \
  -d '{"title":"PostDeploy Legacy","content":"Alias check"}' | tee >(jq .) >> "$OUT"

step "List generated DOCX (/memory/list-docs)"
TODAY=$(date -u +%Y-%m-%d)
curl -s -X GET "$SERVICE_URL/memory/list-docs?owner=BOSS&date=$TODAY" \
  -H "X-Api-Key: $API_KEY" | tee >(jq .) >> "$OUT"

echo -e "\nRisultati completi salvati in $OUT"

# --- ZANTARA: Verifica Impersonation (Drive & Calendar) ---
step "ZANTARA: Verifica Impersonation (Drive & Calendar)"
echo "🧪 Verifica impersonation con read-after-write.js" | tee -a "$OUT"
export API_BASE="$SERVICE_URL"
export API_KEY
if command -v node >/dev/null 2>&1; then
  node ./scripts/read_after_write.js 2>&1 | tee -a "$OUT"
  RA_RC=${PIPESTATUS[0]}
  if [[ $RA_RC -ne 0 ]]; then
    echo "❌ Read-after-write fallito" | tee -a "$OUT"
    # Extra diagnostics: SA info and whoami
    step "Diagnostica: Service Account info (/debug/sa-info)"
    curl -s -H "X-Api-Key: $API_KEY" "$SERVICE_URL/debug/sa-info" | tee >(jq .) >> "$OUT"
    step "Diagnostica: Whoami recap (/debug/whoami)"
    curl -s -H "X-Api-Key: $API_KEY" "$SERVICE_URL/debug/whoami" | tee >(jq .) >> "$OUT"
    step "Diagnostica: Env raw (/debug/env/raw)"
    curl -s -H "X-Api-Key: $API_KEY" "$SERVICE_URL/debug/env/raw" | tee >(jq .) >> "$OUT"
    # Retry Calendar GET if RA provided eventId/calendarId snapshot
    RA_JSON=$(grep -E "^\[RA\] RESULT " "$OUT" | tail -n1 | sed -E 's/^\[RA\] RESULT //')
    if [[ -n "$RA_JSON" ]]; then
      EV_ID=$(echo "$RA_JSON" | jq -r '.details.calendar.eventId // empty')
      CAL_ID=$(echo "$RA_JSON" | jq -r '.details.calendar.calendarId // empty')
      if [[ -n "$EV_ID" ]]; then
        step "Diagnostica: Retry calendar.get (snapshot from RA)"
        EV_ID_ENC=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$EV_ID")
        if [[ -n "$CAL_ID" ]]; then
          CAL_ID_ENC=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$CAL_ID")
          CURL_URL="$SERVICE_URL/actions/calendar/get?eventId=$EV_ID_ENC&calendarId=$CAL_ID_ENC"
        else
          CURL_URL="$SERVICE_URL/actions/calendar/get?eventId=$EV_ID_ENC"
        fi
        HTTP_CODE=$(curl -s -H "X-Api-Key: $API_KEY" -w "%{http_code}" -o >(tee >(jq .) >> "$OUT") "$CURL_URL")
        echo "[RA] RETRY calendar.get status=$HTTP_CODE eventId=$EV_ID calendarId=${CAL_ID:-<none>}" | tee -a "$OUT"
      fi
    fi
  else
    echo "✅ Read-after-write riuscito" | tee -a "$OUT"
  fi
else
  echo "⚠️ Variabili API_BASE o API_KEY mancanti oppure Node non disponibile. Salto check." | tee -a "$OUT"
fi

echo -e "\n🎯 Ogni deploy controlla che: \n• I file siano realmente creati \n• Gli eventi siano presenti e confermati \n• L’impersonation sia attiva e reale" | tee -a "$OUT"

echo -e "\nRisultati completi salvati in $OUT"

# Exit non-zero if read-after-write failed to force CI failure
if [[ -n "$RA_RC" && $RA_RC -ne 0 ]]; then
  exit $RA_RC
fi
