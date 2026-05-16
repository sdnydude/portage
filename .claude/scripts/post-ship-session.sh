#!/usr/bin/env bash
# Post a ship session to the DHG Registry API
# Usage: post-ship-session.sh <json-payload>
# The payload is a JSON string with required fields: project_name, feature
#
# Example:
#   post-ship-session.sh '{"project_name":"portage","feature":"JWT auto-refresh","status":"complete","commits":["3f71868"]}'

set -euo pipefail

REGISTRY_URL="${REGISTRY_URL:-http://10.0.0.251:8011}"
ENDPOINT="${REGISTRY_URL}/api/ship-sessions"

payload="${1:-}"
[ -z "$payload" ] && exit 0

# Fire-and-forget POST — don't block the session on failure
response=$(curl -s -w "\n%{http_code}" -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "$payload" \
  --connect-timeout 2 \
  --max-time 5 2>/dev/null) || {
  echo "ship-session-capture: registry unreachable" >&2
  exit 0
}

http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | head -n -1)

if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
  id=$(echo "$body" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "ship-session captured: $id"
  # Regenerate ship-log docs async — never blocks the session
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  ( "$SCRIPT_DIR/generate-ship-log.sh" >/dev/null 2>&1 & )
else
  echo "ship-session-capture: HTTP $http_code" >&2
fi
