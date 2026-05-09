#!/usr/bin/env bash
# Memory sync on session stop / disconnect
# Phase 1 (immediate): CodeGraph sync + .remember/ consolidation — free, <1s
# Phase 2 (background): Full /sync-memory via claude CLI — spawns a new session

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_DIR"

LOCKFILE="/tmp/portage-memory-sync.lock"
CLAUDE_BIN="/home/swebber64/.local/bin/claude"
LOG_DIR="$PROJECT_DIR/.remember/logs"
mkdir -p "$LOG_DIR"

# --- Phase 1: Immediate (bash-only, no cost) ---

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

# --- Phase 2: Background full sync (claude CLI) ---

# Skip if another sync is already running
if [ -f "$LOCKFILE" ]; then
  LOCK_PID=$(cat "$LOCKFILE" 2>/dev/null)
  if kill -0 "$LOCK_PID" 2>/dev/null; then
    exit 0
  fi
  rm -f "$LOCKFILE"
fi

# Skip if claude CLI not available
if [ ! -x "$CLAUDE_BIN" ]; then
  exit 0
fi

# Spawn background claude session for full sync
(
  echo $$ > "$LOCKFILE"
  "$CLAUDE_BIN" -p "Run /sync-memory — full audit of all 5 memory systems. Be concise, fix what's stale, skip what's current." \
    --allowedTools "Bash,Read,Write,Edit" \
    --max-turns 30 \
    > "$LOG_DIR/sync-$(date +%Y%m%d-%H%M%S).log" 2>&1
  rm -f "$LOCKFILE"
) &

exit 0
