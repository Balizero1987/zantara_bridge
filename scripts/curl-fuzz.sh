#!/usr/bin/env bash
# Infinite curl variations for Zantara Bridge endpoints.
# Randomizes headers, query parameters and payloads.

BASE_URL=${BASE_URL:-https://zantara-chat-v3-1064094238013.asia-southeast2.run.app}
API_KEY=${API_KEY:-your_api_key}

USERS=("boss" "surya@balizero.com" "tester@example.com" "")
NOTES=("Hello world" "" "Another note")
DATE_KEYS=("2025-01-01" "")
ENDPOINTS=("post_note" "get_note" "chat" "chat_riri" "brief_with_notes" "brief_without_notes" "whoami")

while true; do
  ACTION=${ENDPOINTS[$RANDOM % ${#ENDPOINTS[@]}]}
  USER=${USERS[$RANDOM % ${#USERS[@]}]}
  USER_HEADER=()
  [[ -n "$USER" ]] && USER_HEADER=(-H "X-BZ-USER: $USER")

  case "$ACTION" in
    post_note)
      NOTE=${NOTES[$RANDOM % ${#NOTES[@]}]}
      DATE=${DATE_KEYS[$RANDOM % ${#DATE_KEYS[@]}]}
      PAYLOAD="{\"text\":\"$NOTE\""
      [[ -n "$DATE" ]] && PAYLOAD+=",\"dateKey\":\"$DATE\""
      PAYLOAD+="}"
      curl -sS -D - -X POST "$BASE_URL/api/notes" -H "X-API-KEY: $API_KEY" "${USER_HEADER[@]}" -H 'Content-Type: application/json' -d "$PAYLOAD" -w '\nHTTP %{http_code}\n'
      ;;
    get_note)
      DATE=${DATE_KEYS[$RANDOM % ${#DATE_KEYS[@]}]}
      URL="$BASE_URL/api/notes"
      [[ -n "$DATE" ]] && URL+="?dateKey=$DATE"
      curl -sS -D - -X GET "$URL" -H "X-API-KEY: $API_KEY" "${USER_HEADER[@]}" -w '\nHTTP %{http_code}\n'
      ;;
    chat)
      curl -sS -D - -X POST "$BASE_URL/api/chat" -H "X-API-KEY: $API_KEY" "${USER_HEADER[@]}" -H 'Content-Type: application/json' -d '{"message":"hello"}' -w '\nHTTP %{http_code}\n'
      ;;
    chat_riri)
      curl -sS -D - -X POST "$BASE_URL/api/chat" -H "X-API-KEY: $API_KEY" "${USER_HEADER[@]}" -H 'Content-Type: application/json' -d '{"message":"hello","ririMode":true}' -w '\nHTTP %{http_code}\n'
      ;;
    brief_with_notes)
      curl -sS -D - -X POST "$BASE_URL/api/drive/brief" -H "X-API-KEY: $API_KEY" "${USER_HEADER[@]}" -H 'Content-Type: application/json' -d '{"title":"Smoke Brief","includeNotes":true}' -w '\nHTTP %{http_code}\n'
      ;;
    brief_without_notes)
      curl -sS -D - -X POST "$BASE_URL/api/drive/brief" -H "X-API-KEY: $API_KEY" "${USER_HEADER[@]}" -H 'Content-Type: application/json' -d '{"title":"Smoke Brief","includeNotes":false}' -w '\nHTTP %{http_code}\n'
      ;;
    whoami)
      curl -sS -D - -X GET "$BASE_URL/api/drive/_whoami" -H "X-API-KEY: $API_KEY" "${USER_HEADER[@]}" -w '\nHTTP %{http_code}\n'
      ;;
  esac
  echo ''
  sleep 1
done
