---
title: "Registry upsert/idempotency for all non-idempotent tables + dev_changelog KB source"
sidebar_label: "Registry upsert/idempotency for all non-idempotent"
sidebar_position: 21
---

# Registry upsert/idempotency for all non-idempotent tables + dev_changelog KB source

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | No |
| **PR** | [https://github.com/sdnydude/dhgaifactory3.5/pull/18](https://github.com/sdnydude/dhgaifactory3.5/pull/18) |
| **Completed** | 2026-05-15 |
| **Model** | claude-opus-4-6 |

## Approach

App-level upsert (doc_pages pattern) + DB unique constraints + IntegrityError TOCTOU fallback. dev_changelog as 7th KB source.

## Commits

- `990aa4c feat(registry): upsert/idempotency for 4 KB tables + dev_changelog as 7th source`

## Deferred Items

- dev_changelog embedding backfill (16 rows need Ollama vectors)
- Incidents table KB integration (99% alert noise)
- incident_postmortems KB integration (1 row exists)
- Cron job for periodic re-ingest of memory files

## Surprises

- aifactory repo files in /app/ not /app/registry/ inside container
- search_api.py had prior unrelated changes in working tree

## Decisions

- App-level upsert over ON CONFLICT — consistent with existing doc_pages pattern
- MD5 hash column for corrections TEXT field dedup — avoids btree size limit
- Functional unique index for ship_sessions.feature — left(feature,255) handles TEXT columns
- dev_changelog project_name defaults to shared for cross-project visibility

## Review

**Agents:** silent-failure-hunter, code-reviewer
**Critical issues found:** 0
**Important issues found:** 3

## Verification

- **lint:** n/a
- **tests:** n/a (no test suite for registry endpoints)
- **upserts:** all 4 tables pass 201/200 cycle
- **kb_search:** 7 sources searched, results returned
- **typecheck:** n/a (runs in container)
- **idempotency:** ingest scripts x2 = same row counts

**Tags:** `registry`, `upsert`, `idempotency`, `kb-search`, `dev-changelog`, `migrations`, `delete-endpoints`

