---
title: "eBay package weight & dimension capture"
sidebar_label: "eBay package weight & dimension capture"
sidebar_position: 48
---

# eBay package weight & dimension capture

| Field | Value |
|-------|-------|
| **Status** | in_progress |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | — |
| **Completed** | — |
| **Model** | claude-opus-4-8 |

## Approach

Discrete item columns (weightOz/lengthIn/widthIn/heightIn/ebayPackageType/weightEstimated) + frontend AI-prefill and manual; mergeItemShipping makes item columns the source of truth on both publish paths; EbayWeightRequiredError 422 gate on calculated-shipping publishes via getFulfillmentPolicy costType lookup

## Commits

- `f559abd schema cols`
- `35c9cc0 shipping-units`
- `b94157a items route`
- `e13e207 trim shipping-units decision B`
- `9f32625 mergeItemShipping both paths`
- `498b4f7 weight gate`
- `6210853 review fixes`

## Deferred Items

- getFulfillmentPolicy 4xx-propagate vs network fail-open
- Frontend T7-T11 checkpointed

## Decisions

- Frontend AI-estimate persistence over server prepare-route db.update
- shipping-units in apps/api not type-only shared
- Drop eBay catalog weight lookup

## Verification

- **lint:** clean
- **tests:** 382 api pass excl batch-enhance + 47 adapter
- **typecheck:** pass

**Tags:** `ebay`, `shipping`, `weight`, `checkpoint`

