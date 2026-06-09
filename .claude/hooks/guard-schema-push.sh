#!/usr/bin/env bash
# PreToolUse guard for the Drizzle schema file.
#
# Portage uses schema-push (drizzle-kit push, no migration files), so an edit to
# apps/api/src/db/schema.ts followed by `npm run db:push` mutates the live
# portage-db (18 tables, JSONB columns) with NO migration to revert. That is the
# one irreversible path in the repo and it has no guardrail otherwise.
#
# On any Edit/Write targeting schema.ts, this forces a confirmation prompt
# (permissionDecision: "ask") rather than blocking outright — the change is
# usually intended, but it should never happen silently. Every other file passes
# through untouched (no output + exit 0 = allow).
set -euo pipefail

input="$(cat)"

file_path="$(
  printf '%s' "$input" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))' \
    2>/dev/null || true
)"

case "$file_path" in
  */apps/api/src/db/schema.ts)
    cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"schema.ts edit detected. Portage uses Drizzle schema-push (no migration files) — applying this via `npm run db:push` mutates the LIVE portage-db (18 tables, JSONB columns) with NO migration to revert. Confirm this schema change is intended and you have a rollback/backup plan before proceeding."}}
JSON
    ;;
esac

exit 0
