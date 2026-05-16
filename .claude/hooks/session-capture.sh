#!/usr/bin/env bash
# Capture session data and POST to DHG AI Factory registry
# Runs on Stop hook — fire-and-forget, must never fail or block

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_DIR" || exit 0

REGISTRY_URL="http://10.0.0.251:8011/api/agent-sessions"

SESSION_ID="${CLAUDE_CODE_SESSION_ID:-unknown-$(date +%s)}"
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
MODEL="${ANTHROPIC_MODEL:-unknown}"

COMMITS=$(git log --since="12 hours ago" --format='"%H"' --no-merges 2>/dev/null | head -20 | paste -sd, - || echo "")
COMMITS="[${COMMITS}]"

FILES_CHANGED=$(git log --since="12 hours ago" --format="" --name-only --no-merges 2>/dev/null | sort -u | wc -l | tr -d ' ' || echo "0")

NOW_FILE="$PROJECT_DIR/.remember/now.md"
SUMMARY=""
if [ -f "$NOW_FILE" ] && [ -s "$NOW_FILE" ]; then
  SUMMARY=$(sed 's/"/\\"/g; s/$/\\n/' "$NOW_FILE" | tr -d '\n' | head -c 4000 || echo "")
fi

TLDR=$(git log --since="12 hours ago" --format="%s" --no-merges 2>/dev/null | head -10 | paste -sd "; " - || echo "")
TLDR=$(echo "$TLDR" | sed 's/"/\\"/g' | head -c 1000 || echo "")

curl -s -X POST "$REGISTRY_URL" \
  -H "Content-Type: application/json" \
  --connect-timeout 3 \
  --max-time 5 \
  -d "{
    \"session_id\": \"${SESSION_ID}\",
    \"project\": \"portage\",
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
