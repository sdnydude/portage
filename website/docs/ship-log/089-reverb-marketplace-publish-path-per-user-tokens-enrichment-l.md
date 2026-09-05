---
title: "Reverb marketplace publish path — per-user tokens, enrichment, live publish"
sidebar_label: "Reverb marketplace publish path — per-user tokens,"
sidebar_position: 89
slug: ship-15a8af73
registry_id: 15a8af73-e724-469a-8932-d762a71f0982
generated: true
---

# Reverb marketplace publish path — per-user tokens, enrichment, live publish

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [#173](https://github.com/sdnydude/portage/pull/173) |
| **Completed** | 2026-07-09 |
| **Model** | claude-fable-5 |

## Approach

Full production-parity: ReverbAdapter rewired to per-user PATs with typed errors; publish:true flag (docs-verified); prepare-time reverb cache (marketplaceData.reverb) + route enrichment block with category fallback; orders call-site fix; bulk-activate exclusion; web payload + CreateListingSheet Reverb option; live-verified CONDITION_MAP; state-shape normalization

## Commits

- 8029c2d token-manager REVERB_SETUP_REQUIRED
- 8e398c5 adapter rewrite
- c2a68ba orders call-site
- 7cf7e2c reverb cache persist
- b58b15d enrichment + getAdapter
- f7a1515 web payload
- 6215b59 review hardening
- a0817a9 no-deferrals review items
- 268ff5a CreateListingSheet Reverb
- 08512b2 CONDITION_MAP live UUIDs
- c18f73f state-shape normalization

## Deferred Items

- per-image photo DELETE on update
- web idempotencyKey (pre-existing)
- REVERB_SETUP_REQUIRED web UX special-case
- category fallback query quality (user: nothing to fix now)

## Decisions

- publish:true always, drafts never reach adapter
- searchComps stays on global env token
- offersEnabled profile-wins over client

## Review

- Agents: silent-failure-hunter, code-reviewer, pr-test-analyzer, marketplace-adapter-reviewer, plan-review-x2-preband
- Critical found: 0 · Important found: 4

## Verification

- **lint:** clean
- **tests:** 593 API + 273 web green
- **typecheck:** pass

**Tags:** `reverb`, `marketplace`, `publish`, `live-proof`
