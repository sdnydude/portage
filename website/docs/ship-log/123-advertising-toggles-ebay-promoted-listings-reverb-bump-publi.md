---
title: "Advertising toggles — eBay Promoted Listings + Reverb Bump (publish sheet)"
sidebar_label: "Advertising toggles — eBay Promoted Listings + Rev"
sidebar_position: 123
slug: ship-827b1aba
registry_id: 827b1aba-1bda-41f1-8018-33d387cddad1
generated: true
---

# Advertising toggles — eBay Promoted Listings + Reverb Bump (publish sheet)

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [#265](https://github.com/sdnydude/portage/pull/265) |
| **Completed** | 2026-07-27 |
| **Model** | claude-fable-5 |

## Approach

Hook-gated discovery (KB no prior art; Reverb bump endpoints doc-verified via reverb-api.com; eBay sell.marketing scope confirmed pre-consented in code; Marketing API live-probed 200 with real seller token). setBump + promoteListing adapters, fire-and-warn on both publish paths, sheet Promote toggle, draft rows persist intent.

## Commits

- 54338c7 feat: advertising toggles — eBay Promoted Listings + Reverb Bump

## Deferred Items

- Final live-proof of eBay ad creation lands on first real promoted publish (fire-and-warn caps risk)
- Reverb per-listing bump stats surface (GET /listings/:id/bump) — future analytics

## Decisions

- eBay 409 ad-exists treated as success so re-publishes never fail
- promotion is fire-and-warn post-publish, never fatal to the listing

## Review

- Agents: —
- Critical found: 0 · Important found: 0

## Verification

- **lint:** clean
- **tests:** 752 api + 569 web + 4 e2e green vs rebuilt containers; Marketing API live probe 200
- **typecheck:** pass

**Tags:** `advertising`, `promoted-listings`, `bump`, `beta-request`
