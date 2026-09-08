# Amazon Marketplace (SP-API) — Design

**Date:** 2026-08-18
**Status:** Approved (brainstorm 2026-08-18; four independent advisor reviews folded in; Stephen approved sections + decisions Q1–Q3, Q-A–Q-C; "Changes first" on final ask was a mistype — resumed as approved 2026-08-18 09:12 ET)
**Goal:** Amazon as the third fully integrated Portage seller marketplace (after eBay and Reverb).
**Companion:** Portage Marketplace Atlas (working architecture diagrams) — https://claude.ai/code/artifact/05aba95b-d73c-4196-9c9f-803d8e90f23a
**Repo state at design:** `main @ 5856876`. File:line references are as of that commit.

## Context

Portage publishes to eBay (Trading API, live-selling) and Reverb (REST, PAT auth, live-selling) through one `MarketplaceAdapter` contract (`packages/shared/src/marketplace.ts`), one publish route (`apps/api/src/routes/listings.ts`), and one background worker (`apps/api/src/lib/sync-worker.ts`: outbox, status sweep, order sync). Amazon is the operator's chosen third marketplace. It differs structurally from both: listings are offers against catalog ASINs keyed by seller SKU, publish is asynchronous, order PII needs a second token type, and the developer program has approval gates that eBay/Reverb never had.

Operator state at design time: **no Amazon Professional seller account, no developer registration, no app** — everything external starts from zero.

## Scope (operator-approved 2026-08-18)

In:
- Connect account (public-app OAuth for users; private-app refresh-token paste for the operator's own account).
- Publish / update / end listings — **ASIN-match only** (offer on an existing catalog item).
- Orders import + shipment confirmation.
- Registry refactor of adapter selection (forced by the third adapter).
- Docs, env, admin health, UI widenings.

Out (operator decisions, recorded — these are scope choices, not deferrals):
- Comps / price hint (Q2: Fees API only, no price hint). Amazon has no sold-comps API.
- Buyer messaging (Messaging API is template-only).
- New-product creation without an ASIN (Q1: cut — no SP-API path to GTIN exemption; Seller Central only).
- FBA, non-US marketplaces (US `ATVPDKIKX0DER`, merchant-fulfilled only).
- Notifications API (SQS/EventBridge destinations only; no AWS in stack) — polling stays.

## Decisions (with rejected alternatives)

| # | Decision | Over | Because |
|---|---|---|---|
| D1 | Integration shape **B**: `apps/api/src/marketplace/registry.ts` (`getAdapter(userId, mkt)`) + shared `PUBLISHABLE_MARKETPLACES` const, shipped first as a zero-Amazon refactor | A: copy Reverb pattern site-by-site; C: Amazon side-module outside the adapter iface | Four duplicate switches (`listings.ts:126`, `order-sync.ts:45`, `sync-worker.ts:149`, `marketplace-sync.ts:63`) + three hardcoded `['ebay','reverb']` lists (`sync-worker.ts:112`, `items.ts:549`, `listings.ts:1369`) + literal unions (`sync-worker.ts:99/117/223`, `marketplace-sync.ts:62`) would silently skip a third adapter. C breaks the shared worker. |
| D2 | Official SDK `@amazon-sp-api-release/amazon-sp-api-sdk-js` behind a hand-typed wrapper `apps/api/src/marketplace/amazon-sp-client.ts` (~6 ops), constructed with **access token only** | raw fetch + hand LWA; community SDKs; SDK used bare | SDK 1.11.0 ships no TS types (repo gates on typecheck) and embeds its own `LwaOAuthClient` cache — bare use would bypass AES-at-rest, reconnect, health. Wrapper also solves mocking (SDK is superagent-based; the repo's `fetch` stub pattern cannot intercept it). |
| D3 | `token-manager` is sole token owner: `getAmazonAccessToken(userId)` (LWA, ~1h, in-memory), `getAmazonRdt(userId, resources[])` (Tokens API, cached per user/hour), `invalid_grant` → `AppError(409,'AMAZON_RECONNECT_REQUIRED')` | letting the SDK refresh | eBay precedent `token-manager.ts:69-71`; Reverb's missing reconnect path is a known gap. |
| D4 | ASIN-match only; `getListingsRestrictions` pre-flight per ASIN+condition before enabling "Use this ASIN" | new-product fallback (`requirements=LISTING`) | Used goods need GTIN or `supplier_declared_has_product_identifier_exemption`; no SP-API op grants the exemption. Restrictions API returns `NOT_ELIGIBLE` / `APPROVAL_REQUIRED` + path-forward links. Operator Q1. |
| D5 | Listing key = seller SKU, minted once, persisted on the listing row; `marketplaceListingId` = SKU | random SKU per attempt; ASIN as key | putListingsItem is keyed sellerId+sku; a fresh SKU per retry creates a duplicate live offer and orphans patch/delete. Mirrors `ensureItemEbaySku` (`listings.ts:600`). |
| D6 | Publish returns `status:'pending'`; the existing outbox/status-sweep resolves by SKU (`getListingsItem?includedData=summaries,issues,fulfillmentAvailability`); `mode=VALIDATION_PREVIEW` dry-run feeds the issues panel pre-publish | in-request polling like Reverb photo-ingest | put returns ACCEPTED and completes minutes–hours later; `submissionId` is not pollable (no getSubmission op). |
| D7 | Amazon `getListingStatus` never returns `sold`; `status[]` includes `BUYABLE` → active; present-not-buyable → unknown + issues; 404 → ended. Sold is owned by order sync (`order-sync.ts:215`) | qty-0 → sold | `fulfillment_availability` 0 also means seller zeroing, suppression, or cancel/restock lag; `sync-worker.ts:153` flips sold on a positive signal and fires celebration + inventory decrement. |
| D8 | Orders via Orders API with RDT; persisted `LastUpdatedAfter` watermark per user; `getOrderItems` before the no-listing-id skip; skip `Pending`/`PendingAvailability`; store `orderItems[{orderItemId, quantity}]` JSONB; `confirmShipment` from `orders/[id]/page.tsx` | fixed 90-day rescan; import Pending; address-less import | `Pending` = unpaid, no address/pricing (default mapping would tell the seller to ship an unpaid $0 order); refill is 1 token/min; `confirmShipment` needs `packageDetail.orderItems[{orderItemId, quantity}]`; `MarketplaceOrderResult.shippingAddress` and `orders.buyerUsername` are required. |
| D9 | Live proof via a **second, private** developer app (paste refresh token); public app OAuth (`version=beta` while draft) built for beta users | self-authorize the public app | Amazon docs: public apps cannot self-authorize; private apps can. Operator Q-A. |
| D10 | Build W1a–W3 now; live Amazon publish allowed before order sync ships, with an in-product notice "Amazon orders not synced yet — check Seller Central" until W4 | gate whole program on PII role; disable publish until W4 | Operator Q-B, named approval of the W4 sequencing. |
| D11 | PoD listing = publish → screenshot → patch → delete within minutes at max handling time | list a real item to ship | Operator Q-C; avoids ODR/late-shipment risk on the live Pro account. |
| D12 | Same Amazon seller may be connected by two Portage users (no new unique index) | partial unique on `(marketplace, marketplaceUserId)` | Operator Q3. |
| D13 | Fees via Product Fees API `getMyFeesEstimateForASIN`; no price hint | flat 15%; Product Pricing `getItemOffers` | Referral fee is 8–45% + $0.30 floor; operator Q2. |
| D14 | Flat prefixed columns for Amazon seller-profile scalars (`amazonMerchantShippingGroup`, `amazonDefaultCondition`) | `amazonDefaults` JSONB | Repo convention: JSONB for structures, columns for scalars (`reverbOffersEnabled` vs `reverbDefaultShipping`). |

## Architecture

### Shared (unchanged by Amazon)
Scan → vision → `items` (+`marketplaceData` JSONB) → `/prepare-listing` → `POST /listings` (insert-first idempotency, atomic JSONB merge on `marketplaceSpecificFields`) → adapter → `listings` → worker (outbox `enqueueItemSync`, status sweep, retention sweep, order sync cycle) → `orders` (`uq_orders_user_marketplace_order`) → sold → celebration + inventory decrement → ship page (labels = redirect to marketplace). Token store `marketplace_accounts` (AES-256-GCM, `uq(user, marketplace)`), `checkMarketplaceLimit`, Prometheus `marketplace` labels, Langfuse tracing.

### Auth + identity
- Routes: `apps/api/src/routes/marketplace/amazon-auth.ts` mounted `/marketplace/amazon` (`app.ts` mount next to eBay/Reverb):
  - `GET /connect` → Seller Central `/apps/authorize/consent?application_id&state&version=beta` (state = CSRF, eBay pattern `ebay-auth.ts:20-27,157-161`).
  - `GET /callback` → `spapi_oauth_code` + `selling_partner_id` → LWA exchange → refresh token.
  - `POST /connect` (paste, private app, admin/operator-gated flag `AMAZON_PRIVATE_APP_PASTE=true`) → refresh token.
  - `GET /status`, `DELETE /disconnect`. `/status` must not derive "expired" from the sentinel `tokenExpiresAt` (Amazon path).
- On connect: `checkMarketplaceLimit`; Sellers API `getMarketplaceParticipations` → `sellerId` → `marketplaceAccounts.marketplaceUserId` (required path param on every Listings call); Professional-plan eligibility → "connected, not eligible" state if absent.
- Storage: `refreshTokenEncrypted` = LWA refresh; `accessTokenEncrypted = encrypt('none')`; `tokenExpiresAt` = far-future sentinel (Reverb precedent `reverb-auth.ts:79-80`).
- Env (`apps/api/src/lib/env.ts`, `.env.example`, Doppler dev+prd): `AMAZON_LWA_CLIENT_ID`, `AMAZON_LWA_CLIENT_SECRET`, `AMAZON_APP_ID`, `AMAZON_SP_API_SANDBOX` (explicit `!== 'false'` transform — `z.coerce.boolean` footgun), `AMAZON_PRIVATE_APP_PASTE`. Boot must not assert Amazon keys (e2e env has none).
- Rate limits are per (application, selling partner) → per-user buckets; honor `Retry-After` / `x-amzn-RateLimit-Limit`.
- Ops: LWA client-secret rotation runbook (Amazon rotates via `rotateApplicationClientSecret` → SQS notice with expiry on old secret); SQS listener is future work needing AWS — runbook is required in W0/W1.

### Data
- `marketplaceEnum` +`'amazon'` (Postgres cannot drop values — add only when rows are written, W1b, never from a scratch branch against the shared DB). `MarketplaceType`, `MARKETPLACE_TYPES`, all `z.enum(['ebay','reverb'])` sites, literal unions in `types.ts` (`:113,131,220,358,397`), `PreparedListingData` slots.
- `MarketplaceData.amazon?: AmazonCacheEntry { asin, productType, conditionType, sku, cachedAt, candidates?, restrictions? }`.
- `listings.marketplaceSpecificFields.amazon { asin, sku, conditionType, conditionNote, merchantShippingGroup, submissionId (log only), issues[] }`.
- `sellerProfiles`: `amazonMerchantShippingGroup varchar`, `amazonDefaultCondition varchar` (D14).
- `orders` has no marketplace JSONB slot today (`schema.ts:148-167`: scalar columns + `shippingAddress` jsonb). Add `orders.marketplaceData jsonb` (nullable; same shape convention as `items.marketplaceData`) holding `{ amazon: { orderItems:[{orderItemId, quantity}], orderStatus } }`. eBay/Reverb rows leave it null.

### Catalog match + publish (adapter `apps/api/src/marketplace/amazon-adapter.ts implements MarketplaceAdapter`)
- Static `searchCatalog(query|upc)`: Catalog Items `searchCatalogItems` — `identifiers`+`identifiersType` (UPC/EAN, ≤20) first; keywords (+`brandNames`) fallback; `includedData=summaries,images,productTypes`; exactly one marketplaceId. Returns candidates `{asin, title, image, brand, productType}`.
- `getListingsRestrictions(asin, sellerId, conditionType)` before "Use this ASIN"; render reason + link; block on `NOT_ELIGIBLE`.
- Condition map 5→13 (`new→new_new`, `like_new→used_like_new`, `good→used_good`, `fair→used_acceptable`, `poor→` typed `AMAZON_CONDITION_UNSUPPORTED`); `item.conditionNotes → condition_note`.
- `createListing` → `putListingsItem(sellerId, sku)` `productType` + `requirements=LISTING_OFFER_ONLY`; attributes each carry `marketplace_id`: `merchant_suggested_asin`, `condition_type`, `condition_note`, `purchasable_offer[{currency, marketplace_id, our_price:[{schedule:[{value_with_tax}]}]}]`, `fulfillment_availability[{fulfillment_channel_code:"DEFAULT", quantity:1}]`, `merchant_shipping_group` (free-text Seller Central template name; empty → hard pre-flight fail), images `main_offer_image_locator` + `other_offer_image_locator_1..5` (`media_location`, cap 6). `mode=VALIDATION_PREVIEW` first; then real put → `status:'pending'`.
- `updateListing` → `patchListingsItem` (array `value`, body `productType`; `merge` only for `fulfillment_availability`/`purchasable_offer`; condition change = delete + recreate; never re-put on an existing SKU). `deleteListing` → `deleteListingsItem`. `getListingStatus` per D7. `getItemDetail` implemented (sellerId + marketplaceId carried on the adapter instance).
- Publish route: `applyAmazonEnrichment` sibling of `applyReverbEnrichment` (cache → profile → typed `AMAZON_ASIN_REQUIRED`); registry `getAdapter`; `PUBLISH_REQUIRED` via shared const; `descriptionLimitFor` unchanged.
- Prepare: `amazon` slot in `PreparedListingData` (ASIN candidates + fee estimate); prepare gate unchanged; `FEE_RATES` replaced for Amazon by Fees API value.
- Web: `AmazonCatalogSection` (candidates with image, "Use this ASIN" / "No match" (Seller Central exemption link) / condition select), per-marketplace state slice in `create-listing-sheet.tsx` (`:83-105` pattern; suppress offers/promote for Amazon), listing card issues panel + `amazon.com/dp/<asin>` link, settings/marketplace connect (paste + OAuth), seller-profile Amazon defaults, all `['ebay','reverb']` UI lists / `formatMarketplace` / badges / `marketplace-urls.ts` / `fee-estimate.ts` / `swipe-flow` cycle / `item-detail` availableMarketplaces / admin health summary / Porter tool enum widened; the stale `'ebay'|'etsy'` union in orders detail fixed in passing where touched.

### Sync + orders
- Registry replaces the four switches, three lists, and literal unions (D1). Status sweep picks Amazon via the const. Sync-log `errors` JSONB carries Amazon `issues` verbatim.
- `getOrders(since)`: RDT for `/orders/v0/orders` (`buyerInfo`, `shippingAddress`); `getOrders(LastUpdatedAfter=<watermark>, MarketplaceIds, FulfillmentChannels=MFN)` → `getOrderItems` per order → map: `Unshipped|PartiallyShipped` → unshipped, `Shipped` → shipped, `Canceled|Unfulfillable` → canceled, skip `Pending|PendingAvailability`; missing address on Pending/Canceled is normal (do not flag). Buyer "username" = `BuyerName` (RDT) with `AmazonOrderId` fallback. Dedupe by `AmazonOrderId` via existing unique index. Orphan backfill via `getItemDetail`.
- Ship: `orders/[id]/page.tsx` Amazon branch → carrier + tracking → `confirmShipment(orderId, {marketplaceId, packageDetail:{packageReferenceId, carrierCode (+carrierName when Other), trackingNumber, shipDate, orderItems}})`. Labels remain redirect (Buy Shipping deep link — open question).
- PII scope (Data Protection Policy): encrypt order PII at rest (existing `ENCRYPTION_KEY`) or tokenize, scheduled purge with documented window, access logging; privacy page updated. If DPP answers are worded globally they bind eBay/Reverb rows too — read the live DPP clause in W0 (advisor fetch 404'd; do not paraphrase).
- Interim (D10): banner on Amazon listings until W4 ships.

### Testing + proof
- Vitest; tdd-guard one test per Write/Edit (`.claude/rules/tdd-one-test-per-write.md`, verbatim in every test-writing subagent prompt).
- Mock the wrapper module (hoisted per-method pattern `listings.reverb.test.ts:6-36`); one test pins SDK request shape via namespace mock. Goldens captured from real `getDefinitionsProductType` + a real 400 `issues` payload during W2/W3 proof — not from OpenAPI examples.
- Files: `amazon-adapter.test.ts` split by concern (builders / client / adapter / sku), `routes/listings.amazon.test.ts`, `routes/marketplace/amazon-auth.test.ts`, extensions to sync-worker/order-sync/marketplace-sync/token-manager/prepare-listing/items tests; web `amazon-catalog-section.test.tsx`, `create-listing-sheet.test.tsx`, `settings/marketplace/page.test.tsx`. Playwright: connect page renders disconnected in the ephemeral e2e stack (no creds).
- Sandbox is static for Listings/Catalog/PT-defs and RDT must be minted from prod → zero tests depend on sandbox; live proof only, on the operator's Pro account via the private app.
- Coverage thresholds (30/30/25) are not proof.

## Delivery waves

| Wave | Scope | Proof of done | Depends on |
|---|---|---|---|
| W0 (operator) | Professional seller account; private developer app + refresh token; public developer registration + DPP + PII role request; privacy/ToS page live (registration input); Doppler keys; secret-rotation runbook draft; read live DPP clause | private-app refresh token in Doppler; public case id recorded | — |
| W1a (refactor) | `registry.ts` + shared const; migrate 4 switches, 3 lists, literal unions; zero Amazon | 973 API + 646 web green; eBay + Reverb live publish/sync unchanged (screenshots); soak | — |
| W1b (connect) | enum + shared types; env; `amazon-auth.ts`; Sellers API sellerId + eligibility; token-manager LWA/RDT/reconnect; wrapper client; settings UI; admin health; e2e no-throw gating; docs skeleton | real connect on operator account; `marketplace_accounts` row; `/status` screenshot | W0 private app, W1a |
| W2 (catalog) | searchCatalog, restrictions pre-flight, `AmazonCatalogSection`, condition map, prepare slot + Fees API, FeeEstimate | real ASIN candidates for a scanned item; restrictions verdict shown; fee from API | W1b |
| W3 (publish) | SKU mint, offer-only put with pinned shapes, VALIDATION_PREVIEW, pending→outbox, status mapping, patch/delete rules, edit-sync, listing card, UI widenings, interim banner | live offer BUYABLE on amazon.com (screenshot + DB row); price patch visible; delete ends it; goldens captured | W2 |
| W4 (orders) | RDT, getOrders watermark, getOrderItems-first, status map, orderItems JSONB, confirmShipment UI, PII encrypt/purge/logging, sold via order-sync, banner removed | real order imported with address; confirmShipment accepted; purge job observed | PII role approved |
| W5 (wrap) | docs (`architecture/marketplace-adapters.md`, `api/marketplace.md`, `environment-variables.md`, `reference/amazon-registration.md`, ship-log, TODO, CLAUDE.md), tutorials/legal copy, rotation runbook final, beta-user OAuth connect | docs deployed; a beta user connects via OAuth | public app approved |

Each wave: own branch → review record → PR (`gh pr create` exempt) → merge with per-action approval. No git write without approval. No deferral without named approval; W4/W5 dependencies are external gates recorded above by operator decision (D10), not deferrals.

## Blockers and gates (from advisor reviews)
- External: public app + PII role approval — no published duration; community reports months (see Evidence). Private developer registration — hours to days.
- Contract: address-less order import impossible against current schema (`marketplace.ts:53-65`, `schema.ts:156`) — W4 requires the role.
- Infra: DPP compliance touches `orders.shippingAddress` (plaintext today, no purge job).
- Client: SDK no types / owns LWA → wrapper (D2/D3).
- API: sellerId, SKU key, restrictions pre-flight (D4/D5).
- Rollout: enum irreversibility; W1a soak before W1b; e2e env gating.

## Open questions
1. Professional seller account identity-verification time — W0 owner reports.
2. Exact DPP retention/encryption clauses — read live in W0.
3. Whether DPP answers bind eBay/Reverb PII rows — affects W4 scope.
4. Buy Shipping deep link for MFN orders — confirm before W4 ship UI.

## Evidence
- Amazon docs: register-as-a-public-developer, register-as-a-private-developer, sp-api-registration-overview, self-authorization, website-authorization-workflow, tokens-api-use-case-guide, usage-plans-and-rate-limits, the-selling-partner-api-sandbox (developer-docs.amazon).
- OpenAPI models: `listingsItems_2021-08-01`, `listingsRestrictions_2021-08-01`, `ordersV0`, `tokens_2021-03-01` (amzn/selling-partner-api-models).
- npm `@amazon-sp-api-release/amazon-sp-api-sdk-js` 1.11.0 (2026-08-07): no `types`, superagent + bottleneck deps, embedded `LwaOAuthClient`.
- Timelines: Seller Central forum "SP-API Developer Account Approval Timeline" (15 min ack; ~1 day internal; historical 3 business days; one >1 week); GitHub amzn/selling-partner-api-models #1737 and Seller Central "PII access request rejection" thread (months, repeated rejections for Direct-to-Consumer Shipping).
- Repo touchpoint map (Explore agent, 2026-08-18) and four advisor reviews (sections 1–4), consolidated in-session 2026-08-18.
