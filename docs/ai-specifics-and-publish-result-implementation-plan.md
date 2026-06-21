# AI-Filled eBay Specifics at Scan + Two-State Publish Result — Implementation Plan

**Branch:** `feat/ai-specifics-and-publish-result` (single feature branch)
**Source spec:** `docs/superpowers/specs/2026-06-20-ai-specifics-and-summary-panel-design.md` (user-authored)
**Ship:** Pre-Stage-3 fix batch (phase 4-build). **No part deferred. Commit + push each phase.**

---

## Context

Live testing hit two real failures, both rooted in the same gap — eBay item specifics (aspects) are collected only in transient listing-flow state and never persisted on the item:

1. **The aspects pop-up reappears at publish** asking for data the user already gave, because a publish from the item-detail sheet arrives with an empty aspect bag (the gate 422s).
2. **Silent `25002 BrandMPN` failures** — the adapter maps `product.mpn = item.model` (a model *name*, not a part number), which eBay rejects; the failure falls back to a silent draft.
3. **No publish-result feedback on the item-detail path** — `inventory/[id]/page.tsx:625` redirects to `/inventory` with no success/failure screen. The user can't tell what happened.

**Outcome:** AI fills required specifics (Brand, MPN, category aspects) at scan; they persist on `items.aspects` and carry into every publish path; the pop-up only ever appears for genuinely-missing data; publishing always shows an explicit success or draft-saved result.

---

## Verified facts that shape the build (from CodeGraph / Graphify exploration)

- **AI aspect-fill already exists** — `generateListingFields` in `lib/vision.ts` (`ListingFieldsOutputSchema.ebay.aspects`, prompt "Fill ALL required item specifics") is called from `prepare-listing.ts`. **Reuse it; do not rebuild.** Today its output is stored on the *listing* (`listings.marketplaceSpecificFields`), never the item.
- `items` has **no `aspects` column** (JSONB cols: photos, features, marketplaceData). Schema-push workflow (`drizzle-kit push`, no migration files).
- Gate = class `EbayAspectsRequiredError` (`ebay-adapter.ts:40-50`, code `EBAY_ASPECTS_REQUIRED`, 422), validates the aspect bag vs taxonomy-required only. `getRequiredAspects` at L1145.
- **MPN bug at TWO sites:** `ebay-adapter.ts:366` and `:628` both do `product.mpn = input.model`. Brand/Model seeded as aspect fallbacks (L391-392); MPN never seeded.
- `mergeItemShipping` (`listings.ts:35`) is the existing pattern to mirror for a new `mergeItemAspects`. Two publish paths call `createListing`: `POST /listings` and `POST /listings/:id/publish` (+ `PATCH /listings/:id`) — all need the merge.
- Scan review = one scroll column (`scan-flow.tsx:914-1322`); panel mounts at top of `px-4 space-y-4` (~L929). `handleSave` (L474-543) and `handleSaveAndList` (L545-605) both POST `/items` **without aspects** today.
- `publish-success.tsx` = single component toggling on `warning?`; rendered inline by hybrid/swipe/conversational flows. **`create-listing-sheet.tsx` does not render it** — `inventory/[id]/page.tsx:625` just `router.push("/inventory")`.
- **Tokens:** `--flow-accent`/`--flow-text` are per-flow *inline* vars, absent inside ScanFlow and CreateListingSheet. New panel + result screen must use **global** tokens: `--teal`, `--teal-soft`, `--orange`, `--orange-soft`, `--accent-error(-soft)`, `--accent-success(-soft)`, `--graphite`, `--text-primary/secondary`.
- MPN persistence: store in `aspects.MPN` (no separate column); adapter derives `input.mpn` from `aspects.MPN?.[0]`.

---

## Phase A — Vision: MPN + scan-time aspect fill

**Files:** `apps/api/src/lib/vision.ts`, `apps/api/src/routes/scan.ts`, `scan.test.ts`

- [ ] Add `mpn: z.string().nullable().optional()` + `aspects: z.record(z.string(), z.array(z.string())).optional().default({})` to `CandidateSchema`/`VisionResult` + `RecognitionCandidate` (shared).
- [ ] `DETAILED_SYSTEM_PROMPT`: instruct MPN = real part number from label/box/plate, else `null` (never the model name); update JSON example.
- [ ] `scan.ts` (`detail=full` path): after candidates, resolve eBay category for top candidate, `getRequiredAspects(categoryId)`, call existing `generateListingFields`, merge filled `ebay.aspects` into each candidate's `aspects`. Wrap in try/catch — **non-fatal** (empty aspects on failure; review-time resolution unchanged).
- [ ] Tests: mpn preserved through scan; `detail=full` returns `candidates[0].aspects`; fill failure non-fatal.

**Verify:** `npm run typecheck && npm run test:api -- scan`; `docker compose restart portage-api` (bind-mount); real scan returns `mpn` + `aspects`.
**Commit:** `feat(api/scan): mpn + scan-time aspect prefill`.

---

## Phase B — DB: `items.aspects` column

**Files:** `apps/api/src/db/schema.ts`, `packages/shared/src/types.ts`, `routes/items.ts`, `items.test.ts`

- [ ] `schema.ts` items: `aspects: jsonb('aspects').$type<Record<string,string[]>>().notNull().default({})` (existing rows → `{}`, no backfill).
- [ ] `Item` type: add `aspects?: Record<string,string[]>`.
- [ ] `createItemSchema`/`updateItemSchema`: add `aspects: z.record(z.string(), z.array(z.string())).optional()`; wire into POST insert + PATCH update.
- [ ] Tests: POST persists aspects; PATCH updates; default `{}` when omitted.

**Verify:** `npm run db:push` (review diff first) → confirm column + `{}` defaults in `db:studio`; `npm run build -w packages/shared`; `restart portage-api`.
**Commit:** `feat(api/items): aspects jsonb column + read/write`.

---

## Phase C — API: carry-through + fix MPN mapping  ⚠ fragile publish path

**Files:** `routes/listings.ts`, `marketplace/ebay-adapter.ts`, `packages/shared/src/marketplace.ts`, `listings.test.ts`, `ebay-adapter.test.ts`

- [ ] Add `mergeItemAspects(item, marketplaceSpecific)` to `listings.ts` mirroring `mergeItemShipping` — client-supplied aspects win key-by-key over `item.aspects` (so AspectFillSheet retry still overrides).
- [ ] Call it in **all three** publish paths: `POST /listings` (create+publish), `POST /listings/:id/publish` (draft), `PATCH /listings/:id` — right after `mergeItemShipping`.
- [ ] `CreateListingInput`: add `mpn?: string|null`. Derive `input.mpn` from `marketplaceSpecific.aspects?.MPN?.[0]` at the call sites.
- [ ] `ebay-adapter.ts` **L366 + L628**: `product.mpn = input.model` → `if (input.mpn) product.mpn = input.mpn`. Seed `aspects.MPN = [input.mpn]` (L392 area). Drop `input.model`-as-MPN entirely.
- [ ] Tests: item.aspects reaches adapter on all paths; client override wins; `product.mpn` from `input.mpn` not `input.model`; MPN unset when absent.

**Verify:** `npm run typecheck && npm run test:api -- "listings|ebay-adapter"`; `restart portage-api`.
**Commit:** `fix(api): carry item.aspects all publish paths + correct MPN mapping`.

### ⏸ HARD GATE (recommended) — live-publish verification before UI work

Deploy A–C, then publish a **real eBay item** (Brand+MPN set via PATCH): confirm (1) no `25002`, (2) no spurious aspect pop-up when item.aspects complete, (3) draft fallback (if any) surfaces a reason. Only proceed to D–F once the publish path is proven on the real account.

---

## Phase D — Web: persist aspects at save

**Files:** `apps/web/src/components/capture/scan-flow.tsx`, `scan-flow.test.tsx`

- [ ] `handleSave` + `handleSaveAndList`: add `aspects: buildAspects()` to the POST `/items` body (+ deps arrays).
- [ ] Tests: both handlers post aspects to `/items`; `{}` when empty.

**Verify:** `npm run typecheck`; web tests; `docker compose up -d --build portage-app`; scan→fill Brand→Save → `GET /items/:id` shows `aspects.Brand`.
**Commit:** `feat(web/scan): persist aspects on item at save`.

---

## Phase E — Web: `AiIdentificationPanel`

**Files:** `apps/web/src/components/capture/ai-identification-panel.tsx` (new) + test, `scan-flow.tsx`, `scan-flow.test.tsx`

- [ ] New pure-display component at top of review (above PhotoGalleryStrip, ~L929): collapsed = `name · category · $price` + status pill (`✓ Ready` / `N to confirm` / error); expanded = candidate tabs (if >1), inline-editable Brand/MPN/required aspects with one-tap "Does Not Apply" for MPN, collapsible "Why Porter chose this" (reasoning). Three-state visuals: AI-suggested `--teal-soft`+`[AI]` → confirmed `bg-surface`+✓ → missing `--accent-error` border. Auto-expand when Brand/MPN missing. **Global tokens only.**
- [ ] Replace the inline candidate selector + "Why this identification?" blocks (L940-990) with the panel; retheme `aspect-fill-sheet.tsx` off legacy forest-green to DHG tokens (folded in, not deferred).
- [ ] Tests (one at a time): selected candidate + confidence; tabs hidden when 1 candidate; reasoning collapse; missing-required auto-expand; "Does Not Apply" sets MPN.

**Verify:** typecheck; web tests; `--build portage-app`; visual scan check.
**Commit:** `feat(web): AiIdentificationPanel summary at scan review`.

---

## Phase F — Web: two-state publish result + item-detail screen

**Files:** `publish-success.tsx` + test, `create-listing-sheet.tsx` + test, `app/inventory/[id]/page.tsx`

- [ ] Split `publish-success.tsx` into two explicit states (spec copy):
  - **Success:** teal ✓, **"You're live on eBay"**, `name · condition · $price`; CTAs **View listing** (→ `/listings/{id}`) · **List another** · **Go to Inventory**.
  - **Draft-saved (failure):** orange ⚠ (not error-red), **"Saved as draft — couldn't publish yet"**, orange-soft callout with the **verbatim eBay reason** (`warning`) + "Fix this detail to publish"; CTAs **Fix and re-publish** (→ item edit/setup with aspect sheet auto-opened) · **Go to Inventory**. No "List another", no ambiguous "Cancel".
  - All global tokens (no `--flow-accent`).
- [ ] `create-listing-sheet.tsx`: capture `{ id, warning }` from create; render the result screen in-sheet instead of immediately closing. Add `itemTitle`/`itemPhotoUrl` props.
- [ ] `inventory/[id]/page.tsx`: pass title/photo; make `onCreated` a no-op (sheet owns the result screen; "Go to Inventory" CTA does the redirect).
- [ ] Tests: success renders 3 CTAs; draft renders warning + "Fix and re-publish", no "List another"; create-listing-sheet shows result screen on success and on draft-fallback; tokens are global not flow-accent.

**Verify:** typecheck; web tests; `--build portage-app`; **two manual paths** — (1) HybridFlow publish, (2) item-detail Create Listing publish — both show correct success/draft screen on iPhone.
**Commit:** `feat(web): two-state publish result + item-detail result screen`.

---

## Cross-cutting risks

- **Schema push is live + irreversible** — push (`.default({})`) BEFORE C/D code deploys; if push fails, don't deploy B.
- **Miss a publish path** → draft items publish without aspects. Phase C tests cover all three paths explicitly.
- **`product.mpn` fix at L628** clears MPN on update if PATCH callers don't pass `input.mpn` — defensively keep prior value when `input.mpn` absent on the update path.
- **tdd-guard scope** is disputed (memory says apps/web exempt; config exempts only aifactory). Treat web as logic-test + run-the-app gated regardless; verify `test.json` freshness with `npm run test -w apps/api` for API phases.

---

## Critical files

`apps/api/src/lib/vision.ts` · `apps/api/src/routes/listings.ts` · `apps/api/src/marketplace/ebay-adapter.ts` · `apps/api/src/db/schema.ts` · `apps/web/src/components/capture/scan-flow.tsx` · `apps/web/src/components/listing/create-listing-sheet.tsx` · `apps/web/src/components/listing-flow/publish-success.tsx`

---

## End-to-end verification (whole feature)

Scan a real item (`detail=full`) → AI panel shows filled Brand/MPN/aspects → confirm/correct → Save → reopen item: aspects persisted. Create Listing (item-detail) → publishes with **no aspect pop-up**, **no 25002** → **"You're live on eBay"** with working CTAs. Force a failure (missing required aspect) → **"Saved as draft"** screen shows the eBay reason + "Fix and re-publish". Repeat via HybridFlow. All on iPhone against the real eBay account, both containers rebuilt.
