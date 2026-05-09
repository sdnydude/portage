# SessionStart Briefing — Design Spec

A bash hook that assembles and injects a context briefing at the start of every Claude Code session, pulling from 6 data sources to eliminate the 2-3 minutes typically spent re-orienting.

## Problem

Each Claude Code session starts cold. CLAUDE.md and auto-memory MEMORY.md are auto-loaded, but they describe the project — not what happened recently. Claude has no visibility into prior sessions, today's work journal, recent git activity, or active decisions without manually reading files. This costs 2-3 minutes of tool calls at the start of every session.

## Design

### Hook Script

`session-briefing.sh` in `.claude/hooks/`. Reads 6 data sources, prints structured text to stdout. The output lands in the conversation as a `SessionStart hook` system message that Claude sees immediately.

### Data Sources

| # | Source | Method | Fallback |
|---|--------|--------|----------|
| 1 | Last 3 session tldrs | `curl` registry API at `10.0.0.251:8011/api/agent-sessions?project=portage&limit=3` | Skip section if curl fails |
| 2 | `.remember/recent.md` | File read | Skip if missing |
| 3 | `.remember/today-YYYY-MM-DD.md` | File read (today's date) | Skip if missing (first session of day) |
| 4 | `decisions_index.md` | File read from `~/.claude/projects/-home-swebber64-DHG-portage/memory/` | Skip if missing |
| 5 | Git state | `git branch --show-current` + `git log --oneline -5` | Skip if not a git repo |
| 6 | `docs/TODO.md` progress | `grep` phase summary headers | Skip if missing |

### Output Format

```
=== SESSION BRIEFING ===

--- Recent Sessions ---
[session 1 tldr]
[session 2 tldr]
[session 3 tldr]

--- Recent Activity (7-day) ---
[contents of recent.md]

--- Today's Journal ---
[contents of today-YYYY-MM-DD.md]

--- Decision Log ---
[contents of decisions_index.md]

--- Git State ---
Branch: [current branch]
[last 5 commits, one-line format]

--- Progress ---
[TODO.md phase lines with completion counts]

=== END BRIEFING ===
```

### Failure Handling

Each section is independent — wrapped in its own block with `|| true`. No section can crash the hook or block others. If the registry is down, 5 of 6 sections still populate. If it's the first session of the day, the today journal section is empty.

The registry curl gets `--connect-timeout 3 --max-time 5`. All local file reads are instant (<1ms each).

### Hook Registration

Added to the existing `SessionStart` array in `.claude/settings.json` as a second hook entry alongside `doppler-sync.sh`:

```json
{
  "type": "command",
  "command": "bash /home/swebber64/DHG/portage/.claude/hooks/session-briefing.sh",
  "timeout": 5
}
```

Hooks in the same group execute sequentially: doppler (~2-3s) then briefing (~1-2s). Total well under combined timeouts.

### Time Budget

| Operation | Expected time |
|-----------|--------------|
| Registry curl (success) | 50-200ms |
| Registry curl (timeout) | 3s (connect) or 5s (max) |
| 4 local file reads | <10ms total |
| 2 git commands | <50ms |
| **Total (happy path)** | **<500ms** |
| **Total (registry down)** | **3-5s** |

### Size Budget

Target: ~50 lines of output. Each section is naturally bounded:
- Session tldrs: 3 lines (one per session)
- recent.md: ~10-15 lines (7-day rolling)
- Today's journal: ~5-15 lines (varies by activity)
- decisions_index.md: ~10-15 lines (grows slowly)
- Git state: 6 lines (branch + 5 commits)
- Progress: ~8 lines (phase headers)

## Implementation Scope

1. Create `session-briefing.sh` bash script
2. Add hook entry to `.claude/settings.json` SessionStart array
3. Test the hook manually and verify output format

No new infrastructure, no new dependencies. Uses `jq` (already installed) for JSON parsing of the registry response.

### Registry Response Parsing

The `/api/agent-sessions?project=portage&limit=3` endpoint returns:

```json
{"sessions": [{"tldr": "...", "ended_at": "...", "model": "..."}, ...], "total": N}
```

Extract tldrs with: `jq -r '.sessions[] | "\(.ended_at // "unknown") — \(.tldr // "no tldr")"'`

If `jq` is not available, fall back to `python3 -c "import sys,json; ..."` as a secondary parser.
