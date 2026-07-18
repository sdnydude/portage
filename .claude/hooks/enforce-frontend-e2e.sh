#!/usr/bin/env bash
# PreToolUse(Bash) hook — frontend e2e enforcement.
#
# Blocks `git push` of apps/web changes unless BOTH hold:
#   1. the running portage-app container was built from HEAD (freshness), and
#   2. the deterministic Playwright e2e passes against the real :3002.
#
# This is enforcement, not advice: exit 2 blocks the tool call and feeds the
# reason back. It NEVER rebuilds the live stack itself — a stale app yields a
# block with the explicit (safe, canonical-dir) rebuild command to run.
set -uo pipefail

REPO="/home/swebber64/DHG/portage"
APP_URL="http://10.0.0.251:3002"

TOOL_INPUT="${CLAUDE_TOOL_INPUT:-}"
[ -z "$TOOL_INPUT" ] && exit 0

CMD=$(printf '%s' "$TOOL_INPUT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('command',''))" 2>/dev/null || echo "")
# Only act on git push commands.
printf '%s' "$CMD" | grep -Eq '\bgit\b.*\bpush\b' || exit 0

# Hard-pin the canonical dir (the foreign-dir rebuild is what caused an outage).
cd "$REPO" 2>/dev/null || exit 0

# Are unpushed commits touching apps/web? Fail TOWARD enforcement on ambiguity.
BASE=$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || echo "origin/main")
if CHANGED=$(git diff --name-only "$BASE"..HEAD -- apps/web/ 2>/dev/null); then
  [ -z "$CHANGED" ] && exit 0   # confidently no apps/web changes being pushed
fi

HEAD_SHA=$(git rev-parse HEAD 2>/dev/null || echo "")
RUNNING_SHA=$(curl -s --max-time 5 "$APP_URL/api/version" \
  | python3 -c "import json,sys; print(json.load(sys.stdin).get('sha',''))" 2>/dev/null || echo "")

if [ -z "$RUNNING_SHA" ] || [ "$RUNNING_SHA" != "$HEAD_SHA" ]; then
  cat >&2 <<EOF
BLOCKED (frontend-e2e): portage-app is stale or unreachable.
  running: '${RUNNING_SHA:-none}'
  HEAD:    '${HEAD_SHA}'
The e2e must run against the CURRENT code. Rebuild (safe, canonical dir, app only):

  cd $REPO && GIT_SHA=\$(git rev-parse HEAD) docker compose up -d --build --no-deps portage-app

then retry the push.
EOF
  exit 2
fi

# App is fresh — run the deterministic e2e against the real :3002.
LOG=$(mktemp)
if ! npm run test:e2e -w apps/web >"$LOG" 2>&1; then
  {
    echo "BLOCKED (frontend-e2e): e2e FAILED against $APP_URL — do not push broken frontend."
    echo "--- last 30 lines ---"
    tail -30 "$LOG"
  } >&2
  rm -f "$LOG"
  exit 2
fi
rm -f "$LOG"
exit 0
