---
title: "Registry KB acceleration — bulk ingest memory + CLAUDE.md files"
sidebar_label: "Registry KB acceleration — bulk ingest memory + CL"
sidebar_position: 20
---

# Registry KB acceleration — bulk ingest memory + CLAUDE.md files

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | simple |
| **TDD** | No |
| **PR** | [https://github.com/sdnydude/portage/pull/64](https://github.com/sdnydude/portage/pull/64) |
| **Completed** | 2026-05-15 |
| **Model** | claude-opus-4-6 |

## Approach

Dedicated Python scripts — one for memory files (route by frontmatter type), one for CLAUDE.md files (chunk by heading). Rich meta_data JSONB for analytics/reporting.

## Commits

- `bc64bcd feat: Registry KB acceleration — agent_sessions, memory files, CLAUDE.md bulk ingest`
- `9fc02a1 chore: finalize ship-state for registry KB acceleration`

## Deferred Items

- Registry upsert for decision_logs/insights/corrections/ship_sessions
- Docusaurus site restructuring for multi-project (Option B)
- agent_sessions embeddings (FTS-only)
- Cron job for periodic re-ingest

## Surprises

- doc_pages/bulk has built-in upsert — idempotency free
- decision_logs has NO upsert — dupes on re-run
- Only 5 unique CLAUDE.md files across DHG
- claude-code-tresor is third-party, not DHG

## Decisions

- Import chunk_markdown from registry source over copy
- Dedupe claude-code-tresor CLAUDE.md (root and subdir identical)

## Review

**Agents:** manual-config-review
**Critical issues found:** 0
**Important issues found:** 0

## Verification

- **lint:** n/a (config only)
- **tests:** n/a (config only)
- **typecheck:** n/a (config only)

**Tags:** `registry`, `kb`, `ingestion`, `memory`, `claude-md`, `bulk-ingest`

