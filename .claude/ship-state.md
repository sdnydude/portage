status: stopped
phase: 4
resume_at: "Phase 4 (Build) PAUSED after T5 (5/20 tasks done + committed) on branch feat/ebay-listing-hardening. Resume at T6 (getValidConditions Metadata API). Read phase4_progress + tdd_guard_flush_note at end of file BEFORE building. Next: chunk 2 finishes at T6, then chunks 3-7 (T7-T20)."
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
        title: "POST /listings — add publishMode, validate eBay marketplaceSpecificFields, store ebaySku"
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
  tdd_guard_flush_note: "tdd-guard-vitest reporter flushes test.json ASYNC after vitest exits. MUST: (1) run FULL file not -t, (2) confirm grep '\"reason\"' test.json shows 'failed' in a SEPARATE bash call before the impl edit, (3) one impl increment per first-failing-assertion, (4) refactors only allowed when test.json shows 'passed'. Also: 2>/dev/null to hide pino logs; never run two vitest processes at once (resource-contention cascade failures)."
  current: T6 (getValidConditions Metadata API — chunk 2)
  preexisting_test_failures:
    - "apps/api/src/routes/__tests__/batch-enhance.test.ts (UNTRACKED — photo-gallery WIP, NOT in my commits): 4 failures, POST /images/batch-enhance returns 404 (route never implemented). Full api suite = 303 pass / 4 fail, all from this one file. Deferred to photo-gallery ship (ship-state_v89). When verifying my ship, exclude this file."
