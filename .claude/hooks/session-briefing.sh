#!/usr/bin/env bash
# Session briefing hook — prints structured context for Claude Code at session start
# Runs on SessionStart hook — outputs recent sessions and project state

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_DIR"

echo "=== SESSION BRIEFING ==="

# Freshness indicator
(
  LAST_SYNC="$PROJECT_DIR/.remember/.last-full-sync"
  if [ -f "$LAST_SYNC" ]; then
    echo "Last full sync: $(cat "$LAST_SYNC")"
  else
    echo "Last full sync: never (run /sync-memory)"
  fi
) || true
echo ""

# --- Section 1: Recent Sessions from registry API ---
(
  REGISTRY_URL="http://10.0.0.251:8011/api/agent-sessions?project=portage&limit=3"
  RAW=$(curl -s --connect-timeout 3 --max-time 5 "$REGISTRY_URL" 2>/dev/null)

  if [ -z "$RAW" ]; then
    exit 0
  fi

  if command -v jq &>/dev/null; then
    OUTPUT=$(printf '%s' "$RAW" \
      | jq -r '.sessions[] | "\(.ended_at // "unknown") — \(.tldr // "no tldr")"' 2>/dev/null)
  else
    OUTPUT=$(printf '%s' "$RAW" | python3 -c '
import sys, json
try:
    data = json.loads(sys.stdin.read())
    for s in data.get("sessions", []):
        ended = s.get("ended_at") or "unknown"
        tldr  = s.get("tldr")    or "no tldr"
        print(f"{ended} — {tldr}")
except Exception:
    pass
' 2>/dev/null)
  fi

  if [ -n "$OUTPUT" ]; then
    echo "--- Recent Sessions ---"
    echo "$OUTPUT"
    echo ""
  fi
) || true

# --- Section 2: Recent Activity (7-day rolling) ---
(
  RECENT_FILE="$PROJECT_DIR/.remember/recent.md"
  if [ -f "$RECENT_FILE" ] && [ -s "$RECENT_FILE" ]; then
    echo "--- Recent Activity (7-day) ---"
    cat "$RECENT_FILE"
    echo ""
  fi
) || true

# --- Section 3: Today's Journal ---
(
  TODAY_FILE="$PROJECT_DIR/.remember/today-$(date +%Y-%m-%d).md"
  if [ -f "$TODAY_FILE" ] && [ -s "$TODAY_FILE" ]; then
    echo "--- Today's Journal ---"
    cat "$TODAY_FILE"
    echo ""
  fi
) || true

# --- Section 4: Decision Log ---
(
  DECISIONS_FILE="$HOME/.claude/projects/-home-swebber64-DHG-portage/memory/decisions_index.md"
  if [ -f "$DECISIONS_FILE" ] && [ -s "$DECISIONS_FILE" ]; then
    echo "--- Decision Log ---"
    cat "$DECISIONS_FILE"
    echo ""
  fi
) || true

# --- Section 5: Git State ---
(
  BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
  if [ -n "$BRANCH" ]; then
    echo "--- Git State ---"
    echo "Branch: $BRANCH"
    git log --oneline -5 2>/dev/null
    echo ""
  fi
) || true

# --- Section 6: Progress ---
(
  TODO_FILE="$PROJECT_DIR/docs/TODO.md"
  if [ -f "$TODO_FILE" ]; then
    PROGRESS=$(grep "^## Phase" "$TODO_FILE" 2>/dev/null)
    if [ -n "$PROGRESS" ]; then
      echo "--- Progress ---"
      echo "$PROGRESS"
      echo ""
    fi
  fi
) || true

# --- Section 7: Memory Intelligence ---
(
  MEMORY_DIR="$HOME/.claude/projects/-home-swebber64-DHG-portage/memory"

  # Hot areas
  HOT_FILES=$(find "$MEMORY_DIR" -name "project_pattern_hotarea_*.md" 2>/dev/null)
  if [ -n "$HOT_FILES" ]; then
    echo "--- Hot Areas ---"
    for f in $HOT_FILES; do
      NAME=$(grep "^name:" "$f" 2>/dev/null | head -1 | sed 's/^name: //')
      TAG=$(grep "^\*\*Tag:" "$f" 2>/dev/null | head -1)
      if [ -n "$NAME" ]; then
        echo "$NAME"
        [ -n "$TAG" ] && echo "  $TAG"
      fi
    done
    echo ""
  fi

  # Unfinished work
  UNFINISHED="$MEMORY_DIR/project_pattern_unfinished.md"
  if [ -f "$UNFINISHED" ] && [ -s "$UNFINISHED" ]; then
    echo "--- Unfinished Work ---"
    grep "^-" "$UNFINISHED"
    echo ""
  fi

  # Workflow trend alert
  WORKFLOW="$MEMORY_DIR/project_pattern_workflow.md"
  if [ -f "$WORKFLOW" ]; then
    TREND=$(grep "^\*\*Trend:" "$WORKFLOW" 2>/dev/null)
    if [ -n "$TREND" ]; then
      echo "--- Workflow Alert ---"
      echo "$TREND"
      echo ""
    fi
  fi
) || true

echo "=== END BRIEFING ==="
