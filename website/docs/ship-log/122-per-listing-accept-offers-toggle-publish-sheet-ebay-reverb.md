---
title: "Per-listing Accept-offers toggle (publish sheet, eBay + Reverb)"
sidebar_label: "Per-listing Accept-offers toggle (publish sheet, e"
sidebar_position: 122
slug: ship-dd079e9b
registry_id: dd079e9b-a898-4d35-8876-4bb5a50b30f3
generated: true
---

# Per-listing Accept-offers toggle (publish sheet, eBay + Reverb)

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | simple |
| **TDD** | Yes |
| **PR** | [#264](https://github.com/sdnydude/portage/pull/264) |
| **Completed** | 2026-07-27 |
| **Model** | claude-fable-5 |

## Approach

Hook-gated discovery (KB then CodeGraph then attested Explore) found best-offer backend 90% built; added bestOfferEnabled + minimumBestOfferPrice to Trading builders, toggle-only downgrade retry, Reverb offersEnabledExplicit provenance key preserving sync contract, sheet toggle + floor inputs sending only on explicit user flip

## Commits

- 2f353a0 feat: per-listing Accept-offers toggle on the publish sheet

## Deferred Items

- Reverb per-listing min/auto-accept amounts — Reverb listing API only exposes offers_enabled

## Decisions

- offersEnabledExplicit provenance key over raw-key-wins (would have silently killed profile sync propagation for all legacy rows)

## Review

- Agents: —
- Critical found: 0 · Important found: 0

## Verification

- **lint:** clean
- **tests:** 745 api + 567 web + 4 e2e green vs rebuilt containers
- **typecheck:** pass

**Tags:** `best-offer`, `reverb`, `publish-sheet`, `beta-request`
