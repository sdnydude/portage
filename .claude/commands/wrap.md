# /wrap — Session Handoff + Registry Capture + End-of-Session Tasks

You are closing out this session. Produce the handoff, sweep every memory/registry capture that this session earned but has not yet posted, and finish end-of-session hygiene. Work from what actually happened in THIS session — never invent items to fill a section, and never re-post something already captured this session (reposting the same title upserts, but a fabricated capture poisons the registry).

Optional focus/slug override from the user: $ARGUMENTS

---

## Rules (non-negotiable)

- **Captures are fire-and-forget.** Every `~/.claude/scripts/post-*.sh` call exits 0 even when the registry (10.0.0.251:8011) is down — payloads dead-letter for daemon retry. Never block or retry manually; never announce individual posts.
- **`model_name` is the actual model in use** this session — not a placeholder copied from the rules files.
- **Version planning files before overwriting.** `whats-next.md` gets versioned (`whats-next_v{N}.md`), not clobbered.
- **No completion claims without evidence.** The wrap reports what was verified, with the proof that exists (test counts, PR URLs, screenshots delivered) — "should" and "probably" are red flags.
- **Never commit secrets.** The wrap commits docs and handoff files only.

---

## Phase 1 — Gather session facts (read-only)

Collect before writing anything:

1. `git log --oneline` for commits made this session; current branch; `git status --short`.
2. PRs opened/merged this session (`gh pr list --author @me --state all` filtered to today, or from conversation memory).
3. Verification evidence produced: test counts (from the last suite run), typecheck/lint results, screenshots delivered, e2e/proof artifacts.
4. From the conversation: decisions made, bugs root-caused and fixed, work discovered-but-deferred, corrections received, insights worth keeping, test-count deltas.
5. Read the existing `whats-next.md` (if present) so the new handoff supersedes rather than loses items.

## Phase 2 — Write the handoff (`whats-next.md`)

Version the old file, then write a fresh `whats-next.md` at the repo root for the next session (human or Claude) to act on **without asking questions**:

- **State of work:** what shipped this session (PR #s, merged or open), what is mid-flight (branch names, exact stopping point, what is committed vs. uncommitted).
- **Continuation order:** numbered next steps, most-blocking first, each concrete enough to execute (file paths, commands, which phase of which plan).
- **Blockers:** anything requiring the operator (permissions, external services, live-verify steps) — say exactly what and why.
- **Don't-redo list:** work that LOOKS pending but is already done elsewhere (cite the PR/commit) — this prevents the next session from re-deriving or duplicating it.

## Phase 3 — Registry capture sweep

For EACH rule below, check whether this session met its trigger AND the item was not already posted this session. Post only what qualifies; skip silently what doesn't. Field schemas and category enums live in the corresponding `.claude/rules/auto-*.md` file — follow them exactly.

| Capture | Script | Fires when (this session) |
|---|---|---|
| Session report | `post-session-reports.sh --stdin` | Always on /wrap (unless the session was trivial — a quick lookup with no story). Write `docs/session-reports/YYYY-MM-DD-<slug>.md` FIRST, then post its full body as `report_md`. File + post are one atomic action. |
| Ship session | `post-ship-session.sh` | A /ship (or ship-shaped feature arc) completed and wasn't posted in-flight |
| Insights | `post-insight.sh` | Non-obvious discoveries: patterns, surprises, root causes revealing a class, techniques, tradeoffs — one call each |
| Decisions | `post-decision-logs.sh` | Choices where an alternative was explicitly rejected and the reasoning is non-obvious from code — one call each |
| Deferred items | `post-deferred-items.sh` | Work discovered but intentionally not done — one call per item, never batched |
| Bug fixes | `post-bug-fixes.sh` | Symptom + root cause + non-trivial fix, all three present |
| Test coverage | `post-test-coverage.sh` | Test files added/removed/modified — single aggregate event with before/after counts from real runner output |
| Corrections | `post-correction.sh` | User pushed back on Claude's behavior and it wasn't captured at the time |

Build JSON payloads programmatically (`python3 -c` or `jq`) whenever a body contains quotes/newlines — hand-rolled escaping breaks the heredoc.

## Phase 4 — Session summary (`.remember/now.md`)

Append the compressed end-of-session entry (format per `.claude/rules/auto-session-summary-capture.md`):

```
## HH:MM | branch-name | commit-hash
Max-compressed summary: what was done, key decisions, current state. 2-3 lines.
```

This is what the Stop hook `session-capture.sh` posts as the session record — if it's empty, the registry gets a blank session.

## Phase 5 — Memory sync

Invoke the `/sync-memory` skill to fold session memory into the durable memory files.

## Phase 6 — Git + hygiene close-out

1. Commit the wrap artifacts (`whats-next.md`, the session report, `.remember/now.md` changes) — docs-only commit, conventional message.
2. Push the current branch; ensure an open PR exists for any branch with unmerged work (create as draft if missing).
3. Verify: `git status` clean (or every remaining dirty file explained in the handoff), CI state on open PRs noted in `whats-next.md`.
4. If anything cannot be completed (blocked push, failing CI, missing permission), record it in the handoff's Blockers section rather than leaving it implicit.

## Phase 7 — Final report to the user

One compact summary, in this order: what the handoff says the next session should do first → which captures were posted (by type + count, not payload dumps) → git end-state (branch, pushed?, PR, CI) → anything that needs the operator. No padding; every line should be actionable or evidence.
