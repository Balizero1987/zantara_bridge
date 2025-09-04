#!/usr/bin/env bash
set -e
OWNER="Balizero1987"
REPO="zantara_bridge"
BRANCHES=(codex/calendar-real codex/drive-real codex/gmail-real codex/memory-real codex/openapi-complete codex/rate-log codex/cicd-cloudrun codex/staff-gateway)

echo "::actions (ultimi 10)"; gh run list --repo "$OWNER/$REPO" --limit 10
echo
for B in "${BRANCHES[@]}"; do
  PR=$(gh pr list --repo "$OWNER/$REPO" --head "$B" --json number,title,state -q '.[0] // {}' || true)
  NUM=$(echo "$PR" | jq -r '.number // empty')
  echo "::branch $B"
  if [ -z "$NUM" ]; then
    echo "PR: none"
  else
    echo "PR: #$NUM $(echo "$PR" | jq -r '.title') [$(echo "$PR" | jq -r '.state')]"
  fi
done
echo
echo "::ultimo run repository_dispatch"
RID=$(gh run list --repo "$OWNER/$REPO" --workflow "Codex Dispatch Alt" --limit 1 --json databaseId,name,status,conclusion -q '.[0].databaseId' || true)
if [ -n "$RID" ]; then gh run view "$RID" --repo "$OWNER/$REPO" --json status,conclusion,headBranch,headSha --jq '.'; else echo "nessun run"; fi
