#!/usr/bin/env bash
set -euo pipefail

# Usage: API_URL=... API_KEY=... USER=... USER_EMAIL=... ./scripts/api-smoke.sh

: "${API_URL:?missing API_URL}"
: "${API_KEY:?missing API_KEY}"
: "${USER:?missing USER}"
: "${USER_EMAIL:=}"

HDR=(-H "X-API-KEY: $API_KEY" -H "X-BZ-USER: $USER" -H "Content-Type: application/json")

echo "1) Create thread"
CREATE=$(curl -sS -w "\n%{http_code}" -X POST "$API_URL/api/assistant/thread/create" "${HDR[@]}" \
  -d "{\"userId\":\"$USER\",\"title\":\"KITAS procedure\",\"category\":\"kitas\"}")
CREATE_BODY=$(echo "$CREATE" | sed '$d'); CREATE_CODE=$(echo "$CREATE" | tail -n1)
THREAD_ID=$(echo "$CREATE_BODY" | sed -n 's/.*"thread".*"id"\s*:\s*"\([^"]*\)".*/\1/p' | head -n1)
echo "HTTP: $CREATE_CODE, THREAD_ID: ${THREAD_ID:-none}"

echo "2) Send message"
if [[ -n "${THREAD_ID:-}" ]]; then
  curl -sS -X POST "$API_URL/api/assistant/thread/$THREAD_ID/message" "${HDR[@]}" \
    -d "{\"userId\":\"$USER\",\"message\":\"Cos’è un KITAS?\"}" | sed 's/.*/[ok] &/'
else
  echo "[skip] missing thread id"
fi

echo "3) Assistant search"
curl -sS -X POST "$API_URL/api/assistant/search" "${HDR[@]}" \
  -d '{"query":"KITAS renewal","limit":5}' | sed 's/.*/[ok] &/'

echo "4) Gmail monitor"
if [[ -n "$USER_EMAIL" ]]; then
  curl -sS -X POST "$API_URL/api/compliance/gmail/monitor" "${HDR[@]}" \
    -d "{\"userEmail\":\"$USER_EMAIL\",\"maxResults\":10}" | sed 's/.*/[ok] &/'
else
  echo "[skip] USER_EMAIL not set"
fi

echo "5) Create deadline"
curl -sS -X POST "$API_URL/api/compliance/deadline/create" "${HDR[@]}" \
  -d "{\"userId\":\"$USER\",\"title\":\"KITAS Renewal\",\"deadline\":\"2025-12-15\"}" | sed 's/.*/[ok] &/'

echo "6) Create dashboard"
curl -sS -X POST "$API_URL/api/compliance/dashboard/create" "${HDR[@]}" | sed 's/.*/[ok] &/'

echo "7) Upcoming deadlines"
curl -sS -X GET "$API_URL/api/compliance/upcoming-deadlines/$USER?days=90" "${HDR[@]}" | sed 's/.*/[ok] &/'

echo "8) Cache stats"
curl -sS -X GET "$API_URL/api/compliance/cache/stats" "${HDR[@]}" | sed 's/.*/[ok] &/'

echo "9) Process overdue"
curl -sS -X POST "$API_URL/api/compliance/admin/process-overdue" "${HDR[@]}" | sed 's/.*/[ok] &/'

echo "Done."

