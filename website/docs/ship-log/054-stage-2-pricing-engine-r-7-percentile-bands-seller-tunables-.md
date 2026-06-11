---
title: "Stage 2: pricing engine — R-7 percentile bands + seller tunables + eBay Best Offer auto-accept + publish-time listing footer + settings Pricing section + bands UI"
sidebar_label: "Stage 2: pricing engine — R-7 percentile bands + s"
sidebar_position: 54
---

# Stage 2: pricing engine — R-7 percentile bands + seller tunables + eBay Best Offer auto-accept + publish-time listing footer + settings Pricing section + bands UI

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [https://github.com/sdnydude/portage/pull/106](https://github.com/sdnydude/portage/pull/106) |
| **Completed** | 2026-06-10 |
| **Model** | claude-fable-5 |

## Approach

Shared engine computePriceBands (one pool, one call), advisor-verified money math; floor carried prepare→publish via prepared fields; bestOfferTerms under listingPolicies with retry-without fallback; applyFooter idempotent at 3 call sites; merge-before-validate cross-field percentile check

## Commits

- `3d17bad S2-1 schema+Zod+merge-guard`
- `293a329 S2-2 computePriceBands engine`
- `0606102 S2-3 engine delegation + CompStats percentiles`
- `fc94974 S2-4 bestOfferTerms + retry-without`
- `72ae145 S2-5 applyFooter`
- `f35aad4 S2-6/7 settings + bands UI + footer preview`
- `33880dd scroll/min-h-0 guards`
- `9302d05 Phase 6 review fixes`
- `3b11f72 merge`

## Deferred Items

- CompStats marketShape grouping + bestOfferFloor required-nullable (shared-types pass)
- shared percentile bound constants
- Etsy description limit verification
- inversion-guard + footer-drop log lines
- updateListing warning channel Etsy/Reverb
- pre-existing: ListingPreviewCard unreachable in chat flows (HIGH)
- pre-existing: R2 CORS blocks LAN recognition

## Decisions

- Best Offer floor computed at prepare, carried via prepared fields, never recomputed at publish
- retry matcher stays prose-based across ALL errors w/ errorIds captured for future tightening
- demandLabel in apps/web/src/lib not packages/shared

## Review

**Agents:** silent-failure-hunter, type-design-analyzer, code-reviewer, comment-analyzer, pr-test-analyzer, code-simplifier, marketplace-adapter-reviewer
**Critical issues found:** 2
**Important issues found:** 10

## Verification

- **lint:** 0 errors / 25 pre-existing warnings
- **tests:** api 455 + web 105 pass
- **typecheck:** pass

**Tags:** `pricing`, `best-offer`, `ebay`, `comps`, `settings`, `stage2`

