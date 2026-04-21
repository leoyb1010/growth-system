#!/bin/bash
# Auto-sync script: commit all changes and push to GitHub
# Usage: bash .github/auto-sync.sh [version] [changelog_summary]
# Example: bash .github/auto-sync.sh v2.1.0 "新增暗色模式支持"

cd "$(dirname "$0")/.."
git add -A
if git diff --cached --quiet; then
  echo "No changes to commit"
  exit 0
fi

VERSION="${1:-patch}"
MSG="auto: $(date '+%Y-%m-%d %H:%M') sync"

# If a version tag and changelog summary are provided, update README
if [ -n "$1" ] && [ -n "$2" ]; then
  VER="$1"
  SUMMARY="$2"
  TODAY=$(date '+%Y-%m-%d')
  # Insert new version entry after the "## 版本更新日志" heading
  # Uses a temp file approach for macOS sed compatibility
  ENTRY=""
  ENTRY="${ENTRY}### ${VER} — ${TODAY} · ${SUMMARY}\n"
  ENTRY="${ENTRY}\n"
  ENTRY="${ENTRY}_(详细变更请查看 git log)_\n"
  ENTRY="${ENTRY}\n"
  ENTRY="${ENTRY}---\n"
  ENTRY="${ENTRY}\n"

  # Find the line number of the first "---" after "## 版本更新日志"
  README="README.md"
  LINE=$(grep -n "^---$" "$README" | head -1 | cut -d: -f1)
  if [ -n "$LINE" ]; then
    # Insert after the first ---
    sed -i.bak "${LINE}a\\
\\
### ${VER} — ${TODAY} · ${SUMMARY}\\

_(详细变更请查看 git log)_\\
" "$README"
    rm -f "${README}.bak"
    git add "$README"
    MSG="${MSG} (${VER})"
    echo "Updated README with ${VER} changelog"
  fi
fi

git commit -m "$MSG"
git push origin main

# If version tag provided, also create a git tag
if [ -n "$1" ] && [[ "$1" == v* ]]; then
  git tag -a "$1" -m "$1: ${2:-auto release}" 2>/dev/null
  git push origin "$1" 2>/dev/null
  echo "Tagged: $1"
fi

echo "Pushed: $MSG"
