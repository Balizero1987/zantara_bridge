#!/bin/bash

set -e

PROJECT_ID="involuted-box-469105-r0"
REGION="asia-southeast2"
REGISTRY_URL="$REGION-docker.pkg.dev/$PROJECT_ID/zantara-repo"

echo "🚀 Building and deploying Zantara services..."

# Build orchestrator
echo "📦 Building orchestrator..."
cd orchestrator
gcloud run deploy zantara-orchestrator \
  --source . \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --service-account="zantara-orchestrator@$PROJECT_ID.iam.gserviceaccount.com" \
  --set-env-vars="PROJECT_ID=$PROJECT_ID,REGION=$REGION,PUBSUB_TOPIC=zantara-tasks" \
  --memory=4Gi \
  --cpu=2 \
  --min-instances=1 \
  --max-instances=3

echo "✅ Orchestrator deployed successfully"

# Build light agent
echo "📦 Building light agent..."
cd ../light-agent
gcloud run deploy zantara-light-agent \
  --source . \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --service-account="zantara-agents@$PROJECT_ID.iam.gserviceaccount.com" \
  --set-env-vars="PROJECT_ID=$PROJECT_ID,PUBSUB_SUBSCRIPTION=zantara-orchestrator-tasks" \
  --memory=2Gi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10

echo "✅ Light agent deployed successfully"

# Get service URLs
echo "🔗 Service URLs:"
ORCHESTRATOR_URL=$(gcloud run services describe zantara-orchestrator --region=$REGION --format="value(status.url)")
LIGHT_AGENT_URL=$(gcloud run services describe zantara-light-agent --region=$REGION --format="value(status.url)")

echo "Orchestrator: $ORCHESTRATOR_URL"
echo "Light Agent: $LIGHT_AGENT_URL"

echo "🎉 Deployment completed successfully!"