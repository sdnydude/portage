# Memory Intelligence — Design Spec

Cross-session pattern detection, automated memory pruning, registry metrics reporting, and briefing integration. Adds intelligence phases to /sync-memory, a `memory_metrics` table to the AI Factory registry, and a new section to the SessionStart briefing hook.

## Problem

The memory suite accumulates data but doesn't learn from it. Six specific gaps:

1. **No pattern detection** — recurring themes across sessions are invisible
2. **No pruning** — stale memories accumulate, diluting signal
3. **No observability** — memory health and analysis results exist only locally
4. **No delivery** — even when analysis exists, it doesn't reach the next session
5. **No continuity** — sessions are disconnected data points; abandoned work is invisible
6. **No consistency** — memories can contradict each other without detection

## Design

### Phase 1: Local Analysis (build now)

#### Sync Mode: Light vs. Full

Not all /sync-memory triggers need the full analysis pipeline. The heavy AI-powered phases (pattern detection, contradiction scan) are expensive and only need to run daily.

| Trigger | Mode | Phases Run |
|---------|------|------------|
| Daily 6am cron | **Full** | All phases (1–6) |
| Session-end Stop hook | **Light** | Phase 2 (consolidation) + Phase 3f (metrics POST with last-known data) |
| Manual `/sync-memory` | **Full** | All phases (1–6) |

The sync-memory command checks how it was invoked. The Stop hook passes an environment variable `SYNC_MODE=light` to signal lightweight mode. Manual and cron invocations default to full.

#### Phase 2 Extension: Journal Backfill

Before consolidating journals, check for gaps. If a calendar day has git commits but no `.remember/today-*.md` entry (or an entry under 3 lines), backfill a summary from git:

```bash
git log --format="%s" --since="YYYY-MM-DD" --until="YYYY-MM-DD + 1 day" --no-merges
```

Commit subjects are joined into a minimal journal entry. This ensures pattern detection has consistent signal regardless of whether the session journaled well.

Also during Phase 2: delete `.done.md` files older than 30 days. These have already been summarized into `recent.md` and then `archive.md` — keeping them on disk is dead weight.

#### Phase 3a Extension: All Memory Types + Contradiction Detection

**Extended staleness check:** The existing Phase 3a checks `project_*.md` and `decision_*.md`. This spec extends it to also check `feedback_*.md` and `reference_*.md`.

**Feedback memory classification:** Feedback memories fall into two categories that require different verification:

| Category | Example | How to verify | Exempt from pruning? |
|----------|---------|---------------|---------------------|
| **Tooling** | "Check Doppler before asking for keys" | Verify Doppler is still used (grep for doppler in codebase/config) | No — prune if tool is gone |
| **Behavioral** | "Never guess UI navigation" | No codebase artifact to check | Yes — only pruned if explicitly superseded by a newer feedback memory |

Classification heuristic: if the memory references a specific tool, service, file, or pattern by name, it's tooling feedback. If it describes how Claude should behave in general, it's behavioral. When ambiguous, treat as behavioral (safer to keep than to prune).

**Contradiction detection:** After checking individual memories for staleness, scan for contradictions *between* active memories. Read all non-pattern memories and identify pairs where:
- A decision says "chose X" but a feedback memory says "avoid X"
- Two project memories make conflicting claims about the same feature
- A decision's "chosen approach" conflicts with another decision in the same domain

Contradictions are flagged in the Phase 6 report with both memory filenames and the nature of the conflict. They are NOT auto-resolved — contradictions require human judgment.

#### Phase 3d: Pattern Detection

Added to /sync-memory after Phase 3c (rebuild indexes). Only runs in **full** sync mode.

**Input:** All `.remember/today-*.md` and `.done.md` files from the last 14 days. Each daily file represents one session day.

**Analysis:** Claude reads the journal files and identifies:
- **File/directory mentions** — which paths appear across multiple session days
- **Domain activity** — which domains (api, web, shared, infra, registry, ops) were worked on
- **Feature keywords** — recurring themes (auth, marketplace, listing, security, etc.)
- **Sentiment** — whether mentions are feature work ("add", "build", "implement") or fix work ("fix", "bug", "broke", "debug")

This is AI-powered analysis, not regex. Claude understands context and can distinguish "fixed a bug in auth" from "added new auth middleware."

**Hot area threshold:** Items appearing in 3+ of the last 7 daily journals are flagged as hot areas.

**Roadmap correlation:** Each hot area is cross-referenced against `docs/TODO.md` phase completion status. If a hot area maps to a phase marked complete (e.g., auth is hot but Phase 6 Auth shows 1/1), the sentiment is escalated to `regression` regardless of journal keywords. This distinguishes expected active development from unexpected rework on "done" features.

| TODO.md phase status | Journal sentiment | Final tag |
|---------------------|-------------------|-----------|
| Incomplete (< 100%) | feature | `active-development` |
| Incomplete (< 100%) | fix | `active-development` (fixes during build are normal) |
| Complete (100%) | feature | `enhancement` (extending completed work) |
| Complete (100%) | fix | `regression` (rework on supposedly done feature) |

**Unfinished work detection:** Cross-reference hot areas and recent journal mentions against `git branch --list`. If a branch was mentioned in the last 3 journal days but is not the current branch and has not been merged to main, flag it as potentially unfinished work. Include in the pattern output.

**Output — Hot area patterns:**

Saved as `project_pattern_hotarea_{slug}.md` in auto-memory:

```markdown
---
name: Hot area: marketplace adapters
description: Marketplace adapter code modified in 5 of last 7 sessions — active development (Phase 4: 6/7)
type: project
---
marketplace/ directory touched in 5 of 7 recent sessions (2026-05-03 through 2026-05-09).
Files: ebay-adapter.ts (4x), reverb-adapter.ts (3x), marketplace.ts (2x).
**Tag:** active-development (Phase 4 Marketplace: 6/7 incomplete)
**Pattern:** Active development area — on track with roadmap.
```

Or for a regression:

```markdown
---
name: Hot area: auth system [REGRESSION]
description: Auth code modified in 3 of last 7 sessions — regression on completed Phase 6 (1/1)
type: project
---
auth/ touched in 3 of 7 recent sessions (2026-05-05 through 2026-05-09).
Files: jwt.ts (2x), password.ts (1x), auth routes (2x).
**Tag:** regression (Phase 6 Auth: 1/1 COMPLETE — should not need frequent fixes)
**Pattern:** Completed feature requiring repeated fixes — investigate root cause or update TODO.md status.
```

**Output — Workflow distribution:**

Single file `project_pattern_workflow.md`, overwritten each sync:

```markdown
---
name: Workflow distribution (7-day)
description: How session time distributes across project domains — helps prioritize
type: project
---
Last 7 sessions by domain:
- api: 5 sessions (71%)
- web: 4 sessions (57%)
- ops/infra: 3 sessions (43%)
- security: 2 sessions (29%)
```

**Output — Unfinished work** (if any detected):

Saved as `project_pattern_unfinished.md`, overwritten each sync:

```markdown
---
name: Unfinished work detected
description: Branches mentioned in recent sessions but not merged — may need attention
type: project
---
- `feat/listing-detail` — last mentioned 2026-05-07, not merged, 3 commits ahead of main
- `fix/camera-crop` — last mentioned 2026-05-08, not merged, 1 commit ahead of main
```

**Workflow trend comparison:** During the daily full sync, if the registry `memory_metrics` endpoint is reachable, query `GET /api/memory-metrics?project=portage&limit=4` for the last 4 sync results. Compare current week's workflow distribution to the 4-run average. If any domain's share shifted by more than 20 percentage points, note it in the workflow distribution output:

```
**Trend:** ops/infra increased from 15% (4-run avg) to 43% this week — 3x increase
```

If the registry is unreachable or has fewer than 2 prior entries, skip trend comparison silently.

**Lifecycle:** All `project_pattern_*` memories are rolling snapshots — overwritten on each full sync run, not accumulated. They reflect the current state, not history. Added to MEMORY.md index on creation; the index entry updates naturally on each 3c rebuild.

#### Phase 3e: Memory Pruning

Added to /sync-memory after Phase 3d. Only runs in **full** sync mode.

**Scope:** Acts on the staleness results from the extended Phase 3a — archiving verified-stale memories.

**Verification rules by type:**

| Type | How to verify | Stale if... |
|------|--------------|-------------|
| `project_*` | Check referenced files/features exist | Primary subject removed from codebase |
| `decision_*` | Check chosen approach still in code | Code diverged to rejected alternative |
| `feedback_*` (tooling) | Check if referenced tool/service still used | Tool/service no longer in codebase or config |
| `feedback_*` (behavioral) | Exempt — no codebase artifact | Only if explicitly superseded by newer feedback |
| `reference_*` | Check if the external system is still used | Service/URL/tool no longer referenced in codebase |
| `project_pattern_*` | Always overwritten by 3d | N/A — never pruned, just refreshed |

**Archive behavior:** Stale memories are NOT deleted. They get:

1. Content appended to `memory_archive.md` in the auto-memory directory with date stamp and reason:
   ```
   ---
   ## Archived: 2026-05-09 — reference_old_service.md
   **Reason:** Service URL no longer referenced in codebase
   [original file content]
   ```
2. Original file removed from disk
3. Entry removed from MEMORY.md index
4. Reported in the Phase 6 sync report

**Safety rails:**
- Never prune a memory less than 7 days old (too new to judge)
- Never prune more than 3 memories in a single sync run (circuit breaker). If 4+ memories appear stale, flag all for manual review instead of auto-archiving — something may be wrong with the verification heuristics
- `project_pattern_*` files are excluded from pruning (they're rolling snapshots managed by 3d)
- Behavioral feedback memories are exempt from codebase-based pruning

#### Phase 3f: Registry Metrics POST

Added to /sync-memory after Phase 3e. Runs in **both** light and full modes.

In full mode: assembles the complete metrics payload from phases 3d/3e results.

In light mode: POSTs a minimal payload with just `memory_health` (file counts) and `sync_run_at`. Hot areas and workflow distribution fields are null (the last full sync's data is already in the registry).

```bash
curl -s -X POST "http://10.0.0.251:8011/api/memory-metrics" \
  -H "Content-Type: application/json" \
  --connect-timeout 3 \
  --max-time 5 \
  -d '{...}' > /dev/null 2>&1 || true
```

If the registry is down, the local analysis still happened and the report still prints. The POST is best-effort.

#### Phase 6 Report Extension

The sync report summary table gains new rows (full mode):

```
| System              | Status | Changes Made                              |
|---------------------|--------|-------------------------------------------|
| ...existing...      | ...    | ...                                       |
| Pattern detect      | ✅     | 2 hot areas (1 regression), workflow updated |
| Unfinished work     | ⚠️     | 1 unmerged branch detected                |
| Contradictions      | ✅     | None found (or: 1 flagged — see details)  |
| Memory pruning      | ✅     | 1 archived (reference_old.md)             |
| Journal backfill    | ✅     | 1 day backfilled from git log             |
| .done.md cleanup    | ✅     | 2 files removed (> 30 days old)           |
| Registry metrics    | ✅     | Posted to memory_metrics API              |
```

#### Updated Phase Order

| Phase | What | Mode | Change |
|-------|------|------|--------|
| 1 | CodeGraph sync | Full | No change |
| 2 | .remember/ consolidation | Both | **Extended** — journal backfill + .done.md cleanup |
| 3a | Stale memory check | Full | **Extended** — all 4 types + contradiction detection |
| 3b | Missing memory check | Full | No change |
| 3c | Rebuild MEMORY.md + decisions_index.md | Full | No change |
| 3d | **Pattern detection** | Full | **New** — hot areas, roadmap correlation, unfinished work, workflow trends |
| 3e | **Memory pruning** | Full | **New** — archive stale, feedback categorization |
| 3f | **Registry metrics POST** | Both | **New** — full or minimal payload |
| 4 | Serena memories | Full | No change |
| 5 | CLAUDE.md currency | Full | No change |
| 6 | Report | Full | **Extended** — pattern/prune/contradiction/backfill rows |

### SessionStart Briefing Integration

#### Section 7: Intelligence Summary

Add a 7th section to `session-briefing.sh` that reads pattern detection results and surfaces them at session start. This is the delivery mechanism — without it, patterns are detected but never land in the next session's context.

```bash
# --- Section 7: Memory Intelligence ---
(
  MEMORY_DIR="$HOME/.claude/projects/-home-swebber64-DHG-portage/memory"

  # Hot areas
  HOTAREAS=$(find "$MEMORY_DIR" -name "project_pattern_hotarea_*.md" -newer "$MEMORY_DIR/MEMORY.md" 2>/dev/null)
  if [ -n "$HOTAREAS" ]; then
    echo "--- Hot Areas ---"
    for f in $HOTAREAS; do
      grep -A1 "^name:" "$f" | head -1 | sed 's/^name: //'
    done
    echo ""
  fi

  # Unfinished work
  UNFINISHED="$MEMORY_DIR/project_pattern_unfinished.md"
  if [ -f "$UNFINISHED" ] && [ -s "$UNFINISHED" ]; then
    echo "--- Unfinished Work ---"
    grep "^-" "$UNFINISHED"
    echo ""
  fi

  # Workflow trend alert (only if trend line exists)
  WORKFLOW="$MEMORY_DIR/project_pattern_workflow.md"
  if [ -f "$WORKFLOW" ]; then
    TREND=$(grep "^\*\*Trend:" "$WORKFLOW" 2>/dev/null)
    if [ -n "$TREND" ]; then
      echo "--- Workflow Alert ---"
      echo "$TREND"
      echo ""
    fi
  fi
) || true
```

#### Briefing Freshness Indicator

Add a freshness line to the briefing header showing when /sync-memory last completed a full run. The daily sync writes a timestamp to `.remember/.last-full-sync`:

```bash
echo "=== SESSION BRIEFING ==="
# Freshness
(
  LAST_SYNC="$PROJECT_DIR/.remember/.last-full-sync"
  if [ -f "$LAST_SYNC" ]; then
    SYNC_TIME=$(cat "$LAST_SYNC")
    echo "Last full sync: $SYNC_TIME"
  fi
) || true
echo ""
```

The full sync writes this file at the end of Phase 6:

```bash
date -u +"%Y-%m-%d %H:%M UTC" > "$PROJECT_DIR/.remember/.last-full-sync"
```

If the file is missing or older than 48 hours, Claude should consider running `/sync-memory` manually.

### Phase 2: Registry Storage (build now)

#### `memory_metrics` Table

New table in the AI Factory registry database (`~/DHG/aifactory3.5/dhgaifactory3.5/registry/`). Same patterns as `agent_sessions`.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | `server_default=uuid4` |
| project | VARCHAR, indexed | e.g., "portage" |
| sync_mode | VARCHAR | "full" or "light" |
| sync_run_at | TIMESTAMP | When /sync-memory ran |
| hot_areas | JSONB, nullable | `[{"name": "marketplace/", "sessions": 5, "of": 7, "tag": "active-development", "phase": "Phase 4: 6/7"}]` |
| workflow_distribution | JSONB, nullable | `{"api": 71, "web": 57, "ops": 43}` |
| workflow_trend | JSONB, nullable | `{"shifts": [{"domain": "ops", "current": 43, "average": 15, "change": "+28pp"}]}` |
| memory_health | JSONB | `{"total": 20, "stale_pruned": 2, "new_created": 1, "archived": 1}` |
| decision_stats | JSONB, nullable | `{"total": 5, "superseded": 0, "by_domain": {"api": 1, "ops": 2}}` |
| contradictions | JSONB, nullable | `[{"memory_a": "decision_api_bcrypt.md", "memory_b": "feedback_avoid_esm.md", "nature": "..."}]` |
| unfinished_branches | JSONB, nullable | `[{"branch": "feat/listing-detail", "last_mentioned": "2026-05-07", "commits_ahead": 3}]` |
| journal_backfills | INTEGER, nullable | Count of days backfilled from git |
| patterns_detected | INTEGER, nullable | Count of hot areas found |
| created_at | TIMESTAMP | `server_default=func.now()` |

**Index:** `ix_memory_metrics_project_created` on (project, created_at).

Nullable fields are null on light-mode sync runs. Full syncs populate everything.

#### Endpoints

- `POST /api/memory-metrics` — creates a row per sync run
- `GET /api/memory-metrics?project=portage&limit=N` — returns last N entries for trend comparison (used by Phase 3d during full sync)

Both follow existing registry patterns:
- SQLAlchemy model in `models.py`
- Pydantic schemas in `memory_metrics_schemas.py` (MemoryMetricsCreate with `extra="forbid"`, MemoryMetricsResponse with `from_attributes=True`, MemoryMetricsList for paginated response)
- APIRouter in `memory_metrics_endpoints.py` with `prefix="/api/memory-metrics"`, `tags=["memory-metrics"]`
- Alembic migration creating the table
- Router registered in `api.py`

#### Data Lifecycle

One row per sync run. At daily 6am cron + session-end light syncs, expect ~2-4 rows/day, ~1000-1500 rows/year. No retention policy needed.

### Phase 3: Registry-Powered Analysis (future)

Once `agent_sessions` has accumulated 2-3 weeks of data:

- Query last 30 sessions' commits and file paths for richer hot area detection (supplement journal analysis with actual git data)
- Cross-reference session tldrs with pattern detection for validation
- Enable cross-project pattern detection (multiple projects reporting to same registry)
- Power the observability UI dashboards (separate spec)

This phase is NOT built now. It's documented here so the data model accounts for it — the JSONB columns in `memory_metrics` are flexible enough to accommodate richer analysis results without schema changes.

## Implementation Scope

### Build Now (Phase 1 + Phase 2)

1. Update `/sync-memory` command: light/full mode gate, Phase 2 extensions (journal backfill + .done.md cleanup), Phase 3a extension (all types + contradiction detection + feedback categorization), new phases 3d/3e/3f, Phase 6 extension
2. Update Stop hook to pass `SYNC_MODE=light` environment variable
3. Create `memory_metrics` model, schemas, endpoints (POST + GET), migration in AI Factory registry
4. Deploy registry changes (docker cp + alembic upgrade)
5. Add Section 7 (Intelligence Summary) + freshness indicator to `session-briefing.sh`
6. Write `.last-full-sync` timestamp at end of full sync
7. Test end-to-end: run /sync-memory in full mode, verify patterns detected, contradictions scanned, metrics posted, briefing updated

### Build Later

- Observability UI dashboards (separate spec)
- Registry-powered analysis using agent_sessions data (Phase 3)
- Cross-project intelligence
