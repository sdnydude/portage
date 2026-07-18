# Portage Memory Intelligence Suite

A persistent cross-session learning system for Claude Code. Built for the Portage project at Digital Harmony Group, this suite gives an AI coding assistant durable memory, self-correcting knowledge, and pattern recognition across sessions.

**Architecture diagrams:** canonical copies live at `website/static/img/memory-*.svg` (the byte-identical twins formerly in this directory were removed 2026-07-17).

---

## Table of Contents

1. [The Problem](#1-the-problem)
2. [Origin Story](#2-origin-story)
3. [System Architecture](#3-system-architecture)
4. [Component Inventory](#4-component-inventory)
5. [Data Lifecycle](#5-data-lifecycle)
6. [Self-Training Feedback Loops](#6-self-training-feedback-loops)
7. [Operational Characteristics](#7-operational-characteristics)
8. [Current State](#8-current-state)
9. [Roadmap: Next Steps](#9-roadmap-next-steps)
10. [Lessons Learned](#10-lessons-learned)

---

## 1. The Problem

Claude Code sessions are stateless. Each new session starts cold — no memory of what was built yesterday, what mistakes were corrected, what decisions were made, or what patterns are emerging across work sessions. The user (Stephen Webber, CEO/Founder of DHG) bills at $600/hour and expects Fortune 500 execution quality. Repeating context, re-explaining preferences, and re-correcting the same mistakes is unacceptable overhead.

Six specific gaps existed before this system:

| Gap | Impact |
|-----|--------|
| No session continuity | Every session starts from zero context |
| No behavioral learning | Same mistakes repeated across sessions |
| No pattern detection | Recurring themes invisible — regressions undetected |
| No memory pruning | Stale knowledge accumulates, diluting signal |
| No observability | Memory health exists only in local files |
| No contradiction detection | Conflicting memories coexist undetected |

The memory intelligence suite addresses all six.

---

## 2. Origin Story

### Week 1: Foundation (2026-04-20)

The first memory primitive was `.remember/` — a directory of markdown files acting as a session journal. `now.md` captured the current session's work. On session exit, content moved to a daily file (`today-YYYY-MM-DD.md`). This was manual and unreliable.

Alongside this, `CLAUDE.md` was established as the project's declarative config — architecture, rules, progress. It loads into every session automatically but required manual updates to stay current.

### Week 2: Automation (2026-04-28 – 2026-05-05)

The `enforce-ship.sh` hook was created after a failed feature attempt where Claude skipped planning phases and produced half-finished work. This was the first behavioral guardrail — code edits blocked unless the `/ship` workflow had reached Phase 4 (Build).

CodeGraph was initialized for semantic code search. Doppler replaced Infisical for secrets management, with a `SessionStart` hook to auto-sync 54 secrets to `.env`.

### Week 3: Memory Systems Proliferate (2026-05-07 – 2026-05-08)

Multiple memory systems were deployed in parallel:

- **Auto-memory** (`~/.claude/projects/.../memory/`) — 5 memory types (user, feedback, project, reference, decision) with `MEMORY.md` as the index
- **Serena** — 6 semantic code memories via MCP language server
- **CodeGraph** — symbol-level code knowledge graph
- **AI Factory Registry** — `agent_sessions` table for session capture with summary/tldr

Each system worked independently. No orchestration existed.

### Week 4: Orchestration + Intelligence (2026-05-09)

The `/sync-memory` slash command was created to unify all memory systems into a single auditable process. Initially a simple 5-phase audit, it evolved over a single day into a 6-phase intelligence pipeline:

1. **Morning:** Basic sync command created + session-end hook + 6am cron
2. **Midday:** Decision log memory type added (5 seeds), SessionStart briefing hook built (6 data sources)
3. **Afternoon:** Memory intelligence design spec written, critical review identified 10 gaps, all incorporated
4. **Evening:** Full implementation via `/ship` workflow (14 tasks) — pattern detection, pruning, contradiction scanning, registry metrics, briefing integration

The system went from "disconnected memory stores" to "self-maintaining knowledge infrastructure" in one day.

---

## 3. System Architecture

> See `website/static/img/memory-system-overview.svg` for the visual diagram.

The suite operates across four layers:

### Session Layer

Every Claude Code session is bookended by hooks:

| Event | Hook | What It Does | Duration |
|-------|------|-------------|----------|
| SessionStart | `doppler-sync.sh` | Syncs 54 secrets to `.env` | ~2s |
| SessionStart | `session-briefing.sh` | Injects 7-section context briefing | <100ms |
| PreToolUse (Edit\|Write) | `enforce-ship.sh` | Blocks edits unless `/ship` Phase 4+ | <10ms |
| PreToolUse (Bash) | `check-ports.sh` | Port conflict guard | <10ms |
| Stop | `memory-sync.sh` | CodeGraph sync + journal flush | <500ms |
| Stop | `session-capture.sh` | POST session summary to registry | <5s |

### Storage Layer

Five independent stores, each optimized for a different access pattern:

| Store | Location | Content | Access Pattern |
|-------|----------|---------|----------------|
| Journal | `.remember/` | Session activity log | Write-heavy, time-series |
| Auto-memory | `~/.claude/.../memory/` | 23 persistent knowledge files | Read-heavy, indexed |
| CLAUDE.md | `./CLAUDE.md` | Architecture + rules | Loaded every session |
| Serena | MCP server | 6 semantic code memories | Query via MCP tools |
| CodeGraph | `.codegraph/` | Symbol knowledge graph | Query via MCP tools |

### External Services

| Service | Port | Role |
|---------|------|------|
| AI Factory Registry | 8011 | Stores session summaries + sync metrics |
| Session Logger | 8009 | Embeds and stores workflow completions |
| Cron (6am ET) | — | Triggers daily full `/sync-memory` |

### Orchestration

| Command | What It Does |
|---------|-------------|
| `/sync-memory` (full) | 6-phase audit: CodeGraph → Journal → Auto-memory → Serena → CLAUDE.md → Report |
| `/sync-memory` (light) | 2 phases: Journal consolidation + metrics POST |
| `/ship` | 7-phase feature workflow with memory integration at each phase |

---

## 4. Component Inventory

### Hooks (`.claude/hooks/`)

| File | Event | Lines | Purpose |
|------|-------|-------|---------|
| `session-briefing.sh` | SessionStart | 148 | 7-section context injection |
| `doppler-sync.sh` | SessionStart | ~20 | Sync secrets to `.env` |
| `memory-sync.sh` | Stop | 30 | CodeGraph sync + journal flush |
| `session-capture.sh` | Stop | 40 | POST summary/tldr to registry |
| `enforce-ship.sh` | PreToolUse | ~30 | Block edits outside `/ship` Phase 4 |
| `check-ports.sh` | PreToolUse | ~15 | Port conflict detection |

### Commands (`.claude/commands/`)

| File | Invocation | Lines | Purpose |
|------|-----------|-------|---------|
| `sync-memory.md` | `/sync-memory` | 275 | Full memory orchestration |
| `ship.md` | `/ship` | ~400 | 7-phase feature workflow |
| `secrets.md` | `/secrets` | ~40 | Doppler secret management |

### Memory Files (`~/.claude/projects/.../memory/`)

| Pattern | Count | Type | Example |
|---------|-------|------|---------|
| `decision_*.md` | 5 | Architectural choices | `decision_api_bcrypt_v6.md` |
| `feedback_*.md` | 6 | Behavioral rules | `feedback_parallel_agents.md` |
| `project_*.md` | 6 | Project state | `project_reverb_marketplace.md` |
| `reference_*.md` | 4 | External pointers | `reference_doppler_secrets.md` |
| `project_pattern_*.md` | 0-3 | Rolling snapshots | `project_pattern_hotarea_*.md` |
| `MEMORY.md` | 1 | Index | Loaded every session |
| `decisions_index.md` | 1 | Decision index | Grouped by domain |

### Journal Files (`.remember/`)

| File | Lifecycle | Purpose |
|------|-----------|---------|
| `now.md` | Current session | Active session buffer |
| `today-YYYY-MM-DD.md` | Current day | Daily journal (appended per session) |
| `*.done.md` | 7-30 days | Aged journals awaiting cleanup |
| `recent.md` | 7-day rolling | Summarized recent activity |
| `archive.md` | Permanent | Compressed weekly summaries |

### External Tables

| Table | Database | Columns | Purpose |
|-------|----------|---------|---------|
| `agent_sessions` | dhg_registry | 12 | Session capture (summary, tldr, commits) |
| `memory_metrics` | dhg_registry | 14 | Sync telemetry (patterns, health, trends) |

### Design Artifacts (`docs/superpowers/`)

| File | Type | Purpose |
|------|------|---------|
| `specs/2026-05-09-memory-intelligence-design.md` | Spec | Full design document |
| `plans/2026-05-09-memory-intelligence.md` | Plan | 14-task implementation plan |
| `specs/2026-05-09-session-briefing-design.md` | Spec | Briefing hook design |
| `specs/2026-05-09-decision-log-design.md` | Spec | Decision log type design |
| `website/static/img/memory-system-overview.svg` | Diagram | Full system architecture |
| `website/static/img/memory-data-lifecycle.svg` | Diagram | Data flow and aging |
| `website/static/img/memory-feedback-loop.svg` | Diagram | Self-training loops |
| `website/static/img/memory-sync-phases.svg` | Diagram | /sync-memory phase detail |

> Note (2026-07-17): the byte-identical SVG twins that lived in this directory were removed; the canonical copies live in `website/static/img/` (embedded by `website/docs/development/memory-system.md`).

---

## 5. Data Lifecycle

> See `website/static/img/memory-data-lifecycle.svg` for the visual diagram.

Information flows through four stages:

### Stage 1: Capture (every session)

During a session, Claude writes timestamped entries to `.remember/now.md`:

```
## 14:30 | main
Implemented prepare-listing endpoint with AI field generation.
Seller profiles table added with Drizzle push.
```

On session exit, the Stop hooks fire:
- `memory-sync.sh` appends `now.md` content to `today-YYYY-MM-DD.md` and clears `now.md`
- `session-capture.sh` POSTs a summary + tldr + commit list to the registry API

During the session, Claude also saves persistent memories when criteria are met:
- **Feedback:** When the user corrects Claude's behavior or confirms a non-obvious approach
- **Decisions:** When an alternative was considered, rejected, and the reasoning is non-obvious
- **Project/Reference:** When durable facts or external pointers are learned

### Stage 2: Consolidation (daily cron or manual)

The `/sync-memory` Phase 2 manages journal aging:

```
now.md → today-YYYY-MM-DD.md → recent.md → archive.md
         (daily, on session exit)  (7-day)    (14-day+)
```

- Daily journals older than 7 days get summarized into `recent.md` and renamed to `*.done.md`
- `recent.md` entries older than 14 days get compressed into `archive.md`
- `*.done.md` files older than 30 days are deleted
- Git backfill fills gaps: if a day has commits but no journal entry, one is synthesized from commit subjects

### Stage 3: Analysis (daily full sync)

The `/sync-memory` Phase 3 applies intelligence:

| Sub-phase | What It Does |
|-----------|-------------|
| 3a: Staleness | Verifies each memory file against current codebase state |
| 3b: Missing | Checks for uncaptured feedback, milestones, references |
| 3c: Patterns | Detects hot areas, workflow distribution, unfinished branches |
| 3d: Pruning | Archives verified-stale memories (max 3/run, 7-day min age) |
| 3e: Rebuild | Regenerates MEMORY.md and decisions_index.md from disk |
| 3f: Metrics | POSTs health/pattern data to registry for trend analysis |

### Stage 4: Recall (every session start)

The `session-briefing.sh` hook reads the artifacts produced by Stages 1-3 and injects them into the session context:

1. **Freshness:** When was the last full sync?
2. **Recent sessions:** Last 3 session tldrs from registry
3. **7-day activity:** `recent.md` content
4. **Today's journal:** Current day's entries
5. **Decision log:** `decisions_index.md` content
6. **Git state:** Current branch + last 5 commits
7. **Intelligence:** Hot areas, unfinished work, workflow trend alerts

This closes the loop: information captured in Stage 1 is delivered back in Stage 4.

---

## 6. Self-Training Feedback Loops

> See `website/static/img/memory-feedback-loop.svg` for the visual diagram.

Three feedback loops are operational today. A fourth is planned.

### Loop 1: Behavioral Learning (operational)

**Trigger:** User corrects Claude's behavior or confirms a non-obvious approach.

**Mechanism:**
1. User says "don't do X" or "yes, exactly like that"
2. Claude saves a `feedback_*.md` file with rule, reason (Why), and scope (How to apply)
3. MEMORY.md index is updated
4. Next session loads MEMORY.md → Claude reads the feedback file when relevant
5. Claude follows the rule without being told again

**Current examples:**
- `feedback_parallel_agents.md` — "Always spawn multiple agents concurrently for independent tasks"
- `feedback_never_guess_ui.md` — "NEVER guess UI navigation; look up docs first"
- `feedback_check_doppler_first.md` — "Search ALL Doppler projects before asking for credentials"
- `feedback_design_quality.md` — "Apple.com minimalist, no boring corporate"
- `feedback_follow_claude_md.md` — "Treat CLAUDE.md as a checklist, not ambient context"
- `feedback_no_selfhosted_secrets.md` — "Hosted SaaS only for infra tooling"

**Self-correcting property:** Behavioral feedback is exempt from automated pruning. It persists until explicitly superseded by a newer feedback memory. This prevents the system from "unlearning" corrections.

### Loop 2: Pattern Recognition (operational)

**Trigger:** Daily 6am cron runs `/sync-memory` in full mode.

**Mechanism:**
1. Sessions accumulate journal entries in `today-*.md` files
2. Phase 3c reads 14 days of journals and detects patterns:
   - Files/directories mentioned in 3+ of last 7 sessions → hot areas
   - Domain activity distribution → workflow snapshot
   - Branches mentioned but not merged → unfinished work
3. Patterns are cross-referenced against `docs/TODO.md`:
   - Hot area in incomplete phase → `active-development`
   - Hot area with fix sentiment in complete phase → `regression`
4. Pattern files written to auto-memory
5. Next session's briefing hook reads pattern files → Section 7
6. Claude starts the session knowing what's hot, what's regressing, and what's abandoned

**Self-correcting property:** Pattern files are rolling snapshots — overwritten each sync. Stale patterns automatically disappear when the underlying activity changes.

### Loop 3: Memory Hygiene (operational)

**Trigger:** Daily full sync, Phase 3a → 3d pipeline.

**Mechanism:**
1. Phase 3a verifies each memory against current codebase (grep, file existence, git log)
2. Memories referencing removed features, old services, or outdated patterns are flagged stale
3. Contradiction detection scans for conflicting active memories
4. Phase 3d archives stale memories to `memory_archive.md` and deletes originals
5. Phase 3e rebuilds the index to match reality

**Safety rails:**
- Maximum 3 memories pruned per run (circuit breaker)
- Minimum 7-day age before pruning (too new to judge)
- Behavioral feedback exempt from codebase-based pruning
- Pattern files exempt (managed separately)
- Contradictions flagged but not auto-resolved (require human judgment)

### Loop 4: Self-Training (PLANNED)

**Goal:** Claude learns from the outcomes of its own decisions, not just from user corrections.

**Mechanism (proposed):**
1. **Action tracking:** When Claude makes a non-trivial decision (architecture choice, approach selection, tool pick), log it with a predicted outcome
2. **Outcome evaluation:** On next sync, check whether the prediction held — did the build succeed? Did the approach survive review? Did the user override it?
3. **Strategy refinement:** Successful strategies get promoted (higher confidence). Failed strategies get demoted or tagged with failure conditions
4. **Measurable metric:** Correction rate (user corrections per session) should decrease over time

**Required infrastructure:**
- `outcome_*.md` memory type — links decisions to results
- Correction counter in registry metrics — tracks user corrections per session
- Strategy scoring — confidence levels on behavioral rules
- A/B memory experiments — test whether a rule improves outcomes
- Grafana dashboard — visualize correction rate, strategy scores, memory health over time

This loop is the bridge between "Claude remembers what you told it" and "Claude learns what works."

---

## 7. Operational Characteristics

### Performance Budget

| Operation | Target | Actual |
|-----------|--------|--------|
| SessionStart hooks (total) | <3s | ~2.1s (Doppler 2s + briefing 100ms) |
| Stop hooks (total) | <5s | <1s (journal flush + capture POST) |
| Full /sync-memory | <10 min | 5-10 min (30 API turns) |
| Light /sync-memory | removed | N/A (was causing hangs) |

### Storage Footprint

| Component | Size | Growth |
|-----------|------|--------|
| `.remember/` | ~50KB | ~2KB/day (journals age out) |
| Auto-memory files | ~40KB | Slow (pruning counterbalances) |
| Registry: agent_sessions | ~2-4 rows/day | ~1000 rows/year |
| Registry: memory_metrics | ~1 row/day | ~365 rows/year |
| CodeGraph index | ~2MB | Stable (rebuilds) |

### Failure Modes

| Failure | Impact | Mitigation |
|---------|--------|------------|
| Registry down | No session capture or metrics | All hooks use `|| true`; local analysis still works |
| Cron missed | Stale patterns, no pruning | Manual `/sync-memory` works; briefing shows "Last full sync: never" |
| CodeGraph stale | Inaccurate symbol search | PostToolUse hook syncs on every Edit/Write |
| Memory contradiction | Conflicting guidance | Flagged in sync report; requires human resolution |
| Hook SIGPIPE | Corrupted prompts | Fixed: removed `set -euo pipefail` from fire-and-forget scripts |
| Hook hangs | Session exit blocked | Fixed: removed background claude CLI spawn from Stop hook |

### Monitoring

The system's health is observable through:

1. **Briefing freshness line** — "Last full sync: YYYY-MM-DD HH:MM UTC" at session start
2. **Registry memory_metrics** — `GET /api/memory-metrics?project=portage&limit=5` for sync history
3. **Sync report** — 12-row summary table after each full sync
4. **Cron logs** — `.remember/logs/cron-sync-*.log`

---

## 8. Current State

As of 2026-05-09:

### What's Working

- SessionStart briefing (7 sections) delivers cold-start context in <100ms
- Stop hooks capture sessions and flush journals without blocking
- Auto-memory has 23 files across 5 types, indexed in MEMORY.md
- Decision log captures 5 architectural choices with domain tags
- 6 behavioral feedback rules persist across sessions
- Registry stores session summaries and sync metrics
- `/sync-memory` command handles full 6-phase orchestration
- 6am cron triggers daily full sync
- `enforce-ship.sh` guards code edits behind `/ship` workflow

### What's Not Yet Tested End-to-End

- Pattern detection (Phase 3c) — code is written but no full sync has run with enough journal data
- Memory pruning (Phase 3d) — logic is specified but no memories have been pruned yet
- Contradiction detection — no contradictions exist to catch yet
- Journal backfill — specified but not exercised (journals have been manually maintained)
- Workflow trend comparison — registry needs 2+ full sync entries before trends can be compared

### Known Issues

- Serena memory verification blocked by MCP permissions (skipped in sync, recurring)
- Cron job spawns a full `claude` CLI session (expensive — ~30 API turns, ~$0.50-1.00/run)
- No Grafana dashboard for memory metrics yet
- `.done.md` files from weeks 1-2 still on disk (no full sync has run cleanup yet)

---

## 9. Roadmap: Next Steps

### Near-Term (next 1-2 weeks)

#### 1. First Full Sync Run
Run `/sync-memory` manually and observe all 6 phases end-to-end. Verify pattern detection produces meaningful hot areas from existing journal data. Fix any issues discovered.

#### 2. Grafana Dashboard
Create a memory health dashboard showing:
- Sync frequency (full vs light)
- Memory count over time (created, pruned, total)
- Hot area trends
- Correction rate per session (foundation for Loop 4)
- Journal coverage (days with entries vs gaps)

#### 3. Cron Cost Reduction
The 6am cron spawns a full `claude -p` session (~30 turns). Explore alternatives:
- Bash-only phases (CodeGraph sync, journal aging, .done cleanup) can run without Claude
- Only the AI-powered phases (staleness analysis, pattern detection, contradiction scan) need Claude
- Split cron into: fast bash script (daily) + claude session (weekly or on-demand)

#### 4. Cross-Project Intelligence
The registry already accepts a `project` field. When other DHG projects adopt the memory suite:
- Pattern detection can identify cross-project hot areas
- Workflow distribution shows time allocation across projects
- Shared feedback rules can propagate (e.g., "always use Doppler" applies everywhere)

### Medium-Term (next 1-2 months)

#### 5. Self-Training Loop (Loop 4)

The biggest leap: moving from "Claude remembers corrections" to "Claude learns from outcomes."

**Phase A: Instrumentation**
- Add `outcome_*.md` memory type linking decisions to measured results
- Track correction rate (user corrections per session) in registry metrics
- Tag behavioral rules with confidence scores based on how often they prevent corrections

**Phase B: Outcome Evaluation**
- After each `/ship` workflow, evaluate: did the approach survive review? How many review issues were found? Did the user override any decision?
- After each session, count corrections and map them to which feedback rules were (or weren't) applied
- Score strategies: `confidence = successes / (successes + failures)`

**Phase C: Strategy Refinement**
- Low-confidence rules get flagged for human review instead of being auto-applied
- High-confidence rules get promoted to CLAUDE.md (ambient, always-on)
- A/B testing: occasionally suppress a rule and measure whether correction rate changes

**Phase D: Dashboard + Metrics**
- Correction rate trend over time (the north star metric — should decrease)
- Strategy leaderboard (which rules prevent the most corrections)
- Memory ROI (which memories are read most often and correlate with fewer corrections)

#### 6. Semantic Memory Search
Replace the flat MEMORY.md index with vector-based retrieval:
- Embed memory files using the session logger's existing embedding pipeline
- On session start, embed the user's first message and retrieve the 5 most relevant memories
- Reduces the "23 files in MEMORY.md" cold-start overhead to "5 precisely relevant memories"

#### 7. Session Replay
Use `agent_sessions` data to enable "what happened in the last session?" queries:
- Summary + tldr already captured
- Add: key files modified, decisions made, corrections received
- Enable: "pick up where the last session left off" as a first-class workflow

### Long-Term (3+ months)

#### 8. Multi-Agent Memory Sharing
When subagents are dispatched (Explore, code-reviewer, etc.), they operate without access to the memory suite. Future: inject relevant memories into subagent prompts based on their task.

#### 9. Predictive Briefing
Instead of showing all 7 sections, predict which sections are relevant based on:
- Time of day (morning = full briefing, mid-session reconnect = minimal)
- Recent git activity (if heavy API work, surface API-related memories)
- Session history (if 3 sessions in a row touched auth, pre-load auth decisions)

#### 10. Memory Portability
Package the memory suite as a reusable Claude Code plugin:
- Extract project-specific details into config
- Publish hooks, commands, and memory types as a plugin
- Enable any Claude Code project to adopt persistent memory with `claude plugin install memory-suite`

---

## 10. Lessons Learned

### What Worked

1. **Hooks over habits.** The most reliable parts of this system are the automated hooks. The least reliable were "Claude should remember to do X" — that's why `enforce-ship.sh` exists. If a behavior matters, encode it as a hook, not a memory.

2. **Fire-and-forget over background spawns.** The original Stop hook spawned a background `claude` CLI session for light sync. This caused processes to pile up, hang, and corrupt prompts. The fix was removing the spawn entirely — fast bash work only, expensive analysis deferred to cron.

3. **Rolling snapshots over accumulation.** Pattern files (`project_pattern_*.md`) are overwritten each sync, not appended. This prevents the "memory grows forever" problem without requiring pruning logic for these files.

4. **Safety rails on pruning.** Max 3 per run + 7-day minimum age + behavioral exemption. Aggressive pruning would be worse than no pruning — losing a critical memory mid-session is catastrophic.

5. **Flat files over databases.** Auto-memory uses markdown files, not a database. This means `grep`, `cat`, and manual editing all work. The MEMORY.md index is just a markdown file with links. Simplicity wins for a system that needs to be debuggable by a human.

### What Failed

1. **`set -euo pipefail` in fire-and-forget hooks.** Strict error handling is correct for scripts that should fail loudly. It's wrong for hooks that must never block the session — a SIGPIPE from `curl | head` would exit the hook with code 141, which the hook runner surfaced as an error into the prompt.

2. **Background process spawning from hooks.** Claude Code's hook runner waits for the entire process group, not just the parent PID. A backgrounded `&` subprocess still blocks the hook from completing. `nohup` + fd closing might work, but removing the spawn entirely is simpler and more reliable.

3. **Environment variable passing to slash commands.** The original light mode detection used `SYNC_MODE=light` as a prefix on the `claude` CLI invocation. But environment variables set on the CLI process aren't visible inside the slash command's execution context. The fix was prompt-based detection: "if the prompt contains the word 'light'".

4. **Phase ordering assumptions.** The initial implementation ran "rebuild MEMORY.md index" (Phase 3c) before "pattern detection" (Phase 3d) and "pruning" (Phase 3e). This meant the index was always one sync behind — missing newly created pattern files and still listing pruned files. The fix was reordering: patterns → pruning → rebuild index.

### Design Principles

1. **Capture is cheap, analysis is expensive.** Session capture (Stop hooks) runs on every exit and must be fast. Analysis (pattern detection, contradiction scanning) runs daily and can take minutes. Never mix the two.

2. **Local-first, registry-second.** All analysis happens locally and produces local files. The registry POST is best-effort — if it fails, the local analysis still works. The briefing hook reads local files, not the registry.

3. **Human in the loop for contradictions.** Contradictions are flagged, not auto-resolved. Two conflicting memories might both be partially correct, or the contradiction might reveal a deeper issue. Automated resolution would mask the signal.

4. **Memory is a feedback loop, not a database.** The value isn't in storing facts — it's in the loop: capture → consolidate → analyze → deliver → Claude behaves better → capture better data. Each turn of the loop makes the next session better.

---

*Last updated: 2026-05-09. See `docs/superpowers/specs/2026-05-09-memory-intelligence-design.md` for the original design spec.*
