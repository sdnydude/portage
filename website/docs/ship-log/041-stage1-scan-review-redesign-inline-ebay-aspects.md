---
id: 041-stage1-scan-review-redesign-inline-ebay-aspects
title: "#041 — Stage 1: Scan-Review Redesign + Inline eBay Aspects"
sidebar_label: "#041 Scan-Review + Aspects"
tags: [scan, ebay, aspects, condition, design-system, redesign]
---

# #041 — Stage 1: Scan-Review Redesign + Inline eBay Aspects

**Branch:** `feat/redesign-stage1-scan-review` | **PR:** [#104](https://github.com/sdnydude/portage/pull/104) | **Status:** Complete (Stage 1 of 3 in merged redesign plan)

## What shipped

The scan-review panel was rebuilt on the DHG design system and now captures **eBay Item Specifics (aspects) at scan time** — closing the gap where listings couldn't be published to eBay without leaving the scan flow. Free-text categories now resolve to real eBay category IDs in-panel, conditions are dynamically constrained to what the resolved category actually allows, and `publishMode` falls back safely to draft when the seller profile is missing.

### Backend (commit `2567633`)

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /scan/category-suggestion` | JWT | Resolves free-text category → eBay categoryId + valid conditions, with in-memory caching |

- Taxonomy/condition caches + Prometheus counter for cache hits/misses
- Route survives `getValidConditions` rejection — returns `conditionIds: []` instead of 500

### Frontend logic (commit `ca388c4`, TDD — 29 tests)

- `use-scan-aspects` hook — category resolution + required-aspect fetch, retains previous resolution on transient fetch failure
- `aspect-seeding.ts` — deterministic AI pre-fill of aspect values from scan results (✨ suggestion chips)
- `scan-listing-payload.ts` — payload builder attaching `marketplaceSpecificFields` (categoryId + non-blank aspects) in **both** draft and live modes
- `ebay-condition-map.ts` — dynamic condition constraining to category-valid condition IDs

### Wiring (commit `47a5399`)

- `ScanAspectsSection` component mirroring the listing-preview-card aspects pattern (required-field highlighting, AI pre-fill chips)
- Scan-review panel ported to DHG semantic tokens (teal/orange/graphite)
- 6 scan-flow integration tests

### Phase 6 review fixes (commit `b0afae1`)

6-lens specialist review (silent-failure-hunter, type-design-analyzer, code-reviewer, comment-analyzer, pr-test-analyzer, code-simplifier): 2 Critical (test gaps) + 8 Important found; C1/C2/I1/I2/I3 fixed, 15 files touched.

## Verification

- Typecheck: clean (3 workspaces) · Lint: 0 errors
- Tests: web 93/93 (16 files), api 411/411 (42 files)
- AgentShield: 0 new findings vs baseline
- 3-state dark-mode screenshot protocol passed on prod container (complete / blocked+reason / unblocked)
- Perf baseline `/scan/category-suggestion`: ~265–490ms cold (2 live eBay calls), cached warm path 2.1ms

## Deferred (6)

1. Type-design sync contracts between scan payload and listing types (4 items, batched)
2. Pre-existing nested-button hydration warning on main
3. Aspect-seeding console noise in dev
