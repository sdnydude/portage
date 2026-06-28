# eBay Trade-First Refactor — Design

**Date:** 2026-06-27 (review findings folded in 2026-06-28)
**Status:** Scope approved; **architect + adversarial review folded in** — see "Pre-Implementation Gates" before this becomes a plan
**Owner:** Stephen Webber (product architect)
**Affected:** `apps/api/src/marketplace/ebay-adapter.ts`, `apps/api/src/marketplace/ebay-trading-client.ts`, `apps/api/src/routes/listings.ts`, `apps/api/src/routes/items.ts`, `apps/api/src/routes/orders.ts`, `apps/api/src/routes/prepare-listing.ts`, `apps/api/src/db/schema.ts`, `packages/shared/src/marketplace.ts`

---

## Problem

Portage's entire eBay listing lifecycle — create, publish, update, edit-sync, withdraw, delete — is built on the eBay **Inventory API** (the SKU → inventory_item → offer → publish model). An eBay API audit concluded this is the wrong API for Portage's product: one-of-a-kind, single-quantity, used personal effects sold from Business-Policy accounts. The correct API is the **Trading API** (`AddFixedPriceItem` / `ReviseFixedPriceItem` / `ReviseInventoryStatus` / `EndFixedPriceItem` / `GetItem`).

The Inventory API model produces concrete failure surfaces in the current code:

- **Orphan offers.** `publishMode='ebay_draft'` and any failed `/publish` create a real eBay offer with no garbage-collection path (already logged as a deferred item).
- **ID ambiguity / silent fails.** On publish failure, `createListing()` returns the offerId as `marketplaceListingId`. Live listing ids start with `3`; a `1`-prefix is an offer id / silent-fail. The distinction is not mechanically enforced.
- **Condition vocabulary bridge.** `EBAY_CONDITION_ID_TO_ENUM` + `selectValidEbayCondition()` hand-bridge numeric condition IDs to Inventory API string enums — brittle and category-dependent.
- **Collision recovery.** A ~40-line offer-reuse-on-error-25002 block compensates for the SKU/offer split.
- **Business-Policy rigidity.** Inventory API requires a policy reference on every operation with no inline fallback.

The reuse foundation already exists: `callTradingApi(callName, xmlBody, accessToken)` in `ebay-trading-client.ts` is proven in production for buyer messaging (`GetMemberMessages` / `GetMyMessages` / `AddMemberMessageRTQ`). The new listing calls reuse this transport unchanged.

---

## Approved Decisions

1. **Existing eBay listings are never touched by this refactor.** No bulk migrate, no mass end, no re-list — the refactor itself initiates zero eBay calls against pre-existing listings. They keep running exactly as they are. The Trading API path applies only to listings created from this point forward. (Note: if a user later edits or archives a *legacy* listing through the normal UI, that still flows through the existing `EbayAdapter` Inventory path unchanged — we are not removing that path, just not building new behavior on it. What we are ruling out is any refactor-driven migration action against live listings.)
2. **DB-only drafts.** Trading API has no server-side draft. `draft` and `ebay_draft` both mean: a row in Portage's DB with `marketplaceListingId = null` and no eBay API call until live publish. This eliminates the orphan-offer problem for all new listings.
3. **Phase G folded in.** The open item "Save & List publishes a draft, not a live listing" is the same publish path this refactor rewrites — it is fixed as part of this work, so the publish path is touched once.
4. **Adapter structure: Option A.** A new `EbayTradingAdapter` class implements the `MarketplaceAdapter` interface for the Trading API listing lifecycle, alongside the existing `EbayAdapter`. Routing is by a new `listings.ebay_api_version` discriminant column.
5. **Business Policies are OPTIONAL under Trading API.** Unlike the Inventory API (which mandates a policy reference on every operation), the Trading API accepts **either** `<SellerProfiles>` (policy IDs) **or** inline `<ShippingDetails>` / `<PaymentMethods>` / `<ReturnPolicy>`. The current Inventory code requiring all four policy IDs (`validateEbayListingFields()`) only proves the account *has* policies configured — it does **not** bind the Trading path to require them. This refactor drops the hard requirement: a listing can publish **without** Business Policies set up, which removes a significant onboarding/setup blocker (related to the Stage-3 eBay-setup nav trap). Chosen policy-source approach: see Decision 6.

6. **Inline terms — Business Policies not required.** New Trading-API listings supply shipping, payment, and return terms via inline `<ShippingDetails>` / `<PaymentMethods>` (`<PayPalEmailAddress>` not needed for managed payments) / `<ReturnPolicy>` XML built from the item's shipping data plus seller defaults. `<SellerProfiles>` / Business Policy IDs are **not** sent and **not** required to publish. This means the publish path no longer depends on the seller having configured eBay Business Policies. **Open data-source item (resolve in implementation plan):** identify where the inline values come from — item `weightOz`/dims/`ebayPackageType` for shipping service + cost, and a source for handling time, return window/type, and accepted payment. Candidates: `seller_profiles` / `shipping_presets` tables and existing `createFulfillmentPolicy`/`createReturnPolicy` inputs (reused as inline values rather than as policy-creation calls). If a required inline value has no current source, the plan must add a sensible default or a settings field. **This is now resolved under Gate G3 / "Inline shipping" below**, including the fallback to `<SellerProfiles>` if eBay rejects inline terms for managed-payments accounts — so the refactor stays shippable even if the no-Business-Policies benefit has to be deferred.

---

## Architecture

### Routing

`getAdapter()` in `listings.ts:101` (currently `getAdapter(userId, marketplace)` — switches on marketplace only) gains a third `apiVersion` argument:

```
getAdapter(userId, 'ebay', listingRow.ebayApiVersion)
  → 'trading'   : new EbayTradingAdapter(userId)
  → 'inventory' : new EbayAdapter(userId)        // legacy rows only, untouched by this work
  → null + ebayOfferId IS NULL : new EbayTradingAdapter(userId)  // new listing → Trading
  → null + ebayOfferId IS NOT NULL : new EbayAdapter(userId)     // safety: un-backfilled legacy row
```

The `null` case must use `ebayOfferId` as a secondary discriminant (see Gate G1 — the null-routing window). A null `ebay_api_version` on a row that already has an `ebayOfferId` is an un-backfilled legacy row, NOT a new Trading listing.

**C1 — `getOrders` / `searchCategories` are on the `MarketplaceAdapter` interface.** Verified: `packages/shared/src/marketplace.ts:68-69` declares `getOrders(since?)` and `searchCategories(query)` on the interface, so `EbayTradingAdapter implements MarketplaceAdapter` will not compile without them. Neither is a Trading-listing concern (orders = Fulfillment REST; categories = Taxonomy). **Resolution:** `EbayTradingAdapter.getOrders()` and `.searchCategories()` delegate to a shared module-level helper (`fetchEbayOrders(userId)`, `fetchEbayCategorySuggestions(query)`) that both adapters call — no cross-adapter instantiation, no duplication. (The pre-existing direct call `orders.ts:150 new EbayAdapter(userId).getOrders()` for order-sync can keep using `EbayAdapter` — order sync is version-agnostic.)

#### Call-site audit (verified — every site that routes an eBay *listing* read/write must become version-aware)

Routing on paper is worthless unless every call site reads `ebay_api_version`. Verified inventory of sites in the current code:

**Via `getAdapter()` in `listings.ts` (9 sites — add the `apiVersion` arg, and ensure the surrounding DB `select` includes `ebayApiVersion`):**
`:243` create · `:376` archive→delete fallback · `:417` PATCH edit-sync · `:476` publish · `:607`/`:617` DELETE branches · `:660` bulk-delete draft · `:673` bulk-delete · `:714` bulk-archive.

**Hardcoded `new EbayAdapter(userId)` on listing paths (must route by version, not hardcode):**
| Site | Issue | Fix |
|------|-------|-----|
| `listings.ts:208` (F-GATE `getEbayItemVerification(ebaySku!)`) | Reads Inventory item/offer by SKU; Trading rows have null `ebaySku` → returns `found:false` for a live listing (Blocker B2) | Route by version; Trading rows use `GetItem(marketplaceListingId)` |
| `listings.ts:374` (archive `withdrawOffer(ebayOfferId)`) | Trading rows have null `ebayOfferId`; falls to `:376` else-branch which must route to `EndFixedPriceItem` (Major M1) | Version-route both branches |
| `listings.ts:775` (bulk-activate adapter) | Trading drafts pass the `!marketplaceListingId` activatable filter and get marked `active` via plain `db.update` with **no `AddFixedPriceItem` call** (Major M2) | Add a Trading-draft branch that calls `createListing`, or block bulk-activate for Trading drafts with an actionable error |
| `items.ts:512` (edit-sync `new EbayAdapter().updateListing(syncId,…)`) | Hardcoded Inventory `updateListing` → `PUT /offer/{ItemID}` 404s; edits silently not applied to live Trading listings (Major M3/M4) | Route by `listed.ebayApiVersion`; select that column first |

**`new EbayAdapter()` sites that correctly STAY (non-listing — no change):** `listings.ts:103` (factory body) · `seller-profile.ts:203` (policy creation) · `items.ts:371` (`getTrafficReport`) · `items.ts:277/314/321/322/390` (Browse/Taxonomy statics) · `orders.ts:150` (order sync).

Several bulk handlers don't currently `select` `ebayApiVersion` (e.g. bulk-delete `:645`, bulk-archive `:700`) — the column must be added to those selects or the routing arg can never be populated (Major M5).

### Trading API call mapping

| Operation | Trading call | Key request fields (from our model) |
|-----------|--------------|--------------------------------------|
| Create + publish live | `AddFixedPriceItem` | Title, Description, PrimaryCategory.CategoryID, StartPrice, Quantity=1, ListingDuration=GTC, ConditionID (numeric), ConditionDescription, PictureDetails.PictureURL[], ItemSpecifics.NameValueList[] (aspects), SKU (`items.ebaySku`), **inline** ShippingDetails / PaymentMethods / ReturnPolicy (Decision 6 — no SellerProfiles). Response `<ItemID>` → `marketplaceListingId`. |
| Create draft | *(none)* | DB-only row, no eBay call. |
| Update — price/qty only | `ReviseInventoryStatus` | ItemID, StartPrice and/or Quantity. |
| Update — other fields | `ReviseFixedPriceItem` | ItemID + changed fields (photos must be resent in full). |
| End / archive | `EndFixedPriceItem` | ItemID, EndingReason=`NotAvailable`. |
| Status / verification | `GetItem` | Response SellingStatus.ListingStatus (`Active`→active, `Completed`→sold, `Ended`→ended), QuantitySold, StartPrice, ItemSpecifics, SKU. |

Edit-sync dispatch in the adapter: if only price (and/or qty) changed → `ReviseInventoryStatus`; otherwise → `ReviseFixedPriceItem`. The recently shipped `mergeItemShipping` / `mergeItemAspects` merge logic in `listings.ts` is preserved — item columns remain source of truth, merged into every revise call.

### Data model

New column on `listings`. Use a **Drizzle `pgEnum`** (matching the existing `listingStatusEnum`/`marketplaceEnum` pattern), not a bare `varchar` — a bare `varchar(10)` admits typos like `'traiding'` (Minor M2):

```ts
export const ebayApiVersionEnum = pgEnum('ebay_api_version', ['trading', 'inventory']);
// listings.ebayApiVersion: ebayApiVersionEnum  (nullable)
//   'trading'   = created by this refactor (marketplaceListingId is a Trading ItemID)
//   'inventory' = pre-existing legacy row (has ebayOfferId; untouched by this work)
//   null        = pure DB draft (no eBay object yet)
```

**Backfill + deploy ordering is a gate, not a detail (Blocker B1 — the null-routing window).** Both reviewers flagged this. Between the `db:push` that adds the column and the `UPDATE` that backfills it, every existing live row has `ebay_api_version = null`. If the version-aware routing ships in that window with a naive `null → Trading` rule, any user who edits/archives an existing live listing routes to the Trading adapter and calls `EndFixedPriceItem`/Revise with an offerId — corrupting or failing on a live production listing. **Resolution (two belts):** (a) the `null` routing rule also checks `ebayOfferId IS NULL` (see Routing) so an un-backfilled legacy row still routes to `EbayAdapter`; AND (b) the backfill `UPDATE listings SET ebay_api_version='inventory' WHERE ebayOfferId IS NOT NULL` runs and is verified **before** the routing code is deployed. This ordering is an explicit Phase-1 sub-gate.

Existing columns:
- `items.ebaySku` (PRT-000123): **kept.** Sent as `<SKU>` in AddFixedPriceItem/ReviseFixedPriceItem for our own reconciliation; returned by GetItem. Mint-once logic and sequence unchanged. No longer load-bearing as an idempotency key.
- `listings.ebaySku`: legacy; null for Trading rows.
- `listings.ebayOfferId`: legacy; null for Trading rows.
- `listings.marketplaceListingId`: for Trading rows, holds the ItemID directly.

Multi-listing-per-item and orphan realities: sync paths already iterate `where(eq(listings.itemId, itemId))` with no `limit(1)` — unchanged. New drafts create no eBay-side orphans.

### Draft / publish semantics (incl. Phase G fix)

`publishMode` collapses from three tiers to two:

| Mode | Behavior |
|------|----------|
| `draft` (and legacy `ebay_draft`) | DB row, `marketplaceListingId = null`, `ebay_api_version = null`, no eBay call. |
| `live` | DB row + `AddFixedPriceItem`; `marketplaceListingId = ItemID`, `ebay_api_version = 'trading'`. |

**Phase G fix:** "Save & List" must route to `live` and produce a real Trading ItemID, not a draft. The route layer (`listings.ts` / `prepare-listing.ts` / drafts flow) is corrected so the Save & List action calls the live publish path.

**Route-level `ebay_draft` guard (Minor N1).** Currently `listings.ts:239-241` sets `shouldPublish = true` for `publishMode==='ebay_draft'` and passes `adapterPublishMode='draft'`. Under DB-only-draft semantics, `ebay_draft` must set `shouldPublish = false` at the route so the adapter is **not** called at all. Without this, an `ebay_draft` request reaches `EbayTradingAdapter.createListing()`, which (having no draft concept) would publish a live listing. The Zod schema still accepts `'ebay_draft'` for backwards compatibility; the route maps it to draft behavior. `createListing()` must also internally guard publishMode as a backstop.

**Condition vocabulary (Minor N2).** Trading `AddFixedPriceItem` takes a numeric `<ConditionID>` (e.g. `5000`) directly — the same value the Taxonomy/Metadata API already returns. The Trading adapter must use the **raw numeric conditionId** from `getValidConditions()`/`resolveEbayCategoryCondition()`, NOT the `EBAY_CONDITION_ID_TO_ENUM` string-enum bridge the Inventory path uses. The bridge is not reused on the Trading path.

**Policy-defaults trap (Minor N3).** `listings.ts:258 applySellerPolicyDefaults()` injects `fulfillmentPolicyId`/`paymentPolicyId`/`returnPolicyId` into `marketplaceSpecific` for all eBay listings. For Trading-path listings these must NOT be required: the Trading adapter must not port `validateEbayListingFields()` (which hard-requires all four policy IDs) — doing so would re-introduce the exact Business-Policy onboarding blocker Decision 6 removes. Either skip `applySellerPolicyDefaults()` for the Trading path, or have the Trading adapter ignore policy IDs when building inline terms.

### Shared interface

`MarketplaceListingInput` / `MarketplaceListingResult` in `packages/shared/src/marketplace.ts` carry `ebaySku` / `ebayOfferId` as optional fields (eBay leakage). They stay for now; the Trading adapter ignores `ebayOfferId`. A later cleanup can move them under `marketplaceSpecific`. Not a blocker — the interface holds as-is (but note C1 above: `getOrders`/`searchCategories` must be implemented on the Trading adapter via delegation).

### Idempotency & error handling

**Idempotency regression (Blocker B3).** The Inventory path is idempotent: `PUT inventory_item/{sku}` is keyed on SKU, and the error-25002 recovery block reuses an existing offer on retry. `AddFixedPriceItem` is **not** idempotent and there is no cheap "get item by SKU" on the Trading API. A timed-out-but-successful call that the client retries → **two live listings**; a successful call whose DB insert then throws → an **orphaned live listing with no Portage row**. Removing the SKU idempotency key without a replacement is a regression. **Resolution:** before calling `AddFixedPriceItem`, the publish path does an app-level dedup check — query `listings` for a recently-created row for the same `itemId`/`items.ebaySku` in a short window; if one exists with a `marketplaceListingId`, treat as already-published. Persist the `marketplaceListingId` in the **same transaction boundary** as (immediately after) the successful eBay response, and on DB-insert failure log the orphaned ItemID loudly for manual reconciliation. The `<SKU>` we send (`items.ebaySku`) is the reconciliation handle.

**PartialFailure / Warning Acks (Major M7).** `callTradingApi` already distinguishes `Failure` / `PartialFailure` / `Warning` Acks. For `AddFixedPriceItem`, a `Warning` or `PartialFailure` Ack still means **the listing was created and an ItemID was returned**. The adapter MUST extract and persist the ItemID on Warning/PartialFailure — it must **not** pass `throwOnPartialFailure: true` for create/revise calls, or it would throw before persisting and orphan the live listing. Rule: only a hard `Failure` Ack (no ItemID) is a create failure.

### OAuth scope (Blocker B4 — verify before Phase 3)

Trading API listing **writes** may require an OAuth scope not in the current grant. The existing grant (`ebay-auth.ts`) covers `sell.inventory`, `sell.marketing`, `sell.account`, `sell.fulfillment`, `sell.analytics.readonly`, `commerce.identity.readonly`. Buyer-messaging Trading calls work under it, but those are message scopes, not listing-write scopes. If `AddFixedPriceItem` / `ReviseInventoryStatus` need a different scope, **every already-connected seller must reconnect** — the same forced-reconnect event as the recent `sell.analytics.readonly` addition. This must be confirmed (and, if needed, the reconnect handled) before Phase 3, not discovered during the live test.

### Inline shipping — viability gate + fallback (I1 / M6 / N5)

Decision 6 (inline terms, no Business Policies) is load-bearing and currently **unverified**. The data audit:
- **Have:** `items.weightOz`, `items.lengthIn/widthIn/heightIn`, `items.ebayPackageType` (extracted by `mergeItemShipping`). Enough for a **calculated** shipping block.
- **Missing (no schema source):** flat-rate shipping **service code** + **cost**, **handling time**, **return window/type**.

**Resolution path:** Phase 3 is gated on confirming (live or sandbox) that `AddFixedPriceItem` accepts an inline `<ShippingDetails>` with a **CalculatedShippingRate** block (package weight + dims, no explicit flat cost) plus `<ReturnPolicy>` for a managed-payments US account **without** `<SellerProfiles>`. Two contingencies, both decided now so Phase 3 isn't blocked on discovery:
1. If calculated-inline works → use it; supply sensible defaults for the missing scalars: **handling time = 1 day**, **returns = 30-day, buyer-paid** (or seller default if `seller_profiles` later grows the fields). These defaults become a single source in code, surfaced in settings later.
2. **Fallback if eBay rejects inline for managed-payments accounts:** fall back to `<SellerProfiles>` using the seller's existing Business Policy IDs (which the account already has — `validateEbayListingFields` proves it). This re-introduces the policy requirement for the seller, but keeps the refactor shippable; the "no Business Policies needed" benefit is then deferred, not blocking. This contingency must be a documented decision the implementer can take without re-escalating.

### Bulk operations (M2 / I2)

`bulkPublishOffers()` (`/sell/inventory/v1/bulk_publish_offer`) is Inventory-API-specific; the Trading API has no batch publish. For the Trading path, bulk publish/activate **degrades to N sequential `AddFixedPriceItem` calls** (or is disabled for Trading drafts with an actionable error — see M2 in the call-site audit). The implementation plan must pick one explicitly; silent reuse of `bulkPublishOffers` for Trading rows is forbidden.

---

## Phasing (behind existing `E2E_EBAY_LIVE` gate)

**Phase 1 — Foundation (no live eBay calls).**
- Add `ebayApiVersion` `pgEnum` column (`db:push`). **Sub-gate (B1):** run + verify the backfill `UPDATE … WHERE ebayOfferId IS NOT NULL` **before** any routing code deploys.
- Create `ebay-trading-adapter.ts` with stubbed `MarketplaceAdapter` methods — including `getOrders`/`searchCategories` delegating to shared helpers (C1), so it compiles.
- Extend `getAdapter()` with the `apiVersion` arg + the `null + ebayOfferId` secondary-discriminant rule. **Execute the full call-site audit** (9 `getAdapter` sites + 4 hardcoded `new EbayAdapter` listing sites + add `ebayApiVersion` to the bulk selects). This is the bulk of Phase 1 and the highest-value correctness work.
- Unit-test the Trading XML builders (AddFixedPriceItem / ReviseFixedPriceItem / ReviseInventoryStatus / EndFixedPriceItem bodies, GetItem parse) via a `callTradingApi` mock — same pattern as `ebay-trading-client.test.ts`. Include a builder test asserting numeric `<ConditionID>` (N2) and inline `<ShippingDetails>`/`<ReturnPolicy>` presence with no `<SellerProfiles>`.
- Risk: none (no eBay calls). **Verify OAuth scope (B4) in parallel** — a read probe / scope inspection — so Phase 3 isn't blocked.

**Phase 2 — Read path (`GetItem`).**
Implement `getListingStatus()` via GetItem; **fix the F-GATE route (`listings.ts:208`, Blocker B2)** to route by version — Trading rows use `GetItem(marketplaceListingId)`, not Inventory `getEbayItemVerification(ebaySku)`. Verify read-only against a real listing id. Risk: low (read-only).

**Phase 3 — Create (`AddFixedPriceItem`) + Phase G.**
- **Entry gate:** the inline-shipping viability gate (I1/M6) and OAuth-scope confirmation (B4) must be resolved first.
- Implement `createListing()` with: idempotency dedup pre-check (B3), Warning/PartialFailure → still persist ItemID (M7), numeric ConditionID (N2), inline terms (Decision 6 + fallback), no `validateEbayListingFields` policy gate (N3). Set `ebay_api_version='trading'`.
- Collapse `ebay_draft` → DB-only at the route (N1). Fix Save & List to publish live (Phase G).
- **Sandbox smoke test first** (`EBAY_SANDBOX` path exists) for AddFixedPriceItem → EndFixedPriceItem, then ONE real live listing behind `E2E_EBAY_LIVE`. Verify ItemID (starts `3`), visibility, `getListingStatus='active'`, `items.ebaySku` round-trips into `<SKU>`, and a retry does NOT create a duplicate (B3).
- Risk: medium (first real write — one listing, gated).

**Phase 4 — Update + End + bulk.**
Implement `updateListing()` with an explicit dispatch predicate — *price/qty only* (`!title && !description && !photos && !brand && (price||quantity)`) → `ReviseInventoryStatus`; else `ReviseFixedPriceItem` (I3). Implement `deleteListing()` → `EndFixedPriceItem(NotAvailable)`. **Resolve bulk publish/activate for Trading rows (M2/I2)** — sequential AddFixedPriceItem or actionable block. Live-verify: price edit → ReviseInventoryStatus; title edit → ReviseFixedPriceItem; archive → ended on eBay; bulk path behaves. Risk: medium (Trading rows only).

**Phase 5 — (deferred, not part of this ship) Inventory sunset.**
Only when `COUNT(active inventory rows) = 0` — by the hands-off decision this happens naturally as old listings sell/end. Remove legacy Inventory listing methods + the routing branch + shared-interface eBay leakage. Not scheduled here.

---

## Verify-before-implementation (eBay facts to confirm against Trading API schema v1207, not assume)

1. Inline `<ShippingDetails>` (CalculatedShippingRate) / `<ReturnPolicy>` accepted by `AddFixedPriceItem` for a managed-payments US account **without** `<SellerProfiles>` (no policy reference forced); confirm whether `<PaymentMethods>` must be present-but-empty vs absent for managed payments.
2. **OAuth scope** for Trading listing **writes** (`AddFixedPriceItem`/`ReviseInventoryStatus`/`EndFixedPriceItem`) — is it in the current grant, or is a reconnect required? (Blocker B4.)
3. `AddFixedPriceItem` idempotency / duplicate behavior on retry, and whether a `Warning`/`PartialFailure` Ack still returns an ItemID (B3/M7).
4. `GetItem` `SellingStatus.ListingStatus` values for active vs sold vs ended on a real listing.
5. `<SKU>` element accepted in `AddFixedPriceItem` for the used-goods categories Portage targets (some categories historically blocked custom SKUs) — confirm in the Phase 3 live test.
6. `ListingDuration=GTC` accepted for the target categories (some categories disallow GTC).
7. Cloudflare **R2 image URLs** accepted by the Trading API `<PictureDetails>` validator (its picture-ingestion path differs from the Inventory API's, which already accepts them).

---

## Pre-Implementation Gates (must clear before this spec becomes a plan)

Both the architect and adversarial reviews agree these are the must-resolve items. The plan cannot start until G1–G4 are decided; G5–G6 are decided here and carried into the relevant phase.

| Gate | Source | What must happen |
|------|--------|------------------|
| **G1 — Compile + interface** | Architect C1 | `EbayTradingAdapter` implements `getOrders`/`searchCategories` via shared-helper delegation. Confirmed: both are on `MarketplaceAdapter` (`marketplace.ts:68-69`). |
| **G2 — Call-site audit + null-routing window** | Architect C2, Eval B1/M1–M5 | Every listing call site (9 `getAdapter` + 4 hardcoded) becomes version-aware; bulk selects include `ebayApiVersion`; `null+ebayOfferId` secondary discriminant; backfill verified before routing deploy. |
| **G3 — Inline shipping viability + fallback** | Architect I1, Eval M6 | Confirm calculated-inline works without `<SellerProfiles>`; if not, the documented `<SellerProfiles>` fallback applies. Defaults (1-day handling, 30-day returns) fixed. |
| **G4 — OAuth write scope** | Eval B4 | Confirm Trading write scope present, or plan the forced reconnect, before Phase 3. |
| **G5 — Idempotency + PartialFailure** | Eval B3/M7 | App-level dedup pre-check; persist ItemID on Warning/PartialFailure; never `throwOnPartialFailure` on create/revise. (Decided here; built in Phase 3.) |
| **G6 — F-GATE + bulk + ebay_draft** | Eval B2/M2/N1 | F-GATE routes by version (Phase 2); bulk publish/activate resolved for Trading (Phase 4); `ebay_draft` guarded at the route (Phase 3). (Decided here.) |

---

## Out of scope / newly deferred

- Touching, migrating, ending, or re-listing any pre-existing live eBay listing.
- Etsy / Reverb adapters.
- Removing the Inventory API code path (Phase 5, deferred).
- Moving `ebaySku`/`ebayOfferId` out of the shared interface (cosmetic, later).
- **GTC auto-renewal handling** (Minor M4) — live GTC listings renew (and incur fees) every ~30 days; no seller notification / renewal-event detection is built here. Logged as a deferred item.
- **Seller-configurable inline shipping/return fields** — handling time, return window, shipping service/cost as real settings (vs. the fixed defaults in G3). Deferred to a follow-on.
