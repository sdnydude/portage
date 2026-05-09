status: in_progress
phase: 4
feature: Memory intelligence spec implementation — pattern detection, pruning, contradiction scanning, registry metrics, briefing integration
approach: 14-task plan across registry (model/schemas/endpoints/deploy), sync-memory command (light/full mode, 6 phase extensions), briefing hook (Section 7 + freshness)
complexity: complex
tdd: no
spec: |
  Design spec: docs/superpowers/specs/2026-05-09-memory-intelligence-design.md (committed a1cfb0a)
  Plan: docs/superpowers/plans/2026-05-09-memory-intelligence.md (committed a9fa4ea)
  14 tasks: registry (4), sync-memory (7), briefing (1), integration (2)
plan: |
  Task 1: Registry — memory_metrics model + migration
  Task 2: Registry — memory_metrics schemas
  Task 3: Registry — memory_metrics endpoints + router registration
  Task 4: Registry — deploy migration (docker cp, alembic, restart, test)
  Task 5: /sync-memory — light/full mode gate + Stop hook update
  Task 6: /sync-memory — Phase 2 extensions (journal backfill + .done.md cleanup)
  Task 7: /sync-memory — Phase 3a extension (feedback/reference staleness + contradictions)
  Task 8: /sync-memory — Phase 3d (pattern detection)
  Task 9: /sync-memory — Phase 3e (memory pruning)
  Task 10: /sync-memory — Phase 3f (registry metrics POST)
  Task 11: /sync-memory — Phase 6 report extension + .last-full-sync
  Task 12: SessionStart briefing hook — Section 7 + freshness
  Task 13: Commit + push both repos
  Task 14: End-to-end test
progress: []
deferred: []
