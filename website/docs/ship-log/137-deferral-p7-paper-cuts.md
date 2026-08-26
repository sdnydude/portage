---
title: "Deferral P7 — paper-cuts batch (14 items) + EBAY_REJECTED error surfacing"
sidebar_label: "Deferral P7 — paper-cuts batch"
sidebar_position: 137
slug: ship-4a295888
registry_id: 4a295888-25dc-42a1-bda4-ebf1c30e47c0
---

# Deferral P7 — paper-cuts batch

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | simple |
| **TDD** | Yes (one-test-per-write, every item red→green) |
| **PR** | #327 (+#328 label follow-up) |
| **Completed** | 2026-08-26 |
| **Model** | claude-fable-5 |

All 14 §P7 items closed, one pathspec commit per item citing its registry id.
A pre-build advisor validated every item against current main first (13 BUILD,
1 respec — stale line refs corrected, one 19-line drift caught).

## Shipped

- `17c90eea` draft-fallback warning keys on `shouldPublish` (live silent
  warning-suppression bug on the publish path)
- `6adfadb4` seller-profile GET auto-create race → `onConflictDoNothing` +
  re-select
- `668ee616` items export capped at 10,000 rows + `X-Portage-Truncated`
- `d65d1e9e` retention sweep clears export tokens 7 days past expiry
  (named keep-all approval — dead single-use security artifacts)
- `3b00baeb` `response_format: json_object` on the no-tools chat path
- `7107c1b8` taxonomy cache lookups labeled `cache_hit`/`cache_miss`
  (the counter had zero cache callers; a route-level caller codegraph
  missed joins the shape in #328)
- `b9c43cd4` SSRF regression test (disallowed photo origin never fetched)
- `d56aff62` eBay Identity fetch-throw path test
- `d37981ff` DisclaimerSheet `listingId`→`itemId` rename
- `69676181` `.env.example` RESEND_FROM quoted
- `90ca92c2` frontend-verification skill reconciled to tdd-guard truth
- `43e86493` gh 2.98.0 via the official apt repo, `~/.local/bin` shadow
  removed (operator-run; plain Ubuntu apt only carries 2.45)
- `ac10157f` respec-to-docs (operator ruling A): tdd-guard hard-codes one
  shared data dir — serialized-suite constraint documented instead

## Bonus: prod incident → fix, same session

A live "Internal server error" on Create Listing was diagnosed from the
(now-redacted) logs in minutes: eBay Trading error 240 —
`LP_Miscat_Accessories_in_Tablet`, an accessory named in a tablet title.
`EbayTradingError` now surfaces as **422 EBAY_REJECTED** carrying eBay's
actionable message (error codes in `details`), deployed the same night.

## Verification

api 1047/1047 (+9) · web 701/701 · typecheck clean · advisor-validated plan ·
all 13 registry items resolved with commit refs.

**Tags:** `p7`, `paper-cuts`, `tdd`, `ebay-rejected`
