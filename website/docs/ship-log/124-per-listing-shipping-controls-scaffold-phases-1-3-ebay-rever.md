---
title: "Per-listing shipping controls — scaffold + Phases 1-3 (eBay + Reverb + surfaces) + 2-day services"
sidebar_label: "Per-listing shipping controls — scaffold + Phases "
sidebar_position: 124
slug: ship-f6afdcb4
registry_id: f6afdcb4-3517-4d5d-b177-90abbf01ffc2
generated: true
---

# Per-listing shipping controls — scaffold + Phases 1-3 (eBay + Reverb + surfaces) + 2-day services

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [#274](https://github.com/sdnydude/portage/pull/274) |
| **Completed** | 2026-08-02 |
| **Model** | claude-fable-5 |

## Approach

Cloud-authored scaffold via git am; VERIFY-FIRST probe/dryrun matrix before builder freezes; Trading inline shipping (flat/free/calculated), Reverb profile override + pickup-only, scan-review ride-along, listing-card edit; live error-37 enum-translation fix; FedEx2Day+UPS2ndDay in service select

## Commits

- bcacab7 merge PR #274 (18 commits: scaffold, Phase 1 eBay, Phase 2 Reverb, Phase 3 surfaces, error-37 fix, 2-day services)

## Deferred Items

- Boot-guard widening to required-keys presence check (pre-existing registry item)

## Decisions

- Flat/free keeps ShippingPackageDetails with weight floored to 1oz
- TRADING_SHIPPING_PACKAGE translation map, unknown enums fall back to default
- Reverb 2-day = shop profile, no API field exists

## Review

- Agents: —
- Critical found: 0 · Important found: 0

## Verification

- **lint:** clean
- **tests:** 768/768 API, 580/580 web (CI run 30705232045)
- **typecheck:** pass

**Tags:** `shipping`, `ebay`, `reverb`, `trading-api`, `publish-sheet`
