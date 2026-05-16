#!/usr/bin/env bash
# Hook: Enforce /ship workflow — block code edits unless /ship has reached Phase 4 (Build).
# /ship is a 7-phase feature shipping workflow. Phases 1-3 are planning.
# No code gets written until planning is complete and approved.

SHIP_STATE=".claude/ship-state.md"

# Only enforce in the portage project
if [[ "$(pwd)" != *"/DHG/portage"* ]]; then
  exit 0
fi

# Allow edits to .claude/ itself (hooks, settings, ship state, memory)
FILE="${TOOL_INPUT_FILE:-}"
if [[ "$FILE" == *".claude/"* ]]; then
  exit 0
fi

# Allow documentation, style guides, and static assets (not code)
if [[ "$FILE" == *"website/docs/"* || "$FILE" == *"website/static/"* || "$FILE" == *".remember/"* ]]; then
  exit 0
fi

# /ship has not been started — block
if [[ ! -f "$SHIP_STATE" ]]; then
  echo "BLOCKED: Run /ship before writing any code."
  echo ""
  echo "  /ship is required for all feature work in this project."
  echo "  Type: /ship <feature description>"
  exit 1
fi

PHASE=$(grep -oP 'phase:\s*\K[0-9]+' "$SHIP_STATE" 2>/dev/null || echo "0")
STATUS=$(grep -oP 'status:\s*\K\w+' "$SHIP_STATE" 2>/dev/null || echo "none")

# Previous /ship completed — need a new one for new work
if [[ "$STATUS" == "complete" ]]; then
  echo "BLOCKED: Previous /ship is complete. Start a new /ship for new work."
  echo ""
  echo "  Type: /ship <feature description>"
  exit 1
fi

# /ship is in planning phases (1-3) — no code yet
if [[ "$PHASE" -lt 4 ]]; then
  echo "BLOCKED: /ship is in Phase $PHASE — still planning. No code until Phase 4."
  echo ""
  echo "  Complete planning (Phases 1-3) and get approval to build."
  echo "  Phase 1: Brainstorm  Phase 2: Explore  Phase 3: Plan"
  echo "  Phase 4: Build ← code allowed here"
  exit 1
fi

# /ship Phase 4+ and in_progress — code is allowed
exit 0
