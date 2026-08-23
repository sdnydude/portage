---
title: "eBay edit-sync (Part 1) + Listing Optimizer research panel (Part 2)"
sidebar_label: "eBay edit-sync (Part 1) + Listing Optimizer resear"
sidebar_position: 69
slug: ship-c455bbbd
registry_id: c455bbbd-e512-494a-a519-38a3db3dfb59
generated: true
---

# eBay edit-sync (Part 1) + Listing Optimizer research panel (Part 2)

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [#133](https://github.com/sdnydude/portage/pull/133) |
| **Completed** | 2026-06-27 |
| **Model** | claude-opus-4-8 |

## Approach

Part1: PATCH /items pushes full-field edits to every live/draft eBay listing (iterate-all, skip null-id orphans, best-effort). Part2: GET /items/:id/research (Taxonomy aspect-gap + Browse demand + Analytics getTrafficReport) + ListingOptimizerPanel on item detail with one-tap suggested-value chips that PATCH-\>sync to eBay. Added sell.analytics.readonly scope (needs reconnect).

## Commits

- e46b71e item-edit eBay sync
- eabd410 export helpers (CI fix)
- 18eb9de gate live-eBay e2e
- 9111565 research backend
- 7c36741 optimizer panel

## Deferred Items

- infographic last-7-days + token analysis
- full Docusaurus docs audit
- /about page (F3b dead link)
- tdd-guard apps/web config-vs-skill drift

## Decisions

- surface taxonomy aspect-gap+demand+traffic on item detail
- no eBay keyword search-volume API; use comps+traffic proxies

## Verification

- **lint:** clean
- **tests:** 544 api + 217 web green; Gate-2 e2e green vs rebuilt :3002
- **typecheck:** pass

**Tags:** `ebay`, `analytics`, `optimizer`, `edit-sync`
