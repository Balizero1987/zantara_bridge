#!/usr/bin/env bash
set -euo pipefail

# CONFIG (override via env if provided)
SA_EMAIL="${SA_EMAIL:-zantara@involuted-box-469105-r0.iam.gserviceaccount.com}"
FOLDER_ID="${FOLDER_ID:-1UGbm5er6Go351S57GQKUjmxMxHyT4QZb}" # ID cartella AMBARADAM
FILENAME="test_from_script_$(date +%s).txt"
MIMETYPE="text/plain"

echo "🔐 Impersonazione SA: $SA_EMAIL"
echo "📁 Cartella target: $FOLDER_ID"
echo "📝 File di test: $FILENAME"
echo

# STEP 1 – Access token impersonando il SA
echo "🔑 Ottenimento access token impersonato..."
ACCESS_TOKEN=$(gcloud auth print-access-token --impersonate-service-account="$SA_EMAIL")

# STEP 2 – Test di lettura: list dei file nella cartella
echo "🔍 Test di LETTURA..."
curl -s -X GET \
  "https://www.googleapis.com/drive/v3/files?q='${FOLDER_ID}'+in+parents+and+trashed=false&supportsAllDrives=true" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.files[] | {name, id}'

echo "✅ Lettura completata."
echo

# STEP 3 – Test di SCRITTURA: crea file temporaneo
echo "📤 Test di SCRITTURA..."

cat > /tmp/test_payload.json <<EOF
{
  "name": "$FILENAME",
  "parents": ["$FOLDER_ID"]
}
EOF

UPLOAD_RESPONSE=$(curl -s -X POST \
  "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: multipart/related; boundary=foo_bar_baz" \
  --data-binary @- <<EOF
--foo_bar_baz
Content-Type: application/json; charset=UTF-8

$(cat /tmp/test_payload.json)

--foo_bar_baz
Content-Type: $MIMETYPE

Questo è un file di test generato via API da bash.

--foo_bar_baz--
EOF
)

FILE_ID=$(echo "$UPLOAD_RESPONSE" | jq -r '.id')

if [ "$FILE_ID" == "null" ] || [ -z "$FILE_ID" ]; then
  echo "❌ ERRORE durante la creazione del file!"
  echo "$UPLOAD_RESPONSE"
  exit 1
fi

echo "✅ File creato con successo: ID = $FILE_ID"
echo

# STEP 4 – Eliminazione del file creato
echo "🗑️ Eliminazione del file di test..."
DELETE_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE \
  "https://www.googleapis.com/drive/v3/files/${FILE_ID}?supportsAllDrives=true" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

if [ "$DELETE_CODE" == "204" ]; then
  echo "✅ File eliminato correttamente."
else
  echo "⚠️ ATTENZIONE: il file non è stato eliminato (HTTP $DELETE_CODE)"
fi

echo
echo "✅ TEST COMPLETATO CON SUCCESSO"

