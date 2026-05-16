#!/usr/bin/env bash
# Post a correction event to the DHG Registry API
# Usage: post-correction.sh <json-payload>
#
# Example:
#   post-correction.sh '{"project_name":"portage","category":"fabrication","user_message":"that file does not exist","context":"Claude referenced non-existent route","claude_action":"Read actual routes dir first","tags":["fabrication"],"model_name":"claude-opus-4-6"}'

set -euo pipefail

REGISTRY_URL="${REGISTRY_URL:-http://10.0.0.251:8011}"
ENDPOINT="${REGISTRY_URL}/api/corrections"

payload="${1:-}"
[ -z "$payload" ] && exit 0

response=$(curl -s -w "\n%{http_code}" -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "$payload" \
  --connect-timeout 2 \
  --max-time 5 2>/dev/null) || {
  echo "correction-capture: registry unreachable" >&2
  exit 0
}

http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | head -n -1)

if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
  id=$(echo "$body" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "correction captured: $id"
else
  echo "correction-capture: HTTP $http_code" >&2
fi
