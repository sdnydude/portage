#!/usr/bin/env bash
# PreToolUse gate (Stephen, 2026-08-03; hardened 2026-08-05).
#
# 2026-08-03: every deferred-item capture must be operator-confirmed. Deferring
# plan scope without approval broke live eBay behavior for 18 hours.
#
# 2026-08-05: the original gate emitted "ask" and Claude filed 5 deferrals in a
# single session anyway — an "ask" is swallowed under an auto-approve posture,
# and the prompt named no item, so there was nothing to evaluate. Now:
#   - a bare capture is DENIED (deny cannot be auto-approved)
#   - a capture carrying DEFERRAL_APPROVED= raises an "ask" that prints the
#     item's TITLE and REASON, so the decision is itemized and visible
# The intended flow: put the item in the visible answer with a recommendation,
# get Stephen's explicit yes, then re-run the capture with DEFERRAL_APPROVED=1.
set -euo pipefail

input="$(cat)"

command="$(
  printf '%s' "$input" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' \
    2>/dev/null || true
)"

case "$command" in
  *post-deferred-items.sh*) ;;
  *) exit 0 ;;
esac

python3 - "$command" <<'PY'
import json, re, sys

cmd = sys.argv[1]
# Positional check (review 2026-08-10): the old `"DEFERRAL_APPROVED=" in cmd`
# substring test flipped the gate from deny to ask when the JSON payload merely
# MENTIONED the flag (e.g. a title describing the approval flow). The flag only
# counts as an env-var assignment prefixing the invocation.
approved = re.match(
    r'\s*(env\s+)?([A-Za-z_][A-Za-z0-9_]*=\S*\s+)*DEFERRAL_APPROVED=1(\s|$)', cmd,
) is not None

def field(name: str) -> str:
    m = re.search(rf'"{name}"\s*:\s*"((?:[^"\\]|\\.)*)"', cmd)
    return (m.group(1)[:180] if m else "(not parsed)")

title, reason = field("title"), field("reason")

if approved:
    out = {"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "ask",
        "permissionDecisionReason": (
            "DEFERRAL APPROVAL — confirm this specific item:\n"
            f"  TITLE : {title}\n"
            f"  REASON: {reason}\n\n"
            "Approve ONLY if you said yes to THIS item in the conversation. "
            "Standing rule 2026-08-03: no deferral without per-item approval and a "
            "technical must-defer rationale (convenience rationales are auto-rejected)."
        ),
    }}
else:
    out = {"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": (
            "DEFERRAL GATE (deny): deferred items may not be filed silently.\n"
            f"  Attempted TITLE: {title}\n\n"
            "Required flow: state the item in your VISIBLE ANSWER with a recommendation "
            "(do now / not for beta / genuinely blocked + why), get Stephen's explicit yes, "
            "then re-run this capture with DEFERRAL_APPROVED=1 prefixed so he can confirm "
            "the specific item. Filing without him seeing it in an answer is the violation "
            "this gate exists to stop (5 such filings on 2026-08-05)."
        ),
    }}

print(json.dumps(out))
PY
exit 0
