
URL="https://zantara-chat-v3-1064094238013-1064094238013.asia-southeast2.run.app"

echo "[LOGIN]"
LOGIN=$(curl -s -X POST "$URL/identity/login" \
  -H "Content-Type: application/json" \
  -d '{"name":"Boss","magicWord":"zantarabangun"}')
echo "$LOGIN"

echo "[LOGS]"
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="zantara-chat-v3-1064094238013"' \
  --project=involuted-box-469105-r0 \
  --limit=10 \
  --format="value(textPayload)" \
  --order=desc
