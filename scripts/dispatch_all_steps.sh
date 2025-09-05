#!/bin/bash
set -e
OWNER="Balizero1987"
REPO="zantara_bridge"

send() {
  local BR="$1"; shift
  local TI="$1"; shift
  local BO="$1"; shift
  jq -n --arg b "$BR" --arg t "$TI" --arg body "$BO" \
    '{event_type:"codex-task", client_payload:{branch:$b,title:$t,body:$body}}' \
  | gh api "repos/$OWNER/$REPO/dispatches" --method POST --input -
}

send "codex/calendar-real" "feat(calendar): integrazione Google Calendar reale" "Implementare integrazione reale Google Calendar. ENV: SA_JSON_SECRET (base64), BALI_ZERO_CALENDAR_ID. src/lib/gcal.ts: factory getCalendar(scopes) con JWT googleapis. src/api/calendar.ts: POST /actions/calendar/create (summary,start,end,attendees[]), GET /actions/calendar/get?eventId=, GET /actions/calendar/list?date=YYYY-MM-DD (UTC), POST /actions/calendar/update {eventId,updates}, POST /actions/calendar/delete {eventId}, POST /actions/calendar/quickadd {text}, POST /actions/calendar/freebusy {timeMin,timeMax}. Mappare errori Google API (4xx→400/404, altro→500). Accettazione: create→201 {eventId,htmlLink}; list→200 events[]; get→200."
sleep 20

send "codex/drive-real" "feat(drive): integrazione Google Drive (upload/list/save)" "Implementare Drive v3 reale. ENV: SA_JSON_SECRET, MEMORY_DRIVE_FOLDER_ID. src/lib/gdrive.ts: helper upload(fileName,mime,buffer,folderId), rename(fileId,name), move(fileId,toFolderId), share(fileId,email,role), permissions(fileId), list(folderId,query?). src/api/drive.ts: POST /actions/drive/upload {filename,content_b64,folderId?}→fileId,webViewLink; POST /actions/drive/rename; POST /actions/drive/move; POST /actions/drive/share; GET /actions/drive/permissions/audit?fileId=. MIME by estensione, default application/octet-stream. Accettazione: upload→200 con link; audit→200 entries[]."
sleep 20

send "codex/gmail-real" "feat(gmail): invio email via Gmail API" "Implementare client Gmail reale. ENV: SA_JSON_SECRET, GMAIL_SENDER. src/lib/gmail.ts: auth JWT. src/api/gmail.ts: POST /actions/gmail/send {to,subject,text} → costruire RFC5322, codifica base64url, users.messages.send; validare destinatari string/array; ritorno {messageId}. Accettazione: 200 {messageId}."
sleep 20

send "codex/memory-real" "feat(memory): save+search note (Drive+Firestore)" "Implementare Memory. ENV: SA_JSON_SECRET, MEMORY_DRIVE_FOLDER_ID. src/lib/firestore.ts: client Firestore. src/api/memory.ts: POST /actions/memory/save {userId?,title?,text} → crea .md su Drive (sottocartella user), scrivi metadati in Firestore collection memory_notes {id,userId,title,driveId,createdAt,summary}; GET /actions/memory/search?q= → ricerca in Firestore per titolo/summary, max 20 risultati. Accettazione: save→200 con link Drive; search→200 items[]."
sleep 20

send "codex/openapi-complete" "docs(openapi): completare OpenAPI con tutti i path e schemi" "Aggiornare src/api/openapi.ts per servire YAML 3.x con tutti i path reali: health, identity, codex (dispatch,status), calendar (create,get,list,update,delete,quickadd,freebusy), drive (upload,rename,move,share,permissions/audit), gmail (send), memory (save,search). Aggiungere components.securitySchemes.bearerAuth e security su /actions/*. Definire OkEnvelope {ok:boolean,data?} e FailEnvelope {ok:false,error:string,details?} e payload per endpoint. Accettazione: GET /.well-known/openapi.yaml contiene tutti i path e schemi."
sleep 20

send "codex/rate-log" "feat(core): rate-limit globale e logging JSON con request_id" "Aggiungere logging e rate limit. src/middleware/logging.ts: log JSON {ts,request_id,method,path,status,duration_ms,ip,user_agent}; generare request_id se assente. src/middleware/rateLimit.ts: bucket per chiave (Authorization o IP) con header X-RateLimit-Limit/Remaining/Reset e 429 on exceed. src/server.ts: app.use(logging) globale; app.use('/actions', rateLimit(...)). Accettazione: headers presenti; 429 se flood; log JSON in stdout."
sleep 20

send "codex/cicd-cloudrun" "ci: build+push Artifact Registry e deploy Cloud Run su merge main" "Aggiungere .github/workflows/cicd.yml: on push main → actions/checkout, setup-node@v4, npm ci, tsc, docker buildx linux/amd64, push su asia-southeast2-docker.pkg.dev/<project>/zantara/bridge:<sha>; step di deploy: gcloud run deploy zantara-chat-v3-1064094238013 --image=<AR_IMAGE> --region=asia-southeast2 --allow-unauthenticated. Secrets richiesti: credenziali GCP (WIF o key), API_KEY, SA_JSON_SECRET, BALI_ZERO_CALENDAR_ID, MEMORY_DRIVE_FOLDER_ID, GMAIL_SENDER. Accettazione: run verde e revisione Cloud Run aggiornata."
sleep 20

send "codex/staff-gateway" "feat(gateway): ponte API per dipendenti con token staff" "Creare src/api/gateway.ts: auth staff via Authorization: Bearer <staff_token> ∈ STAFF_TOKENS; POST /api/dispatch → proxy verso ZANTARA_URL/actions/codex/dispatch aggiungendo Authorization: Bearer ${API_KEY}; logging/audit basico; opzionale deploy separato zantara-gateway. Accettazione: senza token staff→401; con token staff→202."

sleep 30
gh pr list -R "$OWNER/$REPO" --search "head:codex/" --limit 50
