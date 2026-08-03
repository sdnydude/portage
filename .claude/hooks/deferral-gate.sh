#!/usr/bin/env bash
# PreToolUse gate (Stephen, 2026-08-03): every deferred-item capture must be
# operator-confirmed. Deferring plan scope without approval broke live eBay
# behavior for 18 hours — the capture script no longer fire-and-forgets.
set -euo pipefail

input="$(cat)"

command="$(
  printf '%s' "$input" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' \
    2>/dev/null || true
)"

case "$command" in
  *post-deferred-items.sh*)
    cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"DEFERRAL GATE: capturing a deferred item. Standing rule (2026-08-03): NOTHING in a plan/spec/doc may be deferred without Stephen's explicit per-item approval carrying a technical must-defer rationale. Approve ONLY if this specific deferral was already approved by name."}}
JSON
    ;;
esac

exit 0
