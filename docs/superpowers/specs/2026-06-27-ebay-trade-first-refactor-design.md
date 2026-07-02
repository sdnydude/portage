# eBay Trade-First Refactor — Design

**Date:** 2026-06-27 · **Revised 2026-06-28 for Option B** (in-place `EbayAdapter` rewrite after full DB wipe)
**Status:** Scope approved; architect + adversarial review folded in; **revised to Option B** — see "Pre-Implementation Gates" before this becomes a plan
**Owner:** Stephen Webber (product architect)
**Affected:** `apps/api/src/marketplace/ebay-adapter.ts`, `apps/api/src/marketplace/ebay-trading-client.ts`, `apps/api/src/routes/listings.ts`, `apps/api/src/routes/items.ts`, `apps/api/src/routes/prepare-listing.ts`, `apps/api/src/routes/seller-profile.ts`, `apps/api/src/db/schema.ts`, `packages/shared/src/marketplace.ts`, `apps/web/src/app/settings/seller-profile/page.tsx`

> **Revision note (2026-06-28).** The original design proposed **Option A** — a second `EbayTradingAdapter` alongside `EbayAdapter`, routed by a new `listings.ebay_api_version` column. The user then **ended all live eBay listings and wiped the DB** (TRUNCATE `items`/`listings`/`orders`/`listing_drafts`/`disclaimer_acceptances`, exported to `exports/*.csv` first; `conversations`/`ebay_messages` preserved). With **zero legacy Inventory rows to preserve**, the dual-adapter rationale collapses. This revision adopts **Option B: rewrite `EbayAdapter`'s listing methods in place to call the Trading API.** That deletes — as no-longer-needed — the version column, the `getAdapter()` version routing, the inter-adapter routing audit, and the null-routing-window blocker (B1). **Terms (final, after two flips):** the design briefly moved to Business-Policy `<SellerProfiles>` defaults, then **re-reverted to inline terms / no Business Policies (original Decision 6)** on 2026-06-28 after eBay-doc research confirmed the Business-Policy requirement is attached to the **account opt-in state, not the API** — so inline publishing is achievable by opting the account OUT, which also **removes the Stage-3 nav-trap**. See Decision 5.

> **Adversarial review folded in (2026-06-28).** Architect + evaluator reviews of this Option-B revision verified the strategic call as sound but found the "no call-site audit needed" claim **false** and the idempotency story **architecturally broken**. Resolutions are folded into the sections below; the verified findings:
>
> | # | Sev | Finding | Resolution (in this spec) |
> |---|-----|---------|---------------------------|
> | R1 | BLOCKER | Three **concrete** (non-interface) `EbayAdapter` calls compile-break when their methods are deleted: `withdrawOffer` (`listings.ts:374`), `bulkPublishOffers` (`:782`), `getEbayItemVerification` (`:209`). Plus ~8 DB-column reads of `listings.ebayOfferId` (`:374,404,407,434,563,612,657,759`) TS won't surface. | New **"Phase-1 call-site fixes"** subsection enumerates all of them; they move into Phase 1 scope. |
> | R2 | BLOCKER | **Bulk-activate silently marks a Trading DB-draft `active`** via plain `db.update` with no `AddFixedPriceItem` (`listings.ts:758-807`) — active from Phase 1, not Phase 4. | Guard moved to **Phase 1** (block with actionable error or sequential publish). |
> | R3 | BLOCKER | "**Same transaction boundary**" for the eBay call + DB insert is impossible (network call can't live in a DB tx); `createListing()` HTTP at `listings.ts:269`, insert at `:297` — crash between = silent orphan the dedup pre-check can't find. No uniqueness invariant on `listings` → concurrent double-submit double-lists (real fees). | Idempotency section rewritten: **insert-row-first (null ItemID) → call eBay → UPDATE**, a **unique idempotency key**, and a **`GetSellerList`-by-`<SKU>` reconciliation sweep**. |
> | R4 | VOID | The "editable scalars vs `<SellerProfiles>`" contradiction is moot — the build now uses **inline terms, no Business Policies, no policy-selection UI** (Decisions 5 & 8, user-directed 2026-06-28). Nothing to edit or select. |
> | R5 | MAJOR | **GTC no-auto-renew** is not achievable at creation where eBay forces GTC; renewal is server-side + fee-incurring. | Decision 6 + a new **renewal-reconciliation** note: prevention where allowed, detection/auto-end where forced. |
> | R6 | MAJOR | **Best Offer silently dropped** (`seller_profiles.bestOfferAutoAcceptEnabled` exists; current adapter has retry-without-BO logic; Trading supports `<BestOfferDetails>`). | New Best-Offer decision (preserve via `<BestOfferDetails>`). |
> | R7 | MINOR | **R2 image URLs** may be rejected by Trading `<PictureDetails>` (EPS/approved-CDN historically required) → would need an EPS upload step. | Promoted from verify-item to **Gate G3** (block Phase 3). |
> | R8 | MINOR | **OAuth B4 overstated:** `sell.inventory` IS in the grant (`ebay-auth.ts:100`) and covers Trading listing writes; effectively one seller pre-launch. | Down-ranked to a quick Phase-1 confirmation. |
> | R9 | MINOR | Deleting exported condition fns (`resolveEbayCondition`/`selectValidEbayCondition`/`resolveEbayCategoryCondition`) may break importers in `items.ts`/`prepare-listing.ts`. | Phase-1 grep-before-delete gate. |

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

## Approved Decisions (Option B)

1. **Option B — in-place rewrite.** `EbayAdapter`'s listing-lifecycle methods (`createListing`, `updateListing`, `deleteListing`, `getListingStatus`) are rewritten to call the **Trading API** via `callTradingApi`. There is **no** second adapter, **no** `ebay_api_version` column, and **no** version routing — `getAdapter()` keeps returning `EbayAdapter`, so the four *interface* methods route unchanged. The Inventory-API helpers no longer reachable from the listing path (`createInventoryItem`, `createOffer`, `publishOffer`, `withdrawOffer`, the 25002 offer-reuse block, the condition-enum bridge, `bulkPublishOffers`) are **removed in the same change**, not left dormant. **A bounded call-site audit IS still required** (R1) — `withdrawOffer`/`bulkPublishOffers`/`getEbayItemVerification` are called as *concrete* `EbayAdapter` methods (not via the interface) in `listings.ts` and compile-break when deleted; see "Phase-1 call-site fixes" below. This is far smaller than Option A's 13-site version-routing audit, but it is not zero.

2. **DB wiped — zero legacy rows.** Because the user ended all live listings and TRUNCATE'd the listing tables (CSV-exported first), there are no Inventory-era rows to migrate, route around, or back-fill. This is what makes Option B safe: there is no production listing the rewritten methods could corrupt. The original Blocker **B1 (null-routing window)** is therefore **void** — there is no migration window.

3. **DB-only drafts.** The Trading API has no server-side draft. `draft` and legacy `ebay_draft` both mean: a row in Portage's DB with `marketplaceListingId = null` and **no eBay API call** until live publish. This eliminates the orphan-offer problem entirely.

4. **Phase G folded in.** The open item "Save & List publishes a draft, not a live listing" is the same publish path this refactor rewrites — it is fixed here, so the publish path is touched once.

5. **Inline standard terms — NO Business Policies (re-reverted to Decision 6; user-directed 2026-06-28; eBay-doc-verified).** New Trading-API listings supply **inline** item-level terms and send **no `<SellerProfiles>`**. Verified against eBay docs: the Business-Policy requirement is attached to the **account opt-in state, not the API** — Trading `AddFixedPriceItem` accepts inline terms *unless* the account is opted into Business Policies (`SellerProfileOptedIn`), which then forces `<SellerProfiles>` and rejects inline. Managed payments does **not** force policies (payment is automatic). So this build uses fixed standard terms:
   - **Returns:** inline `<ReturnPolicy>` `ReturnsAcceptedOption=ReturnsNotAccepted`
   - **Payment:** automatic (managed payments) — no `<PaymentMethods>`, no payment policy
   - **Shipping:** inline `<ShippingDetails>` `ShippingType=Calculated`, buyer-paid, USPS service, with `CalculatedShippingRate` (package weight/dims from `items`, `OriginatingPostalCode`)
   - **Handling:** `DispatchTimeMax=1` (1-day)

   **Prerequisite (one-time, user action):** the prod seller account must be **opted OUT** of Business Policies or inline is rejected. The account currently has 3 policies (`274222…`) so it is likely opted IN. Build step: check `SellerProfileOptedIn` via `GetUserPreferences` (`ShowSellerProfilePreferences`); if true, opt out (reversible; deletes the 3 policy objects — acceptable, they're unwanted). This is what **removes the Stage-3 `EBAY_SETUP_REQUIRED` nav-trap entirely** — no Business-Policy setup is ever needed. ~~(superseded — was: send the seller's Business Policy IDs in `<SellerProfiles>` as editable defaults via a Seller-Profile Settings UI)~~
6. **GTC → no silent auto-renewal (R5 — prevention where possible, detection where forced).** Goal: listings must not silently auto-renew and auto-incur insertion fees every ~30 days. ⚠️ Reviewers verified this is **only partly preventable at creation:** eBay forces `ListingDuration=GTC` on many fixed-price categories, and for those there is **no creation-time flag that disables server-side renewal** — the only stop is `EndFixedPriceItem`. So the design is two-pronged: (a) where the category allows a bounded `ListingDuration`, use it; (b) where GTC is forced, build a **renewal-reconciliation job** that detects approaching/just-renewed GTC listings (via `GetSellerList`/`GetItem` `ListingDetails.StartTime`/relist signals) and auto-ends or notifies per the seller's setting — recurring fee exposure is otherwise silent. "Verify per category" is therefore a real Gate (G7), not a checklist line, and the reconciliation job is in scope, not deferred.

7. **Shared interface trim.** `ebayOfferId` is **removed** from `MarketplaceListingInput` / `MarketplaceListingResult` in `packages/shared/src/marketplace.ts` — it is genuinely dead once the Inventory offer model is gone. `ebaySku` is **kept**: it is sent as `<SKU>` on every `AddFixedPriceItem`/`ReviseFixedPriceItem` and returned by `GetItem`, so it remains the live reconciliation handle (not leakage). `listings.ebayOfferId` / `listings.ebaySku` columns may stay in the schema (cheap, nullable) but are unused on the Trading path; dropping `listings.ebayOfferId` is optional cleanup.

8. **No policy-selection UI — standard fixed terms (supersedes A3; follows from Decision 5 inline).** Because listings carry **inline** terms and send no `<SellerProfiles>`, there is **nothing to select** — no Business-Policy selector UI is built, and the `seller_profiles` policy-ID columns are unused on the publish path. The existing `GET /seller-profile/ebay-policies` + dropdowns (`seller-profile.ts:146-168`, `page.tsx:241-275`) become dead for publishing; leave them or hide them (cosmetic, not load-bearing). The standard terms are **fixed code defaults** (no returns, 1-day handling, buyer-paid Calculated USPS — Decision 5), not seller-configurable in this build. Both prior R4 resolutions are void: A2 write-back (never chosen) and A3 selection (no policies to select). In-app term configurability is a possible future follow-on only.

10. **No `ebay-api` SDK — keep the hand-rolled transport (user-decided 2026-06-28; architect + evaluator both verified, evaluator could not break it).** The refactor adds **5–6 Trading XML builders** (`AddFixedPriceItem`/`ReviseFixedPriceItem`/`ReviseInventoryStatus`/`EndFixedPriceItem`/`GetItem` build + parse, optional `GetSellerList`) onto the proven 67-line `callTradingApi` (`ebay-trading-client.ts:54-120`) — which is general-purpose (caller supplies callName + raw XML; message parsing is in separate fns) and already handles `Failure`/`PartialFailure`/`Warning` Acks + `throwOnPartialFailure` (the M7 knob). Adopting `ebay-api` (single-maintainer community dep) would replace working code, conflict with the owned `token-manager.ts` (208-line AES-GCM refresh), create a **dual Trading-path** (messaging already uses `callTradingApi`), and add supply-chain risk in the listing+auth path — for no gain: eBay's digital-signature mandate does **not** apply to Trading listing calls (US managed-payments), and `escapeXml` already exists. **Caveat:** `AddFixedPriceItem` has the gnarly nested surface (`ItemSpecifics.NameValueList[]`, `PictureDetails.PictureURL[]`, inline `ShippingDetails`/`CalculatedShippingRate`, `ReturnPolicy`, `BestOfferDetails`, `ConditionID`) — write **unit tests asserting nested-array shape + inline terms present + no `<SellerProfiles>`** before any live call (Gate G8).

9. **Best Offer preserved (R6).** The current Inventory adapter has Best-Offer terms + retry-without-Best-Offer logic, and `seller_profiles.bestOfferAutoAcceptEnabled` exists. The Trading rewrite must **not** silently drop this: `AddFixedPriceItem` carries `<BestOfferDetails><BestOfferEnabled>` (+ auto-accept/auto-decline thresholds), mapped from `bestOfferAutoAcceptEnabled` and the listing's Best-Offer settings. Carried into the `AddFixedPriceItem` XML template (Phase 3).

---

## Architecture

### No routing layer

`getAdapter(userId, marketplace)` is **unchanged** — it still switches on marketplace and returns `EbayAdapter` for eBay. The Trading migration is entirely *inside* `EbayAdapter`'s methods. Consequences:

- **C1 (interface) is satisfied for free.** `getOrders` and `searchCategories` (on `MarketplaceAdapter`, `marketplace.ts:68-69`) stay exactly where they are in `EbayAdapter` — there is no second adapter that would need to re-implement them. Order sync (Fulfillment REST) and category suggestions (Taxonomy) are untouched.
- Every call site that does `getAdapter(...).createListing/updateListing/deleteListing/getListingStatus` automatically gets the Trading behavior. **But** the non-interface concrete calls below DO need fixing.

#### Phase-1 call-site fixes (R1 — verified, not optional)

These break at compile or run silently wrong the moment the Inventory methods are removed. All are in scope for **Phase 1**:

| Site | Problem | Fix |
|------|---------|-----|
| `listings.ts:374` | `new EbayAdapter(userId).withdrawOffer(existing.ebayOfferId)` — concrete call to a deleted method; branch is dead for Trading rows (offerId always null) | Remove the `ebayOfferId` archive branch; let the `else` `deleteListing(marketplaceListingId!)` (→ `EndFixedPriceItem`) handle active listings. |
| `listings.ts:782` | `adapter.bulkPublishOffers(batch)` where `adapter = new EbayAdapter(userId)` (`:775`) — concrete call to a deleted method | Resolve bulk strategy (sequential `AddFixedPriceItem` or actionable block) and rewrite `:774-797` in the same change. |
| `listings.ts:209` | `adapter.getEbayItemVerification(listing.ebaySku!)` — concrete Inventory-by-SKU read; `ebaySku` null on Trading rows → `!` throws; endpoints 404 post-migration | Remove the `!`; null-guard now; rewrite to `GetItem(marketplaceListingId)` in Phase 2 (B2). |
| `listings.ts:758-807` (R2) | Bulk-activate `activatable` filter `(draft\|archived) && !marketplaceListingId` matches Trading DB-drafts → `db.update(status='active')` with **no eBay call** → Portage shows `active`, nothing on eBay | Add explicit Trading-draft guard in Phase 1 (block w/ `TRADING_DRAFT_REQUIRES_PUBLISH` or call sequential publish). |
| `listings.ts:374,404,407,434,563,612,657,759` | ~8 reads of the `listings.ebayOfferId` **DB column** (not the interface field) — TS will NOT flag these; they gate archive/delete/bulk branches and become silently dead for Trading rows | Manual audit each; collapse the offer-vs-listing branching to the Trading (ItemID) model. |
| interface-field readers (`ebay-adapter.ts:609,619,662`; `listings.ts:291,434,563,572`; `types.ts:106`) | read/set `input.ebayOfferId` / `result.ebayOfferId` — **compile errors** when Decision 7 removes the field | Fix each; verified count is 6 interface sites + `types.ts:106`, not "a few." |

### Trading API call mapping

| Operation | Trading call | Key request fields (from our model) |
|-----------|--------------|--------------------------------------|
| Create + publish live | `AddFixedPriceItem` | Title, Description, PrimaryCategory.CategoryID, StartPrice, Quantity=1, ListingDuration (GTC or category-allowed fixed; no silent auto-renew — Decision 6), ConditionID (**numeric**), ConditionDescription, PictureDetails.PictureURL[], ItemSpecifics.NameValueList[] (aspects), SKU (`items.ebaySku`), Country=US, Currency=USD, Location/PostalCode, DispatchTimeMax=1, **inline `<ReturnPolicy>` (ReturnsNotAccepted) + inline `<ShippingDetails>` (Calculated, buyer-paid USPS, CalculatedShippingRate w/ weight/dims + OriginatingPostalCode)**; **no `<SellerProfiles>`, no `<PaymentMethods>`** (managed payments — Decision 5). Response `<ItemID>` → `marketplaceListingId`. |
| Create draft | *(none)* | DB-only row, no eBay call. |
| Update — price/qty only | `ReviseInventoryStatus` | ItemID, StartPrice and/or Quantity. |
| Update — other fields | `ReviseFixedPriceItem` | ItemID + changed fields (photos resent in full). |
| End / archive | `EndFixedPriceItem` | ItemID, EndingReason=`NotAvailable`. |
| Status / verification | `GetItem` | SellingStatus.ListingStatus (`Active`→active, `Completed`→sold, `Ended`→ended), QuantitySold, StartPrice, ItemSpecifics, SKU. |

Edit-sync dispatch inside `updateListing()`: if only price (and/or qty) changed → `ReviseInventoryStatus`; otherwise → `ReviseFixedPriceItem`. The recently shipped `mergeItemShipping` / `mergeItemAspects` merge logic in `listings.ts` is **preserved** — item columns remain source of truth, merged into every revise call.

### Data model

**No new column.** Option B adds nothing to `listings`. For new (Trading) rows:
- `listings.marketplaceListingId` holds the Trading **ItemID** directly (starts `3`).
- `listings.ebayOfferId` — unused (legacy column; nullable; optional drop).
- `listings.ebaySku` — unused on Trading path (the live SKU handle lives on `items.ebaySku`).
- `items.ebaySku` (PRT-000123) — **kept.** Sent as `<SKU>`; returned by `GetItem`. Mint-once logic + sequence unchanged. No longer load-bearing as an idempotency key (see B3).

`schema.ts` change is limited to the **Seller-Profile Settings** fields (Decision 8) if the existing `seller_profiles` table lacks columns for handling time / return window / shipping basis. Audit `seller_profiles` first; add only the missing scalar columns.

Multi-listing-per-item and orphan realities: sync paths already iterate `where(eq(listings.itemId, itemId))` with no `limit(1)` — unchanged. New drafts create no eBay-side orphans.

### Draft / publish semantics (incl. Phase G fix)

`publishMode` collapses from three tiers to two:

| Mode | Behavior |
|------|----------|
| `draft` (and legacy `ebay_draft`) | DB row, `marketplaceListingId = null`, no eBay call. |
| `live` | DB row + `AddFixedPriceItem`; `marketplaceListingId = ItemID`. |

**Phase G fix:** "Save & List" must route to `live` and produce a real Trading ItemID, not a draft. The route layer (`listings.ts` / `prepare-listing.ts` / drafts flow) is corrected so Save & List calls the live publish path.

**Route-level `ebay_draft` guard (N1).** `listings.ts:239-241` currently sets `shouldPublish = true` for `publishMode==='ebay_draft'` and passes `adapterPublishMode='draft'`. Under DB-only-draft semantics, `ebay_draft` must set `shouldPublish = false` at the route so the adapter is **not** called at all. Without this, an `ebay_draft` request reaches `EbayAdapter.createListing()`, which (now having no draft concept on the Trading path) would publish a **live** listing. The Zod schema still accepts `'ebay_draft'` for back-compat; the route maps it to draft behavior. `createListing()` also guards `publishMode` internally as a backstop.

**Condition vocabulary (N2).** `AddFixedPriceItem` takes a numeric `<ConditionID>` (e.g. `5000`) directly — the same value the Taxonomy/Metadata API already returns. The rewritten `createListing` uses the **raw numeric conditionId** from `getValidConditions()`/`resolveEbayCategoryCondition()`, and the `EBAY_CONDITION_ID_TO_ENUM` string-enum bridge is **deleted** (it existed only for the Inventory string-enum).

**Inline-terms wiring + publish-time guard (N3, inline version; evaluator-hardened).** Drop `applySellerPolicyDefaults()` / the `<SellerProfiles>` path entirely. Delete the Inventory-only `validateEbayListingFields()` four-policy hard gate (`ebay-adapter.ts:234-236`, throws `EBAY_SETUP_REQUIRED`) — under inline terms there are no policy IDs to require, which is precisely what removes the Stage-3 trap. **But keep a publish-time guard, just on different fields (evaluator's point still applies):** inline `Calculated` shipping is **rejected by eBay** without `OriginatingPostalCode` + `CalculatedShippingRate` weight/dimensions. So validate at publish that the item has **weight + dims + origin ZIP** (from `items`); if missing, throw an actionable error (route the seller to fill item shipping data) — never send a malformed `<ShippingDetails>`. Also guard that the account is **opted OUT** of Business Policies (or eBay rejects inline) — a one-time setup check (Decision 5 prerequisite), surfaced once, not per-publish.

### Business Policies + Seller-Profile Settings UI (Decisions 5 & 8)

- **Source of truth:** none needed — terms are fixed code defaults (no returns, 1-day handling, buyer-paid Calculated USPS). `seller_profiles` policy-ID columns are unused on the publish path. *(This "Business Policies + Settings UI" subsection is retained only for history; under inline terms it does not apply.)*
- **Settings UI:** `apps/web/src/app/settings/seller-profile/page.tsx` gains fields to view/edit them. `apps/api/src/routes/seller-profile.ts` persists them. `createFulfillmentPolicy`/`createReturnPolicy` input shapes (already present) are reused.
- **At item-for-sale creation:** defaults are applied to the listing draft; user can override per-listing before publish.

### Idempotency & error handling

**Idempotency regression (B3 + R3).** The Inventory path was idempotent (`PUT inventory_item/{sku}` keyed on SKU; error-25002 offer-reuse on retry). `AddFixedPriceItem` is **not** idempotent and there is no cheap "get item by SKU" on the Trading API. A timed-out-but-successful call the client retries → **two live listings**; a successful call whose DB insert then throws (or whose process crashes between the eBay 200 and the insert) → an **orphaned live listing with no Portage row**.

The original "query for a prior row, then persist in the **same transaction boundary**" resolution is **architecturally impossible** and was corrected: `createListing()` is an outbound HTTP call (`listings.ts:269`) and the row insert is ~28 lines later (`:297`), outside any DB transaction — a network call cannot be wrapped in a Drizzle transaction (it would hold a connection lock across an unbounded round-trip). A windowed dedup-by-`itemId` pre-check also (a) can't find a *crash* orphan (no row was ever inserted) and (b) races on concurrent double-submit since `listings` has only **non-unique** indexes (`schema.ts:126-127`), and (c) conflicts with legitimate multi-listing-per-item.

**Corrected resolution:**
1. **Insert the DB row FIRST** with `marketplaceListingId = null` and a generated **idempotency key**; enforce a **partial unique constraint** (or a `SELECT … FOR UPDATE` / advisory lock on the key) so concurrent submits serialize and cannot both reach `AddFixedPriceItem`.
2. Call `AddFixedPriceItem`.
3. On success/Warning/PartialFailure (any ItemID returned — M7), `UPDATE … SET marketplaceListingId = ItemID` for that row. On a hard `Failure`, mark the row failed.
4. **Crash/orphan recovery:** a row always exists (step 1), so a `GetSellerList`/`GetItem`-by-`<SKU>` **reconciliation sweep** can find an eBay listing whose Portage row has a null ItemID and heal it. `items.ebaySku` (sent as `<SKU>`) is the reconciliation handle. This sweep — not a transaction — is the real orphan-detection mechanism.

This ordering and the unique constraint are **hard preconditions for any Phase 3 live call** (Gate G5).

**PartialFailure / Warning Acks (M7).** `callTradingApi` already distinguishes `Failure` / `PartialFailure` / `Warning` Acks. For `AddFixedPriceItem`, a `Warning` or `PartialFailure` Ack **still means the listing was created and an ItemID was returned**. The adapter MUST extract and persist the ItemID on Warning/PartialFailure — it must **not** pass `throwOnPartialFailure: true` for create/revise, or it would throw before persisting and orphan the live listing. Rule: only a hard `Failure` Ack (no ItemID) is a create failure.

### F-GATE verification route (B2)

`listings.ts:208` (`getEbayItemVerification(ebaySku!)`) reads the Inventory item/offer by SKU — meaningless once listings are Trading ItemIDs. Rewrite it to call `GetItem(marketplaceListingId)` and assert live offer state (aspects/MPN, ListingStatus). Because there's a single adapter, this is a straight method swap, not version routing.

### OAuth scope (B4 — verify before Phase 3)

Trading API listing **writes** may require an OAuth scope not in the current grant. The existing grant (`ebay-auth.ts`) covers `sell.inventory`, `sell.marketing`, `sell.account`, `sell.fulfillment`, `sell.analytics.readonly`, `commerce.identity.readonly`. Buyer-messaging Trading calls work under it, but those are message scopes, not listing-write scopes. **Down-ranked (R8):** `sell.inventory` IS already in the grant (`ebay-auth.ts:100`) and is the scope Trading listing writes map to, and `sell.account` (present) covers `GetUserPreferences`/the opt-out check — so the most-likely-needed scope is already held. This is a **quick Phase-1 confirmation**, not a blocker-adjacent risk. If a different scope is somehow required, reconnect is trivial pre-launch (effectively one seller). Still confirm before Phase 3 — just don't treat it as a likely blocker.

### Bulk operations

`bulkPublishOffers()` (`/sell/inventory/v1/bulk_publish_offer`) is Inventory-specific; the Trading API has no batch publish. For bulk publish/activate, **degrade to N sequential `AddFixedPriceItem` calls**, OR disable bulk-activate for Trading drafts with an actionable error. The plan must pick one explicitly; silent reuse of `bulkPublishOffers` is forbidden. **This is a Phase-1 item, not Phase 4 (R2):** the bulk-activate `activatable` branch (`listings.ts:758-807`, filter `(draft|archived) && !marketplaceListingId`) **matches Trading DB-drafts today** and would mark them `active` via plain `db.update` with **no eBay call** the instant DB-only drafts ship — Portage would show `active` for a listing that does not exist on eBay. The guard must land in Phase 1 alongside removing `bulkPublishOffers`.

### Shared interface

`MarketplaceListingInput` / `MarketplaceListingResult` drop `ebayOfferId` (Decision 7); `ebaySku` stays. After removal, TypeScript surfaces the **interface-field** readers (verified: `ebay-adapter.ts:609,619,662`; `listings.ts:291,434,563,572`; `types.ts:106` — 6 sites + types.ts, not "a few"). It will **not** surface the ~8 reads of the `listings.ebayOfferId` **DB column** — those are audited manually per the Phase-1 call-site table (R1).

---

## Phasing (behind existing `E2E_EBAY_LIVE` gate)

**Phase 1 — Foundation (no live eBay calls).**
- `seller_profiles` policy-ID columns are unused on the publish path (inline terms — Decision 5); **no schema change for policies**. No `ebay_api_version` column (Option B). Add the **idempotency-key column + partial unique constraint** on `listings` (R3). One-time: verify/opt-out of Business Policies (`SellerProfileOptedIn`).
- **Grep-before-delete (R9):** confirm no importer of `resolveEbayCondition`/`selectValidEbayCondition`/`resolveEbayCategoryCondition` outside `ebay-adapter.ts` (check `items.ts`, `prepare-listing.ts`, `seller-profile.ts`) before removing the condition-enum bridge.
- Rewrite `EbayAdapter` listing methods to build Trading XML and call `callTradingApi`; remove the dead Inventory listing helpers + condition-enum bridge in the same change.
- **Execute the Phase-1 call-site fixes table (R1/R2):** `withdrawOffer`/`bulkPublishOffers`/`getEbayItemVerification` concrete calls, the ~8 `ebayOfferId` DB-column branches, and the bulk-activate Trading-draft guard — all land here, or the build won't compile and bulk-activate will silently mislabel drafts.
- Drop `ebayOfferId` from the shared interface; fix the resulting type errors (6 interface sites + `types.ts:106`).
- **Unit-test the Trading XML builders** (AddFixedPriceItem / ReviseFixedPriceItem / ReviseInventoryStatus / EndFixedPriceItem bodies; GetItem parse) via a `callTradingApi` mock — same pattern as `ebay-trading-client.test.ts`. Assert numeric `<ConditionID>` (N2), inline `<ReturnPolicy>ReturnsNotAccepted` + inline Calculated `<ShippingDetails>` with `OriginatingPostalCode`/weight, and **no `<SellerProfiles>`/`<PaymentMethods>`** (Decision 5). **Note:** these unit tests are necessary but **not** proof-of-done (per user) — L2 sandbox integration is the proof bar.
- **Verify OAuth scope (B4) in parallel.** Risk: none (no eBay calls).

**Phase 2 — Read path (`GetItem`).**
Implement `getListingStatus()` via GetItem; fix the F-GATE route (`listings.ts:208`, B2) to use `GetItem(marketplaceListingId)`. Verify read-only against a real listing id. Risk: low.

**Phase 3 — Create (`AddFixedPriceItem`) + Phase G.**
- **Entry gate:** inline-terms viability confirmed in sandbox (Decision 5 — `AddFixedPriceItem` with inline `<ShippingDetails>`/`<ReturnPolicy>`, no `<SellerProfiles>`, account not opted in), OAuth scope confirmed (B4), GTC/no-auto-renew per-category resolved (Decision 6).
- Implement `createListing()`: idempotency dedup pre-check (B3); Warning/PartialFailure → still persist ItemID (M7); numeric ConditionID (N2); **inline terms, no `<SellerProfiles>`** (Decision 5); delete `validateEbayListingFields` four-policy gate, add inline-shipping-data guard (N3). Collapse `ebay_draft` → DB-only at the route (N1). Fix Save & List → live (Phase G).
- **L2 sandbox smoke first** (`AddFixedPriceItem → EndFixedPriceItem` against the connected sandbox seller), **then** one real live listing behind `E2E_EBAY_LIVE`. Verify ItemID (starts `3`), visibility, `getListingStatus='active'`, `items.ebaySku` round-trips into `<SKU>`, retry does NOT duplicate (B3). Risk: medium (gated, one listing).

**Phase 4 — Update + End + bulk.**
`updateListing()` with explicit dispatch predicate (price/qty-only → `ReviseInventoryStatus`; else `ReviseFixedPriceItem`); `deleteListing()` → `EndFixedPriceItem(NotAvailable)`; resolve bulk publish/activate (sequential or actionable block). Live-verify: price edit → ReviseInventoryStatus; title edit → ReviseFixedPriceItem; archive → ended; bulk behaves. Risk: medium.

**Phase 5 — (not part of this ship) Inventory sunset.**
Under Option B most Inventory listing code is removed in Phase 1. Any residual Inventory helpers kept for non-listing reasons (none expected) are removed when confirmed unreferenced. Not separately scheduled.

---

## Verify-before-implementation (confirm against Trading API schema v1207 — do not assume)

1. Inline `<ShippingDetails>` (Calculated, USPS, buyer-paid) + inline `<ReturnPolicy>` (ReturnsNotAccepted) accepted by `AddFixedPriceItem` for a managed-payments US account **with no `<SellerProfiles>`** and the account **not opted into Business Policies** (Decision 5) — confirm in sandbox. Also confirm `SellerProfileOptedIn` check via `GetUserPreferences`.
2. **OAuth scope** for Trading listing **writes** — present in current grant, or reconnect required? (B4.)
3. `AddFixedPriceItem` idempotency / duplicate-on-retry behavior, and whether `Warning`/`PartialFailure` still returns an ItemID (B3/M7).
4. `GetItem` `SellingStatus.ListingStatus` values for active vs sold vs ended on a real listing.
5. `<SKU>` accepted in `AddFixedPriceItem` for the used-goods categories Portage targets.
6. `ListingDuration` / GTC + **auto-renewal** behavior per target category (Decision 6) — which categories force GTC, and how to avoid silent fee-incurring renewals.
7. Cloudflare **R2 image URLs** accepted by the Trading API `<PictureDetails>` validator.

---

## Pre-Implementation Gates (must clear before this spec becomes a plan)

Option B voids the Option-A routing gates (G1 compile-via-delegation and G2 call-site-audit / null-routing window are **no longer applicable** — single adapter, no version column, no legacy rows). Remaining gates:

| Gate | Source | What must happen |
|------|--------|------------------|
| **G3 — Inline-terms viability + R2 images** | Decision 5, R7 | Confirm in sandbox that `AddFixedPriceItem` publishes with **inline** `<ShippingDetails>` (Calculated USPS, buyer-paid) + `<ReturnPolicy>` (ReturnsNotAccepted), **no `<SellerProfiles>`**, for a managed-payments US account **not opted into Business Policies** — AND that Cloudflare R2 `<PictureDetails>` URLs are accepted (else an EPS upload step is a new Phase-3 dependency). Prereq: prod account opted OUT of Business Policies (check `SellerProfileOptedIn`). |
| **G4 — OAuth write scope** | Eval B4 / R8 | Quick confirm `sell.inventory` covers Trading writes (very likely already in grant); only plan a reconnect if disproven. Not a likely blocker. |
| **G5 — Idempotency + PartialFailure** | Eval B3/M7 / R3 | **Insert-row-first (null ItemID) → eBay → UPDATE**; partial unique constraint + lock on the idempotency key; `GetSellerList`-by-`<SKU>` reconciliation sweep; persist ItemID on Warning/PartialFailure; never `throwOnPartialFailure` on create/revise. Hard precondition for any Phase-3 live call. |
| **G6 — F-GATE + bulk + ebay_draft** | Eval B2/M2/N1 / R1/R2 | F-GATE null-guarded Phase 1, `GetItem` Phase 2; **bulk publish/activate Trading-draft guard lands Phase 1** (not Phase 4 — R2); `ebay_draft` guarded at the route (Phase 3). |
| **G7 — GTC / auto-renewal** | Decision 6 / R5 | Per-category `ListingDuration` resolved; where GTC is forced, the renewal-reconciliation job (detect + auto-end/notify) is built — prevention-at-creation is not achievable there. |
| **G8 — Test layer** | User | L2 **connected sandbox seller** stood up — mocked-`callTradingApi` unit tests are NOT proof-of-done. L1 unit + L2 sandbox integration + L3 one `E2E_EBAY_LIVE` live smoke. ⚠️ Per project memory `EBAY_SANDBOX=false` and some read calls hardcode prod — standing up a *functioning* sandbox is real scope, not a flag flip. |
| **G9 — Best Offer** | R6 | `<BestOfferDetails>` carried into `AddFixedPriceItem` from `bestOfferAutoAcceptEnabled` — not silently dropped. |

---

## Out of scope / newly deferred

- Etsy / Reverb adapters.
- eBay listing **import** (re-creating the wiped/ended listings) — future ship if wanted; not part of this refactor.
- Dropping the legacy `listings.ebayOfferId`/`ebaySku` columns (cosmetic; the interface field is removed, the columns can linger).
- ~~Stage-3 eBay-setup nav-trap~~ — **now REMOVED by this refactor** (inline terms + account opt-out → no `EBAY_SETUP_REQUIRED`, no Business-Policy setup). No longer a separate ship.
