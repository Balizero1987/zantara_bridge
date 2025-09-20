# 🚀 ZANTARA BRIDGE v3.5.0 - MASSIVE SECURITY REFACTOR

## ⚠️ BREAKING CHANGES - LEGGERE PRIMA DI AGGIORNARE! (19 Gennaio 2025)

### 🔴 ATTENZIONE: Refactoring completo del sistema di autenticazione e sicurezza

---

## 🔄 CHANGELOG v3.5.0 (19 Gennaio 2025)

### NUOVE FEATURES
- **Security Core v2**: Sistema di sicurezza enterprise-grade
- **JWT Authentication**: Token-based auth con refresh tokens
- **OAuth2/Google**: Login con Google account
- **Rate Limiting**: Protezione contro abusi (per IP/User/Endpoint)
- **Audit Logging**: GDPR-compliant con retention policies
- **Multi-layer Auth**: 4 metodi di autenticazione supportati

### FILE MODIFICATI CRITICI
- `src/server.ts` - Refactoring completo middleware stack
- `src/core/security/*` - Nuovo security layer (3 componenti)
- `package.json` - Aggiornato da v1.0.0 a v3.5.0
- Nuove dipendenze: helmet, express-rate-limit, compression, google-auth-library

### BREAKING CHANGES
1. Authentication endpoint cambiati (vedi sotto)
2. Headers di autenticazione modificati
3. Rate limiting attivo di default
4. Session management con limiti

---

## Esecuzione tramite Docker

Questa applicazione è pronta per essere eseguita in ambiente Docker, utilizzando Node.js versione **22.13.1** (come specificato nel Dockerfile). Il servizio espone la porta **8080**.

### Requisiti
- Docker e Docker Compose installati
- API Key per autenticazione sugli endpoint (`X-Api-Key` o `Authorization: Bearer <API_KEY>`)
- (Opzionale) File `.env` per variabili d'ambiente personalizzate

### Build e avvio rapido

1. **Costruisci e avvia il servizio**:

```sh
docker compose up --build
```

2. **Accedi all'API**:

Il servizio sarà disponibile su `http://localhost:8080`.

### Configurazione
- La porta **8080** è esposta dal container e mappata sulla stessa porta locale.
- Non sono richiesti database o servizi esterni: la configurazione è pronta all'uso.
- Se necessario, puoi aggiungere un file `.env` per gestire variabili d'ambiente personalizzate (vedi commento nel `docker-compose.yml`).

### Note
- Il container viene eseguito con utente non-root (`zantara`) per maggiore sicurezza.
- Tutte le dipendenze sono gestite tramite `npm ci` e ottimizzate per produzione.
- Per modifiche avanzate, consulta il `Dockerfile` e `docker-compose.yml` inclusi nel progetto.

