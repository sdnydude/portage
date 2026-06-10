---
id: 042-stage2-pricing-engine-best-offer-footer
title: "#042 — Stage 2: Pricing Engine, Best Offer Auto-Accept + Listing Footer"
sidebar_label: "#042 Pricing Engine + Best Offer"
tags: [pricing, ebay, best-offer, comps, settings, redesign]
---

# #042 — Stage 2: Pricing Engine, Best Offer Auto-Accept + Listing Footer

**Branch:** `feat/redesign-stage2-pricing` | **PR:** [#106](https://github.com/sdnydude/portage/pull/106) | **Merge:** `3b11f72` | **Status:** Complete (Stage 2 of the merged redesign plan)

## What shipped

A **shared server-side pricing engine** that turns sold-comp pools into percentile bands, with seller-tunable percentiles, an opt-in **eBay Best Offer auto-accept floor**, and a **publish-time listing footer**. The bands surface as tap-to-set price buttons (Move it / Market / Top dollar) with a Hot/Normal/Slow demand badge in both the scan-review price area and the listing-flow pricing widget.

### Pricing engine (`apps/api/src/lib/pricing.ts`)

- R-7 linear interpolation percentiles — replaces inconsistent index-pluck math
- All band values derive from **one pool in one call** (floor and suggested can never mix pools)
- Round once at the end with the `Number.EPSILON` guard; float dollars throughout
- `SUGGEST_UNDERCUT` (0.97) applies only when the suggest percentile is 50
- `n === 0` → null bands (no $0 prices); `n < 3` → low confidence and **no floor**; floor inversion → null

### Best Offer auto-accept (opt-in, default off)

- `listingPolicies.bestOfferTerms` with string-typed `autoAcceptPrice`, on create **and** update (update always sends the complete `listingPolicies` block — eBay's PUT replaces it wholesale)
- Floor computed at prepare time from the same pool as the suggested price, carried to publish via prepared fields — never recomputed
- Retry-once-without fallback on best-offer-specific rejections, matching across **all** returned eBay errors (errorIds captured for future tightening)
- Every degradation stage is now user-visible: thin-comps suppression warns at prepare; the retry downgrade returns a warning through create, publish, and PATCH responses

### Listing footer

- `applyFooter` — idempotent, drop-not-truncate over the marketplace limit, applied server-side at all three publish call sites; display-only preview in the listing card

### Settings → Pricing (seller profile)

- Suggested-price percentile (10–90), Best Offer toggle, auto-accept floor percentile (5–75), default footer
- PATCH merges with the stored row **before** cross-field validation (`PRICING_FLOOR_INVALID`), so partial updates can't sneak an inverted floor through
- Out-of-range input reverts on blur; server validation messages surface verbatim

### Schema

`seller_profiles` +4 columns (`pricing_suggest_percentile`, `pricing_floor_percentile`, `best_offer_auto_accept_enabled`, `default_listing_footer`) — NOT NULL with defaults, schema-push applied.

## Verification

- **Gate (S2-8):** production draft probe — eBay stored `bestOfferTerms` verbatim on a never-published draft offer, deleted after
- API 455 tests / web 105 tests / typecheck clean / lint 0 errors; AgentShield 0 new findings
- Live drive on the rebuilt production container: real AI scan → bands + demand badge rendered, band tap set the exact engine value, light + dark proofs

## Review

Six review lenses plus the marketplace-adapter-reviewer ran in one batch. Two Critical test gaps (Best Offer opt-in negative gate; `EBAY_US` header pin for the single-currency pool) and ~10 Important findings were fixed in `9302d05` — the dominant theme was surfacing the four stages where an opted-in seller's Best Offer could silently not apply. One reviewer claim (floor not persisted on PATCH re-sync) was refuted with evidence. Six small deferrals are registry-tracked.

## Also in this stage

- Capture-panel scroll fix: `min-h-0` chain on the scan capture stage (hero photo could push the scan button unreachably below the viewport), plus `max-h` guards on the create-listing and capture sheets
- `demandLabel` extracted to one boundary-tested helper; comps widget band selection moved to teal tokens
