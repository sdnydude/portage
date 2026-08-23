---
title: "eBay Trade-First refactor — Phase 1 (createListing → Trading API)"
sidebar_label: "eBay Trade-First refactor — Phase 1 (createListing"
sidebar_position: 70
slug: ship-dc0ef347
registry_id: dc0ef347-12e7-4d41-97ea-3110adda40dc
generated: true
---

# eBay Trade-First refactor — Phase 1 (createListing → Trading API)

| Field | Value |
|-------|-------|
| **Status** | in_progress |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | no PR recorded |
| **Completed** | 2026-06-29 |
| **Model** | claude-opus-4-8 |

## Approach

In-place rewrite of EbayAdapter.createListing from Inventory API (inventory_item/offer/publish) to Trading AddFixedPriceItem via callTradingApi; inline terms, no Business Policies; account opted out; route injects origin ZIP and treats ebay_draft as DB-only; schema-correct builders verified by a live VerifyAddFixedPriceItem dry-run.

## Commits

- 5ac428f builders
- da5d8e1 schema-fix
- d5e167e helpers
- 66752ae verify-builder
- 1a74b59 createListing
- 0e27ebe coverage
- 3536ff2 route
- 51a849a dry-run

## Deferred Items

- updateListing/deleteListing/bulk/getListingStatus to Trading (Phase 2/4)
- idempotency insert-row-first
- GTC auto-renewal reconciliation
- request() error-sanitization coverage re-add

## Decisions

- live-only proof skip sandbox
- inline terms no Business Policies
- no ebay-api SDK

## Verification

- **lint:** n/a apps/api
- **live:** VerifyAddFixedPriceItem dry-run: zero structural errors
- **tests:** api 537 green
- **typecheck:** pass

**Tags:** `ebay`, `trading-api`, `trade-first`, `refactor`
