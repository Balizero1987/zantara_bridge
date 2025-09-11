MCP Node Server

Avvio
- `npm install`
- `npm start` oppure `node src/server.js`

Env principali
- `MCP_FS_ALLOWLIST`: percorsi consentiti (virgole).
- `MCP_FETCH_ALLOW_HOSTS`: host consentiti (virgole).
- `MCP_FETCH_ALLOW_ALL`: `1` per consentire tutti i domini.
- `MCP_DEBUG`: `1` per log più verbosi.

Strumenti
- `health`, `echo`, `sum`, `list_dir`, `fs_read`, `fs_write`, `fetch`.

Nota: il server usa ESM e Node >= 18.

