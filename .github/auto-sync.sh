#!/bin/bash
# Auto-sync script: commit all changes and push to GitHub
cd "$(dirname "$0")/.."
git add -A
if git diff --cached --quiet; then
  echo "No changes to commit"
  exit 0
fi
MSG="auto: $(date '+%Y-%m-%d %H:%M') sync"
git commit -m "$MSG"
git push origin main
echo "Pushed: $MSG"
