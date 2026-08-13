# Category Mismatch Guard — Implementation Plan

**Date:** 2026-08-13 · **Status:** APPROVED (operator, 05:23 ET, Tier 2 in) — build complete, PoD in progress
**Trigger incident:** eBay Taxonomy suggested "Baseball Jackets" (leaf 181335, Clothing tree) for a fiber-optic audio cable title; scan-flow silently saved it as the item's category and cached it for publish (2026-08-10 item, discovered 2026-08-12 during Porter PoD).

## Problem

Scan review auto-resolves the eBay category from the item title (500ms debounce, `use-scan-aspects.ts:106-162`), accepts eBay's **top-1 suggestion with zero sanity check**, shows it only in a passive read-only text box among ~15 fields, and Save persists it unconditionally (`scan-flow.tsx:590/648`). A wildly wrong suggestion is undetectable anywhere in the pipeline. The vision scan's own coarse category ("electronics") is sitting in memory at that exact moment and is never cross-checked.

The edit page already solved this class with a `categoryUserResolved` confirm gate (`inventory/[id]/edit/page.tsx:140`) — scan-flow never got it.

## Design (Approach A — server mismatch flag + client banner)

Chosen over a client-only keyword heuristic (B: brittle, protects nothing server-side) and an alternate-category picker (C: extra metered Taxonomy calls, drifts toward "app decides the category," which the taxonomy-is-truth decision forbids).

Mechanism:

1. `EbayAdapter.getCategorySuggestion` already receives `categoryTreeNodeAncestors` in the eBay response and throws it away (`ebay-adapter.ts:1208-1240`; sibling `searchCategories:1076` proves the field exists). Parse it — return `rootCategoryId`/`rootCategoryName` alongside the leaf. Zero extra API calls.
2. New static table `VISION_CATEGORY_TO_EBAY_ROOTS`: each of the 14 vision enum values → the *set* of plausible eBay top-level category IDs (multiple roots per value — `music` includes Clothing for band merch). Used ONLY to compute a boolean; never a category source. Does not resurrect the deprecated internal taxonomy.
3. `GET /marketplace/ebay/category-suggestion` accepts optional `visionCategory` param; responds `{ suggestion, mismatch }`. **Fail open** on every uncertain input: param absent, vision value not in table, ancestors empty, API error → `mismatch: false`. Vision category is `z.string()` not `z.enum` — unknown strings must never throw.
4. `resolveEbayCategoryId` (publish-time self-heal) computes the same flag but only warn-logs (no user present).
5. Client: `useScanAspects` passes the scan candidate's vision category, exposes `mismatch`; scan-flow renders a dismissible warning banner above the Category field — "eBay filed this under **Clothing › Baseball Jackets**, but it scanned as **electronics**. Double-check before saving." Actions: **Use anyway** (dismiss) / **Find different category** (focuses the existing `categorySearch` control). Save is never blocked — advisory only, matching the codebase's `warnings: string[]` convention.

## Scope tiers (operator decision required)

- **Tier 1 — live scan session** (the incident surface): items 1-5 above. No schema change.
- **Tier 2 — persisted vision category**: store the scan's coarse category on the item (`marketplace_data.scan.visionCategory`) so the edit page and publish-time self-heal can also compute mismatch for items scanned before the guard, or re-resolved later. +1 JSONB write site, no new column (JSONB merge pattern exists). Without Tier 2, a stale item republished via self-heal gets only a server log, never a user-facing check.

Per rule 00: Tier 2 is NOT silently deferred — it ships with Tier 1 unless the operator explicitly approves splitting it out.

## Task list

### Phase 1 — adapter (TDD, one test per write)
- [x] 1.1 Test: `getCategorySuggestion` parses `categoryTreeNodeAncestors` → `rootCategoryId`/`rootCategoryName` — red
- [x] 1.2 Implement ancestor parsing — green
- [x] 1.3 Test: `isPlausibleRoot()` true for mapped root — red; implement table + helper — green
- [x] 1.4 Test: fail-open — unknown vision value returns plausible (no mismatch) — green loop
- [x] 1.5 Test: fail-open — missing/empty ancestors returns plausible — green loop
- [x] 1.6 Test: `resolveEbayCategoryId` warn-logs on mismatch, still returns eBay's id unchanged — done as part of 4.3 (needs the Tier-2 persisted vision category)

### Phase 2 — route (TDD)
- [x] 2.1 Test: `/category-suggestion?visionCategory=electronics` returns `mismatch: true` for clothing-root suggestion — red; implement — green
- [x] 2.2 Test: omitted `visionCategory` → `mismatch: false` — green loop
- [x] 2.3 Test: response keeps existing `suggestion` + `conditionIds` shape untouched (regression pin) — green loop

### Phase 3 — web hook + UI
- [x] 3.1 `use-scan-aspects`: pass `visionCategory`, expose `mismatch` (+ test)
- [x] 3.2 scan-flow: banner render on mismatch (+ test)
- [x] 3.3 scan-flow: "Use anyway" dismiss + "Find different category" focus action (+ test)
- [x] 3.4 Banner clears when user manually resolves a different category (+ test)

### Phase 4 — Tier 2 persistence (unless operator splits it out)
- [x] 4.1 scan-flow save paths write `marketplace_data.scan.visionCategory` (atomic JSONB merge pattern, decision_api_atomic_jsonb_merge)
- [x] 4.2 Edit page: seed `visionCategory` from item's persisted value, banner works there (+ test)
- [x] 4.3 Self-heal path reads persisted value when live scan state absent (+ test)

### Phase 5 — verification (PoD)
- [x] 5.1 `npm run test:api` + web tests + typecheck + lint all green
- [x] 5.2 Containers rebuilt; live banner proven on edit page — real eBay suggestion (Coats, Jackets & Vests root 11450) vs scanned electronics; screenshot delivered
- [x] 5.3 Same item auto-resolve (Audio Cables & Interconnects root 293) — mismatch:false, no banner; screenshot delivered
- [x] 5.4 3 screenshots delivered; mismatch flags verified against live endpoint responses + seeded scan.visionCategory rows
- [ ] 5.5 Commit/push/PR — per-action approval each

## Risk analysis & mitigation

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R1 | False positives — legitimately surprising-but-correct categories (band-merch tee under Clothing from a `music` scan) train users to dismiss the banner | Medium | Banner fatigue, guard ignored | Multi-root sets per vision value; `other` suppresses the check entirely; advisory-only (never blocks); 5.3 live false-positive check before ship |
| R2 | Mapping table wrong/stale (eBay renumbers roots) | Low (top-level IDs are years-stable) | Over-warn or missed catch — never a wrong category, since the table can't alter the categoryId used | Table maps to root IDs only (~20 stable values); worst case equals today's zero-detection baseline; unknown root → fail open |
| R3 | Vision category garbage (schema is `z.string()`, enum is prompt-convention only) | Medium | Guard crash would break scan review | Fail-open contract tested explicitly (1.4/1.5); unknown string = no check |
| R4 | eBay ancestors field missing/shape drift | Low | Flag silently absent | Fail open + regression-pinned response shape (2.3); behavior degrades to today's baseline, not worse |
| R5 | Publish-path interaction — aspects fetch and Best-Offer pre-flight are keyed on categoryId | — | Would be high if we auto-swapped categories | Design never substitutes the categoryId; boolean rides alongside. Approach C rejected specifically for this |
| R6 | Extra Taxonomy API usage (metered, `ebayTaxonomyCalls` counter) | None | — | Ancestors ride the existing response; zero new calls |
| R7 | Suggestion endpoint latency on review screen | None | — | No second fetch; parse only |
| R8 | Tier 2 JSONB write races concurrent item updates | Low | Lost update | Reuse atomic single-statement JSONB merge (decision_api_atomic_jsonb_merge) |

## Out of scope (named, not silently dropped)

- Multi-candidate category picker from eBay's ranked list (`searchCategories` already returns it) — Approach C territory; revisit only if banner-dismissal telemetry shows repeated wrong-category saves.
- Backfill audit of existing items for absurd categories (one-off query, could run any time on request).

Both are listed for operator awareness; neither is approved-deferred until Stephen says so per item.
