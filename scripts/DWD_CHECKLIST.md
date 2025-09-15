# Domain-Wide Delegation (DWD) — Checklist

Questa guida verifica e abilita l’impersonation del Service Account per Google Drive.

## Prerequisiti
- Service Account JSON in `GOOGLE_SERVICE_ACCOUNT_KEY`.
- `DRIVE_SUBJECT` impostato a un utente del dominio (es. `boss@…`).
- `DRIVE_FOLDER_AMBARADAM` è l'ID della cartella AMBARADAM (My Drive condivisa) dove operare.

## 1) Recupera runtime SA e OAuth2 Client ID
```bash
export PROJ="involuted-box-469105-r0"
export REGION="asia-southeast2"
export SERVICE="zantara-bridge-v2-prod"

RUNTIME_SA=$(gcloud run services describe "$SERVICE" \
  --region "$REGION" --project "$PROJ" \
  --format='value(spec.template.spec.serviceAccountName)')

echo "Runtime SA: $RUNTIME_SA"
gcloud iam service-accounts describe "$RUNTIME_SA" \
  --project "$PROJ" \
  --format='value(oauth2ClientId)'
```
Annota il valore di `oauth2ClientId`.

## 2) Admin Console — Abilita DWD
In Google Admin Console:
- Security → API controls → Domain-wide delegation → Manage domain-wide delegation
- “Add new” con:
  - Client ID = `oauth2ClientId` del runtime SA
  - OAuth scopes:
    ```
    https://www.googleapis.com/auth/drive
    ```

## 3) Permessi sulla Cartella AMBARADAM
- `DRIVE_SUBJECT` e il Service Account devono avere accesso (almeno Writer) alla cartella `DRIVE_FOLDER_AMBARADAM`.

## 4) Verifica token e accesso
Con servizio in staging e `ENABLE_DIAG=true`:
```bash
# URL e KEY via smoke (vedi scripts/smoke-block3.sh)
npm run smoke
```
Attesi:
- `/diag/google` → `ok:true`, `token_preview` non “none”.
- `/api/drive/_whoami` → `200` con `about` o `sample` (in base alla config).

## 5) Disabilita diagnostica in prod
```bash
gcloud run services update "$SERVICE" \
  --region "$REGION" --project "$PROJ" \
  --update-env-vars="ENABLE_DIAG=false"
```
