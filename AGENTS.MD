# Repository Guidelines

## Project Structure & Module Organization
- `src/` – TypeScript sources: `index.ts` (Express app), `routes/`, `actions/`, `core/` (Google/Drive), `middleware/`.
- `scripts/` – operational tooling (deploy, smoke tests, Firestore helpers).
- `dist/` – compiled JS (created by build).

## Architecture Overview
- Express app bootstrapped in `src/index.ts`; HTTP routes under `src/routes/` and `src/actions/`.
- Drive integration in `src/core/drive.ts` uses Service Account only (no DWD subject). Diagnostics are gated by `ENABLE_DIAG`.
- Auth middleware (`middleware/authPlugin.ts`) validates `X-API-KEY` against `ZANTARA_PLUGIN_API_KEY` or `API_KEYS` CSV and derives `canonicalOwner` from `X-BZ-USER`.

## Build, Test, and Development Commands
- `npm ci` – install dependencies.
- `npm run dev` – run locally with auto‑reload.
- `npm run build` – compile TypeScript to `dist/`.
- `npm start` – start compiled server from `dist/`.
- `npm run lint` – lint codebase with ESLint.
- `npm run smoke` – basic endpoint checks via `scripts/smoke-block3.sh`.

Examples:
```
ENABLE_DIAG=true npm run dev
PROJ=... REGION=... SERVICE=... npm run smoke
# Build & deploy (typical)
TS=$(date +%s); IMG="$REGION-docker.pkg.dev/$PROJ/$REPO/zantara-chat:$TS"
docker buildx build --platform linux/amd64 -t "$IMG" --push .
gcloud run deploy "$SERVICE" --image "$IMG" --region "$REGION" --project "$PROJ" --allow-unauthenticated
```

## CI/CD & Deployment
- Container build: `docker buildx build --platform linux/amd64 -t "$IMG" --push .`
- Deploy to Cloud Run: `gcloud run deploy "$SERVICE" --image "$IMG" --region "$REGION" --project "$PROJ" --allow-unauthenticated`
- Quick smoke (diag enabled):
  - `KEY=$(gcloud secrets versions access latest --secret=ZANTARA_PLUGIN_API_KEY --project="$PROJ")`
  - `curl -s "$URL/diag/google" | jq .`
  - `curl -s -H "X-API-KEY: $KEY" -H "X-BZ-USER: boss" "$URL/api/drive/_whoami" | jq .`

## Coding Style & Naming Conventions
- TypeScript (strict). Indentation: 2 spaces.
- Names: camelCase (vars/functions), PascalCase (classes/types), UPPER_SNAKE (env vars).
- Filenames: descriptive lowerCamelCase (e.g., `core/drive.ts`).
- Keep diffs focused; avoid reformatting unrelated files. Run `npm run lint` before PRs.

## Testing Guidelines
- Current `npm test` is minimal. When adding tests:
- Name tests `*.test.ts`, colocate near modules or under `src/**/__tests__/`.
- Do not rely on live cloud resources; mock Google APIs and external services.

## Commit & Pull Request Guidelines
- Commits: concise, imperative, and scoped (e.g., `core: SA-only Drive auth`).
- PRs: include purpose, summary, and relevant logs/screenshots (e.g., `/diag/google`, `/api/drive/_whoami`).
- Pre‑merge: build OK, lint clean, smoke checks passing where applicable.

## Security & Configuration Tips
- Secrets via Secret Manager in Cloud Run (e.g., `GOOGLE_SERVICE_ACCOUNT_KEY`, `ZANTARA_PLUGIN_API_KEY`). Never commit secrets.
- Configure service env:
  - `gcloud run services update "$SERVICE" --region "$REGION" --project "$PROJ" \\
    --update-secrets="GOOGLE_SERVICE_ACCOUNT_KEY=GOOGLE_SERVICE_ACCOUNT_KEY:latest,ZANTARA_PLUGIN_API_KEY=ZANTARA_PLUGIN_API_KEY:latest" \\
    --update-env-vars="ENABLE_DIAG=true,DRIVE_ID_AMBARADAM=0A..."`
- `DRIVE_ID_AMBARADAM` optional; SA must be a member of the Shared Drive to list files.
- Set `ENABLE_DIAG=false` in production.
