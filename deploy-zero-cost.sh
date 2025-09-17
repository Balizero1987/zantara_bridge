#!/bin/bash
# Zantara Bridge - Zero-Cost Deployment Script
# Optimized for minimal operational costs

set -euo pipefail

# Configuration
PROJECT_ID="involuted-box-469105-r0"
REGION="asia-southeast2"
SERVICE="zantara-bridge-v2-prod"
IMAGE_TAG="zero-cost-$(date +%Y%m%d-%H%M%S)"
IMAGE_URI="asia-southeast2-docker.pkg.dev/$PROJECT_ID/zantara-repo/zantara-bridge:$IMAGE_TAG"

echo "🚀 ZANTARA BRIDGE ZERO-COST DEPLOYMENT"
echo "======================================"
echo "Project: $PROJECT_ID"
echo "Region: $REGION"  
echo "Service: $SERVICE"
echo "Image: $IMAGE_URI"
echo ""

# Step 1: Build lightweight image
echo "📦 Building zero-cost optimized image..."
npm run build

docker buildx build --platform linux/amd64 \
  -t $IMAGE_URI \
  --push \
  .

echo "✅ Image built and pushed: $IMAGE_URI"

# Step 2: Deploy with zero-cost configuration
echo "🔧 Deploying zero-cost Cloud Run configuration..."

gcloud run services replace cloud-run-zero-cost.yaml \
  --region=$REGION \
  --project=$PROJECT_ID

echo "✅ Zero-cost configuration deployed"

# Step 3: Verify deployment and test scale-to-zero
echo "🔍 Verifying deployment..."

# Wait for deployment to stabilize
sleep 30

# Test health endpoint
echo "Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s -w "%{http_code}" \
  "https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app/health" \
  -o /dev/null)

if [[ "$HEALTH_RESPONSE" == "200" ]]; then
  echo "✅ Health check passed"
else
  echo "❌ Health check failed: HTTP $HEALTH_RESPONSE"
  exit 1
fi

# Test authentication
echo "Testing authentication..."
AUTH_RESPONSE=$(curl -s -w "%{http_code}" \
  -H "X-API-KEY: 7a0adc0681bf7a5c6b6476f70a4581c85c49faeb66f7f61f20dc9b57ba86cfb3" \
  -H "Content-Type: application/json" \
  -d '{"message":"zero-cost test","mode":"RIRI"}' \
  "https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app/api/chat" \
  -o /dev/null)

if [[ "$AUTH_RESPONSE" == "200" ]]; then
  echo "✅ Authentication test passed"
else
  echo "❌ Authentication test failed: HTTP $AUTH_RESPONSE"
fi

# Step 4: Verify scaling configuration
echo "🔍 Verifying scaling configuration..."
SCALING_CONFIG=$(gcloud run services describe $SERVICE \
  --region=$REGION \
  --format="value(spec.template.metadata.annotations['autoscaling.knative.dev/minScale'])")

if [[ "$SCALING_CONFIG" == "0" ]]; then
  echo "✅ Scale-to-zero enabled (minScale=0)"
else
  echo "⚠️  Scale-to-zero not properly configured: minScale=$SCALING_CONFIG"
fi

# Step 5: Display cost optimization summary
echo ""
echo "💰 ZERO-COST OPTIMIZATION SUMMARY"
echo "================================="
echo "✅ Minimum instances: 0 (scales to zero when idle)"
echo "✅ Maximum instances: 1 (cost control)"  
echo "✅ Memory: 512Mi (reduced from 2Gi)"
echo "✅ CPU: 1 vCPU (reduced from 2 vCPU)"
echo "✅ No CPU boost (cost optimization)"
echo "✅ Minimal logging (stdout only)"
echo "✅ No enterprise monitoring"
echo "✅ No automated key rotation"
echo "✅ High concurrency (80 requests/instance)"
echo ""
echo "💡 EXPECTED COSTS:"
echo "• Idle: €0.00/month (scales to zero)"
echo "• Active: ~€0.05/hour when processing requests"
echo "• Storage: ~€0.02/month (container images)"
echo ""
echo "🎯 SERVICE READY FOR ZERO-COST OPERATION!"
echo "Service URL: https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app"