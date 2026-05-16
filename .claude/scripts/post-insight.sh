#!/usr/bin/env bash
# Post an insight to the DHG Registry API
# Usage: post-insight.sh <json-payload>
# The payload is a JSON string with required fields: tldr, insight_statement, project_name, category
#
# Example:
#   post-insight.sh '{"tldr":"...", "insight_statement":"...", "project_name":"portage", "category":"testing"}'

set -euo pipefail

REGISTRY_URL="${REGISTRY_URL:-http://10.0.0.251:8011}"
ENDPOINT="${REGISTRY_URL}/api/insights"

payload="${1:-}"
[ -z "$payload" ] && exit 0

# Fire-and-forget POST — don't block the session on failure
response=$(curl -s -w "\n%{http_code}" -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "$payload" \
  --connect-timeout 2 \
  --max-time 5 2>/dev/null) || {
  echo "insight-capture: registry unreachable" >&2
  exit 0
}

http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | head -n -1)

if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
  id=$(echo "$body" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "insight captured: $id"
else
  echo "insight-capture: HTTP $http_code" >&2
fi
