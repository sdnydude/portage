---
title: "Claude tooling + batch-enhance backend + eBay updateListing packageType fix"
sidebar_label: "Claude tooling + batch-enhance backend + eBay upda"
sidebar_position: 53
---

# Claude tooling + batch-enhance backend + eBay updateListing packageType fix

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [https://github.com/sdnydude/portage/pull/101](https://github.com/sdnydude/portage/pull/101) |
| **Completed** | 2026-06-09 |
| **Model** | claude-opus-4-8 |

## Approach

Built marketplace-adapter-reviewer subagent (.claude/agents/) + guard-schema-push.sh PreToolUse hook (bb7e46d); smoke-tested agent against PR #101, traced its packageType finding, TDD-fixed updateListing to omit packageType matching createListing symmetry (648c532); implemented POST /images/batch-enhance to green the 5 WIP spec tests (8f6ddb7); merged PR #101 (0140ec3) + branch cleanup; designed batch-enhance frontend wiring through 2 adversarial advisor passes — design locked, build pending go

## Commits

- `bb7e46d tooling: marketplace-adapter-reviewer agent + schema-push guard hook`
- `648c532 fix(ebay): updateListing omits packageType (symmetry with createListing) + regression test`
- `8f6ddb7 feat(api): POST /images/batch-enhance + 5 spec tests`
- `0140ec3 merge PR #101 eBay publish hardening`

## Deferred Items

- Re-validate locked batch-enhance FE design against Stage 1 scan-review redesign before building

## Decisions

- EnhanceAllButton takes `{photos, replacePhotos}` props — never self-calls useListingFlow (plain useState hook, self-call = dead isolated instance)
- Conversational mode batch-enhance via ListingPreviewCard trigger, not a new photo grid

## Verification

- **lint:** clean
- **tests:** batch-enhance 5/5 green, ebay-adapter regression green (npm test -w apps/api)
- **typecheck:** pass

**Tags:** `batch-enhance`, `ebay`, `packageType`, `subagent`, `hooks`, `tdd`

