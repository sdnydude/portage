---
title: "eBay Trade-First refactor — Phase 1 (createListing to Trading API)"
sidebar_label: "eBay Trade-First refactor — Phase 1 (createListing"
sidebar_position: 71
slug: ship-78d8ec60
registry_id: 78d8ec60-7e70-4b84-bbad-8fa91b066af1
generated: true
---

# eBay Trade-First refactor — Phase 1 (createListing to Trading API)

| Field | Value |
|-------|-------|
| **Status** | in_progress |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | no PR recorded |
| **Completed** | 2026-06-30 |
| **Model** | claude-opus-4-8 |

## Approach

In-place rewrite of EbayAdapter.createListing to Trading AddFixedPriceItem; inline terms no Business Policies; route origin-ZIP + ebay_draft DB-only; schema verified by live VerifyAddFixedPriceItem dry-run

## Verification

- **live:** VerifyAddFixedPriceItem dry-run zero structural errors
- **tests:** api 537 green
- **typecheck:** pass

**Tags:** `ebay`, `trading-api`, `trade-first`
