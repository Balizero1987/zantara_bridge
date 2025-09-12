MCP Node Server

Avvio
- `npm install`
- `npm start` oppure `node src/server.js`

Env principali
- `MCP_FS_ALLOWLIST`: percorsi consentiti (virgole).
- `MCP_FETCH_ALLOW_HOSTS`: host consentiti (virgole).
- `MCP_FETCH_ALLOW_ALL`: `1` per consentire tutti i domini.
- `MCP_DEBUG`: `1` per log più verbosi.
- `GITHUB_TOKEN`: token personale (Classic/ fine-grained) per le API GitHub.

Strumenti
- Base: `health`, `echo`, `sum`, `list_dir`, `fs_read`, `fs_write`, `fetch`.
- Git: `git_status` (porcelain), `git_diff` (staged/revRange/path), `git_commit` (opz. addAll/signoff),
  `git_log` (oneline con `max`/`revRange`/`path`), `git_branches` (locali, opz. remoti),
  `git_current_branch`, `git_show` (contenuto file a una rev), `git_add` (path o `-A`),
  `git_checkout` (cambia o crea branch con `create=true`).
- GitHub: `github_whoami`, `github_list_repos`, `github_list_prs`, `github_create_issue`,
  `github_comment_issue`, `github_get_file` (API contents, restituisce JSON base64). Richiedono `GITHUB_TOKEN`.

GitHub (uso rapido)
- Imposta `GITHUB_TOKEN` nell'env del server (tramite Claude Desktop config per questo server MCP).
- Verifica: chiama `github_whoami`.
- Esempi:
  - `github_list_prs` con `{ "owner": "ORG_O_UTENTE", "repo": "NOME_REPO", "state": "open" }`
  - `github_create_issue` con `{ "owner": "...", "repo": "...", "title": "bug: ...", "body": "descrizione" }`

Nota: il server usa ESM e Node >= 18.
