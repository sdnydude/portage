---
title: "Pre-Stage-3 fix batch Phase B: publish-failure truth + price/weight capture + eBay taxonomy as THE category"
sidebar_label: "Pre-Stage-3 fix batch Phase B: publish-failure tru"
sidebar_position: 61
slug: ship-1bc804cc
registry_id: 1bc804cc-3d6a-4f97-8374-823eff1c8c87
generated: true
---

# Pre-Stage-3 fix batch Phase B: publish-failure truth + price/weight capture + eBay taxonomy as THE category

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [#111](https://github.com/sdnydude/portage/pull/111) |
| **Completed** | 2026-06-11 |
| **Model** | claude-fable-5 |

## Approach

adapter warning carries parsed eBay reason; warning plumbed hook-\>PublishSuccess draft-state-\>TabBar toast; plain-Save price fix (+stale closure); lb+oz WeightDimsInputs on scan review; static category list deprecated for eBay leaf (auto-resolve + search override; edit page persists only on user-invoked Find per user-over-AI); Brand/Model aspect seeding (clear-respecting)

## Commits

- a78a94f adapter real-reason warning
- eef8167 warning plumbing end-to-end
- 67756a3 Save persists price
- 44307f0 lb+oz weight section
- fa6b2f8 eBay taxonomy THE category (scan)
- d0540c7 Brand/Model aspect seeding
- 21da4a4 edit page category+conditions+price
- 1460bf1 review fixes
- b3a735d de-flake

## Deferred Items

- use-scan-aspects resolvedFor+manual-override refinement
- price clearing + per-flow warning tests + AI-weight test + ScanFab + draft-reason persistence

## Decisions

- edit page persists eBay category only after user-invoked Find (user-over-AI); scan-save auto-derives (resolution visible at save)
- aspect seeding keys on presence not truthiness — explicit clears final

## Review

- Agents: silent-failure-hunter, code-reviewer, pr-test-analyzer
- Critical found: 1 · Important found: 2

## Verification

- **lint:** 0 errors
- **tests:** web 171, api 473; live: real scan showed all controls, price+category in DB, publish probe returned eBay account-lock reason
- **typecheck:** pass x2

**Tags:** `ebay`, `category`, `price`, `weight`, `publish-warning`
