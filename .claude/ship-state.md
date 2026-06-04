status: in_progress
phase: 4
resume_at: "Phase 4 (Build) IN PROGRESS. T1-T13 done + committed (13/20) on branch feat/ebay-listing-hardening. CHUNK 1-4 COMPLETE (T1-T12); CHUNK 5 (T13-T15) IN PROGRESS (T13 done). Resume at T14 (Chunk 5 — see current: + tdd_guard_ROUTE_LESSON). [STALE-BELOW: pre-T11 resume text retained for context] Resume at T11 (Chunk 4): createInventoryLocation — PUT /sell/inventory/v1/location/{merchantLocationKey} (naturally idempotent), EbayAdapter INSTANCE method via this.request() (NOT static — Inventory location is a per-seller write needing the user token, same as T10's policy methods). TDD in ebay-adapter.test.ts fetch-mock harness; assert the PUT body + path. tdd-guard STRICT one-test-at-a-time: it BLOCKS multi-test adds AND blocks full-impl when the only failure is 'not a function' (must stub-first → re-run → see assertion fail → then implement). Run-to-completion rhythm: edit test → npm test -w apps/api -- src/marketplace/ebay-adapter.test.ts → confirm 'failed' in test.json (SEPARATE bash call) → impl → re-run green. Then T12 = POST /seller-profile/ebay/auto-setup (orchestrate 10+11, GET-first idempotency, store 4 IDs). DEFERRED to T13 (route publish layer): T7 ebaySku/quantity persistence + T8 POST /:id/publish reuse wiring + publishMode routing/validation + ADD a listings.ebayOfferId column (live publish overwrites marketplaceListingId with the listingId, losing the offerId). Chunks remaining: 4 = T11-T12, 5 = T13-T15 (route hardening), 6 = T16-T18 (frontend), 7 = T19-T20 (settings UI). Settings on auto mode + curated allowlist."
feature: eBay listing publish hardening + draft/live publish mode + auto-setup of business policies & inventory location
approach: Draft-first reframe. Wire prepare-listing fields through to createListing; auto-create policies (Account API) + inventory location (Inventory API) via one-click Settings setup; draft=unpublished offer / live=offer+publish; global default setting + per-listing override; condition USED_* static + dynamic per-category via Metadata get_item_condition_policies.
complexity: complex
tdd: backend_only
branch: feat/ebay-listing-hardening (off main, PR #93 merged)
supersedes: ship-state_v91_ebay-oauth-complete.md (OAuth ship complete + live-verified, PR #93)

decisions_phase1:
  - Publish mode: GLOBAL default setting + PER-LISTING override (user chose).
  - Policy + location setup: Portage AUTO-CREATES via eBay Account API (policies) + Inventory API (location). One-click in Settings. Idempotent.
  - Draft = create inventory_item + UNPUBLISHED offer (no /publish call). Live = + publish. (eBay validates policies/location at publish, not offer-create — draft clears a lower bar; this is the reliable interim.)

drafted_business_policies:
  - Return: 30-day, buyer pays return shipping, money-back. (Toggle to free-returns/seller-pays later.)
  - Fulfillment: handling 1 business day, USPS Ground Advantage (calculated) from seller ZIP, combined shipping on.
  - Payment: eBay Managed Payments, immediate payment (fixed-price).

root_cause_from_review:
  - WIRING GAP: prepare-listing.ts computes valid eBay fields but use-listing-flow.ts passes marketplaceSpecificFields=undefined for eBay -> createListing falls through to broken defaults.
  - Broken defaults: categoryId '99', policy IDs undefined, merchantLocationKey 'default', aspects omitted, condition 'GOOD'/'ACCEPTABLE' (invalid).

spec:
  WHAT IT DOES:
    - Wire prepare-listing eBay fields through use-listing-flow -> create/publish as marketplaceSpecificFields.
    - One-click "Set up eBay selling" (Settings): Account API create fulfillment/payment/return policies + Inventory API create default location; store IDs on seller_profile; idempotent.
    - Draft vs Live publish: global default (user pref) + per-listing override. DRAFT=unpublished offer, LIVE=offer+publish.
    - Condition: static USED_* fix + dynamic valid-per-category via Metadata get_item_condition_policies.
    - Require valid leaf categoryId (never '99'); packageType Portage->eBay enum translation.
    - Surface eBay longMessage on 400 (not generic 500).
    - QUANTITY field: add items.quantity (default 1), editable in listing flow, wired to eBay quantity.
  WHAT IT DOES NOT DO:
    - Etsy/Reverb wiring fix, auction format, non-US marketplaces, full required-aspects editor UI.
  ACCEPTANCE:
    - After setup, listing reliably creates as eBay DRAFT or LIVE.
    - No condition/categoryId 400s. Setup idempotent.
  AFFECTED: apps/api (ebay-adapter, listings, seller-profile, items, schema), apps/web (listing-flow, settings, edit page), packages/shared (types, marketplace), DB schema.

architecture:
  publish_flow: |
    ListingPreviewCard → onPublish("ebay")
      └── useListingFlow.publish({ ebayPreparedFields, publishMode })
            └── POST /listings { marketplaceSpecificFields: {...ebayPreparedFields}, quantity, publishMode }
                  ├── if draft: save to DB (status='draft'), return
                  └── if live: adapter.createListing()
                        ├── Generate OR reuse SKU (check listings.ebaySku)
                        ├── PUT /inventory_item/{sku} (condition USED_*, quantity, aspects, weight)
                        ├── POST /offer (valid leaf categoryId, policies, location)
                        ├── POST /offer/{offerId}/publish
                        └── Return { listingId, offerId, sku, status }
  auto_setup_flow: |
    Settings → "Set up eBay Selling" button
      └── POST /seller-profile/ebay/auto-setup
            ├── GET existing policies → reuse if "Portage Standard" exists
            ├── POST create missing policies
            ├── PUT inventory location (idempotent)
            └── PATCH seller_profile with 4 IDs
  schema_changes:
    - items.quantity: integer, default 1, notNull
    - seller_profiles.ebayPublishMode: varchar(10), default 'live'
    - listings.ebaySku: varchar(255), nullable
  design_decisions:
    - ebayPreparedFields NOT stored in ListingFlowState (avoids draft staleness of cached policy IDs). Passed as parameter to publish() at call time.
    - publishImmediately kept for backward compat (4 frontend callers). New publishMode field takes precedence when present.
    - CONDITION_MAP fixed in BOTH ebay-adapter.ts AND prepare-listing.ts (duplicate maps, both broken).
    - getValidConditions uses getEbayProdAppToken() (matches existing static method pattern).
    - Auto-setup uses GET-first idempotency (check for "Portage Standard" by name) to avoid 409s.
    - bulkPublishOffers uses eBay batch API (up to 25 per call).
    - No useSellerProfile hook exists — settings page uses inline api() calls.
    - Existing autoPublish checkbox stays; ebayPublishMode is a separate concept alongside it.

phase3_plan:
  deploy_order: schema push → shared types build → API changes → frontend changes → container rebuild
  
  chunk_1_foundation:
    status: approved+verified
    tasks:
      task_1:
        title: "DB schema — add items.quantity, seller_profiles.ebayPublishMode, listings.ebaySku"
        files: [apps/api/src/db/schema.ts]
        verify: "npm run db:push && npm run typecheck"
        risk: medium (DB schema, additive with defaults)
        tdd: false
      task_2:
        title: "Shared types — SellerProfile += ebayPublishMode, Item += quantity, MarketplaceListingInput += quantity, MarketplaceListingResult += ebaySku"
        files: [packages/shared/src/types.ts, packages/shared/src/marketplace.ts]
        verify: "npm run build -w packages/shared && npm run typecheck"
        risk: low
        tdd: false
      task_3:
        title: "Items route — accept/return quantity in CRUD endpoints"
        files: [apps/api/src/routes/items.ts]
        verify: "curl POST/GET with quantity"
        risk: low
        tdd: true

  chunk_2_condition_guards:
    status: approved+verified
    revision: "Fix CONDITION_MAP in BOTH ebay-adapter.ts AND EBAY_CONDITION_MAP in prepare-listing.ts. Use getEbayProdAppToken for Metadata API."
    tasks:
      task_4:
        title: "Fix CONDITION_MAP — USED_* values + prefer specific.condition; fix BOTH maps (adapter + prepare-listing)"
        files: [apps/api/src/marketplace/ebay-adapter.ts, apps/api/src/routes/prepare-listing.ts]
        verify: "npm run typecheck + unit test"
        risk: low
        tdd: true
      task_5:
        title: "Adapter guards — categoryId reject '99', policy guards throw if missing, quantity from input"
        files: [apps/api/src/marketplace/ebay-adapter.ts]
        verify: "npm run typecheck + unit test (missing categoryId → clear error)"
        risk: medium (changes error behavior — intentional)
        tdd: true
      task_6:
        title: "getValidConditions — Metadata API method + wire into prepare-listing validation"
        files: [apps/api/src/marketplace/ebay-adapter.ts, apps/api/src/routes/prepare-listing.ts]
        verify: "curl prepare-listing → verify conditions validated"
        risk: low
        tdd: true

  chunk_3_draft_sku_errors:
    status: approved+verified
    revision: "MarketplaceListingResult needs ebaySku field added."
    tasks:
      task_7:
        title: "Conditional publish — draft mode skips /publish, stores offerId + SKU"
        files: [apps/api/src/marketplace/ebay-adapter.ts, apps/api/src/routes/listings.ts, packages/shared/src/marketplace.ts]
        verify: "draft listing → offerId returned, no publish call, SKU stored"
        risk: medium
        tdd: true
      task_8:
        title: "SKU reuse — re-publish updates existing inventory_item, calls publishOffer(offerId)"
        files: [apps/api/src/marketplace/ebay-adapter.ts, apps/api/src/routes/listings.ts]
        verify: "create draft → publish → same SKU reused, no orphan"
        risk: medium
        tdd: true
      task_9:
        title: "Surface eBay longMessage on 400 errors"
        files: [apps/api/src/marketplace/ebay-adapter.ts]
        verify: "trigger known 400 → longMessage in API error response"
        risk: low
        tdd: true

  chunk_4_auto_setup:
    status: approved+verified
    revision: "Auto-setup uses GET-first idempotency. request() error opacity handled by pre-checking. Seller profile race condition deferred."
    tasks:
      task_10:
        title: "New adapter methods — createFulfillmentPolicy, createPaymentPolicy, createReturnPolicy"
        files: [apps/api/src/marketplace/ebay-adapter.ts]
        verify: "npm run typecheck + unit test (mock eBay API, verify POST body)"
        risk: low
        tdd: true
      task_11:
        title: "New adapter method — createInventoryLocation (PUT, naturally idempotent)"
        files: [apps/api/src/marketplace/ebay-adapter.ts]
        verify: "npm run typecheck + unit test"
        risk: low
        tdd: true
      task_12:
        title: "POST /seller-profile/ebay/auto-setup endpoint (orchestrate 10+11, idempotent)"
        files: [apps/api/src/routes/seller-profile.ts]
        verify: "call endpoint → policies created, IDs stored. Call again → idempotent."
        risk: medium
        tdd: true

  chunk_5_route_hardening:
    status: approved+verified
    revision: "Keep publishImmediately for backward compat (4 callers). publishMode takes precedence. bulkPublishOffers uses eBay batch API."
    tasks:
      task_13:
        title: "POST /listings — add publishMode, validate eBay marketplaceSpecificFields, store ebaySku + forward item.quantity to createListing (route glue moved from T7)"
        files: [apps/api/src/routes/listings.ts]
        verify: "draft saves without validation; live+missing fields → 400"
        risk: medium
        tdd: true
      task_14:
        title: "PATCH /:id updateListing — sync ALL fields to eBay (inventory_item + offer)"
        files: [apps/api/src/routes/listings.ts, apps/api/src/marketplace/ebay-adapter.ts]
        verify: "update published listing condition → both inventory_item and offer updated"
        risk: medium
        tdd: true
      task_15:
        title: "POST /bulk/activate — eBay bulkPublishOffers for valid listings"
        files: [apps/api/src/routes/listings.ts, apps/api/src/marketplace/ebay-adapter.ts]
        verify: "3 draft listings → bulk activate → all 3 published"
        risk: medium
        tdd: true

  chunk_6_frontend_wiring:
    status: approved+verified
    revision: "ebayPreparedFields passed as parameter to publish(), NOT stored in ListingFlowState (avoids draft staleness)."
    tasks:
      task_16:
        title: "useListingFlow.publish() — accept ebayPreparedFields + publishMode as parameters, add quantity to state"
        files: [apps/web/src/hooks/use-listing-flow.ts]
        verify: "npm run typecheck"
        risk: medium (central wiring fix)
        tdd: false
      task_17:
        title: "Listing flow components — wire publish with ebayPreparedFields, quantity input, draft/live toggle on ListingPreviewCard"
        files: [apps/web/src/components/listing-flow/hybrid-flow.tsx, conversational-flow.tsx, swipe-flow.tsx, apps/web/src/components/listing/listing-preview-card.tsx]
        verify: "dev server: listing flow → quantity visible, toggle works, publish sends fields"
        risk: medium (4 files)
        tdd: false
      task_18:
        title: "Inventory edit page — quantity field"
        files: [apps/web/src/app/inventory/[id]/edit/page.tsx]
        verify: "dev server: edit → change quantity → save → reload → persisted"
        risk: low
        tdd: false

  chunk_7_settings_ui:
    status: approved+verified
    revision: "No useSellerProfile hook — page uses inline api() calls. autoPublish checkbox stays, ebayPublishMode is separate."
    tasks:
      task_19:
        title: "Settings/seller-profile — 'Set up eBay Selling' button + status indicator"
        files: [apps/web/src/app/settings/seller-profile/page.tsx]
        verify: "dev server: click button → policies created, status green"
        risk: low
        tdd: false
      task_20:
        title: "Settings/seller-profile — publish mode default selector"
        files: [apps/web/src/app/settings/seller-profile/page.tsx]
        verify: "dev server: change mode → reload → persisted"
        risk: low
        tdd: false

  deferred:
    - "Photo-first eBay publish drops ebayPreparedFields+publishMode on fallback paths (hybrid ChatMode showReview && !prepareListing.data pill + conversational 🚀 Publish pill call flow.publish() no-args). prepare gated on inventoryItemId which photo-first lacks until publish → broken eBay defaults. HIGH priority. registry id c3b3013c. Found in T16/T17 advisor verification. Fix: create item earlier so prepare runs, or wire fallback path."
    - Etsy marketplace wiring fix (same pattern as eBay, out of scope)
    - Orphaned eBay inventory_item cleanup sweep
    - Seller profile GET auto-create race condition (pre-existing, upsert fix)
    - Listings route test coverage (zero tests pre-existing)
    - CSV export condition map consistency check
    - Full required-aspects editor UI

phase3_verification_summary:
  chunks_verified: 7/7
  advisor_passes: 8 (1 architecture + 7 chunk verifications)
  claims_checked: ~55
  claims_confirmed: ~52
  claims_refuted_or_revised: 3 (no useSellerProfile hook, autoPublish already exists, filenames *-flow not *-mode)
  design_revisions_from_verification:
    - ebayPreparedFields as publish() parameter, not in ListingFlowState (staleness risk)
    - Keep publishImmediately alongside publishMode (4 frontend callers)
    - Fix CONDITION_MAP in both ebay-adapter.ts AND prepare-listing.ts
    - Use getEbayProdAppToken for Metadata API (not getEbayAppToken)
    - Auto-setup uses GET-first pattern (avoids request() error opacity)
    - bulkPublishOffers uses eBay batch API (up to 25)

phase4_progress:
  branch: feat/ebay-listing-hardening (off feat/ebay-oauth HEAD = origin/main + PR #93; local main was STALE at PR #88)
  tdd_guard_note: tdd-guard global hook enforces test-first on apps/api + packages/shared edits; apps/web + *.md/*.json exempt via .claude/tdd-guard/data/config.json. So plan tdd:false tasks T1/T2 still need a (failing) shape test first; T16-T20 (apps/web) do not.
  db_push_note: drizzle-kit does NOT load .env. Run with DATABASE_URL="postgresql://portage:portage@127.0.0.1:5436/portage" (LAN IP 10.0.0.251:5436 unreachable from this shell).
  completed:
    - "T1 ✓ schema columns (items.quantity, listings.ebaySku, seller_profiles.ebayPublishMode) + regression test; db:push applied + psql-verified. commit 0180714"
    - "T2 ✓ shared types: SellerProfile.ebayPublishMode, MarketplaceListingInput.quantity?, MarketplaceListingResult.ebaySku? (commit c90e303). Item.quantity DEFERRED to T3 — tdd-guard blocked the type-only add; it lands with the items-route Red test."
    - "T3 ✓ items CRUD quantity (createItemSchema + POST insert default 1; PATCH via partial; GET full-row) + Item.quantity type now required. test: POST passes quantity to insert. commit fd4e29f. >>> CHUNK 1 COMPLETE <<<"
    - "T4 ✓ fixed ebay-adapter CONDITION_MAP -> USED_* enums + resolveEbayCondition (prefers specific.condition). prepare-listing EBAY_CONDITION_MAP LEFT ALONE (comp-bucket map, not Inventory API — see decision log). commit 4b7f667"
    - "T5 ✓ validateEbayListingFields (categoryId!='99', policies+location required, throws AppError 400 pre-flight) + createListing uses validated fields + quantity from input. Reusable fetch/token mock harness in ebay-adapter.test.ts. commit 44e7970. >>> CHUNK 2 (T4-T6) almost done — T6 next <<<"
    - "T6 ✓ getValidConditions (Metadata get_item_condition_policies, prod app token, URL-encoded categoryIds filter, graceful [] on any non-OK/throw) + EBAY_CONDITION_ID_TO_ENUM bridge + CONDITION_PREFERENCE_CHAINS + selectValidEbayCondition (closest category-supported grade, conservative bias) + resolveEbayCategoryCondition (tail policy: empty=silent keep-default, deviation=override+warn, no-match=warn no-override, never relabel used as NEW). Wired into prepare-listing via 4th parallel allSettled call, overrides ebayFields.condition. 15 new unit tests (19 in ebay-adapter.test.ts). typecheck clean 3 workspaces. resolveEbayCategoryCondition extracted to adapter (testable via existing harness) keeping route as thin glue. commit 6249fd8. >>> CHUNK 2 (T4-T6) COMPLETE <<<"
    - "T7 ✓ createListing draft/live publishMode. Draft = inventory_item + UNPUBLISHED offer, SKIP /publish, return {marketplaceListingId: offerId, ebayOfferId, ebaySku, status:'draft'} with NO warning (intentional draft != publish-failed fallback). Live (default, backward-compat) = publish as before, return now also carries ebayOfferId + ebaySku for later re-publish/re-sync. shared types: MarketplaceListingInput.publishMode?, MarketplaceListingResult.ebayOfferId?. 2 unit tests (draft skips publish; live returns listingId+offerId+sku), 21 adapter tests green, typecheck clean (shared rebuilt), full api suite 323 pass (excl batch-enhance). commit 1a0f73c. ROUTE-LEVEL ebaySku persistence + item.quantity forwarding MOVED to T13 — tdd-guard rejected the untested route glue inside the adapter red window (edit must address the failing assertion; route persistence is a different behavior needing its own route test). >>> CHUNK 3 (T7-T9): T7 DONE, T8 next <<<"
    - "T8 ✓ createListing SKU+offer reuse. sku = input.ebaySku ?? generate (reuse existing inventory_item, PUT idempotent). offerData = input.ebayOfferId ? {offerId} : POST /offer (reuse existing offer, no duplicate -> no orphan); ternary keeps offerData defined so all 6 downstream refs unchanged. Live path publishes the reused offer; draft path returns the reused offerId. 2 unit tests (reuse SKU; reuse offer w/o creating duplicate), 23 adapter tests green, typecheck clean (shared rebuilt), full api 325 pass (excl batch-enhance). commit e935163. ROUTE wiring of POST /:id/publish (pass listing.ebaySku + offerId-from-marketplaceListingId into createListing) DEFERRED to T13 (untested route glue + depends on T13 persistence). publishOffer() NOT extracted (inline publish satisfies the spec's 'calls publishOffer(offerId)'; extract in T15 only if bulk needs it). tdd-guard friction this task: blocked the ebayOfferId type-only add (test casts input as any) -> landed it on green after the ternary made the test pass at runtime (same class as the backlogged false-positive). >>> CHUNK 3: T7+T8 DONE, T9 next <<<"
    - "T9 ✓ surface eBay longMessage. request() error path now parses errorBody JSON in try/catch -> errors[0].longMessage ?? errors[0].message; throws AppError(response.status, 'EBAY_API_ERROR', longMessage ?? generic) instead of plain Error. Non-JSON body (HTML 5xx) -> catch -> generic 'eBay API error: {status} on {path}'. Route errorHandler now returns the real eBay status + reason (e.g. 400 + 'condition not valid for category') instead of generic 500. AppError was already imported (validateEbayListingFields). 2 unit tests (longMessage+status; non-JSON fallback). 25 adapter tests green, typecheck clean, full api 327 pass — Error->AppError change broke NO caller (createListing publish try/catch + getListingStatus catch still catch it; getOrders propagates cleanly to the route). commit b14c024. >>> CHUNK 3 (T7-T9) COMPLETE <<<"
    - "T10 ✓ Account API policy creation: createFulfillmentPolicy/createPaymentPolicy/createReturnPolicy as EbayAdapter INSTANCE methods via this.request() (seller user token, sell.account scope) — NOT static app-token. Resume note's 'static-method pattern' was WRONG for per-seller writes: verified ebay-auth.ts:62 already requests sell.account + pulled the eBay Account OpenAPI spec (api-evangelist/ebay GitHub mirror; developer.ebay.com WebFetch still times out). Bodies spec-verified: fulfillment=handlingTime{value:1,unit:DAY}+DOMESTIC CALCULATED USPSGroundAdvantage+categoryTypes ALL_EXCLUDING_MOTORS_VEHICLES (CategoryType.default deprecated→omit; buyerResponsibleForShipping is motors-only→omit); payment=immediatePay:true+NO offline paymentMethods (managed payments); return=returnsAccepted+returnPeriod{30,DAY}+returnShippingCostPayer BUYER+refundMethod MONEY_BACK. Each returns *PolicyId from 201 body. 3 unit tests assert POST body+id, ONE-AT-A-TIME (tdd-guard blocked the 3-test batch add, and for the 3rd blocked full-impl-on-'not-a-function' → required stub-first). 28 adapter tests green, typecheck clean 3 ws, full api 330 pass (excl batch-enhance). commit 1b92db7. Decision logged (instance-vs-static). >>> CHUNK 4: T10 DONE, T11 next <<<"
    - "T11 ✓ createInventoryLocation(merchantLocationKey, address, name?) — EbayAdapter INSTANCE method via this.request() (sell.inventory scope). CORRECTED the plan: it is POST /sell/inventory/v1/location/{key} returning 204 No Content (NOT 'PUT naturally idempotent' — verified eBay Inventory OpenAPI spec api-evangelist/ebay GitHub). POST 400s if key exists → idempotency is T12's job (GET-first), not the method's. Body=InventoryLocationFull: location.address (eBay Address fields passed through), explicit merchantLocationStatus ENABLED + locationTypes WAREHOUSE, name optional. postalCode here is eBay's ship-from for T10's calculated-shipping policy. 1 unit test asserts POST path+body (stub-first per tdd-guard; full-impl-on-not-a-function blocked again). 29 adapter tests green, typecheck clean 3 ws, full api 331 pass (excl batch-enhance). commit 7453445. Decision logged (POST-not-idempotent). >>> CHUNK 4: T10+T11 DONE, T12 next <<<"
    - "T12 ✓ POST /seller-profile/ebay/auto-setup orchestrator. Verified seller_profiles ALREADY has ebayFulfillmentPolicyId/ebayPaymentPolicyId/ebayReturnPolicyId/ebayMerchantLocationKey + shipFromAddress jsonb {name,street1,street2,city,state,zip,country} — NO schema change needed. Flow: account-check (400 EBAY_NOT_CONNECTED) → load/auto-create profile → GET-first policies (Promise.allSettled the 3 /sell/account/v1/*_policy?marketplace_id=EBAY_US, reuse by name 'Portage Standard *' else adapter.createX from T10) → location GET-first (GET /location/portage-primary; create via T11 only on !ok) gated on shipFrom presence → persist 4 ids → return {setup:{...,locationConfigured}}. PROGRESSIVE setup (Stephen 'option 2'): no shipFrom → policies still created, location SKIPPED (locationConfigured:false, key null), NOT blocked. Address-pull-from-Identity-API DEFERRED (separate OAuth-scope PR). 4 supertest cases (not-connected, full setup w/ full-address toEqual, idempotent reuse=no POSTs, no-address skip) — db+token mocked, REAL adapter against URL-routed fetch stub. typecheck clean 3 ws, full api 335 pass (excl batch-enhance). commit 36c65a0. DEFERRED: DRY fetchEbayPolicies (dup with /ebay-policies, left inline). >>> CHUNK 4 (T10-T12) COMPLETE <<<"
    - "T20 ✓ Chunk 7 COMPLETE — PHASE 4 (BUILD) DONE 20/20. Settings/seller-profile: Default Publish Mode select bound to profile.ebayPublishMode ('live'|'draft') via updateField('ebayPublishMode', v); placed in eBay Account section after Merchant Location Key (eBay-specific, distinct from general autoPublish toggle which stays in Listing Preferences). Options: 'Publish live immediately' / 'Save as draft (review on eBay first)' + helper note 'override per listing at publish time'. typecheck clean 3 ws, lint 0 errors. commit 109fa4a. >>> ALL 20 TASKS DONE. NEXT: Phase 5 (Verify) → 6 (Review) → 7 (Ship) <<<"
    - "T19 ✓ Chunk 7 START. Settings/seller-profile: 'Set up eBay Selling' button → POST /seller-profile/ebay/auto-setup (T12); on success setProfile with returned 4 IDs + RE-FETCH /ebay-policies so dropdowns gain new 'Portage Standard' options (else selects show value w/ no matching option). 3-state status indicator derived purely from profile fields (reactive, no refetch race): green='eBay selling configured' (all 4 IDs), amber='Policies set · ship-from address needed' (3 policy IDs, no location), gray='Not set up yet'. Button label flips to 'Re-run setup' when configured. Partial-success path (locationConfigured=false) shows amber banner ('Policies set up. Add a ship-from address...') — widened the message banner tri-tone (Saved=green, 'Policies set up'=amber, else red). EBAY_NOT_CONNECTED 400 → ApiError message surfaced. typecheck clean 3 ws, lint 0 errors. commit e05b494. >>> CHUNK 7: T19 DONE, T20 next <<<"
    - "T18 ✓ Chunk 6 COMPLETE. Inventory edit page (apps/web/src/app/inventory/[id]/edit/page.tsx): added Quantity number input (min 1, NaN/<1 → 1) as own FieldGroup after Brand/Model; quantity state + load from item + handleSave passes quantity + hasChanges includes quantity!==(item.quantity??1). GOTCHA: useItem types `item` via a LOCAL Item interface in use-items.ts (frontend duplicate of @portage/shared Item), NOT the shared type — had to add quantity:number THERE too (shared Item already had it from T3). Clean rebuild + dropped tsconfig.tsbuildinfo ruled out caching before tracing to the dup type. typecheck clean 3 ws, lint 0 errors. commit 042ca2c. >>> CHUNK 6 (T16-T18) COMPLETE — frontend wiring done <<<"
    - "T17 ✓ Chunk 6 flow components. ListingPreviewCard: +quantity/onQuantityChange props, quantity stepper (±, min 1), draft/live segmented toggle (local state default 'live'), onPublish widened to (marketplace, publishMode); eBay button label flips to 'Save eBay draft' in draft mode. hybrid-flow ChatMode card + conversational-flow card: forward prepareListing.data?.ebay as ebayPreparedFields + publishMode into flow.publish(); pass quantity props. hybrid CompactMode (never shows card): added own quantity stepper bound to setField('quantity'). swipe-flow ReviewPhase: own quantity stepper + draft/live toggle (dark theme), onPublish→(publishMode); SwipeFlow.handlePublish(publishMode) forwards prepareListing.data?.ebay. NOTE pre-existing setField('marketplace')→publish() race left untouched (out of scope). typecheck clean 3 ws; lint 0 errors/25 pre-existing warnings. apps/web tdd-guard EXEMPT. commit a909107. >>> CHUNK 6: T16+T17 DONE, T18 next <<<"
    - "T16 ✓ Chunk 6 frontend wiring START. useListingFlow.publish() now accepts options {ebayPreparedFields?: EbayPreparedFields|null, publishMode?: 'draft'|'live'}; forwards eBay prepared fields as marketplaceSpecificFields (reverb branch unchanged), passes publishMode when present (else publishImmediately:true for backward compat). Added ListingFlowState.quantity (shared types) + INITIAL_STATE quantity:1 + startFromItem loads item.quantity + POST /items body sends quantity. ebayPreparedFields PASSED AS PARAM not stored in state (staleness — per design_decisions). typecheck clean 3 ws (CLI authoritative; IDE diagnostics stale until shared/dist rebuild propagates). apps/web = tdd-guard EXEMPT, no test. commit e7c5753. >>> CHUNK 6: T16 DONE, T17 next <<<"
    - "T15 ✓ POST /bulk/activate → eBay bulkPublishOffers. Adapter: new bulkPublishOffers instance method — POST /sell/inventory/v1/bulk_publish_offer with up to 25 offerIds per batch, returns per-offer {offerId, listingId, success, error}. Route: /bulk/activate now separates eBay drafts (status=draft, marketplace=ebay, ebayOfferId set) from plain activatable (no marketplace connection); eBay drafts published in 25-item batches; each success → db.update(marketplaceListingId=listingId, status=active, publishedAt); failures logged + counted. Non-marketplace drafts activate locally as before. Removed transaction wrapper on local activation (unnecessary for single update). 1 adapter test (POST body + response mapping) + 1 route test (bulkPublishOffers called with offerIds, published count returned). 344 pass (was 342, +2), typecheck clean 3 ws. commit fb67686. >>> CHUNK 5 (T13-T15) COMPLETE <<<"
    - "T14 ✓ PATCH /:id updateListing — sync ALL fields to eBay. Adapter: updateListing now PUTs inventory_item (condition/quantity/photos/weight/aspects) when ebaySku is present, then PUTs the offer using ebayOfferId (fixes latent bug: live listings stored listingId as marketplaceListingId, not offerId — offer PUT would have used wrong ID). Route: PATCH handler passes full item data (condition, quantity, brand, model, photos, features, ebaySku, ebayOfferId, marketplaceSpecificFields) to adapter.updateListing instead of just title/description/price. 1 adapter test (inventory_item PUT body + offer PUT targets ebayOfferId) + 1 route test (full fields forwarded including ebaySku/ebayOfferId). 342 pass (was 340, +2), typecheck clean 3 ws. commit c17cdfb. >>> CHUNK 5: T13+T14 DONE, T15 next <<<"
    - "T13 ✓ Chunk 5 route hardening. T13a: listings.ebayOfferId column (nullable varchar) + shape test; db:push + psql-verified (ebay_offer_id nullable); commit eb028b7. T13b POST /listings: added publishMode ('draft'|'live') to createListingSchema; shouldPublish = publishMode==='live' || (publishMode===undefined && publishImmediately) — publishMode takes precedence; draft=DB-only NO marketplace call (per architecture.publish_flow, RESOLVED the draft-semantics question); live=createListing; forward item.quantity; persist result.ebaySku+ebayOfferId on insert. T13c POST /:id/publish: pass listing.ebaySku+ebayOfferId+quantity into createListing (T8 reuse = no orphan), persist result ids in the update. First listings.test.ts (zero pre-existing): 4 cases (persistence, publishMode-live routing+quantity, re-publish reuse, persist-on-publish) — adapter mocked via vi.hoisted. typecheck clean 3 ws, full api 340 pass (excl batch-enhance). commit b883433. DEFERRED: live-publish-failure warning gap (tdd-guard DEADLOCKED the in-place fix — flagged the publishImmediately→shouldPublish swap as refactor-while-red; captured to registry). >>> CHUNK 5: T13 DONE, T14 next <<<"
  tdd_guard_ROUTE_LESSON: "T12 route work hit HEAVY tdd-guard friction (T13-T15 are also routes — heed this). (1) Validator sub-agent ERRORS with error_max_turns on LARGE diffs (a full-file Write of ~288 lines) → it BLOCKS the edit. Use small targeted Edits (<~85 lines analyze fine). (2) Guard enforces STRICT one-assertion-at-a-time + 'minimal code for THE FIRST failing assertion' — it rejects cohesive handlers as over-implementation, even helper fns added 'ahead of' the route. Pattern that worked: route STUB first (res.json({setup:{}})) → then build up per failing assertion. (3) To drive a COHESIVE object (e.g. full address map) in ONE increment, assert it with a SINGLE toEqual(wholeObject) — guard can't demand 'less' than a deep-equal. (4) Guard BLOCKS changing a test's assertions while that test is RED ('must pass first') — only refactor assertions when green. (5) Build front-loaded logic (account-check select) via its OWN test FIRST so later tests' sequential db.select mocks don't reshuffle. (6) 3 near-identical creates were accepted together (addressed 3 assertions); a 4th unrelated concern in the same edit was rejected."
  tdd_guard_DECISION: "KEEP THE GATE ON — advisor-verified + user-confirmed (option 1, 2026-06-03). It is the deterministic guarantee TDD runs every time; do NOT disable it, do NOT treat TDD as ambient. CORRECTED diagnosis: the false-block is a PROCESS-COMPLETION RACE (hook fires before the just-started vitest finishes writing test.json), NOT a flush lag — defeat it by waiting for the run to finish. RHYTHM: (1) write failing test, (2) run FULL file 'npx vitest run <file> 2>/dev/null' to completion, (3) confirm 'grep reason .claude/tdd-guard/data/test.json' shows failed in a SEPARATE bash call, (4) THEN edit impl, one increment per first-failing-assertion, (5) refactor only when test.json shows passed. Never edit mid-run; never run two vitest at once. Friction is backlogged ('Tune TDD-guard false-positives') — fix friction, never weaken enforcement."
  current: "PHASE 4 (BUILD) COMPLETE — all 20 tasks done + committed on feat/ebay-listing-hardening. NEXT: Phase 5 (Verify) — run full api test suite (EXCLUDE batch-enhance.test.ts, pre-existing 4 fails from untracked photo-gallery WIP), typecheck 3 ws, lint, re-run task verifies. Then Phase 6 (Review — 6 agents on full diff vs main) → Phase 7 (Ship — PR + CLAUDE.md update + defer list). 1 HIGH deferred item logged (c3b3013c photo-first fallback publish gap). Backend chunks 1-5 had tdd tests; frontend chunks 6-7 (T16-T20) apps/web tdd-EXEMPT, no tests added (visual verification deferred to live review per user 'see it after t20')."
  preexisting_test_failures:
    - "apps/api/src/routes/__tests__/batch-enhance.test.ts (UNTRACKED — photo-gallery WIP, NOT in my commits): 4 failures, POST /images/batch-enhance returns 404 (route never implemented). Full api suite = 303 pass / 4 fail, all from this one file. Deferred to photo-gallery ship (ship-state_v89). When verifying my ship, exclude this file."

t6_research_prefetched:
  status: "VERIFIED from live eBay docs via Playwright 2026-06-03 (WebFetch TIMES OUT on developer.ebay.com; Playwright navigate + read the saved .playwright-mcp/*.yml snapshot works — browser_evaluate is blocked under dontAsk/auto unless allowlisted). Do NOT re-fetch — build T6 directly from this."
  two_vocabularies: "eBay has TWO condition representations. (1) Inventory API createListing sends ENUM strings (NEW, USED_GOOD...). (2) Metadata getItemConditionPolicies returns numeric conditionId STRINGS (1000, 5000...). Validation MUST bridge enum<->id. NOTE: prepare-listing.ts EBAY_CONDITION_MAP is a THIRD, unrelated thing (Browse-API comp-bucket map for pricing) — leave it alone (T4 decision)."
  metadata_endpoint: "GET {base}/sell/metadata/v1/marketplace/EBAY_US/get_item_condition_policies?filter=categoryIds:{<id>}  (URL-encode filter -> categoryIds%3A%7B<id>%7D). base = api.ebay.com (prod) / api.sandbox.ebay.com. Auth: client-credentials app token + api_scope -> use getEbayProdAppToken() (matches searchComps/getCategorySuggestion/getRequiredAspects static pattern). Cert-Refurbished cond 2000 needs auth-code token, but we do NOT list refurbished, so app token suffices."
  metadata_response_shape: "{ itemConditionPolicies: [ { categoryId, categoryTreeId, itemConditionRequired: bool, itemConditions: [ { conditionId: '1000', conditionDescription: 'New', conditionHelpText?, usage? } ] } ], warnings: [] }. getValidConditions returns itemConditionPolicies[0].itemConditions.map(c => c.conditionId)."
  enum_to_conditionId_bridge: "NEW=1000 | LIKE_NEW=2750 (books/DVDs; cards/coins=Graded) | NEW_OTHER=1500 | NEW_WITH_DEFECTS=1750 | CERTIFIED_REFURBISHED=2000 | SELLER_REFURBISHED=2500 | USED_EXCELLENT=3000 (apparel=Pre-owned Good) | USED_VERY_GOOD=4000 (cards/coins=Ungraded) | USED_GOOD=5000 | USED_ACCEPTABLE=6000 | FOR_PARTS_OR_NOT_WORKING=7000. (MANUFACTURER_REFURBISHED=2000 deprecated->CERTIFIED; EXCELLENT/VERY_GOOD/GOOD_REFURBISHED=2010/2020/2030; PRE_OWNED_EXCELLENT/FAIR=2990/3010 apparel-only — none of which we list.)"
  wiring_target: "aiFields.ebay.condition EXISTS (vision.ts:292, default '') and flows into ebayFields via spread (prepare-listing.ts:313). EbayPreparedFields.condition EXISTS in shared types (types.ts:445) — NO type change needed. resolveEbayCondition (ebay-adapter.ts:51) already prefers specific.condition when a valid enum is passed, so a category-validated enum injected at ebayFields.condition reaches the Inventory PUT cleanly."
  adapter_method: "static async getValidConditions(categoryId: string): Promise<string[]> in EbayAdapter — mirror getRequiredAspects EXACTLY (prod app token, fetch api.ebay.com, graceful return [] on non-OK, parse itemConditions)."
  RESOLVED_fallback_heuristic: "CONFIRMED by Stephen 2026-06-03. AUTO-CORRECT (warn-only REJECTED — does not prevent the publish 400). getValidConditions(categoryId) -> string[] of valid conditionIds. In prepare-listing: pick the FIRST conditionId in the Portage-condition PREFERENCE CHAIN that the category supports; set ebayFields.condition to that enum; warn when the chosen enum differs from the CONDITION_MAP default. CHAINS (first supported wins): new=[1000 NEW, 1500 NEW_OTHER]; like_new=[2750 LIKE_NEW, 3000 USED_EXCELLENT, 4000 USED_VERY_GOOD]; good=[5000 USED_GOOD, 3000 USED_EXCELLENT, 4000 USED_VERY_GOOD, 6000 USED_ACCEPTABLE]; fair=[6000 USED_ACCEPTABLE, 3000 USED_EXCELLENT, 5000 USED_GOOD]; poor=[6000 USED_ACCEPTABLE, 3000 USED_EXCELLENT, 5000 USED_GOOD]. KEY: 3000 doubles as generic 'Used' so every used grade resolves in general categories {1000,3000}; media/apparel get their exact granular grade; conservative bias (never auto-upgrade past generic Used). TAIL: (a) getValidConditions returns [] (Metadata API failure) -> NO correction, keep CONDITION_MAP default, NO warning (never block prepare on a transient hiccup); (b) chain has no supported id (New-only category + used item) -> keep default + warn, let eBay 400 longMessage (T9) surface the conflict, NEVER relabel used as NEW. IMPL: add ENUM<->conditionId bridge constant (see enum_to_conditionId_bridge) + CONDITION_PREFERENCE_CHAINS keyed by Portage condition. tdd:true — failing test FIRST per tdd_guard_DECISION rhythm."

session_note_2026-06-03_pm: "Resumed to build T6, but session spent on permission-config triage instead (no T6 code written — T6 still NOT started). Outcome: diagnosed dontAsk auto-deny was blocking ad-hoc compound Bash, browser_evaluate, claude.ai-Context7. Fix: defaultMode dontAsk->auto; added then REMOVED blanket Bash (auto's classifier + 300-entry allowlist preferred over an ungated shell). NEXT SESSION must restart for auto mode to load, then /ship resume -> T6."
