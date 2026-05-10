#!/usr/bin/env bash
# Append a one-liner to .remember/now.md after every git commit
# Runs as PostToolUse hook on Bash — checks if a commit just happened

# Only run in projects with .remember/
NOW_FILE="$PWD/.remember/now.md"
[ -f "$NOW_FILE" ] || exit 0

# Only act if the tool input looks like a git commit
TOOL_INPUT="${CLAUDE_TOOL_INPUT:-}"
case "$TOOL_INPUT" in
  *"git commit"*) ;;
  *) exit 0 ;;
esac

# Get the latest commit (just made)
HASH=$(git log -1 --format="%h" 2>/dev/null) || exit 0
MSG=$(git log -1 --format="%s" 2>/dev/null) || exit 0
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "?")
TIME=$(date +%H:%M)

echo "" >> "$NOW_FILE"
echo "## ${TIME} | ${BRANCH} | ${HASH}" >> "$NOW_FILE"
echo "${MSG}" >> "$NOW_FILE"
echo "" >> "$NOW_FILE"

exit 0
