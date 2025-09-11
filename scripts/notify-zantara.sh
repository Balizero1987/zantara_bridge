#!/usr/bin/env bash
set -euo pipefail

# Send a message to Zantara via the deployed /api/chat endpoint.
# Requires: PROJ, SERVICE, REGION env vars (or pass flags), and a message.

usage(){
  cat <<'EOF'
Usage: scripts/notify-zantara.sh -m <message> [options]

Options:
  -m, --message <text>   Message to send (required)
  -p, --project <id>     GCP project ID (defaults to $PROJ)
  -s, --service <name>   Cloud Run service (defaults to $SERVICE)
  -g, --region <region>  Region (defaults to $REGION or asia-southeast2)
  -u, --url <url>        Override service URL (skip gcloud lookup)

This script fetches the API key from Secret Manager (ZANTARA_PLUGIN_API_KEY) and
POSTs to /api/chat with X-API-KEY and X-BZ-USER headers.
EOF
}

MESSAGE=""
PROJECT="${PROJ:-}"
SERVICE_NAME="${SERVICE:-}"
REGION="${REGION:-asia-southeast2}"
URL_OVERRIDE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -m|--message) MESSAGE="$2"; shift 2 ;;
    -p|--project) PROJECT="$2"; shift 2 ;;
    -s|--service) SERVICE_NAME="$2"; shift 2 ;;
    -g|--region)  REGION="$2"; shift 2 ;;
    -u|--url)     URL_OVERRIDE="$2"; shift 2 ;;
    -h|--help)    usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ -z "$MESSAGE" ]]; then echo "Error: --message is required" >&2; usage; exit 1; fi
if [[ -z "$PROJECT" || -z "$SERVICE_NAME" ]]; then
  echo "Error: --project/--service (or PROJ/SERVICE env) required" >&2; exit 1
fi

if ! command -v gcloud >/dev/null 2>&1; then
  echo "Error: gcloud not found. Install and auth first." >&2; exit 1
fi

URL="${URL_OVERRIDE}"
if [[ -z "$URL" ]]; then
  URL=$(gcloud run services describe "$SERVICE_NAME" \
    --region "$REGION" --project "$PROJECT" \
    --format='value(status.url)')
fi

KEY=$(gcloud secrets versions access latest \
  --secret=ZANTARA_PLUGIN_API_KEY --project "$PROJECT" | tr -d '\n\r')

curl -fsS -X POST "$URL/api/chat" \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: $KEY" \
  -H "X-BZ-USER: boss" \
  -d "{\"message\":$(jq -Rn --arg m "$MESSAGE" '$m'),\"ririMode\":false}"

echo

