#!/bin/bash

# Script GRATUITO per vedere metriche usando Google Cloud Logging
# Non richiede costi aggiuntivi - usa solo quello che è già incluso

PROJECT_ID="involuted-box-469105-r0"
SERVICE_NAME="zantara-bridge-v2-prod"

echo "📊 ZANTARA MONITORING (GRATIS)"
echo "================================"

# 1. Health check
echo -e "\n🏥 Health Check:"
curl -s https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app/health | jq .

# 2. Ultimi errori (se ci sono)
echo -e "\n❌ Ultimi Errori (ultimi 10):"
gcloud logging read "resource.type=cloud_run_revision AND \
  resource.labels.service_name=$SERVICE_NAME AND \
  severity>=ERROR" \
  --limit=10 \
  --format="table(timestamp,jsonPayload.error)" \
  --project=$PROJECT_ID 2>/dev/null || echo "Nessun errore recente"

# 3. Richieste per endpoint (ultime 24h)
echo -e "\n📈 Top Endpoints (ultime 24h):"
gcloud logging read "resource.type=cloud_run_revision AND \
  resource.labels.service_name=$SERVICE_NAME AND \
  jsonPayload.type=REQUEST_METRIC AND \
  timestamp>=\"$(date -u -d '24 hours ago' '+%Y-%m-%dT%H:%M:%S')Z\"" \
  --format="csv(jsonPayload.endpoint)" \
  --project=$PROJECT_ID 2>/dev/null | \
  sort | uniq -c | sort -rn | head -10

# 4. Response time medio (ultime 100 richieste)
echo -e "\n⏱️ Response Time (media ultime 100):"
gcloud logging read "resource.type=cloud_run_revision AND \
  resource.labels.service_name=$SERVICE_NAME AND \
  jsonPayload.type=REQUEST_METRIC" \
  --limit=100 \
  --format="value(jsonPayload.responseTime)" \
  --project=$PROJECT_ID 2>/dev/null | \
  awk '{sum+=$1} END {if(NR>0) print sum/NR " ms"; else print "N/A"}'

# 5. Utilizzo memoria/CPU (GRATIS da Cloud Run)
echo -e "\n💾 Risorse Cloud Run:"
gcloud run services describe $SERVICE_NAME \
  --region=asia-southeast2 \
  --project=$PROJECT_ID \
  --format="table(
    spec.template.spec.containers[0].resources.limits.memory,
    spec.template.spec.containers[0].resources.limits.cpu,
    status.traffic[0].percent
  )"

# 6. Costi stimati (GRATIS da vedere)
echo -e "\n💰 Stima Costi Mensili:"
echo "Cloud Run: ~\$0 (Free tier: 2M requests/month)"
echo "Logging: ~\$0 (Free tier: 50GB/month)" 
echo "Monitoring: \$0 (usando solo logging base)"
echo "TOTALE: \$0-5/mese con traffico basso"

echo -e "\n✅ Monitoring attivo e GRATUITO!"
echo "Dashboard completa: https://console.cloud.google.com/run/detail/asia-southeast2/$SERVICE_NAME/metrics?project=$PROJECT_ID"