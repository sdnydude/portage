---
title: "Deferral P3: beta UX truth — guided Best Offer fix, scan/swipe outage surfacing, mobile deep-link guard"
sidebar_label: "Deferral P3: beta UX truth"
sidebar_position: 58
---

# Deferral P3: beta UX truth

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex (api + web, 9 registry items, 13 tasks) |
| **TDD** | yes |
| **Branch** | `feat/p3-beta-ux-truth` |
| **PR** | [#315](https://github.com/sdnydude/portage/pull/315) (merged 2026-08-22 22:12 ET, `734ae42`) |
| **Registry items** | `25afd214` `cf6d2ce2` `c3b3013c` `e955f1b9` `62e1061e` `125cbc53` `14efa906` `2b8aefb1` `a5a2b944` + adapter-path BO enrichment |
| **Tests** | api 1011 → 1016 · web 649 → 674 · e2e +6 |

## What shipped

Every silent failure or silent mutation on the beta scan → price → publish
path now tells the seller what happened and, where possible, how to fix it.

- **Best Offer conflicts get a guided fix.** All three adapter throw sites
  carry `BestOfferConflictDetails`; the `PATCH /listings/:id` post-save catch
  no longer swallows an eBay rejection into a 200 + warning — it heals from
  live (one GetItem), persists, and rethrows 422 with the real thresholds
  (`healed` only when the write landed). `ListingCard` renders the banner with
  the numbers and two actions — **Adjust to fit price** (clamped strictly
  below the form price, minimum left empty when there's no room) and **Turn
  off offers** — from the price, shipping, archive and publish catches. The
  item edit page surfaces `syncWarnings` in place instead of `router.back()`.
- **Swipe is photo-first.** Confirming recognition creates the item, then runs
  prepare + comps (Hybrid's contract); creation failure shows with Retry and
  Next is held. Hybrid's identical silent `.catch` got the same Retry.
- **Scan review tells the truth.** Comps outage notice; condition-snap notice
  (cleared on choice / category change); category panel split into lookup
  failed / no match / details unavailable, each with retry; `useRequiredAspects`
  exposes `isError` + `refetch`, `aspectsBlockPublish` includes it, and the
  specifics header reads **Unavailable** instead of a false **Complete**.
- **Mobile deep links** (`?item=`) only select at the `lg` breakpoint, so the
  hidden pane never fetches on phones.

## Live proof

See [2026-08-22 — Deferral P3 proof](/docs/proof/2026-08-22-p3-beta-ux-truth):
the 08-05 blocked price-save reproduced on a real eBay listing, fixed through
the banner, synced, and restored.

## Review rigor

4-advisor plan review (route must heal at conflict time; `aspectsBlockPublish`
must include the error; live eBay can't run in CI; rounding clamp), 3
per-chunk diff reviews, 6-agent final review — ~40 findings, all fixed or
dispositioned with reason in the review record. Zero deferrals.
