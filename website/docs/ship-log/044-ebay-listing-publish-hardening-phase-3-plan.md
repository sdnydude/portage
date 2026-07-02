---
title: "eBay listing publish hardening — Phase 3 Plan"
sidebar_label: "eBay listing publish hardening — Phase 3 Plan"
sidebar_position: 44
---

# eBay listing publish hardening — Phase 3 Plan

| Field | Value |
|-------|-------|
| **Status** | in_progress |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | — |
| **Completed** | — |
| **Model** | claude-opus-4-6 |

## Approach

20-task plan across 7 chunks: schema+types, condition+guards, draft/live+SKU reuse, auto-setup, route hardening, frontend wiring, settings UI. 8 advisor-verification passes, ~55 claims checked.

## Deferred Items

- Etsy marketplace wiring fix
- Orphaned eBay inventory_item cleanup
- Seller profile auto-create race condition
- Listings route test coverage
- CSV export condition map check
- Full required-aspects editor UI

## Decisions

- ebayPreparedFields as publish() param not in ListingFlowState
- Keep publishImmediately alongside publishMode for backward compat
- Fix CONDITION_MAP in both adapter and prepare-listing
- GET-first idempotency for auto-setup
- bulkPublishOffers via eBay batch API

## Review

**Critical issues found:** 0
**Important issues found:** 0

## Verification

- **lint:** n/a
- **tests:** n/a
- **typecheck:** n/a

**Tags:** `ebay`, `listing`, `publish`, `hardening`, `draft`, `auto-setup`, `condition`

