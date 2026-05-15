status: in_progress
phase: 5
feature: Registry KB data acceleration — bulk ingest memory files and cross-project CLAUDE.md files
approach: Dedicated Python scripts — one for memory files (route by frontmatter type), one for CLAUDE.md files (chunk by heading). Rich meta_data JSONB for analytics/reporting.
complexity: simple
pre_work: |
  Task 1 (agent_sessions KB integration) already complete before /ship started:
  - Migration 020: added embedding, search_vector, project_name columns to agent_sessions
  - Updated kb_endpoints.py, kb_schemas.py, models.py
  - 110 of 515 sessions now searchable via /api/kb/search
  - Verified working with unified search across all 6 sources

file_map: |
  Files to reuse:
    - registry/doc_ingest.py — chunk_markdown() for heading-based splitting, import directly
    - registry/doc_pages_endpoints.py — POST /api/doc-pages/bulk (upsert by project_name+source_file+chunk_index)
    - registry/decision_logs_endpoints.py — POST /api/decision-logs (no bulk, no upsert)
  Files to create:
    - ~/.claude/scripts/ingest-memory-files.py — parse 56 memory files, route by type
    - ~/.claude/scripts/ingest-claude-md.py — chunk 5 CLAUDE.md files by H2, bulk POST

surprises: |
  1. doc_pages/bulk has built-in upsert — idempotency is free
  2. decision_logs has NO bulk and NO upsert — need manual dupe check by source_file
  3. claude-code-tresor is third-party, not DHG
  4. Digital-Harmony-Studio-v1 CLAUDE.md is governance only, no project content
  5. Embeddings generated server-side — scripts just POST JSON
  6. Only 5 unique CLAUDE.md files across DHG

spec: |
  ## Script 1: ingest-memory-files.py
  Parse 56 memory files from ~/.claude/projects/-home-swebber64-DHG-portage/memory/.
  Route by frontmatter type:
    - type: decision (12 files) → POST /api/decision-logs
      Fields: title (from description), choice (parse "Choice:" line), alternatives_rejected (parse "Over:" line),
      rationale (parse "Because:" line), domain (from metadata.domain), supersedes (if present),
      project_name: "portage", source_file: "memory/<filename>", session_id: originSessionId,
      model_name: "backfill", tags: [domain, keywords]
      meta_data: {memory_name, ingestion_source: "memory-backfill", ingestion_batch: "2026-05-15",
                  origin_session_id, decision_date (parse from body), supersedes_slug, related_memories (parse [[links]])}

    - type: feedback (10 files) → POST /api/doc-pages
    - type: reference (8 files) → POST /api/doc-pages
    - type: project (24 files) → POST /api/doc-pages
    - type: user (0 files) → POST /api/doc-pages
      Fields: project_name: "portage", source_file: "memory/<filename>", chunk_index: 0,
      title (from frontmatter name), content (full body), heading_path: "<type> > <name>",
      tags: [type, keywords]
      meta_data: {memory_type: "<type>", memory_name: "<slug>", ingestion_source: "memory-backfill",
                  ingestion_batch: "2026-05-15", origin_session_id, related_memories (parse [[links]]),
                  content_age_days (compute from file mtime), has_why (bool), has_how_to_apply (bool)}

  Skip: MEMORY.md (index), decisions_index.md (index), any file without valid frontmatter.
  Idempotent: check source_file before inserting, skip if exists.

  ## Script 2: ingest-claude-md.py
  Find CLAUDE.md files across ~/DHG/*/, chunk by H2 heading, POST /api/doc-pages/bulk.
  Target projects: portage, c2l-vault, claude-code-tresor, Digital-Harmony-Studio-v1, and any others with CLAUDE.md.
  Fields: project_name (from dir name), source_file: "claude-md/<project>/CLAUDE.md",
  chunk_index: N (per heading), title: H2 heading text, content: text under heading,
  heading_path: "CLAUDE.md > <H2>", tags: ["claude-md", project_name]
  meta_data: {doc_type: "claude-md", ingestion_source: "project-scan", ingestion_batch: "2026-05-15",
              project_dir: full path, heading_level: 2, has_code_blocks (bool), has_tables (bool),
              word_count (int)}

  Idempotent: check source_file + chunk_index before inserting, skip if exists.

  ## Acceptance criteria
  - Memory files: 40+ records ingested (12 to decision_logs, 30+ to doc_pages)
  - CLAUDE.md files: chunks from 4+ projects ingested
  - All ingested content searchable via POST /api/kb/search
  - No duplicates if script is run twice
  - meta_data populated on every record for analytics/reporting
  - Queryable: GROUP BY meta_data->>'memory_type', meta_data->>'ingestion_source', etc.

  ## Reporting queries enabled
  - Memory coverage by type (feedback/reference/project/decision)
  - Decisions by domain over time
  - Projects with documentation in the KB
  - Content freshness (content_age_days)
  - Ingestion batch tracking
  - Word count distribution across CLAUDE.md chunks
