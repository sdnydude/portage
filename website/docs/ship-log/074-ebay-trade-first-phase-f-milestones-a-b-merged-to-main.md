---
title: "eBay Trade-First (Phase F + Milestones A+B) — MERGED to main"
sidebar_label: "eBay Trade-First (Phase F + Milestones A+B) — MERG"
sidebar_position: 74
slug: ship-2dacc2f5
registry_id: 2dacc2f5-b101-4e8d-becd-cfc5b90273b2
generated: true
---

# eBay Trade-First (Phase F + Milestones A+B) — MERGED to main

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [#133](https://github.com/sdnydude/portage/pull/133) |
| **Completed** | 2026-06-30 |
| **Model** | claude-opus-4-8 |

## Approach

Completed the Inventory-\>Trading API migration (Milestone B: End/GetItem/Revise/bulk + ebayOfferId removal), live-proved the full lifecycle on real eBay, then merged PR #133 (52 commits) to main via merge commit. Also: git cleanup (untrack runtime ship-state, gitignore session artifacts), gh CLI upgrade to fix Projects-classic error.

## Commits

- 5d22368 Merge PR #133
- 6dc63fe Milestone B
- 1f2baef repo cleanup
- 8c40f33 agentlint

## Deferred Items

- reconcile stale listing 307034606520
- 1.20 dead-code sweep
- gh system-wide install
- tune no-force-push rule
- fix ship-state pointer

## Decisions

- updateListing Revise dispatch
- drop ebayOfferId from interface
- merge via merge-commit (single-revert)

## Verification

- **lint:** clean
- **tests:** 531 api green; 6/6 CI checks pass
- **typecheck:** pass

**Tags:** `ebay`, `trade-first`, `merged`, `milestone-b`, `live-proven`
