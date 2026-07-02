# Portage — eBay Trade-First Refactor: Burndown

**Updated:** 2026-06-30 (end of session 3)
**Branch:** `feat/phase-f-publish-unification`
**Status:** Epic 1 (Trade-First) **COMPLETE + LIVE-PROVEN** (api 531 green, typecheck+lint clean; commit `6dc63fe`). Full lifecycle ran live on eBay `sdnydude@me.com`: publish→`AddFixedPriceItem` (ItemID 307034773471), price edit→`ReviseFixedPriceItem`, archive→`EndFixedPriceItem`. Remaining open items: 1.17, 1.19, 1.20 (housekeeping) + Epic 2 backlog.

This is the canonical execution queue. **The next session's FIRST action is an independent
adversarial review** that must: (1) verify each task below is real and correctly stated,
(2) verify the ORDER is correct (dependencies sound), and (3) verify WHY each is necessary
(challenge any task that isn't). Treat the order/rationale columns as claims to be falsified,
not accepted.

**Legend:** ✅ done · 🔄 in progress · ⬜ not started · 🚫 deferred/dropped · 🔑 needs Stephen

---

## Epic 1 — eBay Trade-First refactor (Inventory API → Trading API, in place)

| # | Task | Status | Depends on | Why necessary | Proof / Done-when | Risk |
|---|------|--------|-----------|---------------|-------------------|------|
| 1.1 | Opt account OUT of Business Policies | ✅ | — | Inline terms are rejected by eBay if the account is opted IN (`SellerProfileOptedIn`); also removes the Stage-3 nav-trap | Account API before=opted-in → after=none | done |
| 1.2 | Trading XML builders (Add/Revise/ReviseInventoryStatus/End/Get) + parsers | ✅ | — | Transport primitives for every listing op; replace Inventory JSON | 10 unit tests; schema-fixed `da5d8e1` | done |
| 1.3 | Pure mappers `splitOunces`, `resolveEbayConditionId` | ✅ | 1.2 | oz→lbs+oz split + numeric ConditionID (N2) for Trading | 12 unit tests | done |
| 1.4 | `VerifyAddFixedPriceItem` builder | ✅ | 1.2 | Enables a live dry-run that validates the payload without creating a listing | unit test `66752ae` | done |
| 1.5 | `createListing()` → AddFixedPriceItem | ✅ | 1.2,1.3 | The core publish path; single call replaces inventory_item→offer→publish | api 531 green `1a74b59` | done |
| 1.6 | createListing Trading test coverage restored | ✅ | 1.5 | Re-express adapter control-flow coverage (gate, best-offer downgrade, weight guard) post-migration | `0e27ebe` | done |
| 1.7 | Publish route: origin-ZIP inject + `ebay_draft`→DB-only (N1) | ✅ | 1.5 | Trading needs OriginatingPostalCode; no unpublished-offer concept so eBay-draft = local draft | api 537 green `3536ff2` | done |
| 1.8 | Live Verify dry-run (structural validation) | ✅ | 1.4,1.7 | Prove eBay accepts the payload STRUCTURE before risking a live listing (live-only proof) | `51a849a`: Ack=Failure with ONLY missing-aspect errors, zero structural errors | done |
| 1.9 | **Rebuild `portage-api` container** | ✅ | 1.5–1.7 | Running container had OLD Inventory code; live proof needs the new code deployed | `docker compose ps` healthy; Trading calls observed in logs | done (Milestone A + B) |
| 1.10 | **Live publish proof** (real AddFixedPriceItem) | ✅ | 1.9 | The actual proof-of-done: eBay creates a real listing from our payload | done: ItemIDs 307034606520 (A) + 307034773471 (B), prefix `3`, active, no dup row | done |
| 1.11 | `getListingStatus()` → `GetItem` | ✅ | 1.2 | Status reads (active/sold/ended) must leave Inventory; F-GATE route depends on it | `parseGetItemStatus` + GetItem call; unit-covered; `6dc63fe` | done |
| 1.12 | `getEbayItemVerification` / F-GATE route → `GetItem` | ✅ | 1.11 | Verification read-back path used Inventory inventory_item/offer | new `parseGetItemVerification`; route keys on ItemID, no-ItemID→found:false; `6dc63fe` | done |
| 1.13 | `updateListing()` → Revise dispatch | ✅ | 1.5 | Price/qty edits + content edits to a live listing; price/qty→ReviseInventoryStatus, else ReviseFixedPriceItem. Folds in **F6** (shared `buildTradingInput`) | **live: price edit → `ReviseFixedPriceItem`** (PATCH sync re-sends full item body, so even a price change takes the content path); unit-covered both branches; `6dc63fe` | done |
| 1.14 | `deleteListing()` → `EndFixedPriceItem` | ✅ | 1.5 | Archive/end a live listing (Inventory withdraw path is gone) | live: archive 307034773471 → `EndFixedPriceItem`, DB archived; `withdrawOffer` removed; `6dc63fe` | done |
| 1.15 | Bulk publish/activate → Trading | ✅ | 1.13,1.14 | Bulk ops called Inventory `bulkPublishOffers` | dropped `bulkPublishOffers`; bulk-activate blocks eBay drafts w/ actionable "publish individually" warning (G6); `6dc63fe` | done |
| 1.16 | Idempotency: insert-row-first (null ItemID) + unique key (R3/G5) | ✅ | 1.5 | AddFixedPriceItem is non-idempotent — a retry double-lists | insert-first + partial unique `(userId, idempotencyKey)`; col+index live in DB (Milestone A) | done |
| 1.17 | GTC / no-auto-renewal reconciliation (G7) | ⬜ | 1.10 | Where eBay forces GTC, prevent silent fee-incurring renewals (detect + auto-end/notify) | per-category ListingDuration resolved; renewal job or documented N/A | med |
| 1.18 | `request()` error-sanitization coverage re-add | 🚫 obviated | 1.13 | Premise was "re-add against updateListing (still REST)" — but updateListing is now Trading (`callTradingApi`), not REST. `request()` only serves Browse/Taxonomy/Orders/getValidConditions now | n/a (revisit if a REST write path returns) | — |
| 1.19 | Verify pre-flight wiring decision (per-publish vs proof-only) | ⬜ | 1.10 | Decide whether every publish dry-runs first (extra call) or Verify is proof-only | documented decision + (if wired) test | low |
| 1.20 | Remove dead Inventory helpers once unreferenced | ⬜ | 1.11–1.15 | After Milestone B: `isOfferExistsError` + `bestOfferTerms` private statics now dead; `resolveEbayCondition`/`resolveEbayCategoryCondition` exported-but-unused in adapter; inert `listings.ebayOfferId` DB column | grep shows no references; deleted | low |

## Epic 2 — Publish/listing UX phases (broader backlog)

| # | Phase | Status | Depends on | Why necessary | Proof / Done-when | Risk |
|---|-------|--------|-----------|---------------|-------------------|------|
| 2.1 | E — AiIdentificationPanel (`[AI]` aspect confirm) | 🚫 superseded | — | Decision 2026-07-01: inline `[AI]` auto-fill + chips (PR #132) is the consumer of AI-suggested aspects; a separate confirm panel would duplicate the UX. Plan-doc PR #126 closed unmerged. | n/a | — |
| 2.2 | F — Unify publish panels + price/terms + 2-state result | ✅ | — | Done F0–F4 / PR #132 (UI). Transport now superseded by Epic 1 | shipped | done |
| 2.3 | F6 — `updateListing` aspect-normalize parity | ✅ | 1.13 | updateListing set aspects raw — a scalar/null could reach eBay on edit | folded into 1.13: `buildTradingInput` (normalizeAspects + required-aspect gate) is the single shared path for create + content-revise; `6dc63fe` | done |
| 2.4 | F2 / F9 — prepare-listing malformed-aspect guard / enum filter | ⬜ | — | Low: present-but-malformed aspect throws 502; AI value not checked vs enum | guard or comment fix; enum filter | low |
| 2.5 | G — "Save & List" lists LIVE (not silent draft) | ⬜ | 1.10 | Scan Save&List defaults to draft; defeats "List" expectation | Save&List w/ live → active eBay listing | med |
| 2.6 | H — Orders sync (broken weeks) | ✅ | 1.10 | TWO layers: (1) no auto-trigger + swallowed errors; (2) REAL blocker — orders for listings not in local DB (wiped during live proof) were skipped at warn-level, never imported | DONE: errors[] surfacing + login-trigger + Sync button (layer 1); GetItem backfill creates item+listing per eBay ItemID for orphan orders, lineItem-title fallback, in-run dedup (layer 2). LIVE PROVEN: synced:11 (7 items/listings, no dupes); orders page shows NEEDS SHIPPING (11). api 538 green, typecheck/lint clean, 4 e2e green. Branch fix/orders-sync-diagnosis | done |
| 2.7 | I — Remove in-app carriers → eBay shipping policy | ⬜ | — | Carrier integration deferred; rely on eBay policy. Remove stubbed rates/labels carefully | no in-app carrier rates/labels; weight/dims + policy intact | med (scope) |
| 2.8 | Stage 3 — eBay-setup nav-trap | 🚫 obviated | 1.1 | Removed by inline terms + opt-out (no EBAY_SETUP_REQUIRED) | n/a | — |

## Epic 3 — Deferred / smaller

| # | Item | Status | Why necessary (or why deferred) | Notes |
|---|------|--------|-------------------------------|-------|
| 3.1 | Seller-configurable inline shipping/return fields | 🚫 low | Trade-First ships fixed defaults to stay shippable; promote to seller settings later | from seller_profiles/shipping_presets |
| 3.2 | Carrier label integration (EasyPost/Shippo) | 🚫 | Superseded by Phase I removal | mock rates today |
| 3.3 | Camera-driven scan→save Playwright e2e | ✅ | Proves Phase E end-to-end without real camera | `camera-scan-save.spec.ts` (2026-07-01): canvas.captureStream getUserMedia polyfill (plain-HTTP :3002 has no mediaDevices), mocked /scan/refine + /images + taxonomy reads, REAL /items save asserted after reload, cleanup delete |
| 3.4 | Type AI auto-pick on high-cardinality aspects | ✅ | Best-effort prompt shipped; AI-dependent | `aspect-pick.ts` (2026-07-01): deterministic constrained second pass inside generateListingFields — unfilled/out-of-enum required enum aspects re-asked one cheap text call, picks validated + canonical-cased, never throws; 6 tests |
| 3.5 | SKU "Custom label" Seller-Hub check | ✅ | Confirm SKU shows in Seller Hub | Live GetItem 2026-07-01: 307034606520 → SKU `PRT-000016`, 307034773471 → `PRT-000017` (Seller Hub "Custom label" IS the Trading SKU field); probe-sku-getitem.ts |

---

## Open decisions / flags for the adversarial review to scrutinize
- **Order 1.9→1.10 vs coding Phase 2/4 first:** is the live proof correctly prioritized before update/delete, or should the full adapter be Trading-complete before any live call? Challenge.
- **1.16 Idempotency placement:** is insert-row-first needed BEFORE 1.10 (live proof) to avoid a dup on retry, i.e. should 1.16 move before 1.10? Likely yes — review.
- **Verify pre-flight (1.19):** dry-run on every publish adds latency + a credit/call cost; proof-only may suffice. Decide.
- **tdd-guard friction:** atomic refactors fight the guard (edit-red-test block). Pattern used: delete-obsolete-then-readd + git-checkout reset. No bypasses used this session.
