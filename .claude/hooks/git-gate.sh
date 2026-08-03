#!/usr/bin/env bash
# PreToolUse gate (Stephen, 2026-08-03): git state changes require per-action
# operator approval. Commit/push/PR-create/PR-merge each force a confirmation
# prompt — "auto mode" covers building and read-only ops, never publication.
set -euo pipefail

input="$(cat)"

command="$(
  printf '%s' "$input" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' \
    2>/dev/null || true
)"

ask() {
  local reason="$1"
  python3 - "$reason" <<'PY'
import json, sys
print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "ask", "permissionDecisionReason": sys.argv[1]}}))
PY
  exit 0
}

case "$command" in
  *PROOF_WAIVED=*)
    ask "PROOF-WAIVER GATE: this command self-waives proof-before-push (PROOF_WAIVED=). The waiver is Stephen's alone (standing rule 2026-08-03) — approve ONLY if you are explicitly granting this specific waiver; otherwise deny and require proof screenshots." ;;
  *"git commit"*|*"git-commit"*)
    ask "GIT GATE: commit requires Stephen's approval for this specific commit (standing rule 2026-08-03)." ;;
  *"git push"*)
    ask "GIT GATE: push requires Stephen's approval for this specific push (standing rule 2026-08-03)." ;;
  *"gh pr create"*)
    ask "GIT GATE: PR creation requires Stephen's approval (standing rule 2026-08-03)." ;;
  *"gh pr merge"*)
    ask "GIT GATE: PR MERGE requires Stephen's approval (standing rule 2026-08-03)." ;;
esac

exit 0
