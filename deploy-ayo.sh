#!/bin/bash
# Deploy Bali Zero Landing Page to ayo.balizero.com

set -e

PROJECT_ID="involuted-box-469105-r0"
REGION="asia-southeast2"
SERVICE_NAME="ayo-balizero"
IMAGE_TAG="bali-zero-$(date +%Y%m%d-%H%M%S)"

echo "🚀 Deploying Bali Zero Landing Page to ayo.balizero.com"
echo "======================================================"

# Step 1: Build Docker image
echo "1️⃣ Building Docker image..."
docker build --platform linux/amd64 -t gcr.io/$PROJECT_ID/$SERVICE_NAME:$IMAGE_TAG .

# Step 2: Push to Container Registry
echo "2️⃣ Pushing to Container Registry..."
docker push gcr.io/$PROJECT_ID/$SERVICE_NAME:$IMAGE_TAG

# Step 3: Deploy to Cloud Run
echo "3️⃣ Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME:$IMAGE_TAG \
  --region $REGION \
  --project $PROJECT_ID \
  --platform managed \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --port 8080 \
  --set-env-vars "NODE_ENV=production,PORT=8080,ENABLE_DIAG=false" \
  --set-secrets "GOOGLE_SERVICE_ACCOUNT_KEY=GOOGLE_SERVICE_ACCOUNT_KEY:latest,ZANTARA_PLUGIN_API_KEY=ZANTARA_PLUGIN_API_KEY:latest" \
  --set-env-vars "DRIVE_FOLDER_TARGET=0AJC3-SJL03OOUk9PVA,IMPERSONATE_USER=zero@balizero.com,ADMIN_EXPORT_KEY=$ZANTARA_PLUGIN_API_KEY"

# Step 4: Get service URL
echo "4️⃣ Getting service URL..."
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --project $PROJECT_ID \
  --format "value(status.url)")

echo "✅ Deployment completed!"
echo "🌐 Service URL: $SERVICE_URL"

# Step 5: Configure custom domain (ayo.balizero.com)
echo "5️⃣ Configuring custom domain..."
echo "⚠️  Manual DNS configuration required:"
echo "   1. Go to Cloud Run console: https://console.cloud.google.com/run"
echo "   2. Select service: $SERVICE_NAME"
echo "   3. Go to 'Manage Custom Domains'"
echo "   4. Add domain: ayo.balizero.com"
echo "   5. Follow DNS verification steps"

# Step 6: Test endpoints
echo "6️⃣ Testing deployment..."
echo ""
echo "🧪 Test commands:"
echo "curl -s $SERVICE_URL | head -20"
echo "curl -s $SERVICE_URL/api/waitlist/stats"
echo "curl -s $SERVICE_URL/api/folder-access/status"

# Optional: Run basic smoke test
if command -v curl &> /dev/null; then
  echo ""
  echo "🔍 Running smoke test..."
  
  if curl -s --max-time 10 "$SERVICE_URL" | grep -q "Bali Zero"; then
    echo "✅ Landing page loads successfully"
  else
    echo "❌ Landing page test failed"
  fi
  
  if curl -s --max-time 10 "$SERVICE_URL/api/waitlist/stats" | grep -q "success"; then
    echo "✅ Waitlist API responds"
  else
    echo "❌ Waitlist API test failed"
  fi
fi

echo ""
echo "🎯 Next Steps:"
echo "1. Configure DNS for ayo.balizero.com → $SERVICE_URL"
echo "2. Test waitlist form submission"
echo "3. Verify Drive storage integration"
echo "4. Monitor analytics and performance"

echo ""
echo "📊 Monitoring Commands:"
echo "gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME' --limit=50 --project=$PROJECT_ID"
echo "gcloud run services describe $SERVICE_NAME --region=$REGION --project=$PROJECT_ID"