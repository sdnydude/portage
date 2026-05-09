#!/usr/bin/env bash
# PreToolUse hook: checks port availability before starting servers
# Intercepts Bash commands that look like server starts and warns if ports are occupied

set -euo pipefail

TOOL_INPUT="${CLAUDE_TOOL_INPUT:-}"
if [ -z "$TOOL_INPUT" ]; then
  exit 0
fi

CMD=$(echo "$TOOL_INPUT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('command',''))" 2>/dev/null || echo "")
if [ -z "$CMD" ]; then
  exit 0
fi

declare -A PORT_MAP=(
  ["dev:api"]=8016
  ["dev:web"]=3002
  ["portage-api"]=8016
  ["portage-app"]=3002
  ["portage-db"]=5436
)

check_port() {
  local port=$1
  local pid
  pid=$(lsof -ti :"$port" 2>/dev/null | head -1 || true)
  if [ -z "$pid" ]; then
    pid=$(ss -tlnp "sport = :$port" 2>/dev/null | grep -oP 'pid=\K\d+' | head -1 || true)
  fi
  if [ -n "$pid" ]; then
    local cmd
    cmd=$(ps -p "$pid" -o cmd= 2>/dev/null | head -c 120 || true)
    echo "BLOCK: Port $port is already in use by PID $pid ($cmd). Kill it first: kill $pid"
    exit 0
  fi
}

for pattern in "${!PORT_MAP[@]}"; do
  if echo "$CMD" | grep -q "$pattern"; then
    check_port "${PORT_MAP[$pattern]}"
  fi
done

if echo "$CMD" | grep -qE '(npm run dev|node.*index|tsx.*index|next dev|docker compose up)'; then
  for port in 8016 3002; do
    if echo "$CMD" | grep -qE '(dev:api|portage-api|src/index)' && [ "$port" = 8016 ]; then
      check_port "$port"
    elif echo "$CMD" | grep -qE '(dev:web|portage-app|next)' && [ "$port" = 3002 ]; then
      check_port "$port"
    elif echo "$CMD" | grep -qE '(docker compose up)' && ! echo "$CMD" | grep -q -- '-d'; then
      check_port "$port"
    fi
  done
fi

if echo "$CMD" | grep -qoP -- '--port[= ]\K\d+|(?<=-p )\d+(?=:)|:(\d+)->' | head -1 | grep -qP '\d+'; then
  EXPLICIT_PORT=$(echo "$CMD" | grep -oP -- '--port[= ]\K\d+' | head -1)
  if [ -n "$EXPLICIT_PORT" ]; then
    check_port "$EXPLICIT_PORT"
  fi
fi

exit 0
