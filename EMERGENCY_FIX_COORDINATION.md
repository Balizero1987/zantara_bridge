# 🚨 EMERGENCY FIX - ZANTARA TOTALMENTE DOWN

## ⛔ PROBLEMA CRITICO IDENTIFICATO
- **MEMORIA**: Non funziona
- **DRIVE**: Non funziona  
- **REDIS**: Crasha il servizio (ECONNREFUSED)
- **FIRESTORE**: Non configurato
- **CALENDAR**: Non configurato

## 🎯 DIVISIONE TASK IMMEDIATA - 6 CLAUDE

### CLAUDE 1 (IO - OPUS COORDINATOR)
**TASK: Fix Redis + Coordinamento**
```bash
git checkout -b emergency-redis-fix
```
- Disabilitare Redis requirement che crasha
- Implementare fallback in-memory cache
- Coordinare gli altri 5 Claude

### CLAUDE 2 (OPUS)
**TASK: Google Drive Connection**
```bash
git checkout -b drive-eternal-connection
```
- Fix Drive API connection
- Implementare service account impersonation
- Cartelle condivise con tutti gli utenti listati
- Test con folder memoria

### CLAUDE 3 (OPUS)  
**TASK: Firestore Persistent Storage**
```bash
git checkout -b firestore-connection
```
- Setup Firestore client
- Collections: memories, conversations, users
- Persistence layer per tutti i dati
- Backup automatico

### CLAUDE 4 (SONNET)
**TASK: Google Calendar Integration**
```bash
git checkout -b calendar-integration
```
- Calendar ID: `c_7000dd5c02a3819af0774ad34d76379c506928057eff5e6540d662073aaeaaa7@group.calendar.google.com`
- Implementare eventi, reminder
- Quick add functionality

### CLAUDE 5 (SONNET)
**TASK: Service Account & Permissions**
```bash
git checkout -b service-account-fix
```
- Service account: `involuted-box-469105-r0@appspot.gserviceaccount.com`
- Configurare impersonation per tutti gli utenti:
  - kadek.tax@balizero.com
  - krisna@balizero.com
  - rina@balizero.com
  - ruslana@balizero.com
  - sahira@balizero.com
  - surya@balizero.com
  - tax@balizero.com
  - zero@balizero.com

### CLAUDE 6 (SONNET)
**TASK: Emergency Deployment**
```bash
git checkout -b emergency-deploy
```
- Merge tutti i fix
- Build Docker image funzionante
- Deploy immediato su Cloud Run
- Monitoring e test

## 📝 CONFIGURAZIONI CRITICHE

```env
# Google APIs
GOOGLE_SERVICE_ACCOUNT=involuted-box-469105-r0@appspot.gserviceaccount.com
GOOGLE_CALENDAR_ID=c_7000dd5c02a3819af0774ad34d76379c506928057eff5e6540d662073aaeaaa7@group.calendar.google.com
MEMORY_DRIVE_FOLDER_ID=[DA CONFIGURARE]

# Users with Full Access
AUTHORIZED_USERS=kadek.tax@balizero.com,krisna@balizero.com,rina@balizero.com,ruslana@balizero.com,sahira@balizero.com,surya@balizero.com,tax@balizero.com,zero@balizero.com

# Service Account
SERVICE_ACCOUNT_EMAIL=zantara@involuted-box-469105-r0.iam.gserviceaccount.com

# Redis (OPTIONAL - con fallback)
REDIS_ENABLED=false
USE_MEMORY_CACHE=true

# Firestore
FIRESTORE_PROJECT_ID=involuted-box-469105-r0
FIRESTORE_COLLECTION_PREFIX=zantara_
```

## 🚀 AZIONI IMMEDIATE

1. **ORA**: Ogni Claude prende il suo branch
2. **T+30min**: Prima sync con fix critici
3. **T+1h**: Merge e test integrazione
4. **T+1h30m**: Deploy emergenza

## ⚡ COMANDI RAPIDI

```bash
# Per tutti i Claude - Setup iniziale
cd ~/Documents/GitHub/zantara_bridge
git pull origin main
npm install

# Test locale
npm run dev

# Quick deploy
./emergency-deploy.sh
```

## 🔴 PRIORITÀ ASSOLUTE

1. **DISABILITARE REDIS** che crasha tutto
2. **CONNETTERE DRIVE** per memoria
3. **FIRESTORE** per persistenza
4. **CALENDAR** con ID fornito
5. **SERVICE ACCOUNT** con impersonation

## ✅ SUCCESS CRITERIA

- [ ] Health check risponde 200
- [ ] Memoria salva su Drive
- [ ] Calendar crea eventi
- [ ] Firestore persiste dati
- [ ] Tutti gli utenti hanno accesso
- [ ] NO CRASH da Redis

---

**INIZIATE SUBITO! NON C'È TEMPO DA PERDERE!**