---
title: "eBay Trade-First Milestone B — End/GetItem/Revise + drop offers"
sidebar_label: "eBay Trade-First Milestone B — End/GetItem/Revise "
sidebar_position: 73
slug: ship-7815d6e8
registry_id: 7815d6e8-6ef9-4cb4-b271-01e57686aacc
generated: true
---

# eBay Trade-First Milestone B — End/GetItem/Revise + drop offers

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | no PR recorded |
| **Completed** | 2026-06-30 |
| **Model** | claude-opus-4-8 |

## Approach

Rewrote remaining EbayAdapter listing methods (deleteListing/getListingStatus/getEbayItemVerification/updateListing/bulk) from Inventory API to Trading API in place; extracted buildTradingInput shared by createListing+updateListing; removed ebayOfferId from the marketplace interface and all inert branches. TDD in lockstep with tdd-guard ON.

## Commits

- 6dc63fe feat(api): Trade-First eBay listing lifecycle (Milestone B)

## Deferred Items

- Live publish/revise/end proof pending eBay OAuth reconnection (marketplace_accounts empty)
- Stale DB row: listing 307034606520 still active locally but ended on eBay
- Drop inert listings.ebayOfferId DB column (1.20 dead-code sweep)
- Remove orphaned private statics isOfferExistsError/bestOfferTerms (1.20)

## Decisions

- updateListing Revise dispatch: ReviseInventoryStatus for price/qty, full ReviseFixedPriceItem for content
- Drop ebayOfferId from adapter interface, keep DB column inert

## Verification

- **lint:** clean (0 errors)
- **tests:** 531 api green
- **typecheck:** pass

**Tags:** `ebay`, `trading-api`, `trade-first`, `milestone-b`
