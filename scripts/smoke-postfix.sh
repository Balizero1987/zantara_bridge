#!/usr/bin/env bash
set -euo pipefail

echo "== Zantara smoke-postfix =="
echo "Node: $(node -v)"
echo "NPM:  $(npm -v)"

if [ -f package-lock.json ]; then
  echo "Installing deps (ci)"
  npm ci --no-audit --no-fund
fi

echo "Building TypeScript"
npm run -s build

echo "Grepping for forbidden symbol 'withAllDrives' in actions..."
if rg -n "withAllDrives" src/actions >/dev/null 2>&1; then
  echo "ERROR: withAllDrives still referenced under src/actions" >&2
  rg -n "withAllDrives" src/actions || true
  exit 1
fi

echo "OK: build passed and no forbidden symbols found"

