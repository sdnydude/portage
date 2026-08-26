---
title: "2026-08-26 — Publish claim race"
description: "Proof-of-done: concurrent same-key publishes serialized live against the real eBay account — one AddFixedPriceItem, contenders answered 409 PUBLISH_IN_PROGRESS"
---

# Proof of Done — Publish claim race

Captured 2026-08-26 19:05–19:23 ET against `portage-api` + `portage-app`
rebuilt from `fix/publish-claim-race` @ `66e1909`. Both proofs ran against the
production API (`https://10.0.0.251:8016`) and the real eBay seller account —
no mocks, no fixtures.

## Incident

11:56 ET the same day: six `POST /listings` from an iPhone within 1.5 s shared
one idempotency key; four reached `AddFixedPriceItem`, two live eBay listings
(307147990898, 307147990977) were created for one row, and eBay's duplicate
policy 422'd every revise until one was ended by hand. Root cause: the R3
resume claim only refreshed price, so its `WHERE` stayed true for every
contender until the winner wrote the ItemID ~2.5 s later; the terms sheet's
Accept button had no in-flight guard. Latent since the R3 idempotency ship
(2026-07-09), not a P7 regression.

## Proof 1 — `POST /listings`, 3 concurrent same-key live publishes

Item: Panasonic Lumix G Vario 12-35 (`a6acc736`). Script fired three
identical requests (same `idempotencyKey`) at once.

```
req0 409  49ms {"error":"This listing is already being published — wait for that result.","code":"PUBLISH_IN_PROGRESS"}
req1 201 2933ms {"id":"12814372-…","marketplaceListingId":"307148479261","ebaySku":"PRT-000147", …}
req2 409  48ms {"error":"This listing is already being published — wait for that result.","code":"PUBLISH_IN_PROGRESS"}
```

- Loki (`portage-api`, 19:05:27): exactly one `eBay listing published via
  AddFixedPriceItem 307148479261`, one `Listing created`.
- DB: row `12814372` → `active`, `marketplace_listing_id=307148479261`,
  `publish_claimed_at=NULL` (claim released by the ItemID write).
- eBay `GetMyeBaySelling` ActiveList: exactly one listing with SKU `PRT-000147`.
- Live `EbayAdapter.findListingBySku('PRT-000147')` → `307148479261`.

That item turned out to have sold earlier the same day (its `sold` listing
row was not excluded by the proof's item query — operator caught it); the
proof listing was ended 90 s later via `DELETE /listings/:id`
(`EndFixedPriceItem` logged 19:06), the sold row untouched.

## Proof 2 — `POST /listings/:id/publish`, 2 concurrent publishes of one draft

Item: Nextorage AtomX SSDmini 500GB (`b783e5ce`, $119). Saved as a DB draft
(`publishMode: draft`, no ItemID), then two concurrent publishes.

```
draft 201 9dab50b6-… draft null
req0 200 1932ms {"id":"9dab50b6-…","marketplaceListingId":"307148493676", …}
req1 409   12ms {"error":"This listing is already being published — wait for that result.","code":"PUBLISH_IN_PROGRESS"}
```

- Loki: one `AddFixedPriceItem 307148493676` (SKU `PRT-000149`).
- DB: row `9dab50b6` → `active`, ItemID set, `publish_claimed_at=NULL`.
- Listing left live per operator.

## Gates

- typecheck clean; api 1060/1060 (+13 tests: claim stamp, staleness WHERE
  predicate rendered via `PgDialect`, 409 on in-flight loss, ItemID write
  clears, definitive-error release, network-error keep, stale-takeover
  adopt-by-SKU on both routes, post-claim pre-flight release, sweep adopt,
  `findListingBySku` pagination); web 704/704 (+3: double-tap → one POST,
  `busy` disables Accept, 409 rendered as notice); lint 0 errors.
- Adversarial review: 3 findings (sweep read the wrong SKU column; claim
  leaked on post-claim pre-flight throws; unbounded pagination) — all fixed
  before commit; record `.claude/review-records/2f95725e….md`.
- Worker boot on the rebuilt container: `sync worker started`, stuck-claim
  sweep wired (boot + 5 min).
