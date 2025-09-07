#!/usr/bin/env bash
set -euo pipefail
: "${URL:?set URL}"; : "${OWNER:=riri}"
# KEY da Secret Manager se non presente:
if [ -z "${KEY:-}" ]; then
  KEY="$(gcloud secrets versions access latest --secret=ZANTARA_PLUGIN_API_KEY --project involuted-box-469105-r0 | tr -d '\n\r')" || true
fi
fail=0
run(){ name="$1"; shift; echo "== $name"; if ! bash -c "$*"; then echo "!! FAIL: $name"; fail=$((fail+1)); fi; }
# TODO: Codex – implementa 50 run ... (ID: M1..M6, N1..N18, C1..C16, D1..D10)
exit $fail
