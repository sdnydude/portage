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

Single-image scan. Upload the photo as an `image` form field (JPEG/PNG/WebP/HEIC, max 10 MB); the API processes it, uploads it to storage, and returns identification data.

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `detail` | string | `full` for detailed multi-candidate analysis (with eBay aspect prefill) |

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

**Response** `200`:

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
        "features": ["Alder body", "Rosewood fingerboard", "V-Mod II pickups"],
        "description": "..."
      }
    ],
    "reasoning": "The guitar body shape and headstock are characteristic of..."
  },
  "single": {
    "name": "Fender Stratocaster",
    "category": "Musical Instruments",
    "condition": "good",
    "confidence": 82
  }
}
```

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

| Code | Error | Description |
|------|-------|-------------|
| 400 | `INVALID_INPUT` | Invalid image URLs or failed SSRF check (refine) |
| 400 | `NO_FILE` / `INVALID_FILE_TYPE` | Missing or unsupported upload (basic scan) |
| 401 | `USER_NOT_FOUND` | Authenticated user not in database |
| 429 | `LIMIT_REACHED` | Monthly scan limit reached |
| 502 | `PHOTO_FETCH_FAILED` | None of the provided images could be fetched |
| 502 | `AI_RESPONSE_INVALID` | AI returned an unparseable response |
