---
id: memory-system
title: Memory System
sidebar_position: 2
---

# Memory System

Portage development uses a persistent, multi-layer memory system that maintains context across Claude Code sessions. This page documents the architecture of that system.

## System Overview

<img src="/portage/img/memory-system-overview.svg" alt="Memory Intelligence Suite — System Overview" />

The memory system has four layers:

1. **Session Layer** — hooks that fire on session start/stop and tool use
2. **Storage Layer** — files that persist knowledge across sessions
3. **External Services** — registry API and session logger
4. **Orchestration** — /sync-memory and /ship workflows

## Data Lifecycle

<img src="/portage/img/memory-data-lifecycle.svg" alt="Memory Data Lifecycle" />

Information flows through four stages:

### 1. Capture (every session)

During each session, work is recorded in `now.md` (the session buffer). On session stop, the buffer flushes to the daily journal (`today-YYYY-MM-DD.md`) and a summary posts to the registry API.

Auto-memory files (`decision_*.md`, `feedback_*.md`, `project_*.md`, `reference_*.md`) are saved in real-time when specific criteria are met.

### 2. Consolidation (daily cron)

The `/sync-memory` command (run daily at 6am ET) consolidates journals:

- Daily journals older than 7 days → `recent.md` (rolling summary)
- Content older than 14 days → `archive.md` (compressed history)
- Aged journals renamed to `*.done.md` (deleted after 30 days)
- Git history backfilled for gaps

### 3. Analysis (full sync only)

Full-mode sync performs:

- **Staleness audit** — verify each memory against current codebase
- **Pattern detection** — identify hot areas, workflow distribution, unfinished branches
- **Memory pruning** — archive stale memories (max 3 per run, 7-day minimum age)
- **Index rebuild** — regenerate MEMORY.md and decisions_index.md
- **Metrics POST** — send health snapshot to registry

### 4. Recall (every session start)

The `SessionStart` hook (`.claude/hooks/session-briefing.sh`) prints a freshness indicator (time since last full sync), then a 9-section briefing:

1. Recent sessions (from registry API) — including recent ship sessions
2. Recent activity (7-day rolling, from `recent.md`)
3. Today's journal
4. Decision log (from `decisions_index.md`)
5. Git state (branch + recent commits)
6. Progress (phase headers from `docs/TODO.md`)
7. Memory intelligence (hot areas, unfinished work, workflow alerts)
8. Correction lessons (recent, from registry API)
9. Bug-fix root causes (recent, from registry API)

## Feedback Loops

<img src="/portage/img/memory-feedback-loop.svg" alt="Self-Training Feedback Loops" />

The memory system learns from its own operation through three loops:

- **Behavioral Learning** — user corrections become persistent rules
- **Pattern Detection** — repeated file edits and workflow patterns surface automatically
- **Contradiction Detection** — conflicting memories are flagged for resolution

## Sync Phases

<img src="/portage/img/memory-sync-phases.svg" alt="/sync-memory Phase Architecture" />

The `/sync-memory` command has two modes:

| Mode | Phases | When |
|------|--------|------|
| Light | 2 (CodeGraph + Journal consolidation) | Manual invocation |
| Full | 6 (+ Staleness, Patterns, CLAUDE.md, Report) | Daily cron or explicit |

## File Structure

```
.remember/
  now.md                    # Current session buffer
  today-YYYY-MM-DD.md       # Daily journals
  recent.md                 # 7-day rolling summary
  archive.md                # Compressed history
  *.done.md                 # Aged journals (30-day TTL)

~/.claude/projects/.../memory/
  MEMORY.md                 # Index (loaded every session)
  decisions_index.md        # Decision log by domain
  decision_*.md             # Architectural choices
  feedback_*.md             # Behavioral rules
  project_*.md              # Project state files
  reference_*.md            # External system pointers
```

## Decision Log

Architectural decisions are captured automatically when three criteria are met:

1. An alternative was explicitly considered and rejected
2. A future session could plausibly make the opposite choice
3. The reasoning is non-obvious from the code alone

Decisions are posted to the DHG Registry via `post-decision-logs.sh` and saved locally as `decision_*.md` files.
