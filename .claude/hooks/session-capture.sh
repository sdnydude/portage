#!/usr/bin/env bash
# Capture session data and POST to DHG AI Factory registry
# Runs on Stop hook — collects git state and sends to registry API

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_DIR"

REGISTRY_URL="http://10.0.0.251:8011/api/agent-sessions"

# Session ID from environment (Claude Code sets this)
SESSION_ID="${CLAUDE_SESSION_ID:-unknown-$(date +%s)}"
PROJECT_NAME="portage"
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
MODEL="${CLAUDE_MODEL:-unknown}"

# Collect recent commits from today on this branch
COMMITS=$(git log --since="12 hours ago" --format='"%H"' --no-merges 2>/dev/null | head -20 | paste -sd, -)
COMMITS="[${COMMITS}]"

# Count files changed in recent commits
FILES_CHANGED=$(git log --since="12 hours ago" --format="" --name-only --no-merges 2>/dev/null | sort -u | wc -l | tr -d ' ')

# Summary: pull from .remember/now.md (session journal buffer)
NOW_FILE="$PROJECT_DIR/.remember/now.md"
SUMMARY=""
if [ -f "$NOW_FILE" ] && [ -s "$NOW_FILE" ]; then
  SUMMARY=$(sed 's/"/\\"/g; s/$/\\n/' "$NOW_FILE" | tr -d '\n' | head -c 4000)
fi

# TLDR: one-line-per-commit subjects from today's work
TLDR=$(git log --since="12 hours ago" --format="%s" --no-merges 2>/dev/null | head -10 | paste -sd "; " -)
TLDR=$(echo "$TLDR" | sed 's/"/\\"/g' | head -c 1000)

# POST to registry (fire-and-forget, don't block session exit)
curl -s -X POST "$REGISTRY_URL" \
  -H "Content-Type: application/json" \
  --connect-timeout 5 \
  --max-time 10 \
  -d "{
    \"session_id\": \"${SESSION_ID}\",
    \"project\": \"${PROJECT_NAME}\",
    \"branch\": \"${BRANCH}\",
    \"source\": \"claude-code\",
    \"model\": \"${MODEL}\",
    \"summary\": \"${SUMMARY}\",
    \"tldr\": \"${TLDR}\",
    \"commits\": ${COMMITS},
    \"files_changed\": ${FILES_CHANGED},
    \"ended_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
  }" > /dev/null 2>&1 || true

exit 0
