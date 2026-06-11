---
title: "Stage 2.5: photo-gallery strip + full-screen editor overlay across scan, item detail, and all listing flows"
sidebar_label: "Stage 2.5: photo-gallery strip + full-screen edito"
sidebar_position: 55
---

# Stage 2.5: photo-gallery strip + full-screen editor overlay across scan, item detail, and all listing flows

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [https://github.com/sdnydude/portage/pull/108](https://github.com/sdnydude/portage/pull/108) |
| **Completed** | 2026-06-11 |
| **Model** | claude-fable-5 |

## Approach

Replace always-on inline photo editors with the approved comp pattern: PhotoGalleryStrip + PhotoEditPanel overlay (all 4 tools). User-extended mid-stage: rotate/crop ported to item detail; shared usePhotoEdit hook + PhotoEditOverlay wrapper integrated into ListingPreviewCard, hybrid (ChatMode card + CompactMode), conversational (prepared card + review card), swipe ReviewPhase, PhotoCaptureFlow; legacy PhotoEditor deleted. Phase 6: 6-lens parallel review, fix batch (error surfacing in-overlay, blob editable flags, updatePhoto throws on vanished index, dual-state removals). e2e hardened: storageState single-login (auth limiter is 10-in-15min), idempotent compact-toggle test, ephemeral CI fixes (E2E_API_URL + seeded photo).

## Commits

- `4f9037c PhotoGalleryStrip`
- `caac04d PhotoEditPanel`
- `ba6dc1d scan-flow surgery`
- `49a2745 item detail port`
- `13ce5b7 a579ff81 hydration fix`
- `98c640a item detail rotate+crop`
- `1502625 usePhotoEdit hook`
- `75ad49f ListingPreviewCard + hybrid/conv wiring`
- `cf11472 hybrid CompactMode`
- `8e0dbd1 swipe ReviewPhase`
- `7e0ada8 conversational review card`
- `031c011 PhotoCaptureFlow swap + PhotoEditor deleted`
- `639e80f e2e listing leg`
- `(fix batch) Phase 6 review fixes`
- `(e2e) storageState auth + idempotent toggle`
- `d7088e3 CI E2E_API_URL`
- `5c1546c CI seed photo + thumb-required helper`
- `7907997 merge`

## Deferred Items

- comps-fetch empty .catch surfacing (pre-existing PR #78)
- migrate item detail onto usePhotoEdit + collapse dual index state
- Doppler workplace disabled — re-sync VISION_PROVIDERS once restored

## Decisions

- usePhotoEdit centralizes tool plumbing; hosts stay presentational; persistence via host onPhotoUpdated
- S2.5-4 retargeted listings/[id]→inventory/[id] at drift check
- blob photos lose edit affordance (strip editable flag) instead of dead-tap or toast
- summary hero images intentionally NOT converted to strips (listing representations, not galleries)

## Review

**Agents:** code-reviewer, silent-failure-hunter, pr-test-analyzer, type-design-analyzer, comment-analyzer, code-simplifier
**Critical issues found:** 1
**Important issues found:** 8

## Verification

- **lint:** 0 errors / 22 warnings (25→22)
- **tests:** web 148/148, api 455/455, e2e 8/8 in 7.2s vs rebuilt :3002 + ephemeral CI green
- **typecheck:** pass x3

**Tags:** `photo-gallery`, `listing-flow`, `use-photo-edit`, `e2e`, `storageState`, `stage2.5`

