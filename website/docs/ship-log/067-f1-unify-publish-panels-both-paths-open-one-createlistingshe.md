---
title: "F1 unify publish panels — both paths open one CreateListingSheet"
sidebar_label: "F1 unify publish panels — both paths open one Crea"
sidebar_position: 67
slug: ship-0af89c43
registry_id: 0af89c43-8347-47e1-b4da-588860b2b670
generated: true
---

# F1 unify publish panels — both paths open one CreateListingSheet

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | no PR recorded |
| **Completed** | 2026-06-23 |
| **Model** | claude-opus-4-8 |

## Approach

Generalized CreateListingSheet with scan-prefill props (categoryId/initialAspects/initialEbayDraft/initialPublishNow); scan Save&List creates item then opens the sheet seeded from seller profile (live→publish-now; fail→draft safe; explicit eBay-draft overrides live). Removed scan direct-POST+buildListingPayload. Live e2e 3/3 through the sheet.

## Deferred Items

- delete now-unused scan-listing-payload.ts + test
- F2 price panel
- F3 terms panel (schema gate)
- F4 two-state result screen

## Decisions

- seed sheet from seller profile to preserve conservative draft fallback
- explicit eBay-draft choice overrides a live profile default
- tdd-guard scripted bypass (authorized) for scan-flow indirection deadlock, flagged for review

## Verification

- **lint:** clean
- **tests:** web 200; live e2e 3/3 incl scan-via-sheet
- **typecheck:** pass

**Tags:** `ebay`, `f1`, `publish`, `scan`, `phase-f`
