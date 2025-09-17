# MCP local_docs

Server MCP minimale (HTTP) per supportare Codex CLI con funzioni utili sul repo locale.

## Avvio

```
cd zantara_bridge
npm run mcp:local
# Server su http://localhost:3001
```

## Sicurezza (opzionale)
- `LOCAL_MCP_KEY`: se impostata, ogni richiesta deve includere `X-LOCAL-KEY: <valore>`
- `READ_WHITELIST`: CSV di directory consentite (es. `/Users/you/zantara_bridge,/tmp`)

Esempio:
```
export LOCAL_MCP_KEY=dev-local
export READ_WHITELIST="$PWD"
npm run mcp:local
```

Le richieste dovranno includere:
```
-H "X-LOCAL-KEY: dev-local"
```

## Endpoint
- `GET /mcp` → handshake `{ ok, name, version }`
- `GET /mcp/readme?repo=<path>` → contenuto README.md
- `GET /mcp/file?path=<file>` → contenuto file testuale
- `GET /mcp/tree?root=<dir>&depth=2` → albero file/dir (profondità max 5)
- `GET /mcp/grep?root=<dir>&q=<term>` → cerca testo e ritorna snippet
- `GET /mcp/openapi` → scarica OpenAPI JSON dal servizio (override con `OPENAPI_URL`)
- `POST /mcp/tests/run` `{ cmd, cwd }` → esegue comandi test/smoke
- `POST /mcp/deploy` `{ script, env }` → esegue script di deploy (protetto da chiave se impostata)

## Esempi
```
# Handshake
curl -s http://localhost:3001/mcp | jq

# Tree (repo corrente)
curl -s "http://localhost:3001/mcp/tree?root=$PWD&depth=2" | jq

# File (README)
curl -s "http://localhost:3001/mcp/file?path=$PWD/README.md" | jq

# Grep
curl -s "http://localhost:3001/mcp/grep?root=$PWD&q=OPENAI_API_KEY" | jq

# OpenAPI
curl -s http://localhost:3001/mcp/openapi | jq

# Tests run
curl -s -X POST http://localhost:3001/mcp/tests/run \
  -H 'Content-Type: application/json' \
  -d '{"cmd":"npm run smoke","cwd":"'$PWD'"}' | jq
```

## Note
- Endpoint di lettura non validano dimensione/encoding del file: usali per testo.
- Per funzioni aggiuntive (es. zip, diff), apri una issue nel repo.

