#!/bin/bash
set -e
echo "🚀 Deploying Apps Script Integration to ZANTARA Bridge..."
gcloud builds submit --tag gcr.io/$GOOGLE_CLOUD_PROJECT/zantara-bridge
gcloud run deploy zantara-bridge \
  --image gcr.io/$GOOGLE_CLOUD_PROJECT/zantara-bridge \
  --region asia-southeast2 \
  --platform managed \
  --allow-unauthenticated