---
title: "F4 two-state publish result in CreateListingSheet"
sidebar_label: "F4 two-state publish result in CreateListingSheet"
sidebar_position: 68
slug: ship-d6f723e0
registry_id: d6f723e0-5a72-41a2-b93c-91b3514e876e
generated: true
---

# F4 two-state publish result in CreateListingSheet

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | simple |
| **TDD** | Yes |
| **PR** | no PR recorded |
| **Completed** | 2026-06-24 |
| **Model** | claude-opus-4-8 |

## Approach

Unified sheet kept POST /listings \{status,warning\} instead of silent nav; compact two-state result (published green / draft-fallback amber+verbatim eBay reason / clean draft green); aspect-fill retry routed through same result. Amber reserved for actual warning, not all drafts.

## Commits

- d494a2c feat(web): F4 two-state publish result
- 37a0d9b docs(ship-state): F4 done; Phase F complete

## Deferred Items

- /about page (HARD DEP for F3b microcopy)
- F1 scan-flow tdd-guard bypass review
- F3b schema-column bypass review
- DisclaimerSheet listingId-fed-itemId cleanup

## Decisions

- amber result icon only on actual publish-fallback warning; deliberate draft is green clean success

## Verification

- **lint:** clean
- **tests:** web 213 unit + e2e f4-publish-result green vs rebuilt ephemeral stack
- **typecheck:** pass

**Tags:** `phase-f`, `publish-result`, `create-listing-sheet`, `e2e`
