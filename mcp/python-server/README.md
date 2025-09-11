MCP Python Server

Avvio
- (Consigliato) `python -m venv .venv && source .venv/bin/activate`
- `pip install -r requirements.txt`
- `python src/mcp_python_tools/server.py`

Env principali
- `MCP_FS_ALLOWLIST`: percorsi consentiti (virgole).
- `MCP_FETCH_ALLOW_HOSTS`: host consentiti (virgole).
- `MCP_FETCH_ALLOW_ALL`: `1` per consentire tutti i domini.
- `MCP_DEBUG`: `1` per log più verbosi.

Strumenti
- `health`, `echo`, `sum`, `list_dir`, `fs_read`, `fs_write`, `fetch`.

