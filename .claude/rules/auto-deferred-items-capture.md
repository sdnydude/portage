---
name: Auto-capture deferred items
description: Instructs Claude to post deferred items to the registry whenever work is intentionally deferred
type: rule
---

## When to trigger

Whenever work is **discovered but intentionally not done** during any session. This includes:

- During `/ship` Phase 4 when unrelated issues are found and explicitly deferred
- During ad-hoc debugging when a secondary issue is spotted but not worth fixing now
- During code review when something is flagged but deprioritized
- During exploration when technical debt is discovered
- When the user says "we'll do that later", "out of scope", "defer that", "park that for now", "add to backlog"
- When Claude identifies work that should be done but is outside the current task boundary
- When items are listed in a `deferred` array of a ship-state file

Do NOT fire for:
- Items already captured earlier in the same session (check title match)
- Vague future ideas with no concrete work description
- Items the user explicitly says to forget or ignore entirely

## What to capture

Required fields:
- `title`: Short description of the deferred work (max 280 chars). Be specific — "add rate limiting to sync endpoints" not "fix security"
- `description`: Fuller explanation of what needs to be done, enough for a future session to act on
- `reason`: Why it was deferred — "out of scope for current /ship", "needs separate PR", "blocked by carrier API integration", etc.
- `category`: one of `auth | api | frontend | database | infra | marketplace | testing | security | performance | config | docs | other`
- `project_name`: "portage" (or current project slug)

Optional fields:
- `source_context`: What work was happening when this was discovered (e.g., "PR #66 code health sweep", "/ship onboarding flow")
- `priority`: `low | medium | high | critical` (default: "medium"). Use "high" for issues that affect correctness, "critical" for security/data-loss risks
- `status`: `open | in_progress | resolved | wont_fix` (default: "open")
- `affected_files`: Array of file paths that would need changes
- `tags`: Array of search terms (feature area, tech involved)
- `session_id`: Current session ID if known
- `model_name`: "claude-opus-4-6" or actual model in use

## How to call

After identifying a deferred item, call the capture script silently in a bash tool call:

```bash
~/.claude/scripts/post-deferred-items.sh '{"title":"<short title>","description":"<what needs to be done>","reason":"<why deferred>","source_context":"<current work context>","priority":"medium","category":"<category>","project_name":"portage","affected_files":["<file1>","<file2>"],"tags":["<tag1>","<tag2>"],"model_name":"claude-opus-4-6"}'
```

## Do not ask permission

Call this automatically every time the trigger condition is met. Do not announce it. Do not ask "should I log this?" — just do it. The script exits 0 on failure, so it never blocks the session.

## Batch capture

When a `/ship` session produces multiple deferred items (e.g., a deferred list in ship-state.md), capture each one as a separate POST call. Do not batch them into a single record.
