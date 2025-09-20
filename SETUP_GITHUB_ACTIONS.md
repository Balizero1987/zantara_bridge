# Setup GitHub Actions per Zantara Bridge

## 📁 File Aggiornato
**Nome file**: `.env.complete.template`

Ho aggiunto tutte le configurazioni GitHub Actions al tuo file template esistente.

## 🚀 Come Completare il Setup

### 1. Genera una nuova chiave service account
```bash
gcloud iam service-accounts keys create github-deploy-key.json \
  --iam-account=zantara@involuted-box-469105-r0.iam.gserviceaccount.com
```

### 2. Configura il secret principale su GitHub
```bash
gh secret set GCP_SA_KEY < github-deploy-key.json
```

### 3. Pulisci il file temporaneo
```bash
rm github-deploy-key.json
```

## 🔧 Secrets già configurati
✅ `API_KEYS` - Chiavi API applicazione  
✅ `ZANTARA_PLUGIN_API_KEY` - Autenticazione plugin  
✅ `OPENAI_API_KEY` - Integrazione AI  
✅ `MEMORY_DRIVE_FOLDER_ID` - ID cartella memoria  
✅ `AMBARADAM_DRIVE_ID` - ID drive condiviso  
✅ `IMPERSONATE_USER` - Email impersonificazione  
✅ `BALI_ZERO_CALENDAR_ID` - ID calendario  
✅ `ZANTARA_SHARED_DRIVE_ID` - ID drive condiviso  
✅ `GMAIL_SENDER` - Email mittente  

## 📋 Opzioni di Deployment

### Opzione 1: Cloud Build (esistente)
```bash
gcloud builds submit
```

### Opzione 2: GitHub Actions (nuovo)
```bash
git push origin main  # Deploy automatico
```

Oppure trigger manuale:
1. Vai su GitHub > Actions
2. Seleziona "Deploy to Cloud Run via GitHub Actions"
3. Clicca "Run workflow"

## 🎯 Vantaggi GitHub Actions
- **Costi ridotti** (minuti gratuiti)
- **Integrazione GitHub** migliore
- **CI/CD più veloce**
- **Log più chiari**
- **Deploy automatico** su push

## 🔍 Monitoraggio
- **GitHub Actions UI**: Log in tempo reale
- **Cloud Run Console**: Servizi deployati
- **Endpoint health**: `/health`

Una volta completato il setup, avrai due opzioni di deployment funzionanti!