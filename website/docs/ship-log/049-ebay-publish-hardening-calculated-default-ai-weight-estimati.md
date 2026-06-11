---
title: "eBay publish hardening — Calculated default + AI weight estimation + editable price on every publish path"
sidebar_label: "eBay publish hardening — Calculated default + AI w"
sidebar_position: 49
---

# eBay publish hardening — Calculated default + AI weight estimation + editable price on every publish path

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [https://github.com/sdnydude/portage/pull/101](https://github.com/sdnydude/portage/pull/101) |
| **Completed** | — |
| **Model** | claude-opus-4-8 |

## Approach

Live-probe-verified the Calculated/USPSParcel fix (LOGISTICS_INFO_IS_MISSING was a bad service code); fixed AI weight prompt zero-anchoring; added items.price with resolvePublishPrice prefill across all publish paths (detail sheet, 3 listing-flow modes, republish, scan-flow); extracted+tested ScanReviewActions; enforced tdd-guard on apps/web

## Deferred Items

- item detail read-view price display (minor)
- live scan-flow Save&List path not manually driven (camera/AI)

## Decisions

- Calculated USPSParcel buyer-paid default over flat-rate (probe-verified)
- new items.price column over reusing estimatedValueRecommended
- remove silent List-for-Sale button; route all publishing through price-confirming sheet
- enforce tdd-guard on apps/web (remove exemption + wire reporter)

## Verification

- **lint:** 0 errors
- **tests:** web vitest + api items/adapter/seller-profile green; Playwright e2e green vs rebuilt :3002
- **typecheck:** pass

**Tags:** `ebay`, `calculated-shipping`, `price`, `weight`, `tdd-guard`

