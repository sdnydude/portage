# Memory Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cross-session pattern detection, automated memory pruning, contradiction detection, and registry metrics reporting to the /sync-memory system, with intelligence results surfaced in the SessionStart briefing hook.

**Architecture:** Three new phases (3d/3e/3f) added to the /sync-memory slash command, with extensions to Phase 2 (journal backfill, .done.md cleanup), Phase 3a (all memory types + contradictions), and Phase 6 (expanded report). A `memory_metrics` table + POST/GET endpoints added to the AI Factory registry. The SessionStart briefing hook gains a 7th section showing pattern results and a freshness indicator. A light/full sync mode gates expensive phases.

**Tech Stack:** Markdown (slash command), Bash (hooks), Python/FastAPI/SQLAlchemy/Alembic (registry).

---

### Task 1: Registry — memory_metrics model and migration

**Files:**
- Modify: `~/DHG/aifactory3.5/dhgaifactory3.5/registry/models.py` (append after AgentSession class, ~line 1174)
- Create: `~/DHG/aifactory3.5/dhgaifactory3.5/registry/alembic/versions/013_add_memory_metrics.py`

- [ ] **Step 1: Add MemoryMetrics model to models.py**

Append after the `AgentSession` class (after line 1174):

```python
class MemoryMetrics(Base):
    """Tracks memory intelligence sync results — pattern detection, pruning, health."""
    __tablename__ = "memory_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project = Column(String(100), nullable=False, index=True)
    sync_mode = Column(String(10), nullable=False)  # full, light
    sync_run_at = Column(DateTime(timezone=True), nullable=False)

    hot_areas = Column(JSONB, nullable=True)
    workflow_distribution = Column(JSONB, nullable=True)
    workflow_trend = Column(JSONB, nullable=True)
    memory_health = Column(JSONB, nullable=False)
    decision_stats = Column(JSONB, nullable=True)
    contradictions = Column(JSONB, nullable=True)
    unfinished_branches = Column(JSONB, nullable=True)
    journal_backfills = Column(Integer, nullable=True)
    patterns_detected = Column(Integer, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        Index("ix_memory_metrics_project_created", "project", "created_at"),
    )
```

- [ ] **Step 2: Create Alembic migration**

Create `~/DHG/aifactory3.5/dhgaifactory3.5/registry/alembic/versions/013_add_memory_metrics.py`:

```python
"""add memory_metrics table

Revision ID: 013
Revises: 012
Create Date: 2026-05-09

Tracks memory intelligence sync results: pattern detection, pruning,
contradiction scans, workflow distribution, and health metrics.
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "memory_metrics",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project", sa.String(100), nullable=False),
        sa.Column("sync_mode", sa.String(10), nullable=False),
        sa.Column("sync_run_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("hot_areas", postgresql.JSONB, nullable=True),
        sa.Column("workflow_distribution", postgresql.JSONB, nullable=True),
        sa.Column("workflow_trend", postgresql.JSONB, nullable=True),
        sa.Column("memory_health", postgresql.JSONB, nullable=False),
        sa.Column("decision_stats", postgresql.JSONB, nullable=True),
        sa.Column("contradictions", postgresql.JSONB, nullable=True),
        sa.Column("unfinished_branches", postgresql.JSONB, nullable=True),
        sa.Column("journal_backfills", sa.Integer, nullable=True),
        sa.Column("patterns_detected", sa.Integer, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_index("ix_memory_metrics_project", "memory_metrics", ["project"])
    op.create_index("ix_memory_metrics_project_created", "memory_metrics", ["project", "created_at"])


def downgrade() -> None:
    op.drop_table("memory_metrics")
```

- [ ] **Step 3: Verify model file is syntactically valid**

Run: `cd ~/DHG/aifactory3.5/dhgaifactory3.5/registry && python3 -c "import models; print('MemoryMetrics' in dir(models))"`
Expected: `True`

---

### Task 2: Registry — memory_metrics schemas

**Files:**
- Create: `~/DHG/aifactory3.5/dhgaifactory3.5/registry/memory_metrics_schemas.py`

- [ ] **Step 1: Create the schemas file**

```python
"""Pydantic schemas for the memory_metrics API.

Tracks /sync-memory results: pattern detection, pruning, contradiction
scans, workflow distribution, and memory health metrics.
"""
from datetime import datetime
from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


SyncMode = Literal["full", "light"]


class MemoryMetricsCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project: str
    sync_mode: SyncMode
    sync_run_at: datetime
    hot_areas: Optional[list[dict[str, Any]]] = None
    workflow_distribution: Optional[dict[str, Any]] = None
    workflow_trend: Optional[dict[str, Any]] = None
    memory_health: dict[str, Any]
    decision_stats: Optional[dict[str, Any]] = None
    contradictions: Optional[list[dict[str, Any]]] = None
    unfinished_branches: Optional[list[dict[str, Any]]] = None
    journal_backfills: Optional[int] = None
    patterns_detected: Optional[int] = None


class MemoryMetricsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project: str
    sync_mode: str
    sync_run_at: datetime
    hot_areas: Optional[list[dict[str, Any]]]
    workflow_distribution: Optional[dict[str, Any]]
    workflow_trend: Optional[dict[str, Any]]
    memory_health: dict[str, Any]
    decision_stats: Optional[dict[str, Any]]
    contradictions: Optional[list[dict[str, Any]]]
    unfinished_branches: Optional[list[dict[str, Any]]]
    journal_backfills: Optional[int]
    patterns_detected: Optional[int]
    created_at: datetime


class MemoryMetricsList(BaseModel):
    metrics: list[MemoryMetricsResponse]
    total: int
```

- [ ] **Step 2: Verify schemas import cleanly**

Run: `cd ~/DHG/aifactory3.5/dhgaifactory3.5/registry && python3 -c "from memory_metrics_schemas import MemoryMetricsCreate, MemoryMetricsResponse, MemoryMetricsList; print('OK')"`
Expected: `OK`

---

### Task 3: Registry — memory_metrics endpoints

**Files:**
- Create: `~/DHG/aifactory3.5/dhgaifactory3.5/registry/memory_metrics_endpoints.py`
- Modify: `~/DHG/aifactory3.5/dhgaifactory3.5/registry/api.py`

- [ ] **Step 1: Create the endpoints file**

```python
"""Memory Metrics API endpoints.

Routes:
  POST   /api/memory-metrics              create metrics record from sync run
  GET    /api/memory-metrics              list with filters (project, limit, offset)
"""
import os
import sys
import time
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from database import get_db
from models import MemoryMetrics
from memory_metrics_schemas import (
    MemoryMetricsCreate,
    MemoryMetricsResponse,
    MemoryMetricsList,
)

logger = logging.getLogger(__name__)

try:
    from api import (
        registry_read_latency,
        registry_read_operations,
        registry_write_latency,
        registry_write_operations,
        registry_errors,
    )
except ImportError:
    from prometheus_client import Counter, Histogram
    registry_read_latency = Histogram(
        "registry_read_latency", "Read latency",
        buckets=[1, 5, 10, 25, 50, 100, 250, 500, 1000],
    )
    registry_read_operations = Counter(
        "registry_read_operations", "Read operations", ["operation"],
    )
    registry_write_latency = Histogram(
        "registry_write_latency", "Write latency",
        buckets=[1, 5, 10, 25, 50, 100, 250, 500, 1000],
    )
    registry_write_operations = Counter(
        "registry_write_operations", "Write operations", ["operation"],
    )
    registry_errors = Counter(
        "registry_errors", "Registry errors", ["error_type"],
    )


router = APIRouter(prefix="/api/memory-metrics", tags=["memory-metrics"])


@router.post("", response_model=MemoryMetricsResponse, status_code=status.HTTP_201_CREATED)
async def create_memory_metrics(
    payload: MemoryMetricsCreate,
    db: Session = Depends(get_db),
) -> MemoryMetricsResponse:
    start = time.time()
    try:
        row = MemoryMetrics(**payload.model_dump())
        db.add(row)
        db.commit()
        db.refresh(row)

        registry_write_operations.labels(operation="create_memory_metrics").inc()
        registry_write_latency.observe((time.time() - start) * 1000)
        return row
    except Exception as e:
        db.rollback()
        registry_errors.labels(error_type="create_memory_metrics_failed").inc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("", response_model=MemoryMetricsList)
async def list_memory_metrics(
    project: Optional[str] = Query(None),
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> MemoryMetricsList:
    start = time.time()
    try:
        query = db.query(MemoryMetrics)
        if project:
            query = query.filter(MemoryMetrics.project == project)

        total = query.count()
        rows = (
            query
            .order_by(MemoryMetrics.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

        registry_read_operations.labels(operation="list_memory_metrics").inc()
        registry_read_latency.observe((time.time() - start) * 1000)
        return MemoryMetricsList(metrics=rows, total=total)
    except Exception as e:
        registry_errors.labels(error_type="list_memory_metrics_failed").inc()
        raise HTTPException(status_code=500, detail=str(e))
```

- [ ] **Step 2: Register the router in api.py**

Add the import alongside the other router imports (near the `from agent_sessions_endpoints import` line):

```python
from memory_metrics_endpoints import router as memory_metrics_router
```

Add the `include_router` call alongside the other routers (near the `app.include_router(agent_sessions_router)` line):

```python
app.include_router(memory_metrics_router)
```

- [ ] **Step 3: Verify endpoints import cleanly**

Run: `cd ~/DHG/aifactory3.5/dhgaifactory3.5/registry && python3 -c "from memory_metrics_endpoints import router; print(f'{len(router.routes)} routes')"`
Expected: `2 routes`

---

### Task 4: Registry — deploy migration

**Files:**
- Files created in Tasks 1-3

- [ ] **Step 1: Copy new files into registry container**

```bash
docker cp ~/DHG/aifactory3.5/dhgaifactory3.5/registry/models.py dhg-registry-api:/app/
docker cp ~/DHG/aifactory3.5/dhgaifactory3.5/registry/memory_metrics_schemas.py dhg-registry-api:/app/
docker cp ~/DHG/aifactory3.5/dhgaifactory3.5/registry/memory_metrics_endpoints.py dhg-registry-api:/app/
docker cp ~/DHG/aifactory3.5/dhgaifactory3.5/registry/api.py dhg-registry-api:/app/
docker cp ~/DHG/aifactory3.5/dhgaifactory3.5/registry/alembic/versions/013_add_memory_metrics.py dhg-registry-api:/app/alembic/versions/
```

- [ ] **Step 2: Run the migration**

```bash
docker exec dhg-registry-api alembic upgrade head
```

Expected: `INFO  [alembic.runtime.migration] Running upgrade 012 -> 013, add memory_metrics table`

- [ ] **Step 3: Restart the container**

```bash
docker restart dhg-registry-api
```

Wait 5 seconds, then verify:

```bash
curl -s http://10.0.0.251:8011/healthz | head -1
```

Expected: `{"status":"healthy"...}`

- [ ] **Step 4: Test POST endpoint**

```bash
curl -s -X POST http://10.0.0.251:8011/api/memory-metrics \
  -H "Content-Type: application/json" \
  -d '{
    "project": "portage",
    "sync_mode": "full",
    "sync_run_at": "2026-05-09T10:00:00Z",
    "memory_health": {"total": 20, "stale_pruned": 0, "new_created": 0, "archived": 0},
    "patterns_detected": 0
  }' | python3 -m json.tool | head -5
```

Expected: JSON response with `id`, `project: "portage"`, `sync_mode: "full"`, HTTP 201.

- [ ] **Step 5: Test GET endpoint**

```bash
curl -s "http://10.0.0.251:8011/api/memory-metrics?project=portage&limit=1" | python3 -m json.tool | head -5
```

Expected: `{"metrics": [...], "total": 1}`

- [ ] **Step 6: Clean up test record**

```bash
docker exec dhg-registry-api python3 -c "
from database import SessionLocal
from models import MemoryMetrics
db = SessionLocal()
db.query(MemoryMetrics).filter(MemoryMetrics.project == 'portage').delete()
db.commit()
print('Cleaned up test records')
"
```

- [ ] **Step 7: Commit registry changes**

```bash
cd ~/DHG/aifactory3.5
git add dhgaifactory3.5/registry/models.py dhgaifactory3.5/registry/memory_metrics_schemas.py dhgaifactory3.5/registry/memory_metrics_endpoints.py dhgaifactory3.5/registry/api.py dhgaifactory3.5/registry/alembic/versions/013_add_memory_metrics.py
git commit -m "feat(registry): add memory_metrics table and API endpoints

POST/GET /api/memory-metrics for tracking /sync-memory results:
pattern detection, pruning, contradiction scans, workflow distribution,
and memory health metrics.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Update /sync-memory — light/full mode gate

**Files:**
- Modify: `/home/swebber64/DHG/portage/.claude/commands/sync-memory.md`
- Modify: `/home/swebber64/DHG/portage/.claude/hooks/memory-sync.sh`

- [ ] **Step 1: Add sync mode instructions to the top of sync-memory.md**

Add a new section right after the `# Sync Memory` header (before Phase 1):

```markdown
## Sync Mode

This command runs in two modes:

- **Full mode** (default): Runs all phases. Used by daily 6am cron and manual `/sync-memory` invocation.
- **Light mode**: Runs only Phase 2 (consolidation) and Phase 3f (metrics POST with minimal data). Used by session-end Stop hook to avoid expensive AI analysis on every exit.

Check for the `SYNC_MODE` environment variable. If `SYNC_MODE=light`, skip Phases 1, 3a-3e, 4, and 5. Only run Phase 2 and Phase 3f (with a minimal metrics payload where hot_areas, workflow_distribution, decision_stats, contradictions, and unfinished_branches are all null).

If `SYNC_MODE` is unset or any other value, run full mode.
```

- [ ] **Step 2: Update memory-sync.sh to pass SYNC_MODE=light**

In `/home/swebber64/DHG/portage/.claude/hooks/memory-sync.sh`, change the claude CLI invocation (line 56-59) from:

```bash
  "$CLAUDE_BIN" -p "Run /sync-memory — full audit of all 5 memory systems. Be concise, fix what's stale, skip what's current." \
    --allowedTools "Bash,Read,Write,Edit" \
    --max-turns 30 \
    > "$LOG_DIR/sync-$(date +%Y%m%d-%H%M%S).log" 2>&1
```

To:

```bash
  SYNC_MODE=light "$CLAUDE_BIN" -p "Run /sync-memory — light mode, consolidation and metrics only." \
    --allowedTools "Bash,Read,Write,Edit" \
    --max-turns 10 \
    > "$LOG_DIR/sync-$(date +%Y%m%d-%H%M%S).log" 2>&1
```

- [ ] **Step 3: Verify memory-sync.sh is syntactically valid**

Run: `bash -n /home/swebber64/DHG/portage/.claude/hooks/memory-sync.sh && echo "OK"`
Expected: `OK`

---

### Task 6: Update /sync-memory — Phase 2 extensions (journal backfill + .done.md cleanup)

**Files:**
- Modify: `/home/swebber64/DHG/portage/.claude/commands/sync-memory.md`

- [ ] **Step 1: Add journal backfill to Phase 2**

After the existing Phase 2 step 4 (compress old entries from recent.md into archive.md), add:

```markdown
5. **Journal backfill from git:** For each of the last 14 calendar days, check if a `today-YYYY-MM-DD.md` file exists and has more than 3 lines. If a day has git commits (check with `git log --format="%s" --since="YYYY-MM-DD" --until="YYYY-MM-DD + 1 day" --no-merges`) but no journal entry or an entry under 3 lines, create/append a backfill entry:
   ```
   ## [HH:MM] | [branch] (backfilled from git)
   [commit subject 1]; [commit subject 2]; ...
   ```
   This ensures pattern detection has consistent signal regardless of journaling quality. Only backfill — never overwrite existing journal content.

6. **Clean up old .done.md files:** Delete any `.done.md` files in `.remember/` older than 30 days. These have already been summarized into `recent.md` and `archive.md`. Check file modification time with `find .remember/ -name "*.done.md" -mtime +30 -delete`.
```

- [ ] **Step 2: Verify the command file is valid**

Run: `wc -l /home/swebber64/DHG/portage/.claude/commands/sync-memory.md`
Expected: Line count increased from current (~107 lines) by approximately 12-15 lines.

---

### Task 7: Update /sync-memory — Phase 3a extension (all types + contradictions)

**Files:**
- Modify: `/home/swebber64/DHG/portage/.claude/commands/sync-memory.md`

- [ ] **Step 1: Add feedback and reference verification to Phase 3a**

After the existing `decision_*.md` audit block in Phase 3a, add:

```markdown
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
```

- [ ] **Step 2: Add contradiction detection to Phase 3a**

After all the per-type staleness checks, add:

```markdown
**Contradiction detection:** After individual staleness checks, scan for contradictions between active (non-stale) memories:
- Read all non-pattern memory files
- Check for pairs where:
  - A decision says "chose X" but a feedback memory says "avoid X"
  - Two project memories make conflicting claims about the same feature's status
  - A decision's chosen approach conflicts with another decision in the same domain
- Contradictions are NOT auto-resolved — they require human judgment
- List all contradictions found with both memory filenames and the nature of the conflict
- These will be reported in Phase 6 and posted to registry in Phase 3f
```

- [ ] **Step 3: Verify file syntax**

Run: `grep -c "contradiction" /home/swebber64/DHG/portage/.claude/commands/sync-memory.md`
Expected: At least 3 occurrences (the detection section, report reference, and registry reference)

---

### Task 8: Update /sync-memory — Phase 3d (pattern detection)

**Files:**
- Modify: `/home/swebber64/DHG/portage/.claude/commands/sync-memory.md`

- [ ] **Step 1: Add Phase 3d after Phase 3c**

After the existing Phase 3c section, add:

```markdown
### 3d: Pattern Detection (full mode only)

Skip this phase if `SYNC_MODE=light`.

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
```

- [ ] **Step 2: Verify Phase 3d was added**

Run: `grep -c "^### 3d" /home/swebber64/DHG/portage/.claude/commands/sync-memory.md`
Expected: `1`

---

### Task 9: Update /sync-memory — Phase 3e (memory pruning)

**Files:**
- Modify: `/home/swebber64/DHG/portage/.claude/commands/sync-memory.md`

- [ ] **Step 1: Add Phase 3e after Phase 3d**

```markdown
### 3e: Memory Pruning (full mode only)

Skip this phase if `SYNC_MODE=light`.

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
```

- [ ] **Step 2: Verify Phase 3e was added**

Run: `grep -c "^### 3e" /home/swebber64/DHG/portage/.claude/commands/sync-memory.md`
Expected: `1`

---

### Task 10: Update /sync-memory — Phase 3f (registry metrics POST)

**Files:**
- Modify: `/home/swebber64/DHG/portage/.claude/commands/sync-memory.md`

- [ ] **Step 1: Add Phase 3f after Phase 3e**

```markdown
### 3f: Registry Metrics POST (both modes)

This phase runs in both full and light modes.

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
```

- [ ] **Step 2: Verify Phase 3f was added**

Run: `grep -c "^### 3f" /home/swebber64/DHG/portage/.claude/commands/sync-memory.md`
Expected: `1`

---

### Task 11: Update /sync-memory — Phase 6 report extension + .last-full-sync

**Files:**
- Modify: `/home/swebber64/DHG/portage/.claude/commands/sync-memory.md`

- [ ] **Step 1: Extend the Phase 6 report table**

Replace the existing Phase 6 report table in sync-memory.md with:

```markdown
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

**Write freshness timestamp:** At the end of a full sync (not light), write the current UTC time to `.remember/.last-full-sync`:

```bash
date -u +"%Y-%m-%d %H:%M UTC" > .remember/.last-full-sync
```

This file is read by the SessionStart briefing hook to show when the last full sync occurred.
```

- [ ] **Step 2: Verify Phase 6 has the new rows**

Run: `grep -c "Contradictions\|Pattern detect\|Unfinished\|Journal backfill\|\.done\.md cleanup\|last-full-sync" /home/swebber64/DHG/portage/.claude/commands/sync-memory.md`
Expected: At least 6 matches

---

### Task 12: Update SessionStart briefing hook — Section 7 + freshness

**Files:**
- Modify: `/home/swebber64/DHG/portage/.claude/hooks/session-briefing.sh`

- [ ] **Step 1: Add freshness indicator to the briefing header**

Change the opening of `session-briefing.sh` from:

```bash
echo "=== SESSION BRIEFING ==="
```

To:

```bash
echo "=== SESSION BRIEFING ==="

# Freshness indicator
(
  LAST_SYNC="$PROJECT_DIR/.remember/.last-full-sync"
  if [ -f "$LAST_SYNC" ]; then
    echo "Last full sync: $(cat "$LAST_SYNC")"
  else
    echo "Last full sync: never (run /sync-memory)"
  fi
) || true
echo ""
```

- [ ] **Step 2: Add Section 7 (Intelligence Summary) before the closing banner**

Add before the `echo "=== END BRIEFING ==="` line:

```bash
# --- Section 7: Memory Intelligence ---
(
  MEMORY_DIR="$HOME/.claude/projects/-home-swebber64-DHG-portage/memory"

  # Hot areas
  HOT_FILES=$(find "$MEMORY_DIR" -name "project_pattern_hotarea_*.md" 2>/dev/null)
  if [ -n "$HOT_FILES" ]; then
    echo "--- Hot Areas ---"
    for f in $HOT_FILES; do
      NAME=$(grep "^name:" "$f" 2>/dev/null | head -1 | sed 's/^name: //')
      TAG=$(grep "^\*\*Tag:" "$f" 2>/dev/null | head -1)
      if [ -n "$NAME" ]; then
        echo "$NAME"
        [ -n "$TAG" ] && echo "  $TAG"
      fi
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

  # Workflow trend alert
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

- [ ] **Step 3: Test the updated briefing script**

Run: `bash /home/swebber64/DHG/portage/.claude/hooks/session-briefing.sh 2>&1 | head -5`
Expected: `=== SESSION BRIEFING ===` followed by either `Last full sync: [timestamp]` or `Last full sync: never (run /sync-memory)`.

- [ ] **Step 4: Test that Section 7 doesn't error when no pattern files exist**

Run: `bash /home/swebber64/DHG/portage/.claude/hooks/session-briefing.sh 2>&1 | tail -3`
Expected: Script completes with `=== END BRIEFING ===`. No errors from Section 7 (the `find` command returns empty, the section is silently skipped).

---

### Task 13: Commit Portage changes and push

**Files:**
- All Portage files modified in Tasks 5-12

- [ ] **Step 1: Verify all modified files**

Run: `git -C /home/swebber64/DHG/portage status --short`
Expected: Modified files include `.claude/commands/sync-memory.md`, `.claude/hooks/memory-sync.sh`, `.claude/hooks/session-briefing.sh`, and any new spec/plan docs.

- [ ] **Step 2: Stage and commit**

```bash
cd /home/swebber64/DHG/portage
git add .claude/commands/sync-memory.md .claude/hooks/memory-sync.sh .claude/hooks/session-briefing.sh docs/superpowers/plans/2026-05-09-memory-intelligence.md
git commit -m "feat: add memory intelligence to /sync-memory and briefing hook

Pattern detection (hot areas, workflow distribution, unfinished work),
automated pruning with archive, contradiction scanning, journal backfill,
light/full sync modes, briefing Section 7 with intelligence summary,
freshness indicator, and registry metrics POST.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

- [ ] **Step 3: Push both repos**

```bash
cd /home/swebber64/DHG/portage && git push
cd ~/DHG/aifactory3.5 && git push
```

---

### Task 14: End-to-end test — run full /sync-memory

**Files:**
- No new files — this is a test task

- [ ] **Step 1: Run /sync-memory manually**

Run `/sync-memory` in a Claude Code session (this will be a full-mode sync since `SYNC_MODE` is not set).

Expected behavior:
- Phase 1: CodeGraph syncs
- Phase 2: Consolidates .remember/, backfills any missing journal days from git, cleans up .done.md files older than 30 days
- Phase 3a: Checks all 4 memory types for staleness + contradiction detection
- Phase 3b: Checks for missing memories
- Phase 3c: Rebuilds MEMORY.md and decisions_index.md
- Phase 3d: Analyzes journals for hot areas, workflow distribution, unfinished work, workflow trends
- Phase 3e: Archives any stale memories (with safety rails)
- Phase 3f: POSTs metrics to registry
- Phase 4-5: Serena + CLAUDE.md checks
- Phase 6: Extended report with all new rows + writes .last-full-sync

- [ ] **Step 2: Verify pattern files were created**

Run: `ls ~/.claude/projects/-home-swebber64-DHG-portage/memory/project_pattern_*.md`
Expected: At least `project_pattern_workflow.md` exists. Hot area files may or may not exist depending on journal analysis.

- [ ] **Step 3: Verify registry received metrics**

Run: `curl -s "http://10.0.0.251:8011/api/memory-metrics?project=portage&limit=1" | python3 -m json.tool | head -10`
Expected: JSON with `total: 1` (or more), latest entry has `sync_mode: "full"`, `memory_health` populated.

- [ ] **Step 4: Verify freshness file was written**

Run: `cat /home/swebber64/DHG/portage/.remember/.last-full-sync`
Expected: Current UTC timestamp (e.g., `2026-05-09 15:30 UTC`)

- [ ] **Step 5: Verify briefing shows freshness + Section 7**

Run: `bash /home/swebber64/DHG/portage/.claude/hooks/session-briefing.sh 2>&1 | grep -A2 "Last full sync\|Hot Areas\|Workflow Alert\|Unfinished Work"`
Expected: `Last full sync: [timestamp]` line present. Section 7 content present if patterns were detected.
