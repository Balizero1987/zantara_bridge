# 🎯 TASK ASSIGNMENT - TUTTI I CLAUDE

## ⚠️ PRIORITÀ IMMEDIATE

### 1️⃣ **CLAUDE 1** - Google Drive Real Connection
**File da modificare**: `src/api/drive.ts`

**TASK**:
```typescript
// SOSTITUIRE mock responses con chiamate reali Google Drive API
import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
  scopes: ['https://www.googleapis.com/auth/drive']
});

const drive = google.drive({ version: 'v3', auth });

// Implementare:
- drive.files.create()    // Upload reale
- drive.files.list()      // Search reale
- drive.files.get()       // Download reale
- drive.files.delete()    // Delete reale
- drive.files.update()    // Modify reale
```

**Files coinvolti**:
- `/src/actions/drive/upload.ts`
- `/src/actions/drive/search.ts`
- `/src/actions/drive/delete.ts`
- `/src/actions/drive/modify.ts`

---

### 2️⃣ **CLAUDE 2** - Firestore Persistence Integration
**File da modificare**: `src/server.ts`

**TASK**:
```typescript
// INTEGRARE FirestoreManager in TUTTI i componenti
import FirestoreManager from './core/persistence/FirestoreManager';
import SecurityManagerV2 from './core/security/SecurityManagerV2';

// Sostituire:
// - In-memory sessions → Firestore sessions
// - Console.log → Firestore audit logs
// - Local rate limits → Firestore rate limits
```

**Modifiche richieste**:
1. Update `src/server.ts` per usare SecurityManagerV2
2. Update tutti gli endpoint per loggare in Firestore
3. Implementare session recovery dopo restart
4. Test con: restart server → sessions ancora valide

---

### 3️⃣ **CLAUDE 3** - Calendar Integration Reale
**File da modificare**: `src/api/calendar.ts`

**TASK**:
```typescript
// CONNETTERE a Google Calendar API reale
import { google } from 'googleapis';

const calendar = google.calendar({ version: 'v3', auth });

// Implementare:
- calendar.events.insert()     // Create evento
- calendar.events.list()       // List eventi
- calendar.events.update()     // Update evento
- calendar.events.delete()     // Delete evento
- calendar.freebusy.query()    // Check disponibilità
```

**Files coinvolti**:
- `/src/actions/calendar/create.ts`
- `/src/actions/calendar/list.ts`
- `/src/actions/calendar/update.ts`
- `/src/actions/calendar/delete.ts`
- `/src/actions/calendar/freebusy.ts`

---

### 4️⃣ **CLAUDE 4** - Service Accounts per 8 Utenti
**Task**: Creare e configurare service accounts

**SCRIPT DA CREARE**: `scripts/create-service-accounts.sh`
```bash
#!/bin/bash

USERS=(
  "antonello@balizero.com"
  "user2@balizero.com"
  "user3@balizero.com"
  "user4@balizero.com"
  "user5@balizero.com"
  "user6@balizero.com"
  "user7@balizero.com"
  "user8@balizero.com"
)

for USER in "${USERS[@]}"; do
  SA_NAME="zantara-sa-${USER%%@*}"
  
  # Create service account
  gcloud iam service-accounts create $SA_NAME \
    --display-name="Zantara SA for $USER"
  
  # Grant permissions
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/drive.user"
  
  # Domain-wide delegation
  gcloud iam service-accounts add-iam-policy-binding \
    $SA_NAME@$PROJECT_ID.iam.gserviceaccount.com \
    --member="user:$USER" \
    --role="roles/iam.serviceAccountTokenCreator"
  
  # Generate key
  gcloud iam service-accounts keys create \
    keys/$SA_NAME-key.json \
    --iam-account=$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com
done
```

**Implementare in**: `src/core/auth/ServiceAccountManager.ts`
```typescript
class ServiceAccountManager {
  private accounts = new Map<string, GoogleAuth>();
  
  async getAuthForUser(email: string): Promise<GoogleAuth> {
    if (!this.accounts.has(email)) {
      const keyFile = `keys/zantara-sa-${email.split('@')[0]}-key.json`;
      const auth = new google.auth.GoogleAuth({
        keyFile,
        scopes: [
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/calendar',
          'https://www.googleapis.com/auth/gmail'
        ],
        subject: email // Impersonate user
      });
      this.accounts.set(email, auth);
    }
    return this.accounts.get(email)!;
  }
}
```

---

## 🔄 COORDINAMENTO

### ORDINE DI ESECUZIONE:
1. **PRIMA**: Claude 4 crea service accounts (30 min)
2. **POI**: Claude 1, 2, 3 in parallelo (1 ora)
3. **INFINE**: Test integrato di tutto (30 min)

### FILES DA NON TOCCARE:
- `src/core/security/SecurityManager.ts` ✅ (già fatto da OPUS 1)
- `src/core/persistence/FirestoreManager.ts` ✅ (già fatto da OPUS 1)
- `COLLABORATORS_GUIDE.md` ✅
- `CI_CD_INTEGRATION.md` ✅

### TEST FINALE:
```bash
# 1. Test Drive upload con service account
curl -X POST $URL/drive/upload \
  -H "X-API-Key: test-key-123" \
  -H "X-User-Email: antonello@balizero.com" \
  -d '{"name": "test.pdf", "content": "...", "folderId": "..."}'

# 2. Test Calendar create
curl -X POST $URL/calendar/create \
  -H "X-API-Key: test-key-123" \
  -H "X-User-Email: antonello@balizero.com" \
  -d '{"summary": "Meeting", "start": "2024-01-20T10:00:00Z"}'

# 3. Test Firestore persistence
# Restart server
docker restart zantara-bridge
# Sessions dovrebbero essere ancora valide!

# 4. Check audit logs in Firestore
https://console.cloud.google.com/firestore/data/audit_logs
```

---

## 📊 STATUS TRACKER

| Task | Assignee | Status | ETA |
|------|----------|--------|-----|
| Service Accounts | Claude 4 | 🔴 TODO | 30min |
| Drive Integration | Claude 1 | 🔴 TODO | 1h |
| Firestore Integration | Claude 2 | 🔴 TODO | 1h |
| Calendar Integration | Claude 3 | 🔴 TODO | 1h |

---

## 🚨 PROBLEMI COMUNI E SOLUZIONI

### "Application Default Credentials not found"
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
```

### "Insufficient permissions"
```bash
# Grant missing role
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/drive.user"
```

### "Quota exceeded"
- Implementare exponential backoff
- Cache responses in Firestore
- Rate limit per user

### "Domain-wide delegation not working"
1. Go to: https://admin.google.com/ac/owl/domainwidedelegation
2. Add service account client ID
3. Scopes: https://www.googleapis.com/auth/drive,https://www.googleapis.com/auth/calendar

---

## 💬 COMUNICAZIONE

**Slack Channel**: #zantara-dev
**Updates ogni**: 30 minuti
**Blockers**: Tag @opus1 immediatamente

---

**DEADLINE**: 2 ore da ORA
**DEPLOY FINALE**: Dopo tutti i test passano