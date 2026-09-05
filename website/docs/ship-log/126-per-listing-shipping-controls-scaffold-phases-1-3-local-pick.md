---
title: "Per-listing shipping controls — scaffold + Phases 1-3 + local-pickup"
sidebar_label: "Per-listing shipping controls — scaffold + Phases "
sidebar_position: 126
slug: ship-719371f6
registry_id: 719371f6-c0d4-4a6f-a99a-3e799bed4afb
generated: true
---

# Per-listing shipping controls — scaffold + Phases 1-3 + local-pickup

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [#274](https://github.com/sdnydude/portage/pull/274) |
| **Completed** | 2026-08-01 |
| **Model** | claude-fable-5 |

## Approach

VERIFY-FIRST live matrix froze XML shapes before builder tests; touched-contract keys ebayShipping/reverbShipping on marketplaceSpecificFields; shared ShippingFieldsSection across sheet/scan-review/listing-card

## Commits

- b430537 scaffold (cloud patch)
- b9b1b13 flat/free builders
- 19aea55 category heal
- 1397d97 package enum translation

## Deferred Items

- service select fed live from probe endpoint
- Reverb profile select on scan-review

## Decisions

- 1oz weight floor keeps ShippingPackageDetails (operator)
- pickup is add-on toggle — pickup-only illegal on eBay (live-verified)

## Review

- Agents: —
- Critical found: 0 · Important found: 0

## Verification

- **lint:** clean
- **tests:** 768 api / 580 web at merge
- **typecheck:** pass

**Tags:** `ebay`, `reverb`, `shipping`
