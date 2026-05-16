#!/usr/bin/env bash
# Memory sync on session stop / disconnect
# Bash-only, <1s. Full sync handled by 6am cron.

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_DIR"

# CodeGraph sync
if [ -d .codegraph ]; then
  codegraph sync >/dev/null 2>&1 || true
fi

# Consolidate .remember/now.md → today's daily file
NOW_FILE="$PROJECT_DIR/.remember/now.md"
TODAY=$(date +%Y-%m-%d)
DAILY_FILE="$PROJECT_DIR/.remember/today-${TODAY}.md"

if [ -f "$NOW_FILE" ] && [ -s "$NOW_FILE" ]; then
  if [ -f "$DAILY_FILE" ]; then
    cat "$NOW_FILE" >> "$DAILY_FILE"
  else
    cp "$NOW_FILE" "$DAILY_FILE"
  fi
  echo "" > "$NOW_FILE"
fi

# Mark session manifest as clean shutdown
MANIFEST="$PROJECT_DIR/.claude/session-manifest.json"
if [ -f "$MANIFEST" ]; then
  sed -i 's/"clean_shutdown": false/"clean_shutdown": true/' "$MANIFEST" 2>/dev/null || true
fi

exit 0
