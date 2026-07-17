---
id: ebay-trade-first
title: eBay Trade-First Publishing
sidebar_position: 2
---

import ThemedImage from '@theme/ThemedImage';

# eBay Trade-First Publishing

Current-state reference for Portage's eBay listing lifecycle. Since the **Trade-First
migration** (PR #133, merged 2026-06-30, live-proven on a real eBay account), every
listing operation runs on eBay's **Trading API** — the Inventory API's
inventory_item → offer → publish three-step is gone from the publish path entirely.

All Trading calls go through one transport, `callTradingApi()`
(`apps/api/src/marketplace/ebay-trading-client.ts`): an XML POST to
`https://api.ebay.com/ws/api.dll` carrying the call name, the user's OAuth token
(`X-EBAY-API-IAF-TOKEN`), and schema version 1207 via
`X-EBAY-API-COMPATIBILITY-LEVEL` (omitting it makes eBay reject the call with
error 10012). The transport throws on `Ack: Failure`, and — by default — logs and
continues on `PartialFailure` and `Warning`; that distinction matters for publish,
below. Request XML is built by pure functions in
`apps/api/src/marketplace/ebay-trading-builders.ts`; the lifecycle logic lives in
`EbayAdapter` (`apps/api/src/marketplace/ebay-adapter.ts`).

<ThemedImage
  alt="eBay Trade-First publish and listing lifecycle: draft = DB row only; live = single AddFixedPriceItem XML round-trip returning one ItemID, with edit/end/status operations after go-live"
  sources={{light: '/portage/img/ebay-trade-first-workflow.svg', dark: '/portage/img/ebay-trade-first-workflow-dark.svg'}}
/>

*The lifecycle at a glance: drafts never touch eBay, a live publish is a single
`AddFixedPriceItem` round-trip, and the returned ItemID is the one handle for every
later revise, end, and status read.*

## The five Trading calls

| Call | Fires when | Where |
|---|---|---|
| `AddFixedPriceItem` | Live publish — `createListing()`. One call creates the live listing and returns its ItemID. | `ebay-adapter.ts` `createListing` |
| `ReviseFixedPriceItem` | Content edit — any change to title, description, photos, brand/model/MPN, condition, features, aspects, weight/dimensions, or category. Rebuilds the full item body with the same guards as publish. | `ebay-adapter.ts` `updateListing` |
| `ReviseInventoryStatus` | Price/quantity-**only** edit — the fast path. No item rebuild, no aspect gate; just `StartPrice` and/or `Quantity` against the ItemID. | `ebay-adapter.ts` `updateListing` |
| `EndFixedPriceItem` | Ending a live listing (`deleteListing()`), with `EndingReason: NotAvailable`. There is no offer to withdraw or DELETE — the old Inventory offer paths 404 on a Trading ItemID. | `ebay-adapter.ts` `deleteListing` |
| `GetItem` | Every read-back: `getListingStatus()` (Active/Completed/Ended → `active`/`sold`/`ended`), the F-GATE in-app verification read (`getEbayItemVerification()`), and orphan-order backfill (`getItemDetail()` reconstructs a local item+listing when an order arrives for a listing Portage never stored). | `ebay-adapter.ts` |

Two behaviors around `AddFixedPriceItem` are worth knowing:

- **Warning still means published.** eBay returns the ItemID even on
  `Warning`/`PartialFailure` responses, and `callTradingApi` only throws on
  `Failure` — so `parseAddItemResponse()` extracts the ItemID from any non-fatal
  response and the listing is treated as live. A parsed response with **no** ItemID
  is a hard `502 EBAY_PUBLISH_FAILED`.
- **Best Offer downgrade retry.** eBay publishes no stable error id for
  category-level Best Offer support, so if an Add (or Revise) fails with a
  best-offer-shaped message, the adapter retries once without `bestOfferTerms`
  and surfaces a "Listed without Best Offer auto-accept" warning instead of
  failing the whole publish.

A sixth call, `VerifyAddFixedPriceItem`, exists as an operator dry-run only: the
standalone script `apps/api/src/scripts/ebay-verify-dryrun.ts` sends the exact
publish payload for eBay to validate without creating a listing. It is not part of
the runtime publish path.

## Inline shipping terms — no Business Policies

The item body built by `ebay-trading-builders.ts` carries its terms **inline**
(Decision 5 in the builders header): no `<SellerProfiles>`, no `<PaymentMethods>`,
and the eBay account is opted **out** of Business Policies. Concretely, every
Add/Revise payload includes:

- `<ReturnPolicy>` with `ReturnsNotAccepted`, inline
- `<ShippingDetails>` with `ShippingType: Calculated`, the seller's origin ZIP, and
  a buyer-paid USPS service option (default `USPSPriority`)
- `<ShippingPackageDetails>` with the package weight (lbs/oz) and dimensions
  (inches) that calculated shipping requires
- `DispatchTimeMax` (default 1)

Because the terms are inline, the old "set up four eBay Business Policies before
your first listing" gate no longer exists. What replaces it are two pre-flight
guards in `buildTradingInput()` (`ebay-adapter.ts`): a missing ship-from ZIP throws
`422 EBAY_SHIP_FROM_REQUIRED`, and missing weight/dimensions throw
`422 EBAY_WEIGHT_REQUIRED` — both structured errors the UI turns into prompts,
instead of eBay's opaque 25020/21915 rejections.

## No Inventory-API offers

Under Trade-First there is no offer object anywhere in the flow:

- **Adapter interface**: `ebayOfferId` was removed from the shared marketplace
  contract in PR #133 — neither `MarketplaceListingInput` nor
  `MarketplaceListingResult` in `packages/shared/src/marketplace.ts` carries an
  offer id. The Trading **ItemID** (`marketplaceListingId`) is the single handle.
- **Database**: the `listings.ebay_offer_id` column still exists in
  `apps/api/src/db/schema.ts` but is inert — the publish path writes `null` and
  nothing reads it.
- **Drafts**: the Trading API has no unpublished-offer concept, so an "eBay draft"
  is just a local database row. Both `draft` and `ebay_draft` publish modes stay
  DB-only; only `live` calls eBay (`apps/api/src/routes/listings.ts`).

## Insert-first idempotency on publish

`AddFixedPriceItem` is not idempotent on eBay's side — a naive retry would create a
second live listing. Portage makes retries safe with an **insert-first** pattern in
`POST /listings` (`apps/api/src/routes/listings.ts`):

1. Every publish intent carries an `idempotencyKey` (client-supplied and stable
   across retries, or server-generated).
2. The listing row is **inserted before any eBay call** — as a draft with a `null`
   `marketplaceListingId` and the key. A crash between eBay's 200 and the DB write
   can therefore never orphan a live listing.
3. A partial unique index on `(user_id, idempotency_key)` (where the key is
   non-null, `apps/api/src/db/schema.ts`) makes a concurrent or retried submit hit
   a `23505` unique violation **before** any `AddFixedPriceItem` call.
4. On `23505`, the handler replays: a row that already reached the marketplace (or
   a draft-mode submit) is returned as-is — never double-listed. A live-publish
   retry against a row stuck as an unpublished draft (insert succeeded, the eBay
   call failed) **resumes** the publish, using a conditional `UPDATE ... WHERE
   status = 'draft' AND marketplace_listing_id IS NULL` as an atomic claim so that
   of two concurrent retries, only one may call eBay.
5. On success, the pre-inserted row is UPDATEd in place with the returned ItemID,
   status, and `publishedAt`.

Net effect: double-clicks, network retries, and second-device submits converge on
one listing row and at most one live eBay listing.

## Serialized eBay SKU

Each item gets a stable, serialized SKU — `PRT-000123` — minted once from the
Postgres sequence `portage_ebay_sku_seq` and persisted on `items.ebay_sku`
(`apps/api/src/db/schema.ts`). The mint (`ensureItemEbaySku()` in
`apps/api/src/marketplace/ebay-sku.ts`) is a single atomic
`UPDATE ... SET ebay_sku = COALESCE(ebay_sku, ...) RETURNING`, so two concurrent
publishes converge on the same SKU instead of racing into two.

Two properties make this matter:

- **Idempotent republish.** The SKU is resolved **before** the adapter call, so it
  survives a publish that throws — the next attempt reuses it instead of minting a
  fresh one. (Pre-hardening, the adapter minted a random timestamp-based
  `portage-…` SKU per attempt; that random form survives only as the fallback for
  an item with no stored SKU.)
- **ATO-safe.** A burst of new SKUs in minutes is exactly the "rapid listing
  frequency" signal eBay's account-takeover protection keys on. A stable SKU per
  item removes that churn — the full threat model is in
  [eBay ATO & Publish Hardening](/docs/reference/ebay-ato-and-publish-hardening).

## Silent-fail detection: the ItemID prefix

A live eBay Trading listing ItemID starts with **`3`** (PR #133's live proof:
ItemID `307034773471`, "prefix `3` = live"). A **`1`-prefixed** id is an Inventory
API *offer* id — if one ends up stored as `marketplaceListingId`, the publish
silently failed at the offer stage and never went live.

This is a documented **operational heuristic, not an automated code check** —
nothing in `apps/api/src` inspects the prefix programmatically. The one place it
surfaces in product is `ListingCard`
(`apps/web/src/components/listing/listing-card.tsx`), which shows the raw,
copyable listing id specifically so an operator can eyeball the prefix and use the
id for Seller Hub lookups. Under Trade-First the failure mode itself is designed
out — there is no offer step to silently stall in — so the heuristic chiefly
matters when auditing rows that predate the migration.

## Why the Trading API over the Inventory API

From the PR #133 rationale (consistent with
[Marketplace Adapters](/docs/architecture/marketplace-adapters)):

- **No Business Policies setup gate.** Inline terms mean a seller can publish
  their first listing without ever configuring eBay Business Policies — the old
  `EBAY_SETUP_REQUIRED` nav-trap is gone.
- **One call instead of three.** `AddFixedPriceItem` replaces the Inventory API's
  inventory_item → offer → publish sequence. Fewer round-trips, fewer partial
  states.
- **No SKU/offer split, no silent offer-state failures.** A live publish either
  returns a real ItemID or surfaces the error; a failed publish leaves no orphan
  offer behind on eBay.
- **Drafts are free.** With no unpublished-offer concept, a draft is a database
  row and nothing else — no eBay call, no remote state to reconcile.
- **Live-proven.** The full lifecycle (publish → price revise → end) was verified
  against a real eBay account before merge.

<ThemedImage
  alt="End-to-end eBay pipeline: AI scan creates the item, prepare-listing adds AI fields plus comps pricing and category, AddFixedPriceItem publishes it live, then order sync via the Fulfillment API through shipping and fulfillment"
  sources={{light: '/portage/img/ebay-trade-first-pipeline.svg', dark: '/portage/img/ebay-trade-first-pipeline-dark.svg'}}
/>

*Where publishing sits in the whole eBay journey: scan → item → prepare (comps +
category) → Trading-API publish → Fulfillment-API order sync → ship. Aspects flow
into `ItemSpecifics`; weight/dims flow into the inline shipping terms.*

Only the listing lifecycle moved to Trading. Orders still sync via the
**Fulfillment API**, categories and required aspects come from the **Taxonomy
API**, comps from the **Browse API**, and per-category condition policies from the
**Metadata API** — all unchanged by the migration.

## Related pages

- [Marketplace Adapters](/docs/architecture/marketplace-adapters) — the adapter
  interface and the seller-facing framing of Trade-First
- [eBay ATO & Publish Hardening](/docs/reference/ebay-ato-and-publish-hardening) —
  the account-security threat model behind the serialized SKU and `User-Agent`
  hardening
- [Listings API](/docs/api/listings) — the REST endpoints that drive this
  lifecycle
