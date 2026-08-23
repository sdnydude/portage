---
title: "Orders page: ship-on-eBay + sold-date fix (W1+W3)"
sidebar_label: "Orders page: ship-on-eBay + sold-date fix (W1+W3)"
sidebar_position: 76
slug: ship-c6def906
registry_id: c6def906-9e69-4e75-bc12-87ded359334d
generated: true
---

# Orders page: ship-on-eBay + sold-date fix (W1+W3)

| Field | Value |
|-------|-------|
| **Status** | in_progress |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | no PR recorded |
| **Completed** | 2026-07-01 |
| **Model** | claude-opus-4-8 |

## Approach

Option A: Ship-It redirects to eBay item page (labels handled on eBay; Logistics API is allowlist-gated); fixed sold dates via Fulfillment creationDate. Carrier subsystem deletion + fulfillment sync-back + ebay-api SDK deferred to phase 2.

## Commits

- e859abe sold-date map creationDate
- 0c7bb67 API exposes ebayItemId
- 4ec0a36 list Ship-It-\>eBay
- 40f5130 detail Ship-It-\>eBay

## Deferred Items

- W2 fulfillment sync-back
- W4 delete carrier subsystem
- W5 adopt ebay-api SDK
- sold-celebration Ship-It ItemID prop
- DoD: merge + rebuild containers + run-the-app verify

## Decisions

- redirect-to-eBay for shipping
- adopt ebay-api for fulfillment path

## Verification

- **lint:** n/a
- **tests:** api+web green; NOT run-the-app verified
- **typecheck:** pass (api+web)

**Tags:** `orders`, `ebay`, `shipping`
