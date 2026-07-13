# Photo Reorder + 24-Photo Cap — Design Spec

Date: 2026-07-13. Status: **approved by Stephen** (combined ship; grid sheet + strip drag UX; reuse home-grown drag pattern).
Companion research: `docs/research/2026-07-13-video-tooling-and-marketplace-limits.md` (marketplace photo caps verified there).

## Goal

1. Drag photos into a different order everywhere photos are managed (scan flow, item edit, listing flows). Order persists to the item and carries to marketplace publish — first photo = hero image on eBay.
2. Raise the photo limit from 12 to 24 end to end: capture/upload UI, validation, storage, publish. Cap at the lower of ours vs each marketplace's max.

## Current state (verified in code 2026-07-13)

- **Reorder already exists in listing flows**: `apps/web/src/components/listing-flow/photo-grid.tsx` implements long-press (500ms) pointer-drag reorder (`onPointerDown`/`onPointerEnter` drop targets, no library). Live in all three listing flows via `PhotoCaptureOverlay` → `PhotoCaptureFlow` → `PhotoGrid` (`handleReorder` at photo-capture-flow.tsx:298).
- **No reorder** in scan flow or item edit (`inventory/[id]`); both render `capture/photo-gallery-strip.tsx` (horizontal 78px strip, COVER badge on index 0, tap-to-edit).
- Photo cap is a hardcoded literal `12` in five places: `capture/scan-flow.tsx:53` (`MAX_PHOTOS`), `app/inventory/[id]/page.tsx:391`, `listing-flow/{swipe,conversational,hybrid}-flow.tsx`, plus `photo-capture-flow.tsx` default param (`maxPhotos = 12`). No shared constant.
- Order is canonical as array order in `items.photos` JSONB; eBay publish builds `<PictureURL>` list in array order (`ebay-trading-builders.ts:42`); Reverb adapter maps `photos` array in order and already sets the replace/reorder flag on update (`reverb-adapter.ts:117,168-170`).
- Marketplace caps (verified from official docs): **eBay 24** PictureURLs (HTTPS, ≥500px longest side, total of all URL strings ≤3975 chars, first URL = Gallery/hero image), **Reverb 25** (help-center policy; API doc silent).

## Design

### 1. Reorder interaction — reuse the home-grown pattern, no new dependency

- Extract PhotoGrid's long-press pointer-drag mechanism into a shared hook `use-photo-drag` (apps/web/src/hooks/). PhotoGrid refactors onto the hook (behavior unchanged).
- **New `PhotoManageSheet`** (apps/web/src/components/capture/): full-screen sheet, 3-column grid (scrolls; scales to 24 photos), long-press drag reorder via the hook, COVER badge on index 0. Opened from the `PhotoGalleryStrip` header — "Photos · N" label becomes a tappable affordance.
- **Strip drag**: `PhotoGalleryStrip` thumbs also get direct long-press drag (same hook, horizontal axis) for quick 2–5 photo swaps without opening the sheet.
- Rejected alternative: dnd-kit (better animations/auto-scroll, but a new dependency replacing working in-house code). Revisit only if the home-grown pattern feels bad at 24 photos.

### 2. Persistence

- Order lives where photos already live: the host's photos array; `items.photos` array order is canonical.
- Scan flow: local state pre-item; order carries into item create (no new persistence).
- Item edit (`inventory/[id]`): PATCH item with reordered photos array on drop, via the existing item update path (auto-save, no explicit save button — matches existing auto-draft behavior).
- Listing flows: existing `useListingFlow` state + draft persistence, already wired through PhotoCaptureFlow's reorder.
- Items with live listings: reorder rides the existing item edit-sync — eBay `ReviseFixedPriceItem` re-sends `PictureDetails` in new order; Reverb update re-sends `photos` with the replace flag (already implemented).

### 3. Hero image

First photo = hero. Already true end to end (eBay: "The Gallery image will be the first PictureURL in the array"; COVER badge marks index 0). Reorder is the mechanism for choosing the hero — no separate "make cover" action.

### 4. 24-photo cap

- New shared constant `MAX_ITEM_PHOTOS = 24` in `packages/shared/src/constants` (rebuild shared package). Replace all five hardcoded `12`s + the PhotoCaptureFlow default.
- Publish-time guards in the API:
  - eBay: photos sliced to 24 (no-op given app cap); validate total PictureURL character count ≤3975 before AddFixedPriceItem/ReviseFixedPriceItem — fail with a clear error rather than an eBay XML error.
  - Reverb: cap 25 (no-op at our 24).
- API-side request validation (zod schemas on item/listing routes): raise any photos array max from 12 to `MAX_ITEM_PHOTOS` (audit during implementation).
- R2/photo-upload path: no per-item count enforcement expected server-side beyond validation above (audit during implementation; if a limit exists, raise it to the constant).

### 5. Testing & verification

- TDD (tdd-guard enforced, one test at a time): `use-photo-drag` hook tests, PhotoManageSheet render/reorder tests, strip drag test, cap-constant tests (add disabled at 24), publish guard unit tests (3975-char validation, slice).
- e2e vs ephemeral stack (docker-compose.e2e.yml): (1) open manage sheet → drag photo 3 to position 1 → order changes, persists after reload, COVER badge follows; (2) add flow allows >12 up to 24.
- Frontend-verification gate: rebuilt container + proof screenshots into `website/static/img/verification/photo-reorder-24cap/` before claiming done.

## Out of scope

- Video (separate design after research review — see companion research doc).
- 0.5× ultra-wide camera zoom (separate track, research in flight).
- Any change to photo editing tools, upload pipeline, or R2 storage layout.
- dnd-kit or other drag library adoption.
