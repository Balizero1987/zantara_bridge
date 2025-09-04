#!/usr/bin/env bash
set -euo pipefail
DRY=1; ALLOW_TRACKED=0
[[ "${1:-}" == "--apply" ]] && DRY=0
[[ "${2:-}" == "--allow-tracked" ]] && ALLOW_TRACKED=1
PATTERNS=( node_modules dist build .next out .output .cache .parcel-cache .vite
coverage .nyc_output logs *.log tmp temp .tmp
__pycache__ .pytest_cache .mypy_cache .ruff_cache .tox venv .venv
target bin pkg .DS_Store .idea .vscode/.history )
keep_abs=( ".git" ); is_tracked(){ git ls-files --error-unmatch "$1" >/dev/null 2>&1; }
plan_del=(); for p in "${PATTERNS[@]}"; do for hit in $(sh -c "ls -1d $p 2>/dev/null || true"); do
[[ "$hit" == ".git" ]] && continue; plan_del+=("$hit"); done; done
[[ ${#plan_del[@]} -eq 0 ]] && { echo "Niente da eliminare"; exit 0; }
echo "Da eliminare:"; printf ' - %s\n' "${plan_del[@]}"
[[ $DRY -eq 1 ]] && { echo "Dry-run: usa --apply per applicare."; exit 0; }
for path in "${plan_del[@]}"; do
if is_tracked "$path"; then
[[ $ALLOW_TRACKED -eq 1 ]] && git rm -rf "$path" || { echo "Tracciato (skip): $path"; continue; }
else rm -rf "$path"; fi
done
git add -A || true
git diff --cached --quiet || git commit -m "chore(cleanup): remove superfluous files"
