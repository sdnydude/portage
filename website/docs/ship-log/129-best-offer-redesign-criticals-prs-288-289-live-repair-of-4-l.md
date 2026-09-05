---
title: "Best Offer redesign + criticals (PRs #288/#289) + live repair of 4 listings"
sidebar_label: "Best Offer redesign + criticals (PRs #288/#289) + "
sidebar_position: 129
slug: ship-1f010041
registry_id: 1f010041-254a-40f2-a6af-92b509b149aa
generated: true
---

# Best Offer redesign + criticals (PRs #288/#289) + live repair of 4 listings

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [#289](https://github.com/sdnydude/portage/pull/289) |
| **Completed** | 2026-08-04 |
| **Model** | claude-fable-5 |

## Approach

Architect/engineer/advisor trio plan: eBay owns live truth, typed error codes, pre-flight everywhere, atomic JSONB merge, per-marketplace offers state; live proof via operator browser with eBay read-back verification; reconciliation sweep healed all drift

## Commits

- ab25f63
- 45677a7
- 6f74af3
- 85336e4
- 66bf355

## Deferred Items

- floor-note prepare-on-item-entry (operator: next session)

## Decisions

- eBay is source of truth for live Best Offer state; Portage heals on conflict
- explicit toggle-off is the only deletion path
- GetCategoryFeatures deterministic pre-flight replaces prose matching

## Review

- Agents: marketplace-adapter-reviewer, design-advisor, audit, coderabbit
- Critical found: 4 · Important found: 9

## Verification

- **lint:** clean
- **tests:** 857 API / 615 web green
- **typecheck:** pass

**Tags:** `best-offer`, `ebay`, `reverb`, `live-proof`
