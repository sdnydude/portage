#!/usr/bin/env bash
# SessionStart hook: reset tool call counter + check for crashed previous session
PROJECT_DIR="$(cd "$(dirname "$0")/../.." 2>/dev/null && pwd)" || PROJECT_DIR="/home/swebber64/DHG/portage"
SESSION_ID="${CLAUDE_SESSION_ID:-default}"
MANIFEST="$PROJECT_DIR/.claude/session-manifest.json"

# Check for unclean previous session
if [ -f "$MANIFEST" ]; then
  CLEAN=$(python3 -c "import json;print(json.load(open('$MANIFEST')).get('clean_shutdown',False))" 2>/dev/null || echo "True")
  if [ "$CLEAN" = "False" ]; then
    PREV_BRANCH=$(python3 -c "import json;print(json.load(open('$MANIFEST')).get('branch','unknown'))" 2>/dev/null || echo "unknown")
    PREV_CALLS=$(python3 -c "import json;print(json.load(open('$MANIFEST')).get('tool_calls',0))" 2>/dev/null || echo "0")
    PREV_SWEPT=$(python3 -c "import json;print(json.load(open('$MANIFEST')).get('sweep_fired',False))" 2>/dev/null || echo "False")
    PREV_LAST=$(python3 -c "import json;print(json.load(open('$MANIFEST')).get('last_active','unknown'))" 2>/dev/null || echo "unknown")

    cat <<EOF
⚠️ PREVIOUS SESSION CRASHED (no clean shutdown detected)
  Branch: ${PREV_BRANCH}
  Tool calls: ${PREV_CALLS}
  Capture sweep ran: ${PREV_SWEPT}
  Last active: ${PREV_LAST}

ACTION REQUIRED: Check for uncaptured items from the previous session:
1. Read .claude/ship-state.md — was a /ship run in progress? If complete but not captured, post it.
2. Check git log for recent commits — any decisions or milestones not in registry?
3. Update memory files if the previous session made progress (PRs merged, tests added, features shipped).
4. Post any missing insights, decisions, or ship sessions to registry.
EOF
  fi
fi

# Reset counter for new session
rm -f "/tmp/claude-toolcalls-${SESSION_ID}" "/tmp/claude-sweep-fired-${SESSION_ID}" 2>/dev/null

# Clear old manifest — this session will create its own
rm -f "$MANIFEST" 2>/dev/null

exit 0
