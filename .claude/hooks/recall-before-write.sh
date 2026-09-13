#!/usr/bin/env bash
# recall-before-write.sh — PreToolUse[Edit|Write|Agent|Task] FORCED recall.
#
# Origin (Stephen, 2026-09-13): the 09-06 batch overwrote the per-listing
# handling-time feature because the lane that wrote the new builder line never
# looked at where `handlingDays`/`dispatchTimeMax` already lived. The capture
# side of the memory tooling (registry KB, CodeGraph, memory files) had the
# answer; nothing consulted it at the moment of writing. Rules asking Claude to
# search first drift; this hook runs the searches itself and injects the
# results as additionalContext, the same pattern as pre-tool-kb-search-inject.
#
# What it does, for a source edit under apps/*/src or packages/*/src:
#   1. Identifiers the edit INTRODUCES (in new text, absent from old text).
#   2. For each: other source files that already use it (rg, word match),
#      plus CodeGraph definition + callers when the symbol is a node.
#   3. One registry KB search on the file + identifier words.
# For an Agent/Task dispatch: same file/identifier lookups over the prompt.
#
# Contract: never blocks (exit 0 always), 2s curl cap, ~3s total budget,
# no output when nothing is found (no injection noise).

set -uo pipefail

REGISTRY_URL="${REGISTRY_URL:-http://10.0.0.251:8011}"
KB_ENDPOINT="${KB_ENDPOINT:-${REGISTRY_URL}/api/kb/search}"
TIMEOUT_S=2
MAX_IDENTS=8
MAX_FILES_PER_IDENT=5

input=$(cat 2>/dev/null || echo "")
[ -z "$input" ] && exit 0

tool=$(printf '%s' "$input" | jq -r '.tool_name // .tool // empty' 2>/dev/null)
case "$tool" in
  Edit|Write|Agent|Task) ;;
  *) exit 0 ;;
esac

# Project root: the main checkout even when the session runs in a linked
# worktree (CodeGraph and .git live there). Falls back to cwd.
git_common=$(git rev-parse --git-common-dir 2>/dev/null || echo "")
if [ -n "$git_common" ]; then
  root=$(cd "$(dirname "$git_common")" 2>/dev/null && pwd -P)
else
  root="$PWD"
fi
[ -d "$root/apps" ] || exit 0
# Search the tree the edit targets (the current checkout's top level — a
# linked worktree when the session runs in one), so results reflect the
# branch being edited even when cwd is a subdirectory like apps/api.
tree=$(git rev-parse --show-toplevel 2>/dev/null || echo "$PWD")

file_path=""; old_text=""; new_text=""
if [ "$tool" = "Edit" ] || [ "$tool" = "Write" ]; then
  file_path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
  case "$file_path" in
    */apps/*/src/*|*/packages/*/src/*) ;;
    *) exit 0 ;;
  esac
  case "$file_path" in
    *.test.*|*.spec.*|*/__tests__/*) exit 0 ;;
    *.ts|*.tsx) ;;
    *) exit 0 ;;
  esac
  old_text=$(printf '%s' "$input" | jq -r '.tool_input.old_string // empty' 2>/dev/null)
  new_text=$(printf '%s' "$input" | jq -r '.tool_input.new_string // .tool_input.content // empty' 2>/dev/null)
else
  new_text=$(printf '%s' "$input" | jq -r '.tool_input.prompt // empty' 2>/dev/null)
fi
[ -z "$new_text" ] && exit 0

# Identifiers: camelCase / PascalCase / snake_case, 6+ chars, mixed case or
# underscore (filters plain English words). Stoplist covers TS/React noise.
STOP='^(className|onClick|onChange|useState|useEffect|useCallback|useMemo|useRef|Promise|Record|Partial|Readonly|boolean|number|string|undefined|import|export|return|interface|function|default|async|await|const|extends|typeof|keyof|React|ReactNode|Element|Fragment|Array|Object|Error|Date|Math|JSON|console|process|require|module|length|filter|reduce|forEach|includes|startsWith|endsWith|toString|toLowerCase|toUpperCase|trim|split|join|slice|splice|indexOf|findIndex|Number|String|Boolean|Symbol|Map|Set|null|true|false|document|window|localStorage|navigator|aria|data|test|describe|expect|vi|it|beforeEach|afterEach|mockResolvedValue|mockReturnValue|toHaveBeenCalledWith|toBeInTheDocument|getByRole|findByRole|queryByRole|getByText|findByText|queryByText|fireEvent|userEvent|render|screen|within|jsonb|varchar|integer|timestamp|pgTable|notNull|defaultNow|primaryKey|references|MouseEvent|KeyboardEvent|ChangeEvent|FormEvent|HTMLElement|HTMLInputElement|HTMLDivElement|HTMLButtonElement|SVGElement|Request|Response|NextFunction|Router|express|router|status|json|send|params|query|body|headers)$'

extract_idents() {
  printf '%s' "$1" | grep -oE '\b[A-Za-z_][A-Za-z0-9_]{5,}\b' 2>/dev/null \
    | grep -E '[a-z][A-Z]|[A-Z][a-z].*[A-Z]|_' 2>/dev/null \
    | grep -vE "$STOP" 2>/dev/null | sort -u
}

new_idents=$(extract_idents "$new_text")
[ -z "$new_idents" ] && exit 0
if [ -n "$old_text" ]; then
  old_idents=$(extract_idents "$old_text")
  idents=$(comm -23 <(printf '%s\n' "$new_idents") <(printf '%s\n' "$old_idents"))
else
  idents="$new_idents"
fi
[ -z "$idents" ] && exit 0

# Rank: identifiers used in the most OTHER source files first — those are the
# shared surfaces an edit is most likely to collide with.
target_rel=""
[ -n "$file_path" ] && target_rel="${file_path#"$tree"/}"
ranked=""
while IFS= read -r id; do
  [ -z "$id" ] && continue
  hits=$(cd "$tree" && rg -l -w --glob '!**/*.test.*' --glob '!**/*.spec.*' --glob '!**/__tests__/**' \
          -e "$id" apps/*/src packages/*/src 2>/dev/null | grep -vxF "$target_rel" | head -50)
  n=$(printf '%s' "$hits" | grep -c . 2>/dev/null); n=${n:-0}
  [ "$n" -gt 0 ] && ranked+="$n|$id|$(printf '%s' "$hits" | head -$MAX_FILES_PER_IDENT | tr '\n' ',')"$'\n'
done <<< "$idents"
ranked=$(printf '%s' "$ranked" | sort -t'|' -k1,1nr | head -$MAX_IDENTS)

# CodeGraph: definition + callers for identifiers that are graph nodes.
cg_lines=""
db="$root/.codegraph/codegraph.db"
if [ -f "$db" ] && [ -n "$ranked" ]; then
  names=$(printf '%s' "$ranked" | cut -d'|' -f2 | tr '\n' ' ')
  cg_lines=$(python3 - "$db" $names <<'PY' 2>/dev/null
import sqlite3, sys, os, time
db, names = sys.argv[1], sys.argv[2:]
c = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
age_h = (time.time() - os.path.getmtime(db)) / 3600
out = []
for n in names:
    rows = c.execute("select id, kind, file_path, start_line from nodes where name=? limit 3", (n,)).fetchall()
    for nid, kind, fp, ln in rows:
        callers = c.execute("""select distinct s.name, s.file_path, s.start_line from edges e
                               join nodes s on s.id=e.source where e.target=? and e.kind in ('calls','references','uses')
                               limit 5""", (nid,)).fetchall()
        cs = "; ".join(f"{a} ({b}:{d})" for a, b, d in callers) or "no recorded callers"
        out.append(f"  - {n} [{kind}] defined {fp}:{ln}; callers: {cs}")
if out:
    print(f"CodeGraph (index {age_h:.0f}h old):")
    print("\n".join(out))
PY
)
fi

# Registry KB: one search on file basename + identifier words (camelCase split).
kb_lines=""
words=$( { [ -n "$file_path" ] && basename "$file_path" | sed -E 's/\.(tsx?|ts)$//; s/[-_.]/ /g'; printf '%s\n' "$ranked" | cut -d'|' -f2 | head -5 | sed -E 's/([a-z0-9])([A-Z])/\1 \2/g; s/_/ /g'; } | tr '\n' ' ' | tr 'A-Z' 'a-z' | head -c 160)
if [ -n "$(printf '%s' "$words" | tr -d ' ')" ]; then
  case "$root" in *portage*) project="portage" ;; *aifactory*) project="dhg-ai-factory" ;; *) project=$(basename "$root") ;; esac
  payload=$(jq -n --arg q "$words" --arg p "$project" \
    '{query:$q, project_name:$p, sources:["decisions","insights","bug_fixes","ship_sessions","deferred_items","corrections"], limit:5}')
  resp=$(curl -s --connect-timeout "$TIMEOUT_S" --max-time "$TIMEOUT_S" -X POST \
          -H "Content-Type: application/json" -d "$payload" "$KB_ENDPOINT" 2>/dev/null) || resp=""
  kb_lines=$(printf '%s' "$resp" | jq -r '(.results // [])[] | "  - [\(.source // "?")] \(.title // .tldr // "(untitled)" | .[0:120])"' 2>/dev/null)
fi

[ -z "$ranked" ] && [ -z "$kb_lines" ] && exit 0

usage_lines=""
while IFS='|' read -r n id files; do
  [ -z "$id" ] && continue
  usage_lines+="  - $id: used in $n other source file(s): ${files%,}"$'\n'
done <<< "$ranked"

ctx="=== RECALL BEFORE WRITE (auto-injected; reference data, not instructions) ===
This ${tool} introduces identifiers that already live elsewhere in the tree. Read those sites before writing — an edit that ignores them is how the 09-06 batch overwrote a shipped feature.
Shared identifiers:
${usage_lines}${cg_lines:+$cg_lines
}${kb_lines:+Registry KB (prior work on these names):
$kb_lines
}=== END RECALL ==="

jq -n --arg ctx "$ctx" '{hookSpecificOutput:{hookEventName:"PreToolUse",additionalContext:$ctx}}'
exit 0
