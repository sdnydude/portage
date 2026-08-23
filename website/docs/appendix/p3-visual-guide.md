---
title: "Appendix: P3 Visual Guide — what changed and why"
sidebar_label: "Appendix: P3 Visual Guide"
sidebar_position: 2
description: "Before/after guide to Deferral P3 (beta UX truth): every place the app used to fail quietly, what a seller sees now, and the proof screenshot behind it."
---

# Appendix: P3 Visual Guide

Deferral P3 (PR [#315](https://github.com/sdnydude/portage/pull/315), merged
2026-08-22) closed nine registry items under one theme: **every silent
failure or silent mutation on the scan → price → publish path is now told.**
This page is the reader's version of the session's live build tracker and
visual guide — the same content, with the proof screenshots captured by
`apps/web/e2e/p3-ux-truth.spec.ts` (deterministic, rebuilt containers) and
`apps/web/e2e/p3-bo-live.spec.ts` (real eBay).

The interactive artifact is preserved as a standalone page:
[guide.html](pathname:///portage/img/verification/p3-ux-truth/guide.html) (deployed site path).

## 0 · Live proof — the 2026-08-05 blocked price-save, on a real listing

*NETGEAR GSM4212P · eBay 307139861284 · $599, auto-accept $579 / minimum $549*

**Before (08-05):** lowering the price under the auto-accept produced a prose
error and a stuck save — no numbers, no way forward from the card.

**After:** price set to $560 → eBay's thresholds shown in the banner with both
actions. *Adjust to fit price* rewrote them under $560 and the save synced to
eBay (1.95 s). Price restored to $599 in-run, thresholds restored to $579/$549
right after — the listing ended exactly as it started.

![Live conflict on the real listing](/img/verification/p3-ux-truth/L2-live-bo-conflict-banner.png)
![Adjust to fit price → $504 / $448 under $560](/img/verification/p3-ux-truth/L3-live-adjusted-to-fit.png)
![Saved — revise accepted by eBay](/img/verification/p3-ux-truth/L4-live-saved-after-fix.png)
![Restored to $599](/img/verification/p3-ux-truth/L5-live-price-restored.png)

The post-save path (eBay holding thresholds Portage never stored) could not be
induced live — the only candidate listing had no live thresholds and accepted
the lower price; it is covered by route tests.

## 1 · Best Offer conflicts get a guided fix

*ListingCard price editor · `ebay-adapter.ts` + `routes/listings.ts`*

**Before:** a price eBay rejected over its Best Offer thresholds came back as
prose — and if the rejection happened *after* the local save, the app
reported success with a warning string. No numbers, no action; the item edit
page threw the warning away on navigation.

**After:** every conflict carries the live thresholds. The banner shows the
exact auto-accept / minimum values, says whether they were refreshed from
eBay, and offers **Adjust to fit price** (both thresholds rewritten strictly
below the new price) or **Turn off offers**. A conflict tripped from shipping,
archive or publish opens the same fix. The edit page keeps you on the page
with the warning.

![Price save blocked: banner with the real thresholds and both actions](/img/verification/p3-ux-truth/6-bo-conflict-guided-banner.png)
![After Adjust to fit price](/img/verification/p3-ux-truth/7-bo-adjusted-to-fit.png)
![Reloaded: the adjusted thresholds persisted](/img/verification/p3-ux-truth/8-bo-fix-persisted-after-reload.png)

## 2 · Scan review tells the truth about outages

*Scan → Review screen*

**Before:** comps search failing looked identical to "no comps found". The
eBay category details failing to load left the header claiming **Complete**
and the List button enabled. A category lookup failure looked like "no
category matched".

**After:** three separate notices, each with its own retry — *Comps
unavailable — using AI estimate only*; *eBay category details unavailable*
(header reads **Unavailable**, Save & List blocked with that reason until
Retry succeeds); *Category lookup failed — Retry lookup*, kept apart from the
genuine no-match message.

![Comps outage notice and condition-snap notice](/img/verification/p3-ux-truth/1-scan-review-outages-told.png)
![Category details outage: Unavailable chip, Retry, List blocked](/img/verification/p3-ux-truth/1b-scan-review-aspects-outage.png)
![After Retry: notice gone, header back to Complete](/img/verification/p3-ux-truth/2-aspects-retry-cleared.png)
![Category lookup failure with its own Retry](/img/verification/p3-ux-truth/3-category-lookup-failed.png)
![A real no-match after retry](/img/verification/p3-ux-truth/4-category-no-match-after-retry.png)

## 3 · Condition changes are announced

*Scan → Review · Condition chips*

**Before:** when the resolved eBay category didn't accept the AI-detected
condition, the app quietly switched it (e.g. Good → New).

**After:** the switch still happens, but a notice says exactly what and why:
*Condition adjusted to New — Good isn't offered in this category.* It clears
the moment you pick a chip, use a comp's condition, or the category changes.

## 4 · Swipe flow gets the same AI prep as Hybrid

*Listing flow · Swipe mode, Configure step*

**Before:** on a fresh scan the Swipe flow never created the item before the
prepare step, so the AI-prepared eBay fields, comps and Best Offer floor
silently never arrived. A creation failure was swallowed in both flows.

**After:** confirming recognition creates the item first, then runs prepare
and comps. A creation failure is shown with **Retry** in both flows, and
Swipe's Next is held until the item exists. (Data path — proven by component
tests, no screenshot.)

## 5 · Mobile deep links stop fetching a hidden pane

*Inventory page with `?item=` in the URL*

**Before:** opening `/inventory?item=…` on a phone mounted the desktop detail
pane invisibly and fired its item fetches for nothing.

**After:** below 1024px the deep link is ignored; the grid renders and no
detail fetch is made. On desktop the pane opens as before. Side effect: the
mobile grid no longer highlights the deep-linked card.

![390px viewport with ?item= — grid only, zero detail fetches](/img/verification/p3-ux-truth/5-mobile-deep-link-no-pane.png)

## Numbers

api 1011 → 1016 · web 649 → 674 · e2e +6 · 24 code files · ~40 review
findings fixed · zero deferrals. Full proof bundle:
[2026-08-22 — Deferral P3](/docs/proof/2026-08-22-p3-beta-ux-truth) ·
ship-log [058](/docs/ship-log/058-deferral-p3-beta-ux-truth).
