#!/bin/bash
API_KEY="7a0adc0681bf7a5c6b6476f70a4581c85c49faeb66f7f61f20dc9b57ba86cfb3"
BASE_URL="https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app"

echo "🧪 ZANTARA BRIDGE - TEST SUITE COMPLETO"
echo "========================================"

# Test 1: Chat semplice
echo ""
echo "TEST 1: Chat Base 💬"
echo "-------------------"
curl -X POST $BASE_URL/chat \
  -H "X-API-KEY: $API_KEY" \
  -H "X-BZ-USER: test" \
  -H "Content-Type: application/json" \
  -d '{"message":"Ciao, come stai?"}'

echo ""
echo ""

# Test 2: Upload documento
echo "TEST 2: Upload PDF 📄"
echo "---------------------"
echo "Questo è un documento di test per ZANTARA" > test.txt
BASE64_CONTENT=$(base64 -i test.txt)
curl -X POST $BASE_URL/chat \
  -H "X-API-KEY: $API_KEY" \
  -H "X-BZ-USER: test_upload" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"Analizza questo documento\",\"document\":\"$BASE64_CONTENT\",\"fileName\":\"test-document.pdf\"}"

echo ""
echo ""

# Test 3: Multi-lingua
echo "TEST 3: Multi-lingua 🌍"
echo "-----------------------"
curl -X POST $BASE_URL/chat \
  -H "X-API-KEY: $API_KEY" \
  -H "X-BZ-USER: test_multilang" \
  -H "Content-Type: application/json" \
  -d '{"message":"Translate to Indonesian: Hello world, how are you?"}'

echo ""
echo ""

# Test 4: Health Check
echo "TEST 4: Health Check ❤️"
echo "-----------------------"
curl $BASE_URL/health

echo ""
echo ""

# Test 5: Metrics
echo "TEST 5: Metrics 📊"
echo "------------------"
curl $BASE_URL/metrics

echo ""
echo ""

# Cleanup
rm -f test.txt

echo "✅ TEST SUITE COMPLETATO!"
echo "========================"