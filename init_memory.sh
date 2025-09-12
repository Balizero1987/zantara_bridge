#!/bin/bash
set -e

mkdir -p memory

cat > memory/NOTE-zbctx01.json <<EOF
{
  "timestamp": "2025-09-12T00:00:00Z",
  "fonte": "nota",
  "autore": "utente",
  "contenuto": "Contesto: SaaS API-first per automazioni Google Workspace (Zantara Bridge) con endpoint REST e CLI/console.",
  "tag": ["CONTESTO", "PRODUCT"],
  "id": "NOTE-zbctx01"
}
EOF

cat > memory/NOTE-zbstate01.json <<EOF
{
  "timestamp": "2025-09-12T00:00:00Z",
  "fonte": "nota",
  "autore": "utente",
  "contenuto": "Stato: post-MVP in consolidamento; feature principali stabili; CI/CD attivo; refactor moduli Drive/Auth/Claude; deploy GCP/Cloud Run operativo.",
  "tag": ["STATO", "CI/CD", "REFACTOR", "DEPLOY"],
  "id": "NOTE-zbstate01"
}
EOF

cat > memory/NOTE-zbguides01.json <<EOF
{
  "timestamp": "2025-09-12T00:00:00Z",
  "fonte": "nota",
  "autore": "utente",
  "contenuto": "Linee guida presenti: docs modulari (/docs,/scripts,/routes); log conversazionali Codex/Claude; smoke test CLI; policy IAM + OIDC/WIF centralizzate; backup incrementali; naming condiviso.",
  "tag": ["DOCS", "TEST", "SECURITY", "BACKUP", "NAMING"],
  "id": "NOTE-zbguides01"
}
EOF

echo "✅ Memory inizializzata in memory/"
