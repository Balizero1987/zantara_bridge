# ZANTARA BRIDGE - CONFIGURAZIONE COMPLETA

## DIRECTORY PROGETTO
~/Desktop/zantara_bridge_work/zantara_bridge

## URLs PRODUZIONE
- Backend: https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app
- Dashboard: https://zantara-dashboard.netlify.app
- GitHub: https://github.com/Balizero1987/zantara_bridge

## GOOGLE CLOUD
- Project ID: zantara-bridge-v2-prod (1064094238013)
- Region: asia-southeast2
- Service: zantara-bridge-v2-prod
- Image: gcr.io/zantara-bridge-v2-prod/zantara-bridge:latest

## API KEYS E SECRETS
OPENAI_API_KEY=[OPENAI_KEY_REDACTED]
API_KEY=7a0adc0681bf7a5c6b6476f70a4581c85c49faeb66f7f61f20dc9b57ba86cfb3
ZANTARA_API_KEY=7a0adc0681bf7a5c6b6476f70a4581c85c49faeb66f7f61f20dc9b57ba86cfb3
DRIVE_FOLDER_ID=1UGbm5er6Go351S57GQKUjmxMxHyT4QZb

## ENDPOINT FUNZIONANTE
POST /chat
Headers:
  X-API-KEY: 7a0adc0681bf7a5c6b6476f70a4581c85c49faeb66f7f61f20dc9b57ba86cfb3
  X-BZ-USER: username
Body:
  {"message":"test", "document":"base64data", "fileName":"file.pdf"}

## COMANDI DEPLOYMENT
npm run build
docker buildx build --platform linux/amd64 -t gcr.io/zantara-bridge-v2-prod/zantara-bridge:latest .
docker push gcr.io/zantara-bridge-v2-prod/zantara-bridge:latest
gcloud run deploy zantara-bridge-v2-prod --image gcr.io/zantara-bridge-v2-prod/zantara-bridge:latest --region asia-southeast2

## FILE LOCALI NECESSARI
- .env (con keys sopra)
- service-account.json (da Secret Manager)
- src/routes/chat.ts (endpoint principale)

## STATO ATTUALE
✅ Backend deployato e funzionante
✅ Dashboard online
✅ Google Drive configurato
✅ API chat operativa
⚠️ Redis non configurato (non critico)
