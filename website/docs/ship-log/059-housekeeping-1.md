---
title: "Housekeeping batch 1 — price truth, aspect removal, est-value retirement, item status, chips, category filter, condition notes"
sidebar_label: "Housekeeping batch 1"
sidebar_position: 59
---

# Housekeeping batch 1

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex (schema enum + column, api + web, 10 operator items, 11 tasks) |
| **TDD** | yes (one test per write, red → green) |
| **Branch** | `feat/housekeeping-1` |
| **PR** | pending |
| **Tests** | api 1016 → 1033 · web 674 → 695 · e2e +8 (live, incl. wiring audit) |
| **Proof** | [2026-08-23 Housekeeping batch 1](/docs/proof/2026-08-23-housekeeping-1) |

## What shipped

Ten operator-reported beta annoyances, each built, live-proven, and closed.

- **One price, both directions.** `items.price` and `listings.price` are the
  same number. An item edit mirrors the price onto every draft/active listing
  row before the outbox sync; a listing-card edit writes back to the item.
  Item detail shows the item price in the header; a card save refetches the
  item. Five of the twelve cheapest live listings had drifted before this.
- **Aspect removal.** `PATCH /items/:id` accepts `aspects: { Key: null }` and
  deletes the key (listings' `marketplaceSpecificFields` already had this
  semantic). Because the sync merge lets a listing's stored aspects override
  the item's, removed keys are also stripped from live/draft listing rows in
  the same transaction. Optimizer panel gets a Remove (✕) per filled specific;
  scan review's free-text specifics get an explicit ✕.
- **Estimated-value range retired.** Removed from the inventory card (shows
  the price or "No price"), item detail (header badge + panel), scan review
  (Value Low/High inputs), the three listing flows, the publish sheet's
  "Estimated" provenance, and the `price.ts` prefill chain (item price →
  comps → nothing). Columns stay and are still written from the candidate.
- **Item status.** New `item_status` enum (`unlisted | asset | sold |
  archived`, default `unlisted`) on `items`. Reads project a derived
  `displayStatus` (active listing → Active, draft listing → Draft, else the
  manual status); `GET /items?status=` filters on it. Detail and edit pages
  get a status control that locks to Active/Draft while a listing owns it.
  Inventory gains status filter chips.
- **Chips.** Shared `StatusChip` / `MarketplaceChip` on new `--chip-*` tokens
  (light + dark pairs, every pair ≥ 6.3:1 — the old raw `amber-100/700` pairs
  were not readable in light mode). Listings page rows and inventory cards
  use them; the card shows one marketplace chip per live listing via a new
  `liveMarketplaces` projection.
- **Category filter.** The static 13-bucket chip list matched 5 of 156
  items — `items.category` holds the eBay leaf name since the taxonomy
  change. New `GET /items/categories` returns the seller's own categories
  with counts (case-folded); the chips render from it; the match is a
  case-insensitive `ILIKE` with escaped wildcards; create/update/bulk
  normalize writes to lowercase-trim. Caught by the operator after the first
  proof passed on a forced row — the proof was rewritten against real data.
- **Condition notes.** Five-row textarea, 2,000-char cap, on scan review and
  the edit page (server cap was already 2,000).

## Caught by the live run

The mocked route tests were green; the live Playwright run against the
rebuilt containers 500'd on aspect removal. drizzle expands a JS array
parameter into `($1, $2)`, so the `jsonb #- path::text[]` strip was invalid
SQL — and it ran after the item update, outside a transaction, leaving the
item changed and the listing not. Fixed with a single array-literal
parameter and one `db.transaction` around the item write, the aspect strip
and the price mirror. This is the case for the proof-of-done contract.

## Not built as planned, and why

The plan named a null-delete path in `ListingCard`'s aspect sheet.
`AspectFillSheet` only collects category-*required* specifics that are
missing and cannot save until all are filled, so there is nothing to clear
there. Listing-side removal rides the item path (optimizer panel → item PATCH
→ listing-row strip → sync), which is what the proof exercises. No item was
deferred.

## Operator decisions (2026-08-23 00:17)

1. One price, both directions — `items.price ⇄ listings.price`.
2. `items.status` is manual only for non-marketplace states; Active/Draft stay
   derived from listings.
3. Estimated-value range hidden everywhere; columns kept and still written.
