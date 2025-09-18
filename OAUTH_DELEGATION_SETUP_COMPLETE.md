# ✅ OAuth Domain-wide Delegation Setup Completato

## 📋 Configurazione Eseguita

### 🔧 Service Account Configuration
- **Service Account**: `zantara@involuted-box-469105-r0.iam.gserviceaccount.com`
- **Client ID**: `102437745575570448134`
- **Domain-wide Delegation**: ✅ Abilitato
- **Target Folder**: `0AJC3-SJL03OOUk9PVA`

### 🌐 Cloud Run Environment
- **Service**: `zantara-bridge-v2-prod`
- **Region**: `asia-southeast2`
- **Variables**:
  - `DRIVE_FOLDER_TARGET=0AJC3-SJL03OOUk9PVA`
  - `IMPERSONATE_USER=zero@balizero.com`

## 🚨 AZIONE RICHIESTA: Google Admin Console

### 1. Accedi a Google Admin Console
```
https://admin.google.com/ac/owl/domainwidedelegation
```

### 2. Aggiungi Client ID e Scopes
- **Client ID**: `102437745575570448134`
- **OAuth Scopes** (uno per riga):
```
https://www.googleapis.com/auth/drive
https://www.googleapis.com/auth/drive.file
https://www.googleapis.com/auth/drive.metadata
https://www.googleapis.com/auth/calendar
https://www.googleapis.com/auth/gmail.readonly
```

### 3. Clicca "Authorize" per completare la configurazione

## 🧪 Test Endpoints Disponibili

Una volta completata la configurazione in Admin Console, usa questi endpoint per testare:

### Status Check
```bash
curl -H "X-Api-Key: YOUR_API_KEY" \
  https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app/api/folder-access/status
```

### Test Folder Access
```bash
curl -H "X-Api-Key: YOUR_API_KEY" \
  https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app/api/folder-access/test/0AJC3-SJL03OOUk9PVA
```

### Configuration Info
```bash
curl -H "X-Api-Key: YOUR_API_KEY" \
  https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app/api/folder-access/config
```

### Create Test File
```bash
curl -X POST -H "X-Api-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"content":"OAuth delegation test","filename":"oauth-test.txt"}' \
  https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app/api/folder-access/create-test
```

## 📂 Files Created/Updated

### Nuovi File
- `src/utils/folderAccess.ts` - Utilities per accesso cartella
- `src/api/folderAccess.ts` - API endpoints per test OAuth
- `scripts/setup_oauth_delegation.sh` - Script setup automatico

### File Aggiornati  
- `src/index.ts` - Aggiunto router folder-access
- Environment variables di Cloud Run

## 🔄 Risultati Attesi

Dopo la configurazione Admin Console:

1. **Status Check** → `"delegationEnabled": true, "folderAccessible": true`
2. **Folder Access** → Metadata, file list, e permessi della cartella
3. **Test File Creation** → Creazione file di test nella cartella

## ⚠️ Troubleshooting

### Errore 403 "Permission Denied"
- Verifica Domain-wide Delegation in Admin Console
- Controlla che tutti gli scopes siano configurati
- Verifica che `IMPERSONATE_USER` sia un utente valido del dominio

### Errore 404 "Not Found"
- Verifica che la cartella `0AJC3-SJL03OOUk9PVA` esista
- Controlla che la cartella sia condivisa con il dominio/utente
- Verifica `DRIVE_FOLDER_TARGET` nelle environment variables

### Errore JWT/Authentication
- Verifica `GOOGLE_SERVICE_ACCOUNT_KEY` in Cloud Run
- Controlla che il Service Account abbia Domain-wide Delegation abilitato
- Verifica Client ID in Google Admin Console

## 🎯 Prossimi Passi

1. **Completa configurazione** in Google Admin Console
2. **Testa endpoints** con la tua API key
3. **Verifica accesso** alla cartella `0AJC3-SJL03OOUk9PVA`
4. **Integra** negli workflow esistenti del zantara_bridge

---

*Setup completato il: $(date)*  
*Client ID: 102437745575570448134*  
*Target Folder: 0AJC3-SJL03OOUk9PVA*