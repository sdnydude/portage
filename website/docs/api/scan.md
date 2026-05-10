---
id: scan
title: Scan
sidebar_position: 3
---

# Scan

AI-powered item identification using Claude Vision.

## Endpoints

### Basic Scan

```
GET /scan?imageUrl=<url>&detail=full
```

**Auth:** Required

Single-image scan. Returns identification data for one photo.

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `imageUrl` | string | URL of the image to scan |
| `detail` | string | `full` for detailed analysis |

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

Free-tier users have a daily scan limit. The `checkScanLimit()` function:

1. Validates the authenticated user exists in the database
2. Missing users receive a 401 (not a silent bypass)
3. Checks the daily scan count against the tier limit

## Error Responses

| Code | Error | Description |
|------|-------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid image URLs or failed SSRF check |
| 401 | `USER_NOT_FOUND` | Authenticated user not in database |
| 429 | `SCAN_LIMIT_EXCEEDED` | Daily scan limit reached |
| 502 | `AI_RESPONSE_INVALID` | Claude returned unparseable response |
