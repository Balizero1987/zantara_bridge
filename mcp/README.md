MCP Servers scaffold (Node e Python)

Contenuto
- Node: `mcp/node-server`
- Python: `mcp/python-server`
- Esempio config Claude Desktop: `mcp/CLAUDE_DESKTOP_CONFIG_EXAMPLE.json`

Requisiti
- Node.js >= 18 (per `fetch` nativo e ESM)
- Python >= 3.9
- SDK MCP: Node (`@modelcontextprotocol/sdk`), Python (`mcp`)

Installazione
- Node
  1) `cd mcp/node-server`
  2) `npm install` (installa `@modelcontextprotocol/sdk`)
  3) Avvio locale: `node src/server.js` (o aggiungi al PATH tramite `npm link`)

- Python
  1) `cd mcp/python-server`
  2) `python -m venv .venv && source .venv/bin/activate` (facoltativo)
  3) `pip install -r requirements.txt` (installa `mcp`)
  4) Avvio locale: `python src/mcp_python_tools/server.py`

Sicurezza (default)
- File system: allowlist da env `MCP_FS_ALLOWLIST` (se vuota, radice = CWD del processo).
- Rete: allowlist domini da env `MCP_FETCH_ALLOW_HOSTS` (lista separata da virgole). Per consentire tutti i domini: `MCP_FETCH_ALLOW_ALL=1`.
- Timeout richieste e limiti di output impostati in modo prudente.

Strumenti inclusi (entrambi i server)
- `health`: verifica lo stato.
- `echo`: echo di un testo.
- `sum`: somma di numeri.
- `list_dir`: lista file in una directory (allowlist).
- `fs_read`: legge un file (allowlist).
- `fs_write`: scrive un file (allowlist).
- `fetch`: HTTP GET/POST con allowlist domini.

Configurazione Claude Desktop (macOS)
1) Apri/crea `~/Library/Application Support/Claude/claude_desktop_config.json`.
2) Aggiungi una voce in `mcpServers` (vedi `mcp/CLAUDE_DESKTOP_CONFIG_EXAMPLE.json`).
3) Riavvia Claude Desktop; gli strumenti compariranno automaticamente.

Variabili d'ambiente utili
- `MCP_FS_ALLOWLIST`: percorsi consentiti (separati da virgole). Es: `/Users/tuoUtente/progetti,/tmp`.
- `MCP_FETCH_ALLOW_HOSTS`: host consentiti (separati da virgole). Es: `api.github.com,example.com`.
- `MCP_FETCH_ALLOW_ALL`: `1`/`true` per consentire tutti i domini (usa con cautela).
- `MCP_DEBUG`: `1` per log più verbosi.

Note
- Le implementazioni sono minimali e pensate per essere estese.
- Se desideri limitazioni più strette (consigliato), imposta allowlist specifiche.
