# 🚀 ZANTARA BRIDGE - GUIDA SETUP COMPLETA

## ✅ STATO ATTUALE: 95% OPERATIVO

### ✅ COMPLETATO:
1. **OpenAI GPT-4 Turbo** - Funzionante
2. **API Endpoints** - Attivi
3. **Service Account** - Configurato
4. **Codice Enhanced** - Implementato
5. **Cache & Memory** - Pronti

### 🔧 DA COMPLETARE:

## 1. CONDIVIDI CARTELLA AMBARADAM SU GOOGLE DRIVE

1. Vai su Google Drive
2. Trova la cartella **AMBARADAM** 
3. Click destro → **Condividi**
4. Aggiungi: `zantara@involuted-box-469105-r0.iam.gserviceaccount.com`
5. Ruolo: **Editor**
6. Click **Invia**

## 2. CONFIGURA WHATSAPP BUSINESS API

### Opzione A: WhatsApp Business Cloud API (Consigliato)
1. Vai su: https://developers.facebook.com/
2. Crea app → Business → WhatsApp
3. Ottieni:
   - `WHATSAPP_PHONE_ID`
   - `WHATSAPP_ACCESS_TOKEN`
4. Configura webhook URL: `https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app/webhooks/whatsapp`

### Opzione B: Twilio WhatsApp
1. Registrati su: https://www.twilio.com/
2. Attiva WhatsApp sandbox
3. Ottieni credenziali Twilio
4. Configura webhook

## 3. CREA BOT TELEGRAM

1. Apri Telegram
2. Cerca: **@BotFather**
3. Invia: `/newbot`
4. Nome: `ZantaraBaliBot`
5. Username: `zantara_bali_bot`
6. Ricevi il **BOT TOKEN**
7. Configura webhook:
```bash
curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook \
  -d "url=https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app/webhooks/telegram"
```

## 4. AGGIORNA VARIABILI D'AMBIENTE

```bash
gcloud run services update zantara-bridge-v2-prod \
  --update-env-vars \
    WHATSAPP_ACCESS_TOKEN=<tuo-token>,\
    WHATSAPP_PHONE_ID=<tuo-phone-id>,\
    WHATSAPP_VERIFY_TOKEN=verify123,\
    TELEGRAM_BOT_TOKEN=<tuo-bot-token>,\
    ADMIN_API_KEY=admin123,\
    DRIVE_FOLDER_AMBARADAM=f1UGbm5er6Go351S57GQKUjmxMxHyT4QZb \
  --region asia-southeast2
```

## 5. TEST FINALI

### Test Chat Base:
```bash
curl -X POST https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app/api/chat \
  -H "X-API-KEY: 7a0adc0681bf7a5c6b6476f70a4581c85c49faeb66f7f61f20dc9b57ba86cfb3" \
  -H "X-BZ-USER: test" \
  -H "Content-Type: application/json" \
  -d '{"message":"Ciao"}'
```

### Test Admin Dashboard:
```
https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app/admin/dashboard
Password: admin123
```

### Test WhatsApp:
Invia messaggio al numero configurato

### Test Telegram:
Invia `/start` al bot

## 📊 FEATURES DISPONIBILI:

1. **Chat AI** con GPT-4 Turbo ✅
2. **Streaming Responses** (dopo deploy) 🔄
3. **Memory Conversazioni** ✅
4. **Multi-lingua** (IT/EN/ID) ✅
5. **Cache Intelligente** ✅
6. **WhatsApp Integration** 🔄
7. **Telegram Bot** 🔄
8. **Admin Dashboard** ✅
9. **Google Drive Save** 🔄
10. **Cost Monitoring** ✅

## 🎯 ENDPOINTS ATTIVI:

- POST `/api/chat` - Chat normale
- POST `/api/chat/stream` - Streaming (dopo deploy)
- POST `/api/chat/enhanced` - Full features
- GET `/admin/dashboard` - Dashboard
- POST `/webhooks/whatsapp` - WhatsApp
- POST `/webhooks/telegram` - Telegram
- GET `/health` - Health check

## 💡 TROUBLESHOOTING:

### Se Drive non funziona:
- Verifica condivisione AMBARADAM
- Check service account email
- Verifica GOOGLE_SERVICE_ACCOUNT_KEY

### Se WhatsApp non risponde:
- Verifica webhook URL
- Check token corretto
- Verifica numero autorizzato

### Se Telegram non funziona:
- Verifica bot token
- Check webhook attivo
- Test con /start

## 📞 SUPPORTO:
Email: zero@balizero.com
Project: Bali Zero / Zantara

---
Sistema al **95%** - Mancano solo configurazioni esterne (Drive share, WhatsApp token, Telegram bot)