# Plugin QA: 50 alternative

| ID | Route | Input | Expected code | Expected JSON path |
|----|------|-------|----------------|--------------------|
| M1 | /.well-known/ai-plugin.json | – | 200 | `.schema_version=="v1"` |
| M2 | /.well-known/openapi.json   | – | 200 | `.info.title` contains "ZANTARA" |
| …  | … | … | … | … |
