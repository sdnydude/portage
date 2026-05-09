# Sync Memory

Update and synchronize all memory systems for this project. Run all phases in order.

## Sync Mode

This command runs in two modes:

- **Full mode** (default): Runs all phases. Used by daily 6am cron and manual `/sync-memory` invocation.
- **Light mode**: Runs only Phase 2 (consolidation) and Phase 3f (metrics POST with minimal data). Used by session-end Stop hook to avoid expensive AI analysis on every exit.

Check for the `SYNC_MODE` environment variable. If `SYNC_MODE=light`, skip Phases 1, 3a-3e, 4, and 5. Only run Phase 2 and Phase 3f (with a minimal metrics payload where hot_areas, workflow_distribution, decision_stats, contradictions, and unfinished_branches are all null).

If `SYNC_MODE` is unset or any other value, run full mode.

## Phase 1: CodeGraph Index (full mode only)

Sync the code knowledge graph so all other phases work with current symbol data.

```bash
codegraph sync
```

## Phase 2: .remember/ — Consolidate Session Journal

1. Read `.remember/now.md` — if it has content from a prior session, append it to today's daily file (`today-YYYY-MM-DD.md` using today's date)
2. Clear `now.md` to just a timestamp header for the current session
3. Check if any `today-*.md` files are older than 7 days — if so, summarize their key points into `recent.md` and rename them to `.done.md`
4. If `recent.md` has entries older than 14 days, compress them into `archive.md` and remove from `recent.md`
5. **Journal backfill from git:** For each of the last 14 calendar days, check if a `today-YYYY-MM-DD.md` file exists and has more than 3 lines. If a day has git commits (check with `git log --format="%s" --since="YYYY-MM-DD" --until="YYYY-MM-DD + 1 day" --no-merges`) but no journal entry or an entry under 3 lines, create/append a backfill entry:
   ```
   ## [HH:MM] | [branch] (backfilled from git)
   [commit subject 1]; [commit subject 2]; ...
   ```
   Only backfill — never overwrite existing journal content.
6. **Clean up old .done.md files:** Delete any `.done.md` files in `.remember/` older than 30 days. These have already been summarized into `recent.md` and `archive.md`. Use `find .remember/ -name "*.done.md" -mtime +30 -delete`.

## Phase 3: Auto-Memory — Audit & Update (full mode only)

Location: `~/.claude/projects/-home-swebber64-DHG-portage/memory/`

### 3a: Check for stale memories

For each `project_*.md` memory file:
- Read the memory content
- Verify claims against current codebase state (git log, file existence, grep)
- If a memory references something that no longer exists or has changed significantly, update or remove it
- Report what changed

For each `decision_*.md` memory file:
- Read the decision content
- Verify the chosen approach is still reflected in the codebase (check if key files/patterns still exist)
- If the code has diverged from the decision (e.g., the rejected alternative was later adopted), flag for review
- Check `supersedes` field — if this file is superseded by another decision, remove it from `decisions_index.md` but keep the file on disk
- Report what changed

For each `feedback_*.md` memory file:
- Classify as **tooling** (references a specific tool, service, or file by name) or **behavioral** (general Claude behavior rule with no codebase artifact)
- For tooling feedback: verify the referenced tool/service/pattern still exists in the codebase or config. If it's gone, mark as stale.
- For behavioral feedback: exempt from staleness checks. Only flag if explicitly superseded by a newer feedback memory.
- When ambiguous, treat as behavioral (safer to keep than to prune)
- Report what changed

For each `reference_*.md` memory file:
- Check if the referenced external system, URL, or tool is still used in the codebase (grep for service name, URL patterns, or tool commands)
- If the service/URL/tool is no longer referenced anywhere in the codebase or config files, mark as stale
- Report what changed

**Contradiction detection:** After individual staleness checks, scan for contradictions between active (non-stale) memories:
- Read all non-pattern memory files
- Check for pairs where:
  - A decision says "chose X" but a feedback memory says "avoid X"
  - Two project memories make conflicting claims about the same feature's status
  - A decision's chosen approach conflicts with another decision in the same domain
- Contradictions are NOT auto-resolved — they require human judgment
- List all contradictions found with both memory filenames and the nature of the conflict
- These will be reported in Phase 6 and posted to registry in Phase 3f

### 3b: Check for missing memories

Review the current conversation and recent git history (`git log --oneline -20`) for:
- New feedback the user gave that isn't captured in a `feedback_*.md` file
- New project milestones or decisions not in a `project_*.md` file
- New external references not in a `reference_*.md` file
- Save any new memories found

### 3c: Rebuild MEMORY.md index

Re-read all memory files in the directory and regenerate `MEMORY.md` to ensure the index matches reality. Each entry: `- [Title](file.md) — one-line hook`. Keep under 200 lines.

Also rebuild `decisions_index.md`:
- Read all `decision_*.md` files in the directory
- Group by `domain` from frontmatter
- Skip any file that has been superseded (another decision's `supersedes` field points to it)
- Write entries organized by domain section
- Update the entry count in the MEMORY.md Decision Log pointer

### 3d: Pattern Detection (full mode only)

Read all `.remember/today-*.md` and `.done.md` files from the last 14 days. Analyze across session days to identify:

1. **Hot areas:** Files, directories, or features mentioned in 3+ of the last 7 daily journals.
   - For each hot area, determine **sentiment**: is the work "feature" (add/build/implement) or "fix" (fix/bug/broke/debug)?
   - **Roadmap correlation:** Cross-reference with `docs/TODO.md` phase completion:
     - Hot area in incomplete phase → tag `active-development`
     - Hot area with fix sentiment in complete phase → tag `regression`
     - Hot area with feature sentiment in complete phase → tag `enhancement`
   - Save each hot area as `project_pattern_hotarea_{slug}.md` in auto-memory (overwrite if exists):
     ```
     ---
     name: Hot area: [area name]
     description: [area] modified in N of last 7 sessions — [tag] ([phase status])
     type: project
     ---
     [area] touched in N of 7 recent sessions ([date range]).
     Files: [file1] (Nx), [file2] (Nx).
     **Tag:** [active-development|regression|enhancement] ([Phase X: N/M])
     **Pattern:** [contextual recommendation]
     ```

2. **Workflow distribution:** Count domain activity (api, web, shared, infra, registry, ops) across the last 7 daily journals. Save as `project_pattern_workflow.md` (overwrite):
     ```
     ---
     name: Workflow distribution (7-day)
     description: How session time distributes across project domains — helps prioritize
     type: project
     ---
     Last 7 sessions by domain:
     - [domain]: N sessions (N%)
     ...
     ```

3. **Workflow trend comparison:** If the registry is reachable, query `GET http://10.0.0.251:8011/api/memory-metrics?project=portage&limit=4` for prior sync results. Compare current workflow distribution to the 4-run average. If any domain shifted by more than 20 percentage points, add a trend line to `project_pattern_workflow.md`:
   ```
   **Trend:** [domain] increased from N% (4-run avg) to N% this week — Nx increase
   ```
   If registry is unreachable or has fewer than 2 prior entries, skip trend comparison silently.

4. **Unfinished work detection:** Cross-reference recent journal mentions of branches with `git branch --list` and `git log --oneline main..[branch] 2>/dev/null`. If a branch was mentioned in the last 3 journal days but is not the current branch and has not been merged to main (i.e., `git log main..[branch]` returns commits), save as `project_pattern_unfinished.md` (overwrite):
   ```
   ---
   name: Unfinished work detected
   description: Branches mentioned in recent sessions but not merged — may need attention
   type: project
   ---
   - `[branch]` — last mentioned [date], not merged, N commits ahead of main
   ```
   If no unfinished branches found, delete `project_pattern_unfinished.md` if it exists.

All `project_pattern_*` files are rolling snapshots — overwritten each full sync. Add them to MEMORY.md index during the next 3c rebuild.

### 3e: Memory Pruning (full mode only)

Act on the staleness results from Phase 3a. For each memory marked stale:

1. Append the full file content to `memory_archive.md` in the auto-memory directory (`~/.claude/projects/-home-swebber64-DHG-portage/memory/memory_archive.md`) with a header:
   ```
   ---
   ## Archived: YYYY-MM-DD — [filename]
   **Reason:** [why it was marked stale]
   [original file content]
   ```
2. Delete the original file from disk
3. The entry will be removed from MEMORY.md during the next 3c rebuild (or remove it now if 3c already ran)

**Safety rails:**
- Never prune a memory less than 7 days old (check file creation/modification date)
- Never prune more than 3 memories in a single sync run. If 4+ memories appear stale, report all of them but only auto-archive the 3 oldest. Flag the rest for manual review.
- `project_pattern_*` files are excluded from pruning (they are rolling snapshots managed by Phase 3d)
- Behavioral feedback memories are exempt from codebase-based pruning (per Phase 3a classification)

Track: count of memories archived this run, their filenames, and reasons. This data feeds into Phase 3f and Phase 6.

### 3f: Registry Metrics POST (both modes)

Assemble a JSON payload from the results of prior phases and POST it to the registry:

```bash
curl -s -X POST "http://10.0.0.251:8011/api/memory-metrics" \
  -H "Content-Type: application/json" \
  --connect-timeout 3 \
  --max-time 5 \
  -d '{
    "project": "portage",
    "sync_mode": "[full|light]",
    "sync_run_at": "[current UTC timestamp]",
    "hot_areas": [array of hot area objects or null if light mode],
    "workflow_distribution": {domain percentages or null if light mode},
    "workflow_trend": {trend shifts or null},
    "memory_health": {"total": N, "stale_pruned": N, "new_created": N, "archived": N},
    "decision_stats": {"total": N, "superseded": N, "by_domain": {...}} or null,
    "contradictions": [array of contradiction objects or null],
    "unfinished_branches": [array of branch objects or null],
    "journal_backfills": N or null,
    "patterns_detected": N or null
  }' > /dev/null 2>&1 || true
```

In **light mode**: only `project`, `sync_mode`, `sync_run_at`, and `memory_health` are populated. All other fields are null.

In **full mode**: populate all fields from the results of phases 3a, 3d, and 3e.

If the POST fails, continue silently — the local analysis and report still work without the registry.

## Phase 4: Serena Memories — Verify & Update (full mode only)

### 4a: Check existing memories

Use `list_memories` to get current Serena memories. For each one:
- Read it with `read_memory`
- Verify key facts against the codebase (table counts, route lists, command accuracy)
- Update with `edit_memory` if stale

### 4b: Check for gaps

Compare Serena memory topics against what's in the codebase. If a significant area is undocumented (new routes, new components, changed patterns), write a new memory.

### 4c: Verify language server

Run one `find_symbol` or `get_symbols_overview` call to confirm the TypeScript language server is responding.

## Phase 5: CLAUDE.md Currency Check (full mode only)

For each CLAUDE.md file (root + packages):
- Check the database table count against `schema.ts`
- Check the progress numbers against `docs/TODO.md`
- Check key file locations still exist
- If any section is stale, update it

Only fix factual errors — don't restructure or rewrite.

## Phase 6: Report

Output a summary table:

```
| System              | Status | Changes Made                              |
|---------------------|--------|-------------------------------------------|
| CodeGraph           | ...    | ...                                       |
| .remember/          | ...    | ...                                       |
| Journal backfill    | ...    | N days backfilled from git (or "none")    |
| .done.md cleanup    | ...    | N files removed (or "none > 30 days old") |
| Auto-memory         | ...    | ...                                       |
| Contradictions      | ...    | N found (list filenames) or "none"        |
| Pattern detect      | ...    | N hot areas, workflow updated              |
| Unfinished work     | ...    | N unmerged branches (or "none")           |
| Memory pruning      | ...    | N archived (list filenames) or "none"     |
| Registry metrics    | ...    | Posted / failed / skipped (light mode)    |
| Serena memories     | ...    | ...                                       |
| CLAUDE.md           | ...    | ...                                       |
```

List any memories that were added, updated, or removed.

If any contradictions were found, list them with details:
```
### Contradictions Found
- **[memory_a.md]** vs **[memory_b.md]**: [nature of the conflict]
```

**Write freshness timestamp (full mode only):** At the end of a full sync, write the current UTC time to `.remember/.last-full-sync`:

```bash
date -u +"%Y-%m-%d %H:%M UTC" > .remember/.last-full-sync
```

This file is read by the SessionStart briefing hook to show when the last full sync occurred.

## Notes

- Use parallel agents for independent checks (e.g., CLAUDE.md audit + Serena audit can run concurrently)
- Don't create duplicate memories — always check existing files first
- Don't save ephemeral conversation details — only durable knowledge
- If unsure whether something is stale, check the codebase before removing
