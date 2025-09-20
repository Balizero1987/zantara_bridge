#!/bin/bash

# Zantara Light Bridge - Zero-Cost Production Deployment
# Optimized for Cloud Run free tier with minimal resource usage

set -e

echo "🌉 Starting Zantara Light Bridge deployment (Zero-Cost)..."

# Configuration - customize these for your environment
PROJECT_ID="${PROJECT_ID:-your-project-id}"
REGION="${REGION:-asia-southeast2}"
SERVICE_NAME="${SERVICE_NAME:-zantara-light-bridge}"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

# Validation
if [ "$PROJECT_ID" = "your-project-id" ]; then
    echo "❌ Error: Please set PROJECT_ID environment variable"
    echo "   Example: export PROJECT_ID=your-actual-project-id"
    exit 1
fi

if [ -z "$ZANTARA_PLUGIN_API_KEY" ]; then
    echo "❌ Error: ZANTARA_PLUGIN_API_KEY not set"
    echo "   Generate a secure 32+ character API key and set:"
    echo "   export ZANTARA_PLUGIN_API_KEY=your-secure-api-key"
    exit 1
fi

if [ -z "$DRIVE_FOLDER_ID" ]; then
    echo "❌ Error: DRIVE_FOLDER_ID not set"
    echo "   Set your Google Drive shared folder ID:"
    echo "   export DRIVE_FOLDER_ID=your-drive-folder-id"
    exit 1
fi

# Build and push image (optimized for linux/amd64)
echo "📦 Building optimized Docker image..."
docker buildx build \
  --platform linux/amd64 \
  --target production \
  -t ${IMAGE_NAME}:latest \
  -t ${IMAGE_NAME}:$(date +%Y%m%d-%H%M%S) \
  --push .

# Deploy with zero-cost configuration
echo "☁️ Deploying to Cloud Run (Zero-Cost Configuration)..."
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME}:latest \
  --region ${REGION} \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 300 \
  --concurrency 100 \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "PORT=8080" \
  --set-env-vars "ENABLE_DIAG=false" \
  --set-env-vars "DRIVE_FOLDER_ID=${DRIVE_FOLDER_ID}" \
  --set-env-vars "MEMORY_DRIVE_FOLDER_ID=${DRIVE_FOLDER_ID}" \
  --set-env-vars "DRIVE_FOLDER_AMBARADAM=${DRIVE_FOLDER_ID}" \
  --set-secrets "ZANTARA_PLUGIN_API_KEY=ZANTARA_API_KEY:latest" \
  --set-secrets "GOOGLE_SERVICE_ACCOUNT_KEY=GOOGLE_SA_KEY:latest" \
  ${IMPERSONATE_USER:+--set-env-vars "IMPERSONATE_USER=${IMPERSONATE_USER}"} \
  ${SERVICE_ACCOUNT:+--service-account "${SERVICE_ACCOUNT}"}

# Get service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)')

echo ""
echo "✅ Zero-Cost Deployment Complete!"
echo "🌐 Service URL: ${SERVICE_URL}"
echo ""
echo "🧪 Test endpoints:"
echo "  Health Check:  curl ${SERVICE_URL}/health"
echo "  Bridge Status: curl ${SERVICE_URL}/bridge/status"
echo "  Light API:     curl -X POST ${SERVICE_URL}/call \\"
echo "                   -H 'x-api-key: \${ZANTARA_PLUGIN_API_KEY}' \\"
echo "                   -H 'Content-Type: application/json' \\"
echo "                   -d '{\"message\":\"Hello Light Bridge\"}'"
echo ""
echo "🔧 Configuration:"
echo "  Min Instances: 0 (scales to zero)"
echo "  Max Instances: 10"
echo "  Memory: 512Mi (cost optimized)"
echo "  CPU: 1 (minimal allocation)"
echo "  Concurrency: 100 (efficient request handling)"
echo ""
echo "💰 Zero-Cost Features Active:"
echo "  ✓ Scales to zero when idle"
echo "  ✓ Free tier resource allocation"
echo "  ✓ Optimized for minimal billing"
echo "  ✓ Request-based pricing only"
echo ""
echo "📋 Next Steps:"
echo "1. Configure secrets in Secret Manager:"
echo "   gcloud secrets create ZANTARA_API_KEY --data-file=<(echo 'your-api-key')"
echo "   gcloud secrets create GOOGLE_SA_KEY --data-file=/path/to/service-account.json"
echo "2. Test the deployment with the commands above"
echo "3. Set up monitoring and alerts as needed"