---
title: "Reverb category cascade — taxonomy endpoints, AI resolution, UI + review-hardening batch"
sidebar_label: "Reverb category cascade — taxonomy endpoints, AI r"
sidebar_position: 125
slug: ship-24f2b99b
registry_id: 24f2b99b-1c4a-4d98-a4ad-82a7a0abe999
generated: true
---

# Reverb category cascade — taxonomy endpoints, AI resolution, UI + review-hardening batch

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [#280](https://github.com/sdnydude/portage/pull/280) |
| **Completed** | 2026-08-02 |
| **Model** | claude-fable-5 |

## Approach

Product-types/subcategories endpoints from cached flat list (leaf-name-safe); exact-first + leaf-token semantic AI category resolution; ReverbCategorySection cascade on sheet + preview card with publish-category pre-seed; independent 3-agent review round fixed photo-edit race, seed clobber, per-marketplace offers touch, weight-gate symmetry, flat-cost guard, leaf-safe path

## Commits

- 22cc7bb taxonomy endpoints
- 1a93b5e sheet pre-seed + suggestion endpoint
- 0536840 finish/year hygiene + leaf-token pick
- 2f3e2d4 seed-once + per-marketplace offers
- 2c99877 review batch photo race + shipping hardening
- 7657c5b test props

## Deferred Items

- Reverb category scan-review ride-along + listing-card inline edit
- persist healed categoryId on PATCH sync (minor review finding)
- getAdapter type width vs MarketplaceType (etsy artifact)

## Decisions

- resolution order verbatim→leaf-token→majority-search
- pickup as add-on toggle not select option (operator)
- bump rate typed field (operator)

## Review

- Agents: marketplace-adapter-reviewer, feature-dev:code-reviewer, Explore(photo-race trace)
- Critical found: 2 · Important found: 4

## Verification

- **lint:** clean
- **tests:** 785 api / 590 web
- **typecheck:** pass

**Tags:** `reverb`, `category`, `cascade`, `review`
