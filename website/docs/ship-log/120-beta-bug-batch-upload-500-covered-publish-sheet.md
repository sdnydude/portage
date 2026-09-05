---
title: "Beta bug batch: upload 500 + covered publish sheet"
sidebar_label: "Beta bug batch: upload 500 + covered publish sheet"
sidebar_position: 120
slug: ship-1a023679
registry_id: 1a023679-b324-409e-b6f5-7065a4c5e6e8
generated: true
---

# Beta bug batch: upload 500 + covered publish sheet

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | simple |
| **TDD** | Yes |
| **PR** | [#262](https://github.com/sdnydude/portage/pull/262) |
| **Completed** | 2026-07-27 |
| **Model** | claude-fable-5 |

## Approach

Repro-first: minted dev JWT, curl repro of sharp uncaught throw (500-\>400 AppError INVALID_IMAGE); stacking-context analysis for the covered sheet (bar z-70 over sheet inside ScanFlow z-60 context + TabBar z-50 tie) — bar unmounts while sheet open, sheet bumped to z-60; new deterministic e2e proves click actionability

## Commits

- fce27c3 fix: image upload 500 + publish sheet covered by action bar

## Deferred Items

- 5 open beta reports are feature requests (eBay/Reverb sync + tag editing + not-for-sale tag, ad bump, make-offer fields, shipping controls) — need scoping sessions

## Decisions

- hide ScanReviewActions while publish sheet open rather than re-layering z-indexes inside the ScanFlow stacking context

## Review

- Agents: —
- Critical found: 0 · Important found: 0

## Verification

- **lint:** clean
- **tests:** 737 api + 556 web + new e2e green vs rebuilt containers
- **typecheck:** pass

**Tags:** `beta-reports`, `sharp`, `z-index`, `e2e`
