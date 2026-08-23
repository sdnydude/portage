---
title: "2026-08-23 — Housekeeping batch 1"
description: "Proof-of-done bundle: one price both directions on a live eBay listing, aspect removal through to the listing row, estimated-value retirement, token chips, item status, category filter, condition notes"
---

# Proof of Done — Housekeeping batch 1

Captured 2026-08-23 02:20–02:58 ET against `portage-api` + `portage-app`
rebuilt from `feat/housekeeping-1`. Every image is a Playwright capture from
`apps/web/e2e/housekeeping-1.spec.ts` run with `E2E_EBAY_LIVE=1` against the
real stack and the real eBay account. Ground truth was read from Postgres
(`items`, `listings`, `marketplace_sync_log`) and from eBay (`GetItem`) after
each step. Nothing is staged on the page.

The live run earned its keep: it exposed a bug the 1,026 mocked route tests
could not — drizzle renders a JS array parameter as `($1, $2)`, so the
`jsonb #- path` that strips a removed aspect from the listing row was invalid
SQL and the request 500'd after the item row had already changed. Fixed
(array-literal parameter; item write, aspect strip and price mirror now share
one transaction) and re-proven below.

## 1. One price, both directions — live

Listing: Insta360 GO 3 Screen Protector, eBay `307120489530`, $10, no Best
Offer, no orders. Card price $10 → $11: `items.price` = 11. Edit-page price
$11 → $12: `listings.price` = 12. Restored to $10 in-run; eBay `GetItem`
reports `$10 Active` afterwards. Separately, the operator's manual test on the
Sirui tripod (`307124219439`) landed $144 on the item row, the eBay row, the
Reverb row and the live eBay listing, with `listing_edit` and `item_edit` sync
rows both `success`.

![Detail before](/img/verification/housekeeping-1/1a-detail-before.png)
![Header reflects the card edit after reload](/img/verification/housekeeping-1/1b-card-edit-header-reflects.png)
![Card reflects the edit-page price](/img/verification/housekeeping-1/1c-edit-page-card-reflects.png)
![Restored](/img/verification/housekeeping-1/1d-restored.png)

## 2. Aspect removal reaches the listing row

Removing the optional **Features** specific from the optimizer panel deleted
the key from `items.aspects`, stripped it from the live listing's
`marketplace_specific_fields.aspects`, and the `item_edit` sync to eBay
succeeded. On scan review the new ✕ on a free-text specific empties it and the
saved item carries no such key (restored afterwards — it was real data).

![Optimizer before remove](/img/verification/housekeeping-1/2a-optimizer-before-remove.png)
![After remove, reloaded](/img/verification/housekeeping-1/2b-optimizer-after-remove-reload.png)
![Scan review specific filled](/img/verification/housekeeping-1/2c-scan-aspect-filled.png)
![Scan review specific cleared](/img/verification/housekeeping-1/2d-scan-aspect-cleared.png)

## 3 / 4. The estimated-value range is gone

Inventory card shows the set price, item detail has no Estimated Value panel,
scan review has no Value Low / Value High inputs. Columns are kept and still
written from the scan candidate.

![Inventory card shows price](/img/verification/housekeeping-1/3a-inventory-card-price-not-range.png)
![Detail without Estimated Value](/img/verification/housekeeping-1/3b-detail-no-estimated-value.png)
![Scan review without the range](/img/verification/housekeeping-1/3c-scan-review-no-value-range.png)

## 5 / 6 / 7. Chips on design tokens, readable in both themes

Contrast measured from computed colors on `/listings`: light eBay 9.25:1,
Draft 6.29:1; dark eBay 7.08:1, Draft 9.39:1 (bar: 4.5:1). Marketplace is a
chip, not gray uppercase text. The inventory card carries the derived status
chip plus one marketplace chip per live listing.

![Listings chips, light](/img/verification/housekeeping-1/5-listings-chips-light.png)
![Listings chips, dark](/img/verification/housekeeping-1/5-listings-chips-dark.png)
![Inventory card chips](/img/verification/housekeeping-1/7-inventory-card-status-marketplace-chips.png)

## 8. Item status

Unlisted item set to **Asset** on the detail page, survives reload
(`items.status = 'asset'`, `displayStatus = 'asset'`), the Asset filter chip
returns it. The live-listed item shows **Active (live listing)** read-only.

![Asset after reload](/img/verification/housekeeping-1/8a-detail-status-asset-after-reload.png)
![Asset filter](/img/verification/housekeeping-1/8b-inventory-asset-filter.png)
![Locked Active on a live item](/img/verification/housekeeping-1/8c-live-item-status-locked-active.png)

## 9. Category filter is case-insensitive

A row stored as `Electronics` (capital E, forced via SQL — writes are now
normalized) is returned by the Electronics chip; the Automotive chip exists.

![Electronics chip matches the capitalized row](/img/verification/housekeeping-1/9a-electronics-chip-matches-capitalized-row.png)

## 10. Condition notes

Five-row textareas on scan review and the edit page; a 2,000-character paste
stored at `length(condition_notes) = 2000`.

![Scan review notes](/img/verification/housekeeping-1/10a-scan-review-notes-5-rows.png)
![Edit page notes with 2000 chars](/img/verification/housekeeping-1/10b-edit-notes-5-rows-2000-chars.png)
