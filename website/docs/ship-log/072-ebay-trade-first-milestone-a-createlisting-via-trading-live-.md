---
title: "eBay Trade-First Milestone A — createListing via Trading + live proof"
sidebar_label: "eBay Trade-First Milestone A — createListing via T"
sidebar_position: 72
slug: ship-1e958052
registry_id: 1e958052-b5be-40d6-9723-4e1e9e1a5032
generated: true
---

# eBay Trade-First Milestone A — createListing via Trading + live proof

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | no PR recorded |
| **Completed** | 2026-06-30 |
| **Model** | claude-opus-4-8 |

## Approach

In-place EbayAdapter rewrite to Trading AddFixedPriceItem with inline terms; insert-first idempotency (col + partial unique); publish-route origin ZIP; G6 bulk-activate guard; auto-setup demotion; gated db:push + container rebuild; verified one real live listing 307034606520

## Deferred Items

- Milestone B: migrate updateListing/deleteListing/getListingStatus/bulk to Trading (start 1.14 End so the live listing is manageable)
- 1.20 dead-code: remove unused Business-Policy adapter methods + FE Set-up-eBay button
- FE: send a stable idempotencyKey on publish

## Decisions

- 1.16a insert-first idempotency lands before the live proof

## Verification

- **lint:** n/a
- **tests:** 534 api green
- **typecheck:** pass

**Tags:** `ebay`, `trade-first`, `live-proof`, `milestone-a`
