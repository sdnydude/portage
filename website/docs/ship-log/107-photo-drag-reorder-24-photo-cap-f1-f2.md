---
title: "Photo drag-reorder + 24-photo cap (F1+F2)"
sidebar_label: "Photo drag-reorder + 24-photo cap (F1+F2)"
sidebar_position: 107
slug: ship-7c876520
registry_id: 7c876520-ed64-481e-8052-1fec2151457b
generated: true
---

# Photo drag-reorder + 24-photo cap (F1+F2)

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [#223](https://github.com/sdnydude/portage/pull/223) |
| **Completed** | 2026-07-14 |
| **Model** | claude-fable-5 |

## Approach

Touch-capable use-photo-drag hook (elementFromPoint live-reorder) + PhotoManageSheet + strip/scan/flows wiring; optimistic order + one coalesced PATCH; MAX_PHOTOS_PER_ITEM=24 shared + server .max(24) + eBay 24/3975 guards; adversarial plan review v1-\>v2 killed 4 blockers pre-build

## Deferred Items

- thumbnail variant pipeline (storage domain + backfill)
- R2 reference-safe photo deletion GC
- hasContentChange always-full-revise inefficiency
- applyToPhoto race UI test (unreachable via UI)

## Decisions

- coalesced client-side PATCH over per-drop
- touch contract over verbatim PhotoGrid extraction
- zero-photo revise = warn+keep-pictures over hard throw

## Review

- Agents: silent-failure-hunter, code-reviewer, pr-test-analyzer, code-simplifier, comment-analyzer, type-design-analyzer, marketplace-adapter-reviewer
- Critical found: 2 · Important found: 8

## Verification

- **lint:** clean
- **tests:** 685 api + 399 web + 28 e2e pass; live-proven on prod data (keyless GetItem item, DB-verified reorder+restore)
- **typecheck:** pass

**Tags:** `photos`, `reorder`, `drag`, `24-cap`, `ebay`, `touch`
