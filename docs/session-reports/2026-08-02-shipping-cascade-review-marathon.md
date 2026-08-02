# Shipping Controls Ship, Reverb Category Cascade, and the Three-Agent Review — a Two-Day Marathon

**Span:** 2026-08-01 07:39 → 2026-08-02 14:02 ET · **PRs:** #274, #279, #280 merged; #276, #277, #278 open · **Tests:** 757 API / 569 web → **785 API / 590 web**

## Story

**Shipping controls landed end-to-end (PR #274, merged).** The cloud session's scaffold arrived as a `git am` patch; probe + VERIFY-FIRST dryrun matrix ran live (84 services — `USPSFirstClass` NOT deprecated, no `USPSGroundAdvantage`; 9/9 `Ack=Warning` proving flat/free/no-weight/handling shapes), then Phases 1–3 built TDD in-session: eBay flat/free builders (1 oz weight floor keeps dimensions — operator call), adapter `ebayShipping` + weight-gate skip + the `packageType`→`ShippingPackage` dead-end fix, publish-sheet Shipping section under the touched contract, scan-review ride-along via the extracted `ShippingFieldsSection`, listing-card inline shipping edit, Reverb profile/pickup overrides, 2-day services, and (PR #276, still open) the live-verified local-pickup add-on toggle — pickup-only is illegal on eBay, verified with two dryrun calls.

**Two live regressions surfaced and were fixed same-day.** The dead-end fix unleashed stored Inventory-API package enums (`MAILING_BOX`) raw into Trading XML — error 37 on publish; fixed with the live-verified `TRADING_SHIPPING_PACKAGE` translation map. And the operator's price edit hit the known "valid leaf category required" deferred item: the PATCH `/listings/:id` sync block was the only eBay write path without the categoryId self-heal (resolved categories are never persisted to listing rows, so any listing published outside the scan flow had a category-less row). Ported the `items.ts` heal (PR #279).

**eBay payment-hold context shaped the session.** The 7/26–28 OAuth incident put the seller account under a 30-day payment hold; a support/security email was drafted, then preserved as a resolved-status Docusaurus incident page (PR #277). API call discipline followed: 13 eBay calls total for all shipping verification, then zero.

**Reverb category program (PR #280, merged).** Live taxonomy pulled (320 categories, genuinely 4 levels deep, one leaf name containing " / "), published as four CSV artifacts, then: leaf-name-safe hierarchy in `getFlatCategories`, `product-types`/`subcategories`/`category-suggestion` endpoints, exact-first AI validation (`validateReverbAiFields`), the `ReverbCategorySection` cascade on the publish sheet + preview card (superseding the flat 320-option select), and publish-category pre-seeding so the sheet shows what will actually publish. Operator scan findings drove same-day AI-quality fixes: JSON-fragment finishes (`} "pitch"`) now sanitized, and the Donner-pitch-shifter→Guitar-Synths miscategorization fixed with a leaf-token semantic pick (title tokens vs. category leaf names, generic-word stopwording) slotted between verbatim match and majority search. The live listing and cache were healed to Octave and Pitch.

**The three-agent independent review** (operator-requested after the regressions): adapter-contract reviewer, general correctness reviewer, and a photo-race tracer. Six confirmed findings, all fixed: the photo-edit race (Reverb-published items make `PATCH /items/:id` slow via synchronous marketplace photo re-sync; tool saves rotate R2 keys; the key-anchored guard then errored — fixed with ref-guarded save serialization, display-array anchoring, index-slot fallback on key rotation, and preview reset), the category pre-seed clobbering an explicit reset, the shared `offersTouched` ref leaking eBay flips onto Reverb POSTs (pre-existing since PR #264), the weight-gate/builder asymmetry on unknown method values, silent $0.00 flat-rate listings (now `EBAY_FLAT_COST_REQUIRED` on both sides), and the dormant path-split bug in `searchCategories`.

**Operator UX corrections mid-flight:** local pickup restored as a panel toggle (not a select option), bump rate became a typed field, cascade pre-seeds the publish category.

## Learnings

- A "dead-end" data path is a mask, not dead code — wiring it up (packageType→ShippingPackage) surfaced an enum-domain mismatch that had been silently defaulted over for weeks.
- Marketplace-published items change the latency class of ordinary CRUD: `PATCH /items/:id` doing a synchronous Reverb photo re-sync turned instant saves into a multi-second race window the photo editor was never designed for.
- Reused ephemeral e2e stacks lie: accumulated items/drafts across proof reruns changed which item the specs drove, producing screenshots that contradicted passing class assertions. Deterministic proof requires a fresh stack per run.
- Token-count category matching fails on generic-word domains: "guitar/effects/pedals" tokens ranked a pitch shifter into Guitar Synths; the distinctive signal lives in title tokens hitting the category's LEAF name.
- The tdd-guard validator reads its reporter's test.json — red/green must run through `npm run test -w <app>` or compliant edits get rejected as premature.

## Insights

- Reverb's flat taxonomy is 4 levels deep (14/149/150/7) and one leaf name legitimately contains " / " — every full_name parser must anchor on the API's `name` field, never split naively.
- Verbatim-list AI selection + exact-match validation beats free-generation + token-search sanitization: the prompt asks for a list-verbatim full name, and a verbatim hit IS the resolution.
- The "touched contract" (nothing sent until explicit interaction; a seed counts as touched) needs per-marketplace touched state — shared refs leak intent across marketplace switches.

## Deferred

- Reverb sync refactor — NEXT SESSION (operator: current sync "has never been properly planned"; symptoms recorded in whats-next.md; Reverb API sync doc was mentioned but never attached).
- Reverb category scan-review ride-along + listing-card inline category edit.
- Persist healed categoryId back to rows on the PATCH sync path (review minor).
- `getAdapter` type width vs shared `MarketplaceType` (etsy-park artifact).
- Flaky CI test: seller-profile policy-cleanup ZIP guard (CI-only timing race).
