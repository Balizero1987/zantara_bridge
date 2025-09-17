#!/bin/bash

# Setup Redis for ZANTARA Bridge production environment
# This script sets up Google Cloud Memorystore (Redis) for the project

set -e

echo "🔧 Setting up Redis for ZANTARA Bridge production..."

# Check if gcloud is installed and authenticated
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI not found. Please install Google Cloud SDK first."
    exit 1
fi

# Set project variables
PROJECT_ID=${GOOGLE_CLOUD_PROJECT:-"involuted-box-469105-r0"}
REGION=${REGION:-"asia-southeast2"}
REDIS_INSTANCE_NAME="zantara-redis"
REDIS_SIZE="1"  # GB
REDIS_TIER="BASIC"  # or STANDARD_HA for high availability

echo "📋 Configuration:"
echo "- Project: $PROJECT_ID"
echo "- Region: $REGION"
echo "- Instance: $REDIS_INSTANCE_NAME"
echo "- Size: ${REDIS_SIZE}GB"
echo "- Tier: $REDIS_TIER"

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable redis.googleapis.com --project=$PROJECT_ID
gcloud services enable servicenetworking.googleapis.com --project=$PROJECT_ID

# Check if Redis instance already exists
echo "🔍 Checking if Redis instance exists..."
if gcloud redis instances describe $REDIS_INSTANCE_NAME --region=$REGION --project=$PROJECT_ID &>/dev/null; then
    echo "✅ Redis instance $REDIS_INSTANCE_NAME already exists"
    
    # Get instance details
    REDIS_HOST=$(gcloud redis instances describe $REDIS_INSTANCE_NAME --region=$REGION --project=$PROJECT_ID --format="value(host)")
    REDIS_PORT=$(gcloud redis instances describe $REDIS_INSTANCE_NAME --region=$REGION --project=$PROJECT_ID --format="value(port)")
    
    echo "📊 Instance details:"
    echo "- Host: $REDIS_HOST"
    echo "- Port: $REDIS_PORT"
    echo "- Redis URL: redis://$REDIS_HOST:$REDIS_PORT"
    
else
    echo "🚀 Creating new Redis instance..."
    
    # Create Redis instance
    gcloud redis instances create $REDIS_INSTANCE_NAME \
        --size=$REDIS_SIZE \
        --region=$REGION \
        --tier=$REDIS_TIER \
        --project=$PROJECT_ID \
        --display-name="ZANTARA Bridge Redis Cache" \
        --redis-version=redis_6_x
    
    echo "⏳ Waiting for Redis instance to be ready..."
    gcloud redis instances describe $REDIS_INSTANCE_NAME --region=$REGION --project=$PROJECT_ID --format="value(state)" | grep -q "READY"
    
    # Get instance details
    REDIS_HOST=$(gcloud redis instances describe $REDIS_INSTANCE_NAME --region=$REGION --project=$PROJECT_ID --format="value(host)")
    REDIS_PORT=$(gcloud redis instances describe $REDIS_INSTANCE_NAME --region=$REGION --project=$PROJECT_ID --format="value(port)")
    
    echo "✅ Redis instance created successfully!"
    echo "📊 Instance details:"
    echo "- Host: $REDIS_HOST"
    echo "- Port: $REDIS_PORT"
    echo "- Redis URL: redis://$REDIS_HOST:$REDIS_PORT"
fi

# Update Cloud Run service with Redis URL
echo "🔧 Updating Cloud Run service environment..."

SERVICE_NAME=${SERVICE:-"zantara-bridge-v2-prod"}
REDIS_URL="redis://$REDIS_HOST:$REDIS_PORT"

# Check if Cloud Run service exists
if gcloud run services describe $SERVICE_NAME --region=$REGION --project=$PROJECT_ID &>/dev/null; then
    echo "🚀 Updating Cloud Run service with Redis URL..."
    
    gcloud run services update $SERVICE_NAME \
        --set-env-vars="REDIS_URL=$REDIS_URL" \
        --region=$REGION \
        --project=$PROJECT_ID
    
    echo "✅ Cloud Run service updated with Redis configuration"
else
    echo "⚠️ Cloud Run service $SERVICE_NAME not found. Please update manually:"
    echo "   REDIS_URL=$REDIS_URL"
fi

# Test Redis connectivity
echo "🧪 Testing Redis connectivity..."
if command -v redis-cli &> /dev/null; then
    if redis-cli -h $REDIS_HOST -p $REDIS_PORT ping; then
        echo "✅ Redis connectivity test successful!"
    else
        echo "❌ Redis connectivity test failed"
    fi
else
    echo "⚠️ redis-cli not found, skipping connectivity test"
fi

echo ""
echo "🎉 Redis setup completed!"
echo ""
echo "📋 Summary:"
echo "- Redis Instance: $REDIS_INSTANCE_NAME"
echo "- Region: $REGION"
echo "- Host: $REDIS_HOST"
echo "- Port: $REDIS_PORT"
echo "- URL: $REDIS_URL"
echo ""
echo "🔧 Next steps:"
echo "1. Verify Redis is accessible from Cloud Run"
echo "2. Monitor Redis memory usage and performance"
echo "3. Set up Redis monitoring and alerts"
echo "4. Consider upgrading to STANDARD_HA tier for production"
echo ""
echo "💡 Useful commands:"
echo "- View instance: gcloud redis instances describe $REDIS_INSTANCE_NAME --region=$REGION"
echo "- Delete instance: gcloud redis instances delete $REDIS_INSTANCE_NAME --region=$REGION"
echo "- List instances: gcloud redis instances list --region=$REGION"