# 🔑 DOVE CONFIGURARE LA TUA API KEY - ZANTARA BRIDGE

## 📱 CHATGPT (Custom GPT)

### Metodo 1: Nelle Actions
1. Vai su **Configure → Actions**
2. Clicca su **Authentication**
3. Seleziona **API Key**
4. Inserisci:
   - Header name: `X-API-Key`
   - API Key: `tua-api-key-qui`

### Metodo 2: Nelle Instructions
```
Quando comunichi con Zantara, usa sempre questo header:
X-API-Key: tua-api-key-qui
Base URL: https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app
```

---

## 🤖 CLAUDE (Projects)

### In Project Knowledge
1. Crea file `.env` nel progetto:
```
ZANTARA_API_KEY=tua-api-key-qui
ZANTARA_BASE_URL=https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app
```

2. Nelle istruzioni del progetto:
```
Per tutte le chiamate a Zantara Bridge, usa:
- Header: X-API-Key: [vedi .env file]
- Base URL: [vedi .env file]
```

---

## 💻 CODICE LOCALE

### Node.js / JavaScript

**.env file**:
```bash
ZANTARA_API_KEY=tua-api-key-qui
ZANTARA_BASE_URL=https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app
```

**Uso**:
```javascript
require('dotenv').config();

const headers = {
  'X-API-Key': process.env.ZANTARA_API_KEY,
  'Content-Type': 'application/json'
};
```

### Python

**.env file**:
```bash
ZANTARA_API_KEY=tua-api-key-qui
```

**Uso**:
```python
import os
from dotenv import load_dotenv

load_dotenv()

headers = {
    'X-API-Key': os.getenv('ZANTARA_API_KEY'),
    'Content-Type': 'application/json'
}
```

### React

**.env.local**:
```bash
REACT_APP_ZANTARA_API_KEY=tua-api-key-qui
REACT_APP_ZANTARA_URL=https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app
```

**Uso**:
```javascript
const apiKey = process.env.REACT_APP_ZANTARA_API_KEY;
const baseUrl = process.env.REACT_APP_ZANTARA_URL;
```

---

## 🌐 POSTMAN

### Metodo 1: Environment Variables
1. Crea nuovo Environment
2. Aggiungi variabile:
   - Name: `api_key`
   - Value: `tua-api-key-qui`
3. Nelle richieste usa: `{{api_key}}`

### Metodo 2: Collection Authorization
1. Click su Collection → Authorization
2. Type: **API Key**
3. Key: `X-API-Key`
4. Value: `tua-api-key-qui`
5. Add to: **Header**

---

## 📱 MOBILE APPS

### iOS (Info.plist)
```xml
<key>ZANTARA_API_KEY</key>
<string>tua-api-key-qui</string>
```

### Android (gradle.properties)
```properties
ZANTARA_API_KEY=tua-api-key-qui
```

**Build.gradle**:
```gradle
buildConfigField "String", "ZANTARA_API_KEY", "\"${ZANTARA_API_KEY}\""
```

**Uso**:
```kotlin
val apiKey = BuildConfig.ZANTARA_API_KEY
```

---

## 🔧 ZAPIER / MAKE / N8N

### Zapier
1. Vai su **Authentication**
2. Scegli **API Key**
3. Configura:
   - Header Name: `X-API-Key`
   - API Key: `tua-api-key-qui`

### Make.com
1. Crea connessione HTTP
2. Headers → Add item:
   - Name: `X-API-Key`
   - Value: `tua-api-key-qui`

### n8n
1. Credentials → Create New
2. Generic Credential Type
3. Aggiungi:
   ```json
   {
     "headers": {
       "X-API-Key": "tua-api-key-qui"
     }
   }
   ```

---

## 🐳 DOCKER

**docker-compose.yml**:
```yaml
version: '3.8'
services:
  app:
    image: your-app
    environment:
      - ZANTARA_API_KEY=${ZANTARA_API_KEY}
```

**.env**:
```bash
ZANTARA_API_KEY=tua-api-key-qui
```

**Dockerfile**:
```dockerfile
ENV ZANTARA_API_KEY=${ZANTARA_API_KEY}
```

---

## ☁️ CLOUD PLATFORMS

### Vercel
```bash
vercel env add ZANTARA_API_KEY
# Inserisci: tua-api-key-qui
```

### Netlify
1. Site Settings → Environment Variables
2. Add Variable:
   - Key: `ZANTARA_API_KEY`
   - Value: `tua-api-key-qui`

### Heroku
```bash
heroku config:set ZANTARA_API_KEY=tua-api-key-qui
```

### Google Cloud Run
```bash
gcloud run services update YOUR_SERVICE \
  --update-env-vars ZANTARA_API_KEY=tua-api-key-qui
```

---

## 🛡️ SICUREZZA - BEST PRACTICES

### ⚠️ MAI FARE:
```javascript
// ❌ MAI hardcodare l'API key
const apiKey = 'abc123def456'; // NON FARE!

// ❌ MAI committare su Git
git add .env  // AGGIUNGI .env a .gitignore!

// ❌ MAI esporre nel frontend
<script>
  const key = 'tua-api-key'; // VISIBILE A TUTTI!
</script>
```

### ✅ SEMPRE FARE:
```javascript
// ✅ Usa variabili d'ambiente
const apiKey = process.env.ZANTARA_API_KEY;

// ✅ Aggiungi a .gitignore
echo ".env" >> .gitignore

// ✅ Usa un proxy backend per il frontend
// Frontend chiama → Tuo backend → Zantara API

// ✅ Rotazione periodica delle chiavi
// Cambia API key ogni 3-6 mesi
```

---

## 🔄 ROTAZIONE API KEY

### Quando cambiare la key:
1. Ogni 3-6 mesi (routine)
2. Se sospetti compromissione
3. Quando un collaboratore lascia il team
4. Dopo un security incident

### Come cambiarla:
1. Richiedi nuova key a admin@balizero.com
2. Aggiorna in TUTTI i sistemi (usa questa lista!)
3. Testa che tutto funzioni
4. Comunica al team il completamento

---

## 🧪 TEST RAPIDO API KEY

### Bash/Terminal:
```bash
curl -H "X-API-Key: tua-api-key-qui" \
  https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app/health
```

### Response attesa:
```json
{
  "status": "OK",
  "authenticated": true
}
```

### Se non funziona:
- ❌ `401 Unauthorized` → API key errata
- ❌ `403 Forbidden` → API key valida ma senza permessi
- ❌ `429 Too Many Requests` → Rate limit raggiunto

---

## 📞 SUPPORTO

**Problemi con API Key?**
- Email: support@balizero.com
- Slack: #zantara-api-keys
- Include: Nome, progetto, errore specifico

**Richiesta nuova API Key:**
- Email: admin@balizero.com
- Specifica: Nome progetto, uso previsto, ambiente (dev/prod)

---

**Ultimo aggiornamento**: 2024-01-19  
**Versione**: 1.0.0