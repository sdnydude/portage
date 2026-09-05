#!/usr/bin/env bash
# Helper for review-before-commit.sh (Stephen, 2026-08-05).
#
# Writes the adversarial-review record for the CURRENTLY STAGED diff, keyed by
# its sha256 so the record cannot be recycled onto different changes.
#
#   .claude/hooks/record-review.sh <<'EOF'
#   <reviewer findings, verdict, what was fixed>
#   EOF
#
# Findings must come from an actual review pass (code-reviewer subagent or
# /code-review) over the staged changes — an empty or fabricated record defeats
# the gate it is meant to satisfy.
set -euo pipefail

repo="${CLAUDE_PROJECT_DIR:-$PWD}"
cd "$repo"

staged="$(git diff --cached)"
if [ -z "$staged" ]; then
  echo "record-review: nothing staged — stage the changes you reviewed first" >&2
  exit 1
fi

body="$(cat)"
if [ "$(printf '%s' "$body" | tr -d '[:space:]' | wc -c)" -lt 40 ]; then
  echo "record-review: refusing to write an empty/trivial review record" >&2
  exit 1
fi

hash="$(printf '%s' "$staged" | sha256sum | cut -d' ' -f1)"
dir="$repo/.claude/review-records"
mkdir -p "$dir"

{
  echo "# Review record"
  echo
  echo "- diff-sha256: \`$hash\`"
  echo "- recorded-at: $(date -Iseconds)"
  echo "- files:"
  git diff --cached --name-only | sed 's/^/  - /'
  echo
  echo "## Findings"
  echo
  printf '%s\n' "$body"
} > "$dir/$hash.md"

echo "review recorded: .claude/review-records/$hash.md"
