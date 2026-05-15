status: complete
phase: 7
feature: Registry KB data acceleration — bulk ingest memory files and cross-project CLAUDE.md files
approach: Dedicated Python scripts — one for memory files (route by frontmatter type), one for CLAUDE.md files (chunk by heading). Rich meta_data JSONB for analytics/reporting.
complexity: simple
completed_at: 2026-05-15T15:30:00Z

results: |
  - agent_sessions added as 6th KB source (migration 020, 119 searchable sessions)
  - 54 memory files ingested (12 decisions + 42 doc_pages)
  - 189 CLAUDE.md chunks from 5 DHG projects
  - Total KB: 835 records across 6 sources
  - All searchable via POST /api/kb/search with hybrid FTS+vector RRF

known_limitations: |
  - decision_logs NOT idempotent — re-running ingest-memory-files.py creates dupes
  - Root cause: decision_logs API has no upsert/source_file filter
  - Fix: separate /ship for registry upsert across 4 non-idempotent tables

deferred: |
  - Registry upsert for decision_logs, insights, corrections, ship_sessions (needs own /ship)
  - Docusaurus site restructuring for multi-project (Option B — shared/ plugin)
  - agent_sessions embeddings (0 of 524 have embeddings, FTS-only search)
  - CLAUDE.md ingest for new projects as they're added
  - Memory file re-ingest after memory files are updated/added
  - Cron job for periodic re-ingest
