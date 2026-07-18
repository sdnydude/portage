---
id: scan
title: Scan
sidebar_position: 3
---

# Scan

AI-powered item identification using a configurable vision provider chain (`VISION_PROVIDERS` — Gemini primary with Claude fallback).

## Endpoints

### Basic Scan

```
POST /scan?detail=full
```

**Auth:** Required  
**Content-Type:** `multipart/form-data`

Single-image scan. Upload the photo as an `image` form field (JPEG/PNG/WebP/HEIC/HEIF, max 10 MB); the API processes it, uploads it to storage, and returns identification data.

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `detail` | string | `full` for detailed multi-candidate analysis (with eBay aspect prefill) |

**Response** `201`:

```json
{
  "identification": {
    "name": "Fender Stratocaster",
    "description": "...",
    "category": "Musical Instruments",
    "condition": "good",
    "conditionNotes": "",
    "brand": "Fender",
    "model": "American Professional II",
    "estimatedValueLow": 1200,
    "estimatedValueHigh": 1600
  },
  "detailed": { "candidates": [...], "reasoning": ["..."] },
  "image": { "key": "...", "url": "https://...", "width": 2048, "height": 1536 },
  "thumbnail": { "key": "...", "url": "https://..." }
}
```

`detailed` is present only when `detail=full` (its shape matches the refine response below — `identification` is then the top candidate). `image` and `thumbnail` are `null` if the storage upload failed (the identification is still returned).

### Refined Multi-Image Scan

```
POST /scan/refine
```

**Auth:** Required

The primary scanning endpoint. Accepts 1-3 image URLs for multi-angle identification.

**Body:**

```json
{
  "imageUrls": [
    "https://images.portage.app/items/uuid/photo-1.jpg",
    "https://images.portage.app/items/uuid/photo-2.jpg"
  ]
}
```

**Response** `201`:

```json
{
  "identification": {
    "name": "Fender Stratocaster American Professional II",
    "description": "...",
    "category": "Musical Instruments",
    "condition": "good",
    "conditionNotes": "",
    "brand": "Fender",
    "model": "American Professional II Stratocaster",
    "mpn": null,
    "aspects": { "Brand": ["Fender"], "Model": ["American Professional II"] },
    "features": ["Alder body", "Rosewood fingerboard", "V-Mod II pickups"],
    "estimatedValueLow": 1200,
    "estimatedValueHigh": 1600,
    "confidence": 0.87,
    "weight": { "value": 180, "unit": "oz" },
    "dimensions": { "length": 44, "width": 18, "height": 6, "unit": "in" }
  },
  "detailed": {
    "candidates": [ ... 1-3 candidates in the same shape as identification ... ],
    "reasoning": ["The guitar body shape and headstock are characteristic of..."]
  }
}
```

`identification` is the top candidate (`detailed.candidates[0]`) with required eBay aspects pre-filled best-effort. `confidence` is a 0–1 float; `mpn`, `weight`, `dimensions`, and `packageType` are optional; `reasoning` is an array of strings.

## Security

### SSRF Protection

All image URLs are validated against the `R2_PUBLIC_URL` environment variable prefix using Zod's `.refine()`:

- URLs must start with the configured R2 domain
- If `R2_PUBLIC_URL` is unset, **all URLs are rejected** (fail-closed behavior)
- This prevents attackers from using the scan endpoint to probe internal network addresses

### Scan Limits

Free-tier users have a **monthly** scan limit (Pro and beta-tester are unlimited; admins can set per-user overrides). The `checkScanLimit()` function:

1. Validates the authenticated user exists in the database
2. Missing users receive a 401 (not a silent bypass)
3. Checks the monthly scan count against the effective-tier limit (idempotent monthly reset)

## Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_INPUT` | Invalid image URLs or failed SSRF check (refine) |
| 400 | `NO_FILE` / `INVALID_FILE_TYPE` | Missing or unsupported upload (basic scan) |
| 401 | `USER_NOT_FOUND` | Authenticated user not in database |
| 429 | `LIMIT_REACHED` | Monthly scan limit reached |
| 502 | `PHOTO_FETCH_FAILED` | None of the provided images could be fetched |
| 502 | `AI_RESPONSE_INVALID` | AI returned an unparseable response |
