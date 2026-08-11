#!/usr/bin/env bash
# PreToolUse gate (Stephen, 2026-08-05): "ADD A HOOK THAT YOU MUST RUN A
# CODE REVIEW ON EACH PR BEFORE EACH COMMIT."
#
# Blocks `git commit` unless an adversarial review record exists for the EXACT
# staged diff. The record is keyed by the sha256 of `git diff --cached`, so it
# cannot be recycled across changes: edit one line after reviewing and the key
# changes, the record no longer matches, and the commit is blocked again.
#
# To satisfy it: run the review (code-reviewer subagent or /code-review), then
# write the findings to .claude/review-records/<hash>.md. Helper:
#   .claude/hooks/record-review.sh  (writes the record for the current staged diff)
set -euo pipefail

input="$(cat)"

command="$(
  printf '%s' "$input" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' \
    2>/dev/null || true
)"

# Token-level detection (review 2026-08-10): the old substring `case` missed
# `git -C /repo commit` / `git -c k=v commit`, and its *--amend* exemption
# matched "--amend" anywhere — including inside a quoted -m message — turning
# the exemption into a bypass. shlex + subcommand walk closes both.
verdict="$(
  python3 - "$command" <<'PY'
import shlex, sys

cmd = sys.argv[1]
try:
    tokens = shlex.split(cmd)
except ValueError:
    tokens = cmd.split()

# Git global options that consume a following value.
VALUED = {"-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path"}

def subcommand_span(tokens, gi):
    """Return (subcommand, args) for the git invocation starting at tokens[gi]."""
    i = gi + 1
    while i < len(tokens):
        t = tokens[i]
        if t in VALUED:
            i += 2
            continue
        if t.startswith("-"):
            i += 1
            continue
        return t, tokens[i + 1:]
    return None, []

gate = False
for gi, tok in enumerate(tokens):
    if tok != "git":
        continue
    sub, args = subcommand_span(tokens, gi)
    if sub != "commit":
        continue
    # Amend rewrites an already-reviewed commit — exempt only when --amend is a
    # real argument token (a quoted -m message is ONE token here, so "--amend"
    # inside a message can no longer trip the exemption). Stop scanning this
    # invocation's args at a shell operator token.
    amend = False
    for a in args:
        if a in ("&&", "||", ";", "|"):
            break
        if a == "--amend":
            amend = True
            break
    if not amend:
        gate = True
print("gate" if gate else "skip")
PY
)"
[ "$verdict" = "gate" ] || exit 0

repo="${CLAUDE_PROJECT_DIR:-$PWD}"
cd "$repo" 2>/dev/null || exit 0

staged="$(git diff --cached 2>/dev/null || true)"
[ -z "$staged" ] && exit 0   # nothing staged — let git produce its own error

# Reviewable surface = anything executable or supply-chain-shaped, not just
# app source: CI workflows run on the self-hosted runner, package.json swaps
# dependencies, compose/Dockerfile change what runs in prod (review 2026-08-10).
# Prose-only commits (md/txt/images) stay exempt.
code_files="$(git diff --cached --name-only 2>/dev/null \
  | grep -E '\.(ts|tsx|js|jsx|mjs|cjs|sql|sh|py|ya?ml)$|(^|/)Dockerfile[^/]*$|(^|/)package(-lock)?\.json$|(^|/)docker-compose[^/]*$' || true)"
[ -z "$code_files" ] && exit 0

hash="$(printf '%s' "$staged" | sha256sum | cut -d' ' -f1)"
record="$repo/.claude/review-records/$hash.md"

if [ -f "$record" ]; then
  exit 0
fi

python3 - "$hash" "$code_files" <<'PY'
import json, sys
h, files = sys.argv[1], sys.argv[2].replace("\n", ", ")
msg = (
    "REVIEW GATE: this commit has no adversarial review record for its staged diff.\n"
    f"Staged code files: {files}\n"
    f"Required record: .claude/review-records/{h}.md\n\n"
    "Run a real review of the staged changes (code-reviewer subagent or /code-review), "
    "then write the findings to that path and commit again. The key is the sha256 of the "
    "staged diff, so a record written for a different diff will not satisfy this gate.\n"
    "Approve ONLY if Stephen is explicitly waiving review for this specific commit."
)
print(json.dumps({"hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "ask",
    "permissionDecisionReason": msg,
}}))
PY
exit 0
