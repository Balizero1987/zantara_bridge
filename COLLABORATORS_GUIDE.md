# 📚 GUIDA COLLABORATORI - ZANTARA BRIDGE v3.5

## 🚀 QUICK START

### Endpoint Base
```
https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app
```

### API Key Richiesta
Contatta l'amministratore per ricevere la tua API key personale.

---

## 🔐 AUTENTICAZIONE

### Metodo 1: API Key (RACCOMANDATO)
Aggiungi uno di questi header alle tue richieste:
```
X-API-Key: la-tua-api-key
```
oppure
```
Authorization: Bearer la-tua-api-key
```

### Metodo 2: JWT Token
```javascript
// 1. Login
POST /auth/login
{
  "email": "tuo@email.com",
  "password": "tua-password"
}

// 2. Usa il token ricevuto
Authorization: Bearer eyJhbGc...
```

---

## 📋 OPERAZIONI COMUNI

### 1️⃣ DRIVE - Upload File
```bash
curl -X POST https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app/drive/upload \
  -H "X-API-Key: TUA-API-KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "report.pdf",
    "content": "base64-encoded-content",
    "folderId": "1UGbm5er6Go351S57GQKUjmxMxHyT4QZb",
    "mimeType": "application/pdf"
  }'
```

### 2️⃣ DRIVE - Ricerca File
```bash
curl -X POST https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app/drive/search \
  -H "X-API-Key: TUA-API-KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "invoice 2024",
    "folderId": "1UGbm5er6Go351S57GQKUjmxMxHyT4QZb"
  }'
```

### 3️⃣ CALENDAR - Crea Evento
```bash
curl -X POST https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app/calendar/create \
  -H "X-API-Key: TUA-API-KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "summary": "Team Meeting",
    "description": "Discussione progetto Q1",
    "start": "2024-01-25T10:00:00+02:00",
    "end": "2024-01-25T11:00:00+02:00",
    "attendees": ["email1@example.com", "email2@example.com"]
  }'
```

### 4️⃣ CALENDAR - Lista Eventi
```bash
curl -X GET "https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app/calendar/list?days=7" \
  -H "X-API-Key: TUA-API-KEY"
```

### 5️⃣ MEMORY - Salva Nota
```bash
curl -X POST https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app/actions/memory/save \
  -H "X-API-Key: TUA-API-KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Meeting notes: Discussed new features...",
    "tags": ["meeting", "features", "2024"],
    "category": "work"
  }'
```

### 6️⃣ GMAIL - Invia Email
```bash
curl -X POST https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app/actions/email/send \
  -H "X-API-Key: TUA-API-KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "recipient@example.com",
    "subject": "Report Mensile",
    "body": "In allegato il report...",
    "attachments": []
  }'
```

---

## ⚡ RATE LIMITS

| Tipo | Limite | Reset |
|------|--------|-------|
| Standard | 60 req/min | 1 minuto |
| Upload | 10 req/min | 1 minuto |
| Search | 30 req/min | 1 minuto |

### Come leggere i rate limit headers:
```
X-RateLimit-Limit: 60        # Limite totale
X-RateLimit-Remaining: 45    # Richieste rimanenti
X-RateLimit-Reset: 1705743300 # Unix timestamp reset
```

---

## 🐛 GESTIONE ERRORI

### Codici di Risposta Comuni

| Codice | Significato | Azione |
|--------|------------|--------|
| 200 | Successo | ✅ Continua |
| 400 | Bad Request | Controlla i parametri |
| 401 | Non autorizzato | Verifica API key |
| 403 | Forbidden | Permessi insufficienti |
| 429 | Rate limit | Aspetta prima di riprovare |
| 500 | Server error | Riprova più tardi |

### Esempio Risposta Errore:
```json
{
  "ok": false,
  "error": "Rate limit exceeded",
  "retryAfter": "2024-01-20T10:15:00Z"
}
```

---

## 🧪 TEST ENDPOINTS

### Health Check (No Auth)
```bash
curl https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app/health
```

### Test Auth
```bash
curl https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app/identity/me \
  -H "X-API-Key: TUA-API-KEY"
```

---

## 🔧 CONFIGURAZIONE CLIENT

### JavaScript/Node.js
```javascript
const ZANTARA_API = 'https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app';
const API_KEY = 'tua-api-key';

async function uploadFile(name, content) {
  const response = await fetch(`${ZANTARA_API}/drive/upload`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name,
      content: Buffer.from(content).toString('base64'),
      folderId: '1UGbm5er6Go351S57GQKUjmxMxHyT4QZb'
    })
  });
  
  return response.json();
}
```

### Python
```python
import requests
import base64

ZANTARA_API = 'https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app'
API_KEY = 'tua-api-key'

def upload_file(name, content):
    headers = {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
    }
    
    data = {
        'name': name,
        'content': base64.b64encode(content).decode('utf-8'),
        'folderId': '1UGbm5er6Go351S57GQKUjmxMxHyT4QZb'
    }
    
    response = requests.post(
        f'{ZANTARA_API}/drive/upload',
        headers=headers,
        json=data
    )
    
    return response.json()
```

---

## 📊 MONITORAGGIO

### Metrics Endpoint
```bash
curl https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app/metrics \
  -H "X-API-Key: TUA-API-KEY"
```

### Audit Logs
Tutte le operazioni sono registrate con:
- Timestamp
- User/API key
- Endpoint chiamato
- Response status
- IP address

---

## 🆘 SUPPORTO

### Problemi Comuni

**"Unauthorized"**
- Verifica che l'API key sia corretta
- Controlla che l'header sia formattato correttamente

**"Rate limit exceeded"**
- Aspetta il tempo indicato in `retryAfter`
- Implementa exponential backoff

**"Internal server error"**
- Riprova dopo qualche secondo
- Se persiste, contatta supporto

### Contatti
- **Email tecnico**: support@balizero.com
- **Slack**: #zantara-support
- **Docs**: https://docs.balizero.com/zantara

---

## 🚀 MIGRAZIONE DA v2 A v3

### Cosa cambiare:

1. **Headers Auth**:
   - PRIMA: `Authorization: AMBARADAM BaliZero2025`
   - ORA: `X-API-Key: tua-api-key`

2. **Endpoints**:
   - Base URL resta uguale
   - Alcuni path sono cambiati (vedi sopra)

3. **Rate Limits**:
   - Ora attivi di default
   - Gestisci status 429

4. **Response Format**:
   - Sempre `{ ok: boolean, data?: any, error?: string }`

---

## 📝 CHANGELOG

### v3.5.0 (2024-01-19)
- ✅ Nuovo sistema autenticazione JWT/API Key
- ✅ Rate limiting implementato
- ✅ Audit logging completo
- ✅ Security headers aggiunti
- ✅ Performance optimization

### v3.0.0 (2024-01-18)
- 🔄 Refactoring architettura
- 🔒 Security enhancements
- ⚡ Cache layer aggiunto

---

**Last Updated**: 2024-01-19
**Version**: 3.5.0