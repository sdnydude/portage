---
title: "eBay listing publish hardening + draft/live publish mode + auto-setup of business policies & inventory location"
sidebar_label: "eBay listing publish hardening + draft/live publis"
sidebar_position: 45
---

# eBay listing publish hardening + draft/live publish mode + auto-setup of business policies & inventory location

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [https://github.com/sdnydude/portage/pull/94](https://github.com/sdnydude/portage/pull/94) |
| **Completed** | 2026-06-04 |
| **Model** | claude-opus-4-6 |

## Approach

Draft-first reframe: wire prepare-listing AI fields through full publish flow, one-click policy/location auto-setup, draft/live toggle, per-category condition validation, self-healing photo-first publish

## Commits

- `0180714 feat(db): add quantity, ebaySku, ebayPublishMode columns`
- `c90e303 feat(shared): add ebayPublishMode + marketplace quantity/ebaySku types`
- `fd4e29f feat(api): wire quantity through items CRUD`
- `4b7f667 fix(ebay): map conditions to valid Inventory-API enums`
- `44e7970 feat(ebay): pre-flight guards + quantity wiring in createListing`
- `6249fd8 feat(ebay): per-category condition validation + auto-correct`
- `1a0f73c feat(ebay): draft/live publish mode in createListing`
- `e935163 feat(ebay): SKU + offer reuse on re-publish`
- `b14c024 feat(ebay): surface eBay error longMessage on API failures`
- `1b92db7 feat(ebay): Account API policy-creation adapter methods`
- `7453445 feat(ebay): createInventoryLocation adapter method`
- `36c65a0 feat(ebay): one-click auto-setup endpoint`
- `eb028b7 feat(db): add listings.ebayOfferId column`
- `b883433 feat(ebay): wire publishMode + ebaySku/ebayOfferId through listings routes`
- `c17cdfb feat(ebay): sync inventory_item + offer on listing update`
- `fb67686 feat(ebay): bulk publish eBay drafts via bulkPublishOffers`
- `e7c5753 feat(ebay): wire ebayPreparedFields + publishMode through useListingFlow.publish`
- `a909107 feat(ebay): wire publishMode/quantity into listing flow components`
- `042ca2c feat(ebay): add quantity field to inventory edit page`
- `e05b494 feat(ebay): one-click Set up eBay Selling button + status indicator`
- `109fa4a feat(ebay): default publish mode selector on seller profile`
- `a8923e6 fix(ebay): Phase 6 adversarial review — 6 critical + 3 important fixes`
- `e1604f2 fix(ebay): bulk activate includes eBay-published IDs + Listing type gap`
- `79213c7 fix(listing-flow): self-healing publish() fetches eBay prepared fields when missing`

## Deferred Items

- Etsy marketplace wiring fix
- Orphaned eBay inventory_item cleanup
- Seller profile GET auto-create race condition
- Listings route test coverage expansion
- CSV export condition map consistency
- Full required-aspects editor UI
- DRY fetchEbayPolicies

## Decisions

- Instance methods for seller-scoped eBay writes (not static app-token)
- POST not PUT for createInventoryLocation
- ebayPreparedFields as publish() parameter not stored in state
- Keep publishImmediately alongside publishMode for backward compat
- Fix CONDITION_MAP in adapter only (prepare-listing map is comp-bucket, different purpose)
- GET-first idempotency for auto-setup
- Self-healing publish() over fixing every caller

## Review

**Agents:** silent-failure-hunter, type-design-analyzer, code-reviewer, comment-analyzer, pr-test-analyzer, code-simplifier, adversarial-bugs, adversarial-security, adversarial-perf, adversarial-edge-cases
**Critical issues found:** 6
**Important issues found:** 3

## Verification

- **lint:** 0 errors
- **tests:** 351/351 pass (excl pre-existing batch-enhance)
- **typecheck:** pass (3 workspaces)

**Tags:** `ebay`, `marketplace`, `listing-flow`, `publish`, `draft`, `condition`, `policies`, `inventory-location`, `auto-setup`, `bulk-publish`

