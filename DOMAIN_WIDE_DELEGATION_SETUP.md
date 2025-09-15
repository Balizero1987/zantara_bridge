# ZANTARA Bridge - Domain-wide Delegation Setup

## ❌ PROBLEMA ATTUALE:
```
{"error":"invalid_grant: Invalid JWT Signature."}
```

## ✅ SOLUZIONE - Domain-wide Delegation:

### 1. **Vai su Google Cloud Console**
```
https://console.cloud.google.com/iam-admin/serviceaccounts?project=involuted-box-469105-r0
```

### 2. **Trova Service Account ZANTARA**
- **Account**: `zantara@involuted-box-469105-r0.iam.gserviceaccount.com`
- Clicca su "Edit" (matita)
- Vai in "Advanced settings"
- **Abilita "Enable G Suite Domain-wide Delegation"**
- Note: "ZANTARA Bridge Gmail/Calendar access"
- **Salva**

### 3. **Client ID Service Account**
- **Client ID**: `102437745575570448134`
- (già ottenuto dal Service Account ZANTARA)

### 4. **Configura in Google Admin Console**
```
https://admin.google.com/ac/owl/domainwidedelegation
```

- **Client ID**: `102437745575570448134`
- **OAuth Scopes** (uno per riga):
```
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/calendar
https://www.googleapis.com/auth/calendar.events
https://www.googleapis.com/auth/drive
```

### 5. **Autorizza in Admin Console**
- Clicca "Authorize"
- Conferma accesso per il dominio

### 6. **Test la configurazione**
```bash
curl -X POST https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app/api/compliance/gmail/monitor \
  -H "x-api-key: 7a0adc0681bf7a5c6b6476f70a4581c85c49faeb66f7f61f20dc9b57ba86cfb3" \
  -H "x-bz-user: zero@balizero.com" \
  -H "Content-Type: application/json" \
  -d '{"userEmail":"zero@balizero.com","maxResults":5}'
```

**Risultato atteso**: Lista di email invece di errore JWT.

---

## 🔧 COMANDI ALTERNATIVI:

### Verifica Current SA:
```bash
gcloud iam service-accounts describe zantara@involuted-box-469105-r0.iam.gserviceaccount.com
```

### Aggiungi permessi Domain-wide:
```bash
gcloud iam service-accounts update zantara@involuted-box-469105-r0.iam.gserviceaccount.com \
  --display-name="ZANTARA Bridge with DWD"
```

### Ottieni Client ID:
```bash
gcloud iam service-accounts describe zantara@involuted-box-469105-r0.iam.gserviceaccount.com \
  --format="value(oauth2ClientId)"
```

---

## ⚠️ NOTA IMPORTANTE:
**Il Domain-wide Delegation deve essere configurato da un Super Admin del dominio Google Workspace.**

Se non hai accesso Admin, contatta l'amministratore con:
- **Client ID**: [Da ottenere dal SA]
- **Scopes richiesti**: Gmail, Calendar, Drive
- **Motivo**: ZANTARA Bridge compliance monitoring

---

## 🎯 DOPO IL SETUP:
1. Gmail monitoring funzionerà ✅
2. Calendar alerts attivi ✅  
3. Auto-save Drive migliorato ✅
4. Compliance dashboard completo ✅