# Sync Memory

Update and synchronize all memory systems for this project. Run all phases in order.

## Phase 1: CodeGraph Index

Sync the code knowledge graph so all other phases work with current symbol data.

```bash
codegraph sync
```

## Phase 2: .remember/ — Consolidate Session Journal

1. Read `.remember/now.md` — if it has content from a prior session, append it to today's daily file (`today-YYYY-MM-DD.md` using today's date)
2. Clear `now.md` to just a timestamp header for the current session
3. Check if any `today-*.md` files are older than 7 days — if so, summarize their key points into `recent.md` and rename them to `.done.md`
4. If `recent.md` has entries older than 14 days, compress them into `archive.md` and remove from `recent.md`

## Phase 3: Auto-Memory — Audit & Update

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

## Phase 4: Serena Memories — Verify & Update

### 4a: Check existing memories

Use `list_memories` to get current Serena memories. For each one:
- Read it with `read_memory`
- Verify key facts against the codebase (table counts, route lists, command accuracy)
- Update with `edit_memory` if stale

### 4b: Check for gaps

Compare Serena memory topics against what's in the codebase. If a significant area is undocumented (new routes, new components, changed patterns), write a new memory.

### 4c: Verify language server

Run one `find_symbol` or `get_symbols_overview` call to confirm the TypeScript language server is responding.

## Phase 5: CLAUDE.md Currency Check

For each CLAUDE.md file (root + packages):
- Check the database table count against `schema.ts`
- Check the progress numbers against `docs/TODO.md`
- Check key file locations still exist
- If any section is stale, update it

Only fix factual errors — don't restructure or rewrite.

## Phase 6: Report

Output a summary table:

```
| System          | Status | Changes Made |
|-----------------|--------|--------------|
| CodeGraph       | ...    | ...          |
| .remember/      | ...    | ...          |
| Auto-memory     | ...    | ...          |
| Serena memories | ...    | ...          |
| CLAUDE.md       | ...    | ...          |
```

List any memories that were added, updated, or removed.

## Notes

- Use parallel agents for independent checks (e.g., CLAUDE.md audit + Serena audit can run concurrently)
- Don't create duplicate memories — always check existing files first
- Don't save ephemeral conversation details — only durable knowledge
- If unsure whether something is stale, check the codebase before removing
