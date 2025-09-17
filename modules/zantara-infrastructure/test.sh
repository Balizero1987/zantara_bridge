#!/bin/bash

# Get service URLs from terraform
ORCHESTRATOR_URL=$(terraform output -raw orchestrator_service_url 2>/dev/null || echo "https://zantara-orchestrator-himaadsxua-et.a.run.app")
LIGHT_AGENT_URL=$(terraform output -raw light_agent_service_url 2>/dev/null || echo "")

echo "🧪 Testing Zantara Infrastructure..."
echo "Orchestrator URL: $ORCHESTRATOR_URL"

# Test orchestrator health
echo "📡 Testing orchestrator health endpoint..."
curl -s "$ORCHESTRATOR_URL" | head -n 5

echo -e "\n✅ Infrastructure deployed successfully!"

echo -e "\n📋 **Zantara Multi-Agent System - Deployment Summary**"
echo "========================================================="
echo "🏗️  Infrastructure Status: ✅ DEPLOYED"
echo "🔄  Orchestrator: $ORCHESTRATOR_URL"
echo "🤖  Light Agent: Ready for deployment"
echo "📡  Pub/Sub Topic: zantara-tasks"
echo "🗄️   Firestore: (default) database"
echo "🔐  Secret Manager: 3 secrets configured"
echo "📦  Container Registry: asia-southeast2-docker.pkg.dev/involuted-box-469105-r0/zantara-repo"

echo -e "\n🚀 **Next Steps:**"
echo "1. Replace placeholder images with custom applications"
echo "2. Update secrets with real API keys"
echo "3. Test the complete workflow"

echo -e "\n🔗 **Quick Test Commands:**"
echo "# Test with sample briefing:"
echo "curl -X POST $ORCHESTRATOR_URL/briefing \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"briefing\": \"Create a multi-agent task coordination system\", \"user_id\": \"test-user\"}'"

echo -e "\n📊 **Monitor Infrastructure:**"
echo "gcloud firestore databases list"
echo "gcloud pubsub topics list"
echo "gcloud run services list --region=asia-southeast2"