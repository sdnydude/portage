#!/usr/bin/env bash
# Post a bug fix / root cause analysis to the DHG Registry API
# Usage: post-bug-fixes.sh <json-payload>
# Required fields: tldr, symptom, root_cause, fix_applied, severity, category, project_name
#
# Example:
#   post-bug-fixes.sh '{"tldr":"JWT refresh race condition","symptom":"Users logged out mid-session","root_cause":"Concurrent refresh requests invalidated each other","fix_applied":"Added mutex lock around token refresh","severity":"high","category":"auth","project_name":"portage","tags":["jwt","auth"],"model_name":"claude-opus-4-6"}'

set -euo pipefail

REGISTRY_URL="${REGISTRY_URL:-http://10.0.0.251:8011}"
ENDPOINT="${REGISTRY_URL}/api/bug-fixes"

payload="${1:-}"
[ -z "$payload" ] && exit 0

response=$(curl -s -w "\n%{http_code}" -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "$payload" \
  --connect-timeout 2 \
  --max-time 5 2>/dev/null) || {
  echo "bug-fixes-capture: registry unreachable" >&2
  exit 0
}

http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | head -n -1)

if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
  id=$(echo "$body" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "bug-fix captured: $id"
else
  echo "bug-fixes-capture: HTTP $http_code" >&2
fi
