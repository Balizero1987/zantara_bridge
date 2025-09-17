#!/bin/bash

# ZANTARA Bridge Deployment Script
# Deploy to Google Cloud Run with production configuration

set -e

echo "🚀 Starting ZANTARA Bridge deployment..."

# Configuration
PROJECT_ID="involuted-box-469105-r0"
REGION="asia-southeast2"
SERVICE_NAME="zantara-bridge-v2-prod"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

# Check if required environment variables are set
if [ -z "$ZANTARA_PLUGIN_API_KEY" ]; then
    echo "❌ Error: ZANTARA_PLUGIN_API_KEY not set"
    exit 1
fi

# Build and push Linux/amd64 image
echo "📦 Building and pushing Docker image (linux/amd64)..."
docker buildx build --platform linux/amd64 -t ${IMAGE_NAME} --push .

# Deploy to Cloud Run
echo "☁️ Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME} \
  --region ${REGION} \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 10 \
  --timeout 300 \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "OPENAI_MODEL=gpt-4o-mini" \
  --set-env-vars "ZANTARA_PLUGIN_API_KEY=${ZANTARA_PLUGIN_API_KEY}" \
  --set-env-vars "API_KEYS=${ZANTARA_PLUGIN_API_KEY}" \
  --set-env-vars "DRIVE_FOLDER_AMBARADAM=1UGbm5er6Go351S57GQKUjmxMxHyT4QZb" \
  --set-env-vars "IMPERSONATE_USER=zero@balizero.com" \
  --set-env-vars "GMAIL_SENDER=zero@balizero.com" \
  --set-env-vars "ENABLE_DIAG=false" \
  --set-secrets "GOOGLE_SERVICE_ACCOUNT_KEY=GOOGLE_SERVICE_ACCOUNT_KEY:latest" \
  --service-account "zantara@${PROJECT_ID}.iam.gserviceaccount.com"

# Get service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)')

echo "✅ Deployment complete!"
echo "🌐 Service URL: ${SERVICE_URL}"
echo ""
echo "📝 Next steps:"
echo "1. Test the API: curl ${SERVICE_URL}/diag/health"
echo "2. Test Assistant: curl -X POST ${SERVICE_URL}/api/assistant/query -H 'x-api-key: ${ZANTARA_PLUGIN_API_KEY}' -H 'Content-Type: application/json' -d '{\"message\":\"What is KITAS?\"}'"
echo "3. Monitor Gmail: curl -X POST ${SERVICE_URL}/api/compliance/gmail/monitor -H 'x-api-key: ${ZANTARA_PLUGIN_API_KEY}' -H 'Content-Type: application/json' -d '{\"userEmail\":\"zero@balizero.com\"}'"
echo ""
echo "Dashboard: https://zantara-dashboard.netlify.app"
