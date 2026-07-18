---
id: scan-flow
title: Scan Flow
sidebar_position: 4
---

# Scan Flow

The Scan Flow is Portage's unified photo capture, editing, and AI identification interface. It's accessible from the center Scan button in the tab bar.

## Flow States

```
capture → uploading → scanning → review → saving → (done)
```

| State | What Happens |
|-------|-------------|
| `capture` | Camera preview or image picker. User takes/selects photos. |
| `uploading` | Photos upload to Cloudflare R2 immediately on capture. |
| `scanning` | `POST /scan/refine` sends R2 URLs to the AI vision provider chain (configured via `VISION_PROVIDERS`; Gemini primary with automatic fallback) for identification. |
| `review` | AI candidates displayed with confidence %. User selects/edits fields. |
| `saving` | Item saves to database with photos and metadata. |

## Multi-Photo Capture

Users can capture 1-24 photos per scan session (`MAX_PHOTOS_PER_ITEM` in `packages/shared/src/constants.ts` — sized to eBay's 24-picture limit):

1. First photo triggers immediate upload to R2
2. "+" button appears to add more photos (up to 24 total)
3. Photos display in a thumbnail strip below the main view
4. Only the first 3 photos are sent to the AI scan (cost optimization)
5. All photos attach to the saved item

## Camera Zoom & Device Selection

The camera preview (`camera-capture.tsx`, backed by the `useCamera` hook) supports zoom and multi-device selection:

- **Pinch-to-zoom** — two-finger pinch scales zoom continuously between the device's min and max
- **Zoom presets** — 0.5×/1×/2×/3× chips, filtered to the range the active camera actually supports
- **Native vs. digital zoom** — when the video track exposes sensor zoom via `applyConstraints` (e.g. iPhone Dual Wide/Triple cameras on Safari 17+), zoom is optical-quality and 0.5× ultra-wide is available; otherwise a digital fallback scales the preview with CSS and `capture()` crops the matching region (digital mode can't go below 1×)
- **Device picker** — when multiple cameras exist (desktop with external webcams or a Continuity Camera iPhone), a picker lists them by label
- **iPhone-via-Mac hint** — Continuity Camera doesn't expose zoom to browsers (WebKit gates it to iOS), so when an iPhone device is active in digital mode the UI points to the macOS menu-bar camera controls (green camera icon → Video, Center Stage off) for zoom and 0.5×

## Upload-on-Capture

Photos upload immediately when captured, not when the user taps "save":

```
Camera shutter → Blob → POST /images (FormData) → R2 URL stored in state
```

This eliminates the "uploading..." wait at save time and provides instant feedback if an upload fails.

## AI Identification

The `POST /scan/refine` endpoint returns multiple identification candidates:

```json
{
  "detailed": {
    "candidates": [
      {
        "name": "Fender Stratocaster American Professional II",
        "description": "American Professional II Stratocaster in sunburst finish...",
        "category": "Musical Instruments",
        "condition": "good",
        "conditionNotes": "Light pick wear near the pickguard",
        "brand": "Fender",
        "model": "American Professional II Stratocaster",
        "mpn": null,
        "estimatedValueLow": 1200,
        "estimatedValueHigh": 1600,
        "confidence": 0.87,
        "features": ["Alder body", "Rosewood fingerboard", "V-Mod II pickups"],
        "weight": { "value": 320, "unit": "oz" },
        "dimensions": { "length": 44, "width": 18, "height": 6, "unit": "in" },
        "packageType": "LARGE_PACKAGE"
      }
    ],
    "reasoning": [
      "Contoured double-cutaway alder body matches the Stratocaster silhouette",
      "Headstock logo and tuner layout indicate the American Professional II line"
    ]
  }
}
```

Candidates carry `estimatedValueLow`/`estimatedValueHigh` (no median field), `confidence` is a 0–1 float, and `reasoning` is an array of strings (see `CandidateSchema`/`DetailedVisionResultSchema` in `apps/api/src/lib/vision.ts`). Users see a candidate selector with confidence percentages and a collapsible reasoning section explaining the AI's logic.

Two deliberate design choices differentiate this flow: only the first 3 photos go to the AI, keeping per-scan cost flat no matter how many of the 24 photos a user captures, and every identification ships with a confidence score plus visible reasoning — the user sees *why* the AI thinks it's a Type III jacket, not just a label to accept on faith.

## Inline Photo Editing

The review screen includes photo editing tools above the AI-identified fields:

| Tool | Description |
|------|-------------|
| Rotate | 90-degree rotation |
| Crop | Interactive crop with aspect ratio options |
| Exposure | EV slider, baked server-side via Sharp |
| Enhance | Server-side auto-level/sharpen via Sharp |
| Remove BG | Background removal with before/after preview slider |

Editing creates a new version of the photo (original is preserved).

## SSRF Protection

The `/scan/refine` endpoint validates all image URLs against the `R2_PUBLIC_URL` environment variable:

- URLs must start with the configured R2 domain prefix
- If `R2_PUBLIC_URL` is unset, the endpoint rejects **all** URLs (fail-closed)
- This prevents attackers from using the scan endpoint to probe internal network URLs

## Component

The `ScanFlow` component lives at `apps/web/src/components/capture/scan-flow.tsx`. It's a full-screen modal that manages:

- Camera capture via `useCamera` hook
- Image picker via `ImagePicker` component
- Photo upload state
- AI scan request/response
- Candidate selection and field editing
- Save to inventory

Related components in `components/capture/`:

| Component | Purpose |
|-----------|---------|
| `camera-capture.tsx` | Live camera preview with shutter button |
| `capture-sheet.tsx` | Camera vs. gallery choice sheet |
| `image-picker.tsx` | File input wrapper for gallery selection |
| `photo-edit-overlay.tsx` / `photo-edit-panel.tsx` | Full-screen photo editor (rotate, crop, exposure, enhance, BG remove) |
| `photo-gallery-strip.tsx` | Thumbnail strip with add tile, tap-to-edit, and drag reorder; opens the manage sheet |
| `photo-manage-sheet.tsx` | Full-screen 3-column photo grid sized for the 24-photo cap — long-press drag reorder + per-tile delete |
| `exposure-tool.tsx` | EV slider — instant CSS `brightness()` preview, applied server-side via Sharp so preview and saved file match |
| `scan-review-actions.tsx` | Review-screen action bar: price + quantity fields, Save, Save & List (with eBay-draft option), Rescan |
| `scan-fab.tsx` | Self-contained floating Scan button that opens ScanFlow (currently unreferenced in the app shell) |
| `scan-aspects-section.tsx` | Scan-time eBay item-aspect prefill and editing |

ScanFlow opens from the center Scan button in the `TabBar` (`components/layout/tab-bar.tsx`).
