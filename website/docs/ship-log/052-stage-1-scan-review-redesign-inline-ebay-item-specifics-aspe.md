---
title: "Stage 1: Scan-review redesign + inline eBay Item Specifics (aspects) at scan time + dynamic condition constraining + publishMode fallback"
sidebar_label: "Stage 1: Scan-review redesign + inline eBay Item S"
sidebar_position: 52
---

# Stage 1: Scan-review redesign + inline eBay Item Specifics (aspects) at scan time + dynamic condition constraining + publishMode fallback

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [https://github.com/sdnydude/portage/pull/104](https://github.com/sdnydude/portage/pull/104) |
| **Completed** | 2026-06-10 |
| **Model** | claude-fable-5 |

## Approach

Port approved scan-review mockup to DHG design system; new GET /scan/category-suggestion endpoint resolving free-text category to eBay categoryId + valid conditions with caching; use-scan-aspects hook + deterministic aspect seeding + scan-listing-payload builder (TDD, 29 tests); ScanAspectsSection mirroring listing-preview-card pattern; marketplaceSpecificFields attached in both draft and live modes

## Commits

- `2567633 feat(api): category-suggestion endpoint + taxonomy/condition caches + metrics`
- `ca388c4 feat(web): scan aspects FE logic — hook, seeding, payload builder, condition map (TDD)`
- `47a5399 feat(web): scan-review panel wiring — ScanAspectsSection + DHG token port + integration tests`
- `b0afae1 fix: Phase 6 review fixes — C1/C2 test gaps, I1 retention, I2 draft fields, I3 route resilience`
- `db9cf08 Merge pull request #104`

## Deferred Items

- Type-design sync contracts scan payload vs listing types (4 batched items)
- Pre-existing nested-button hydration warning on main
- Aspect-seeding console noise in dev

## Decisions

- use-scan-aspects retains previous category resolution on transient fetch failure
- buildListingPayload attaches marketplaceSpecificFields in draft mode too, not just live
- buildListingPayload falls back to draft publishMode when seller profile missing

## Review

**Agents:** silent-failure-hunter, type-design-analyzer, code-reviewer, comment-analyzer, pr-test-analyzer, code-simplifier
**Critical issues found:** 2
**Important issues found:** 8

## Verification

- **lint:** clean (0 errors, 25 pre-existing warnings)
- **tests:** web 93/93 (16 files), api 411/411 (42 files)
- **typecheck:** pass (3 workspaces)

**Tags:** `scan`, `ebay`, `aspects`, `condition`, `redesign`, `design-system`

