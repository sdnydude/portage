---
id: scan-flow
title: Scan Flow
sidebar_position: 4
---

# Scan Flow

The Scan Flow is Portage's unified photo capture, editing, and AI identification interface. It's accessible from the camera FAB button in the center of the tab bar.

## Flow States

```
capture → uploading → scanning → review → saving → (done)
```

| State | What Happens |
|-------|-------------|
| `capture` | Camera preview or image picker. User takes/selects photos. |
| `uploading` | Photos upload to Cloudflare R2 immediately on capture. |
| `scanning` | `POST /scan/refine` sends R2 URLs to Claude Vision for identification. |
| `review` | AI candidates displayed with confidence %. User selects/edits fields. |
| `saving` | Item saves to database with photos and metadata. |

## Multi-Photo Capture

Users can capture 1-12 photos per scan session:

1. First photo triggers immediate upload to R2
2. "+" button appears to add more photos (up to 12 total)
3. Photos display in a thumbnail strip below the main view
4. Only the first 3 photos are sent to the AI scan (cost optimization)
5. All photos attach to the saved item

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
        "category": "Musical Instruments",
        "condition": "good",
        "confidence": 87,
        "brand": "Fender",
        "model": "American Professional II Stratocaster",
        "valueLow": 1200,
        "valueHigh": 1600,
        "valueMedian": 1400,
        "features": ["Alder body", "Rosewood fingerboard", "V-Mod II pickups"]
      }
    ],
    "reasoning": "The guitar body shape and headstock are characteristic of..."
  }
}
```

Users see a candidate selector with confidence percentages and a collapsible reasoning section explaining the AI's logic.

## Inline Photo Editing

The review screen includes photo editing tools above the AI-identified fields:

| Tool | Description |
|------|-------------|
| Rotate | 90-degree rotation |
| Crop | Interactive crop with aspect ratio options |
| Enhance | Server-side auto-level/sharpen via Sharp |
| Remove BG | Client-side WASM background removal |

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
| `scan-fab.tsx` | Floating action button that opens ScanFlow |
