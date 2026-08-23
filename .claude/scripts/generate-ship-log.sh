#!/usr/bin/env bash
# Ship-log generator wrapper — logic lives in .claude/scripts/shiplog/gen.py (tested).
# Usage: generate-ship-log.sh [--check|--prune] [project_name] [output_dir]
#   --check  write nothing; exit 1 on drift: a session with no page, a matched
#            page lacking registry_id, or an orphaned generated page
#            (CI drift gate — git is the source of truth for pages).
#   --prune  also delete orphaned generated pages (otherwise only reported).
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHECK=()
case "${1:-}" in --check|--prune) CHECK=("$1"); shift;; esac
PROJECT="${1:-portage}"
OUTPUT_DIR="${2:-$HERE/../../website/docs/ship-log}"
exec python3 "$HERE/shiplog/gen.py" "${CHECK[@]}" --project "$PROJECT" --out "$OUTPUT_DIR" --registry "${REGISTRY_URL:-http://10.0.0.251:8011}"
