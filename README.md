# Zantara Bridge

[![Deploy Cloud Run](https://github.com/Balizero1987/zantara_bridge/actions/workflows/deploy-cloudrun.yml/badge.svg)](https://github.com/Balizero1987/zantara_bridge/actions/workflows/deploy-cloudrun.yml)

Pipeline CI/CD sicura via GitHub OIDC (WIF) con deploy su Cloud Run e post-deploy checks automatici.

## Endpoints principali

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
