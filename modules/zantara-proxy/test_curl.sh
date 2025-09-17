#!/bin/bash

echo "=== Zantara Proxy Test Summary ==="
echo ""

# Test direct authentication
echo "✅ Service Account: zantara-client@involuted-box-469105-r0.iam.gserviceaccount.com"
echo "✅ Key File: ~/zantara-key.json" 
echo "✅ Target Service: zantara-bridge-v2-prod"
echo "✅ API Key: 7a0adc0681bf7a5c6b6476f70a4581c85c49faeb66f7f61f20dc9b57ba86cfb3"

echo ""
echo "=== Direct Test (IAM Authentication) ==="
TOKEN=$(gcloud auth print-access-token)
curl -H "Authorization: Bearer $TOKEN" \
  https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app/health

echo ""
echo ""
echo "=== Usage Instructions ==="
echo "To use the proxy with API key authentication:"
echo ""
echo "curl -H \"X-API-KEY: 7a0adc0681bf7a5c6b6476f70a4581c85c49faeb66f7f61f20dc9b57ba86cfb3\" \\"
echo "  https://[PROXY-URL]/health"
echo ""
echo "Note: Deploy proxy to Cloud Run or use locally for testing"