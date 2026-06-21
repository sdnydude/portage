# AI-Filled eBay Specifics at Scan + Identification Summary Panel

**Date:** 2026-06-20
**Status:** Design — pending user approval
**Owner:** Stephen Webber
**Context:** Pre-Stage-3 fix batch. Live test hit eBay publish failure `25002 "Input data for tag <BrandMPN> is invalid or missing"`, and the required-aspects pop-up re-appears at publish because collected specifics are not carried to the publish call.

## Problem

1. The scan AI extracts `brand`/`model` but **no MPN and no item-specifics (aspects)**.
2. At publish the adapter maps `item.model → product.mpn` (a model *name*, not a part number), which eBay rejects → `25002 BrandMPN`.
3. The pre-publish aspects gate validates only the taxonomy aspect bag, **not** `product.brand`/`product.mpn`, so `BrandMPN` slips past the gate and fails at the eBay write — surfacing as a **silent draft fallback**.
4. Collected aspects live only in transient listing-flow state (`listings.marketplaceSpecificFields`), **not on the item**, so a publish from the item-detail sheet arrives with empty aspects → the gate 422s → the **aspects pop-up reappears** asking for data the user already provided.

## Goals

- The AI fills the required eBay specifics (real **Brand** + **MPN** + category aspects) **during scan**, so listings are publish-ready.
- Specifics persist on the item and are **carried into every publish path**; the aspects pop-up only ever appears for genuinely-missing required data.
- A publish can **never fail silently** — a missing Brand/MPN is a typed, collectable error, and every draft fallback surfaces its reason.
- A **collapsible identification summary panel** at the top of scan setup shows the AI's selections + reasoning and lets the user correct anything (user edits are authoritative over AI).
- **No part deferred.**

## Non-Goals

- No change to Etsy/Reverb adapters.
- No broader scan-flow redesign beyond adding the panel and the specifics fill.

---

## Design

### A. AI extraction — add MPN + aspects at scan

- Extend the vision output schema (`apps/api/src/lib/vision.ts`) to emit **`mpn: string | null`** (legible part number, else `null`) in addition to existing `brand`/`model`. Prompt: emit MPN only when actually legible on a label/box/plate; otherwise `null`.
- After the category resolves in scan-review, run the existing AI aspect-fill (today in `/prepare-listing`'s `generateListingFields`) to populate the category's **required aspects**, including `Brand` and `MPN`. This replaces, not adds to, the later prepare-listing call.
- Downstream defaults: empty Brand → `"Unbranded"`; `null`/empty MPN → `"Does Not Apply"` (eBay-accepted). User can override both.

### B. Persist specifics on the item (new source of truth)

- Add **`items.aspects` JSONB** (`Record<string, string[]>`) via Drizzle schema-push. Holds the confirmed item specifics (Brand, MPN, Color, Type, …). `items.brand` stays for back-compat; MPN and the rest live in `aspects`.
- Written when the user confirms at scan save and at item edit. Update `PATCH /items` + `POST /items` and the web item types to read/write `aspects`.

### C. Carry-through to every publish path

- `POST /listings` already accepts `marketplaceSpecificFields`. The adapter (`createListing`) merges, in priority order: explicit per-publish aspects → **`item.aspects`** → AI fallback (`brand`/`model`). User-supplied values always win.
- Map to eBay correctly: `product.brand ← aspects.Brand`, `product.mpn ← aspects.MPN` (NOT `item.model`), `product.aspects ← merged aspects`.
- All four publish entry points (`create-listing-sheet.tsx`, `use-listing-flow.ts`, and the three flows) rely on the merged `item.aspects` so the data is present regardless of path.

### D. Publish-time guard (no silent 25002)

- Extend the pre-publish gate in `createListing` so missing/empty **Brand or MPN** (after merge) throws the typed **`EbayAspectsRequiredError` (422 `EBAY_ASPECTS_REQUIRED`)** with Brand/MPN included in the missing list — collectable via the aspect sheet — instead of reaching eBay and returning a silent `25002` draft.
- Every draft-fallback response returns a `warning`; every publish UI renders it (`create-listing-sheet`, `PublishSuccess` across flows). No path swallows the reason.

### E. Frontend — `AiIdentificationPanel`

- New component `apps/web/src/components/capture/ai-identification-panel.tsx`, hosted at the **top of the ScanFlow review** state; a `readOnly` variant reused on `/inventory/[id]/edit`.
- Reuses the existing `ScanAspectsSection` collapsible shell and the `useScanAspects` hook (no new state/API). Consumes the `reasoning` already in scan-flow state.
- **Collapsed:** `name · category · $price` one-liner + status pill (`✓ Ready` / `N to confirm` / error). **Expanded:** item/category/price (display, tap-to-scroll to existing inputs) + inline-editable **Brand, MPN, required aspects**, one-tap **"Does Not Apply"** for MPN, and a collapsible **"Why Porter chose this"** reasoning section (replaces the standalone "Why this identification?" button).
- **Three-state visual language:** AI-suggested = `--teal-soft` bg + `[AI]` badge → user-confirmed = plain `bg-surface` + ✓ → missing = `--accent-error` border. Auto-expands when Brand/MPN missing (same trigger as `ScanAspectsSection`).
- Uses current **DHG tokens** (teal/orange/graphite). Also **retheme `aspect-fill-sheet.tsx`** off the legacy forest-green classes (folded in, not deferred).

### F. Publish result screen (success / draft) — no silent outcomes

The current `publish-success.tsx` toggles icon/heading off a single `warning` prop. Split into **two named render states** (success vs draft-saved) so the outcome is unambiguous. Used by every publish path now (create-listing sheet + three flows); later reused as wizard Step 5.

- **Success:** photo hero, teal ✓ (spring-in), heading **"You're live on eBay"**, subline `name · condition · $price`. CTAs: **"View listing"** (primary, → eBay/listing detail), **"List another"** (secondary), **"Go to Inventory"** (text link).
- **Draft-saved (publish failed — backend always saves a draft):** photo hero (40% dim), orange ⚠, heading **"Saved as draft — couldn't publish yet"**, subline **"Couldn't publish to eBay"**, an orange-soft callout showing the **verbatim eBay reason** (the `warning`) + "Your item is saved. Fix this detail to publish." CTAs: **"Fix and re-publish"** (primary, → back to the item's edit/setup with the aspect sheet auto-opened on the missing field), **"Go to Inventory"** (text link). No ambiguous "Cancel".
- Tokens: teal for success, orange-soft for draft (not error-red — a draft is recoverable, not a catastrophe). 44pt targets, sticky CTAs, safe-area insets.

### G. Data flow

```
Scan photo → vision: name, brand, model, mpn, category
   → resolve eBay leaf category
   → AI fill required aspects (Brand, MPN, Color, …) → aspectValues
   → AiIdentificationPanel (confirm/correct) → save → items.aspects (+ brand)
Publish (any path) → POST /listings (item.aspects merged)
   → adapter: product.brand/mpn/aspects from merged set
   → gate: Brand/MPN/required present? no → 422 (collect) ; yes → publish
   → fail → draft + warning surfaced (never silent)
```

## Error handling

- Missing Brand/MPN/required aspect at publish → `422 EBAY_ASPECTS_REQUIRED` (collect via sheet, retry).
- eBay publish failure for any other reason → draft saved + `warning` surfaced in UI.
- AI aspect-fill failure at scan → panel shows fields empty/seeded best-effort; never blocks scan save; backstop sheet still catches at publish.

## Testing (no deferral)

- **API (Vitest):** vision schema includes `mpn`; `createListing` maps `product.mpn` from `aspects.MPN` not `item.model`; gate throws 422 when Brand/MPN missing; `item.aspects` merge precedence (user > item > AI); draft-fallback returns `warning`.
- **Web (logic):** panel AI-suggested vs user-confirmed state; "Does Not Apply" sets MPN; carry-through — publish reads `item.aspects`; aspect sheet only fires for still-missing aspects; publish-result renders success vs draft-saved by outcome and shows the eBay reason on draft.
- **Web (Gate-2 e2e, rebuilt container):** scan → confirm specifics → publish path asserts no redundant aspect prompt when item.aspects complete; publish failure shows the "Saved as draft" screen with the reason; assert reload persistence.

## Rollout

Single feature branch. Drizzle `db:push` for `items.aspects`. Rebuild `portage-api` (bind-mount) + `portage-app`. Verify on iPhone.

## Follow-on (separate spec, not this one)

The progressive-disclosure **5-step listing wizard** (Photos → Identify & Confirm → Price → Shipping → Publish Result), for small-device usability, is **spec #2** — sequenced after this fix ships (user decision 2026-06-20: "fix first, then wizard"). It imports `AiIdentificationPanel` as Step 2 and the publish-result screen (section G) as Step 5 — both built here are composable into it. This spec is independently complete and ships first because it unblocks live publishing (25002 / silent-failure).
