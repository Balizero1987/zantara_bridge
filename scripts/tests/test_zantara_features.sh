#!/bin/bash
# 🧪 Test suite per ZANTARA Bridge

BASE_URL="https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app"
API_KEY=${ZANTARA_PLUGIN_API_KEY:-"7a0adc0681bf7a5c6b6476f70a4581c85c49faeb66f7f61f20dc9b57ba86cfb3"}

echo "🚀 Avvio test ZANTARA Bridge..."
echo "🔑 API_KEY = ${API_KEY:0:20}..."
echo "🌐 BASE_URL = $BASE_URL"
echo

# 1️⃣ Health check
echo "🩺 Test Health..."
curl -s "$BASE_URL/health" | jq
echo

# 2️⃣ Stats
echo "📊 Test Stats..."
curl -s -H "X-API-KEY:$API_KEY" -H "X-BZ-USER:BOSS" "$BASE_URL/api/stats" | jq
echo

# 3️⃣ Assistant
echo "🤖 Test Assistant (KITAS)..."
curl -s -X POST "$BASE_URL/actions/assistant/chat" \
  -H "Content-Type: application/json" \
  -H "X-API-KEY:$API_KEY" \
  -H "X-BZ-USER:BOSS" \
  -d '{"message":"What is KITAS?"}' | jq
echo

# 4️⃣ Gmail Monitor
echo "📧 Test Gmail Monitor..."
curl -s -X POST "$BASE_URL/actions/gmail/monitor" \
  -H "X-API-KEY:$API_KEY" \
  -H "X-BZ-USER:BOSS" | jq
echo

# 5️⃣ Calendar Status
echo "📅 Test Calendar Deadlines..."
curl -s "$BASE_URL/actions/calendar/deadlines" \
  -H "X-API-KEY:$API_KEY" \
  -H "X-BZ-USER:BOSS" | jq
echo

# 6️⃣ Drive Upload (test file)
echo "📂 Test Drive Upload..."
echo "Test upload from ZANTARA Bridge $(date)" > prova.txt
B64=$(base64 < prova.txt | tr -d '\n')
curl -s -X POST "$BASE_URL/actions/drive/upload" \
  -H "Content-Type: application/json" \
  -H "X-API-KEY:$API_KEY" \
  -H "X-BZ-USER:BOSS" \
  -d "{\"base64Data\":\"$B64\",\"fileName\":\"prova_zantara.txt\",\"userId\":\"BOSS\"}" | jq
echo

echo "✅ Test suite completata!"

# 7️⃣ Conversation Stats (new!)
echo "💬 Test Conversation Stats..."
curl -s -H "X-API-KEY:$API_KEY" -H "X-BZ-USER:BOSS" "$BASE_URL/api/conversations/stats" | jq
echo

# 8️⃣ Start Conversation (AMBARADAM magic door)
echo "🚪 Test Start Conversation..."
curl -s -X POST "$BASE_URL/api/conversations/start" \
  -H "Content-Type: application/json" \
  -H "X-API-KEY:$API_KEY" \
  -H "X-BZ-USER:BOSS" \
  -d '{"userName":"BOSS","message":"Apri AMBARADAM"}' | jq
echo

echo "✅ Test suite completata!"
