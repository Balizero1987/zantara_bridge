#!/bin/bash
set -e
OWNER="Balizero1987"; REPO="zantara_bridge"
PR_IDS=$(gh pr list -R "$OWNER/$REPO" --search "head:codex/" --json number,state -q '.[] | select(.state=="OPEN") | .number')
for PR in $PR_IDS; do
  S=$(gh pr view "$PR" -R "$OWNER/$REPO" --json mergeable,mergeStateStatus -q '.mergeable+" "+.mergeStateStatus')
  if [ "$S" = "MERGEABLE CLEAN" ] || [ "$S" = "MERGEABLE clean" ]; then
    gh pr merge "$PR" -R "$OWNER/$REPO" --squash --delete-branch --admin || true
  fi
done
