---
title: "bulk image export — zip download of all photos for selected inventory items"
sidebar_label: "bulk image export — zip download of all photos for"
sidebar_position: 41
---

# bulk image export — zip download of all photos for selected inventory items

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [https://github.com/sdnydude/portage/pull/88](https://github.com/sdnydude/portage/pull/88) |
| **Completed** | 2026-05-27 |
| **Model** | claude-sonnet-4-6 |

## Approach

server-side streaming ZIP via fflate, two-endpoint design (POST prepare + GET token-auth download), DB-backed short-lived tokens with 3-use cap for iOS Safari pre-fetch

## Commits

- `dfb1f3b feat: add POST /items/photos/export/prepare endpoint (TDD)`
- `a8e7a03 feat: add export_tokens schema and wire DB insert into prepare endpoint`
- `e39fea7 feat: add GET /items/photos/export token-auth ZIP streaming endpoint`
- `73ea238 feat: add ExportActionSheet with photo ZIP and eBay CSV export options`
- `3080626 feat: lower photo cap to 60, add 502 on total fetch failure, fix export UI errors`
- `31e34c9 fix: escape apostrophe in comps-search-sheet to pass lint`

## Deferred Items

- SSRF regression test — verify fetch not called for disallowed origins
- Per-photo server-side error logging
- export_tokens table cleanup job for expired rows

## Decisions

- fflate over jszip — ESM-native, no Buffer wrapping needed
- Buffer collect then res.end vs streaming — needed for Content-Length which supertest requires for binary assertions
- Route placed before requireAuth middleware to allow token-based bypass
- Move res.setHeader calls after ZIP assembly to avoid Content-Type collision with error handler

## Review

**Agents:** silent-failure-hunter, code-reviewer
**Critical issues found:** 2
**Important issues found:** 2

## Verification

- **lint:** 0 errors, 25 pre-existing img warnings
- **tests:** 290/292 (2 pre-existing billing failures)
- **typecheck:** pass

**Tags:** `export`, `zip`, `fflate`, `photo`, `bulk`, `token-auth`

