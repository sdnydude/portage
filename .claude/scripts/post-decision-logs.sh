#!/usr/bin/env bash
# Post a decision log to the DHG Registry API
# Usage: post-decision-logs.sh <json-payload>
# The payload is a JSON string with required fields: title, choice, rationale, domain, project_name
#
# Example:
#   post-decision-logs.sh '{"title":"Use Drizzle over Prisma","choice":"Drizzle ORM","alternatives_rejected":"Prisma, TypeORM","rationale":"Better SQL control and lighter runtime","domain":"api","project_name":"portage"}'

set -euo pipefail

REGISTRY_URL="${REGISTRY_URL:-http://10.0.0.251:8011}"
ENDPOINT="${REGISTRY_URL}/api/decision-logs"

payload="${1:-}"
[ -z "$payload" ] && exit 0

# Fire-and-forget POST — don't block the session on failure
response=$(curl -s -w "\n%{http_code}" -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "$payload" \
  --connect-timeout 2 \
  --max-time 5 2>/dev/null) || {
  echo "decision-log-capture: registry unreachable" >&2
  exit 0
}

http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | head -n -1)

if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
  id=$(echo "$body" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "decision-log captured: $id"
else
  echo "decision-log-capture: HTTP $http_code" >&2
fi
