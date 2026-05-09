# Memory Intelligence — Design Spec

Cross-session pattern detection, automated memory pruning, and registry metrics reporting. Adds three new phases to /sync-memory and a new `memory_metrics` table to the AI Factory registry.

## Problem

The memory suite accumulates data but doesn't learn from it. Journals pile up without anyone noticing that the same files keep getting fixed. Memories go stale without detection — a `reference_*.md` pointing to a decommissioned service stays in MEMORY.md forever. And nothing about the memory system's health is observable from the AI Factory dashboard.

Three gaps:
1. **No pattern detection** — recurring themes across sessions are invisible
2. **No pruning** — stale memories accumulate, diluting signal
3. **No observability** — memory health and analysis results exist only locally

## Design

### Phase 1: Local Analysis (build now)

#### Phase 3d: Pattern Detection

Added to /sync-memory after Phase 3c (rebuild indexes).

**Input:** All `.remember/today-*.md` and `.done.md` files from the last 14 days. Each daily file represents one session day.

**Analysis:** Claude reads the journal files and identifies:
- **File/directory mentions** — which paths appear across multiple session days
- **Domain activity** — which domains (api, web, shared, infra, registry, ops) were worked on
- **Feature keywords** — recurring themes (auth, marketplace, listing, security, etc.)
- **Sentiment** — whether mentions are feature work ("add", "build", "implement") or fix work ("fix", "bug", "broke", "debug")

This is AI-powered analysis, not regex. Claude understands context and can distinguish "fixed a bug in auth" from "added new auth middleware."

**Hot area threshold:** Items appearing in 3+ of the last 7 daily journals are flagged as hot areas.

**Output — Hot area patterns:**

Saved as `project_pattern_hotarea_{slug}.md` in auto-memory:

```markdown
---
name: Hot area: marketplace adapters
description: Marketplace adapter code modified in 5 of last 7 sessions — signals active development or instability
type: project
---
marketplace/ directory touched in 5 of 7 recent sessions (2026-05-03 through 2026-05-09).
Files: ebay-adapter.ts (4x), reverb-adapter.ts (3x), marketplace.ts (2x).
**Pattern:** Active development area — consider additional test coverage or stabilization.
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

**Lifecycle:** All `project_pattern_*` memories are rolling snapshots — overwritten on each sync run, not accumulated. They reflect the current state, not history. Added to MEMORY.md index on creation; the index entry updates naturally on each 3c rebuild.

#### Phase 3e: Memory Pruning

Added to /sync-memory after Phase 3d.

**Scope:** Extends the existing Phase 3a staleness check (which covers `project_*.md` and `decision_*.md`) to all memory types. Phase 3e then acts on the results — archiving verified-stale memories.

**Verification rules by type:**

| Type | How to verify | Stale if... |
|------|--------------|-------------|
| `project_*` | Check referenced files/features exist | Primary subject removed from codebase |
| `decision_*` | Check chosen approach still in code | Code diverged to rejected alternative |
| `feedback_*` | Check if the behavior it guards is still relevant | Referenced workflow/tool/pattern no longer exists |
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

#### Phase 3f: Registry Metrics POST

Added to /sync-memory after Phase 3e.

After pattern detection and pruning complete, Claude assembles a metrics payload and POSTs it to the registry. Same fire-and-forget pattern as session-capture.sh.

```bash
curl -s -X POST "http://10.0.0.251:8011/api/memory-metrics" \
  -H "Content-Type: application/json" \
  --connect-timeout 3 \
  --max-time 5 \
  -d '{...}' > /dev/null 2>&1 || true
```

If the registry is down, the local analysis still happened and the report still prints. The POST is best-effort.

#### Phase 3a Extension

The existing Phase 3a already checks `project_*.md` and `decision_*.md` for staleness. This spec extends it to also check `feedback_*.md` and `reference_*.md` using the verification rules above. The check logic stays in 3a; the archiving action moves to 3e.

#### Phase 6 Report Extension

The sync report summary table gains three new rows:

```
| System           | Status | Changes Made                    |
|------------------|--------|---------------------------------|
| ...existing...   | ...    | ...                             |
| Pattern detect   | ✅     | 2 hot areas, workflow updated   |
| Memory pruning   | ✅     | 1 archived (reference_old.md)   |
| Registry metrics | ✅     | Posted to memory_metrics API    |
```

#### Updated Phase Order

| Phase | What | Change |
|-------|------|--------|
| 1 | CodeGraph sync | No change |
| 2 | .remember/ consolidation | No change |
| 3a | Stale memory check | **Extended** — covers all 4 types (was project + decision only) |
| 3b | Missing memory check | No change |
| 3c | Rebuild MEMORY.md + decisions_index.md | No change |
| 3d | **Pattern detection** | **New** |
| 3e | **Memory pruning** | **New** |
| 3f | **Registry metrics POST** | **New** |
| 4 | Serena memories | No change |
| 5 | CLAUDE.md currency | No change |
| 6 | Report | **Extended** — 3 new rows |

### Phase 2: Registry Storage (build now)

#### `memory_metrics` Table

New table in the AI Factory registry database (`~/DHG/aifactory3.5/dhgaifactory3.5/registry/`). Same patterns as `agent_sessions`.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | `server_default=uuid4` |
| project | VARCHAR, indexed | e.g., "portage" |
| sync_run_at | TIMESTAMP | When /sync-memory ran |
| hot_areas | JSONB | `[{"name": "marketplace/", "sessions": 5, "of": 7, "sentiment": "feature"}]` |
| workflow_distribution | JSONB | `{"api": 71, "web": 57, "ops": 43}` |
| memory_health | JSONB | `{"total": 20, "stale_pruned": 2, "new_created": 1, "archived": 1}` |
| decision_stats | JSONB | `{"total": 5, "superseded": 0, "by_domain": {"api": 1, "ops": 2}}` |
| patterns_detected | INTEGER | Count of hot areas found |
| created_at | TIMESTAMP | `server_default=func.now()` |

**Index:** `ix_memory_metrics_project_created` on (project, created_at).

#### Endpoint

`POST /api/memory-metrics` — creates a row per sync run. Follows existing registry patterns:
- SQLAlchemy model in `models.py`
- Pydantic schemas in `memory_metrics_schemas.py` (MemoryMetricsCreate with `extra="forbid"`, MemoryMetricsResponse with `from_attributes=True`)
- APIRouter in `memory_metrics_endpoints.py` with `prefix="/api/memory-metrics"`, `tags=["memory-metrics"]`
- Alembic migration creating the table
- Router registered in `api.py`

No GET endpoint yet — the observability UI spec will add query endpoints when it's designed.

#### Data Lifecycle

One row per sync run. At daily 6am cron + occasional session-end syncs, expect ~1-2 rows/day, ~500-700 rows/year. No retention policy needed.

### Phase 3: Registry-Powered Analysis (future)

Once `agent_sessions` has accumulated 2-3 weeks of data:

- Query last 30 sessions' commits and file paths for richer hot area detection
- Cross-reference session tldrs with pattern detection for validation
- Enable cross-project pattern detection (multiple projects reporting to same registry)
- Power the observability UI dashboards (separate spec)

This phase is NOT built now. It's documented here so the data model accounts for it — the JSONB columns in `memory_metrics` are flexible enough to accommodate richer analysis results without schema changes.

## Implementation Scope

### Build Now (Phase 1 + Phase 2)

1. Update `/sync-memory` command with phases 3d, 3e, 3f and extended 3a/6
2. Create `memory_metrics` model, schemas, endpoints, migration in AI Factory registry
3. Deploy registry changes (docker cp + alembic upgrade)
4. Test end-to-end: run /sync-memory, verify patterns detected, metrics posted

### Build Later

- Observability UI dashboards (separate spec)
- Registry-powered analysis using agent_sessions data (Phase 3)
- Cross-project intelligence
