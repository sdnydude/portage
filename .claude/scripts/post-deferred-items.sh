#!/usr/bin/env bash
# Post a deferred item to the DHG Registry API
# Usage: post-deferred-items.sh <json-payload>
# Required fields: title, description, reason, category, project_name
#
# Example:
#   post-deferred-items.sh '{"title":"Add rate limiting to marketplace sync endpoints","description":"Marketplace sync endpoints have no rate limiting — a misbehaving client could hammer eBay/Etsy APIs and exhaust quota","reason":"Out of scope for current /ship — security hardening PR only covers auth","source_context":"PR #28 security hardening","priority":"medium","category":"api","project_name":"portage","affected_files":["apps/api/src/routes/marketplace-sync.ts"],"tags":["rate-limiting","marketplace","security"],"model_name":"claude-opus-4-6"}'

set -euo pipefail

REGISTRY_URL="${REGISTRY_URL:-http://10.0.0.251:8011}"
ENDPOINT="${REGISTRY_URL}/api/deferred-items"

payload="${1:-}"
[ -z "$payload" ] && exit 0

response=$(curl -s -w "\n%{http_code}" -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "$payload" \
  --connect-timeout 2 \
  --max-time 5 2>/dev/null) || {
  echo "deferred-items-capture: registry unreachable" >&2
  exit 0
}

http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | head -n -1)

if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
  id=$(echo "$body" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "deferred-item captured: $id"
else
  echo "deferred-items-capture: HTTP $http_code" >&2
fi
