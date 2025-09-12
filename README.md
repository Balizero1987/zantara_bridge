# Zantara Bridge

[![Deploy Cloud Run](https://github.com/Balizero1987/zantara_bridge/actions/workflows/deploy-cloudrun.yml/badge.svg)](https://github.com/Balizero1987/zantara_bridge/actions/workflows/deploy-cloudrun.yml)

Pipeline CI/CD sicura via GitHub OIDC (WIF) con deploy su Cloud Run e post-deploy checks automatici.

## Endpoints principali
<!-- PR check trigger -->

- POST `/actions/calendar/create`
  - Body: `{ "title", "start", "end", "attendees?", "description?", "calendarId?" }`
- GET `/actions/calendar/list`
  - Query: `calendarId?`, `timeMin?`, `maxResults?`
- POST `/actions/drive/upload`
  - Body: `{ "filename", "content", "mimeType?", "folderId?" }`
- POST `/actions/email/send`
  - Body: `{ "to", "subject", "text", "cc?" }`
- POST `/actions/email/draft`
  - Body: `{ "to", "subject", "text", "cc?" }`
- POST `/actions/memory/save`
  - Body: `{ "title", "content", "tags?[]" }`
- GET `/actions/debug/whoami`
  - Output: `{ email, userId, drivePermissionId, domain, env }`

Nota sicurezza: tutti gli endpoint `/actions/*` richiedono API Key. Passa l'header `X-Api-Key: <API_KEY>` (oppure `Authorization: Bearer <API_KEY>`).

Esempi rapidi

```sh
curl -s -X POST "$SERVICE_URL/actions/calendar/create" \
  -H "Content-Type: application/json" -H "X-Api-Key: $API_KEY" \
  -d '{"title":"Riunione Team","start":"2025-09-02T10:00:00Z","end":"2025-09-02T11:00:00Z","attendees":"a@b.com,b@c.com"}'

curl -s -H "X-Api-Key: $API_KEY" "$SERVICE_URL/actions/calendar/list?maxResults=5"

curl -s -X POST "$SERVICE_URL/actions/drive/upload" \
  -H "Content-Type: application/json" -H "X-Api-Key: $API_KEY" \
  -d '{"filename":"note.txt","content":"ciao"}'
```

## Setup Drive (Cloud Run)

- Requisiti:
  - Il Service Account runtime deve avere accesso in scrittura alla cartella AMBARADAM (My Drive condivisa).
  - Secrets/Env:
    - Secret `GOOGLE_SERVICE_ACCOUNT_KEY` (JSON del SA)
    - Env `DRIVE_FOLDER_AMBARADAM=1UGbm5er6Go351S57GQKUjmxMxHyT4QZb`
    - Secret/API key: `ZANTARA_PLUGIN_API_KEY` oppure `API_KEYS` (CSV)
    - Opzionale per DWD: `IMPERSONATE_USER=zero@balizero.com`

Esempio (placeholders):

```sh
gcloud run services update zantara-chat-v3-1064094238013 \
  --region asia-southeast2 --project $PROJ \
  --set-secrets "GOOGLE_SERVICE_ACCOUNT_KEY=GOOGLE_SERVICE_ACCOUNT_KEY:latest,ZANTARA_PLUGIN_API_KEY=ZANTARA_PLUGIN_API_KEY:latest" \
  --set-env-vars "DRIVE_FOLDER_AMBARADAM=1UGbm5er6Go351S57GQKUjmxMxHyT4QZb,\
ENABLE_DIAG=true,\
IMPERSONATE_USER=zero@balizero.com"
```

## Diagnostica Drive

- `GET /diag/google` → verifica token SA.
- `GET /diag/drive` → lista base (ambito utente/SA, no shared drive).
- `GET /diag/drive/check?folderId=<ID>` → metadata cartella specifica.
- `GET /diag/drive/find-folder?name=AMBARADAM` → ricerca cartelle per nome.

## Upload su Drive (crea cartelle automaticamente)

`POST /actions/drive/upload` con API key e utente:

```sh
curl -s -X POST "$SERVICE_URL/actions/drive/upload" \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: $API_KEY" \
  -H "X-BZ-USER: boss" \
  -d '{
    "filename":"Note-boss.txt",
    "content":"ciao mondo",
    "mimeType":"text/plain",
    "folderPath":"AMBARADAM/BOSS/Notes"
  }'
```

Note:
- Passa `folderId` per caricare direttamente nella cartella AMBARADAM (consigliato).
- In alternativa, `folderPath` creerà segmenti in My Drive.
- Header richiesti per `/actions/*`: `X-API-KEY` e `X-BZ-USER`.

## Troubleshooting

- 401/403 su Drive: verificare DWD (se si usa `IMPERSONATE_USER`) e che il SA abbia permessi writer sulla cartella `DRIVE_FOLDER_AMBARADAM`.
- 404/`notFound`: controllare `DRIVE_FOLDER_AMBARADAM` (folderId corretto e condiviso col SA).
