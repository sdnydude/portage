#!/usr/bin/env bash
# PostToolUse hook: counts tool calls, fires capture sweep reminder before compression
# Also maintains a session manifest for crash recovery.
# Stdout goes to Claude as a system reminder. Must be fast (<50ms).

PROJECT_DIR="$(cd "$(dirname "$0")/../.." 2>/dev/null && pwd)" || PROJECT_DIR="/home/swebber64/DHG/portage"
MANIFEST_DIR="$PROJECT_DIR/.claude"
SESSION_ID="${CLAUDE_CODE_SESSION_ID:-default}"
RUN_DIR="$HOME/.claude/run"
mkdir -p "$RUN_DIR"
COUNTER_FILE="$RUN_DIR/toolcalls-${SESSION_ID}"
FIRED_FILE="$RUN_DIR/sweep-fired-${SESSION_ID}"
MANIFEST="$MANIFEST_DIR/session-manifest.json"
THRESHOLD=${CLAUDE_SWEEP_THRESHOLD:-100}

# If already fired this session, just update manifest timestamp and exit
if [ -f "$FIRED_FILE" ]; then
  # Keep manifest alive so recovery knows session was active recently
  if [ -f "$MANIFEST" ]; then
    sed -i "s/\"last_active\":\"[^\"]*\"/\"last_active\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"/" "$MANIFEST" 2>/dev/null || true
  fi
  exit 0
fi

# Increment counter
if [ -f "$COUNTER_FILE" ]; then
  COUNT=$(( $(cat "$COUNTER_FILE") + 1 ))
else
  COUNT=1
fi
echo "$COUNT" > "$COUNTER_FILE"

# Write/update session manifest (write-ahead log for crash recovery)
BRANCH=$(git -C "$PROJECT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
cat > "$MANIFEST" <<EOF
{
  "session_id": "${SESSION_ID}",
  "branch": "${BRANCH}",
  "started_at": "$([ "$COUNT" -eq 1 ] && date -u +%Y-%m-%dT%H:%M:%SZ || ([ -f "$MANIFEST" ] && python3 -c "import json;print(json.load(open('$MANIFEST'))['started_at'])" 2>/dev/null || date -u +%Y-%m-%dT%H:%M:%SZ))",
  "last_active": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "tool_calls": ${COUNT},
  "sweep_fired": false,
  "clean_shutdown": false
}
EOF

# Check threshold
if [ "$COUNT" -ge "$THRESHOLD" ]; then
  touch "$FIRED_FILE"
  sed -i 's/"sweep_fired": false/"sweep_fired": true/' "$MANIFEST" 2>/dev/null || true
  cat <<'SWEEP'
⚠️ CAPTURE SWEEP — Context compression approaching (~100 tool calls).

Run the capture audit NOW before context is lost:
1. Check: every ★ Insight block has a matching post-insight.sh call
2. Check: every decision (with rejected alternatives) has a post-decision-logs.sh call
3. Check: any /ship completion has a post-ship-session.sh call
4. Check: memory files updated for milestones (PRs merged, test counts, features shipped)
5. Post any missing captures immediately

After sweep, continue your work normally.
SWEEP
fi

exit 0
