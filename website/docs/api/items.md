---
id: items
title: Items
sidebar_position: 1
---

# Items

CRUD operations for inventory items, plus comps search, listing research, and export.

## Endpoints

### List Items

```
GET /items
```

**Auth:** Required

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `search` | string | Filter by title (partial match) |
| `category` | string | Filter by category |
| `condition` | string | Filter by condition (`new`, `like_new`, `good`, `fair`, `poor`) |
| `limit` | number | Items per page (default: 50, max: 100) |
| `offset` | number | Pagination offset (default: 0) |

**Response** `200`:

```json
{
  "items": [
    {
      "id": "uuid",
      "title": "Fender Stratocaster",
      "description": "...",
      "category": "Musical Instruments",
      "condition": "good",
      "conditionNotes": "",
      "brand": "Fender",
      "model": "American Professional II",
      "features": ["Alder body", "Rosewood fingerboard"],
      "aspects": { "Brand": ["Fender"], "Model": ["American Professional II"] },
      "photos": [{ "url": "https://...", "key": "...", "isPrimary": true }],
      "estimatedValueMin": 1200,
      "estimatedValueMax": 1600,
      "estimatedValueRecommended": 1400,
      "price": 1400,
      "aiConfidenceScore": 0.87,
      "quantity": 1,
      "listed": true,
      "createdAt": "2026-05-10T..."
    }
  ],
  "total": 42,
  "limit": 50,
  "offset": 0
}
```

`aiConfidenceScore` is a 0–1 float. `listed` is a computed boolean — `true` when the item has an `active` or `sold` listing (drafts do not count). Items also carry shipping metrics (`weightOz`, `lengthIn`, `widthIn`, `heightIn`, `ebayPackageType`, `weightEstimated`), the seller-set `price` (distinct from the AI estimate), `marketplaceData` (per-marketplace category/title cache), and `ebaySku`.

### Get Item

```
GET /items/:id
```

**Auth:** Required (owner only)

Returns the item object, or `404 NOT_FOUND`.

### Create Item

```
POST /items
```

**Auth:** Required

**Body** (only `title` is required):

```json
{
  "title": "Fender Stratocaster",
  "description": "...",
  "category": "Musical Instruments",
  "condition": "good",
  "conditionNotes": "Minor fret wear",
  "brand": "Fender",
  "model": "American Professional II",
  "features": ["Alder body", "Rosewood fingerboard"],
  "aspects": { "Brand": ["Fender"] },
  "estimatedValueMin": 1200,
  "estimatedValueMax": 1600,
  "estimatedValueRecommended": 1400,
  "price": 1400,
  "aiConfidenceScore": 0.87,
  "quantity": 1,
  "weightOz": 128,
  "lengthIn": 42,
  "widthIn": 16,
  "heightIn": 6,
  "ebayPackageType": "MAILING_BOX",
  "weightEstimated": false,
  "photos": [{ "url": "https://...", "key": "...", "isPrimary": true }],
  "marketplaceData": { "ebay": { "categoryId": "33034", "categoryName": "Electric Guitars" } }
}
```

Field constraints: `title` 1–500 chars; `description` max 2000; `condition` one of `new`/`like_new`/`good`/`fair`/`poor`; `features` max 30 entries of 100 chars; `aspects` maps aspect name → string array; `aiConfidenceScore` 0–1; `price` min 0.01 (omit for "unset"); `photos` max 24 entries (`url` required, `key`/`width`/`height`/`isPrimary` optional).

**Response** `201`: the created item.

### Update Item

```
PATCH /items/:id
```

**Auth:** Required (owner only)

**Body:** Partial item fields — any subset of the Create Item fields. `marketplaceData` and `aspects` are merged with the stored JSONB values, not replaced.

**Response** `200`: the updated item. Edits are also pushed to the item's live eBay/Reverb listings (best-effort); if any sync fails or a photo-URL budget warning applies, the response includes a `syncWarnings: string[]` field alongside the item fields.

### Delete Item

```
DELETE /items/:id
```

**Auth:** Required (owner only)

**Response** `200`: `{ "deleted": true }`

### Bulk Operations

```
POST /items/bulk/delete          # Delete multiple items
POST /items/bulk/update          # Update category/condition on multiple items
POST /items/bulk/export          # Export selected items as JSON
```

**Auth:** Required

**Body (delete)** — 1–50 UUIDs; all must belong to the caller or the request fails `403 FORBIDDEN`:

```json
{
  "ids": ["uuid1", "uuid2", "uuid3"]
}
```

**Response** `200`: `{ "deleted": true, "count": 3, "ids": [...] }`

**Body (update)** — 1–50 UUIDs; `updates` accepts **only** `category` and/or `condition` (at least one required):

```json
{
  "ids": ["uuid1", "uuid2"],
  "updates": { "category": "Musical Instruments", "condition": "good" }
}
```

**Response** `200`: `{ "updated": true, "count": 2, "ids": [...] }`

**Body (export)** — 1–100 UUIDs. **Response** `200`: `{ "items": [...], "count": n }`

### Search Comps

```
GET /items/comps/search?q=<query>
```

**Auth:** Required

Searches eBay's Browse API for comparable sold and active listings. `q` must be at least 3 characters (`400 INVALID_QUERY` otherwise); an optional `category` parameter narrows the search.

**Response** `200`:

```json
{
  "sold": [ { "title": "...", "price": 1400, "condition": "...", "imageUrl": "...", "listingUrl": "...", "soldDate": "..." } ],
  "active": [ ... ],
  "stats": {
    "soldMedian": 1400,
    "soldAvg": 1350,
    "activeMedian": 1450,
    "activeAvg": 1500,
    "sampleSize": 38,
    "p25": 1250,
    "p50": 1400,
    "p75": 1500,
    "sellThrough": 0.39
  }
}
```

`p25`/`p50`/`p75` and `sellThrough` may be `null`; a `"partial": true` flag is added when one of the sold/active searches failed.

### Item Comps

```
GET /items/:id/comps
```

**Auth:** Required (owner only)

Runs the same comps search using the item's own title and category. Returns the flat `{ sold, active, stats }` shape above. Errors: `404 NOT_FOUND`, `503 MARKETPLACE_UNAVAILABLE` when the eBay lookup fails.

### Listing Research

```
GET /items/:id/research
```

**Auth:** Required (owner only)

Listing optimizer research: which eBay item-specifics the item is still missing for its category, plus comps-based demand and (best-effort) eBay traffic for the item's published listing. Uses app-token reads, so it works before any marketplace account is connected.

**Response** `200`:

```json
{
  "category": { "categoryId": "33034", "categoryName": "Electric Guitars" },
  "aspects": {
    "filled": [ { "name": "Brand", "required": true, "values": ["Fender"] } ],
    "missing": [ { "name": "Body Color", "required": false, "suggestedValues": ["Black"], "cardinality": "SINGLE" } ]
  },
  "demand": { "soldMedian": 1400, "soldAvg": 1350, "activeMedian": 1450, "activeAvg": 1500, "sampleSize": 38, "soldCount": 15, "activeCount": 23 },
  "traffic": null
}
```

`category`, `demand`, and `traffic` may each be `null` when unavailable.

### Export Items

```
GET /items/export?format=<format>
```

**Auth:** Required

**Query Parameters:**

| Param | Type | Options |
|-------|------|---------|
| `format` | string | `ebay_csv`, `json` (default) |
| `ids` | string | Optional comma-separated item IDs |
| `category` | string | Optional category filter |
| `condition` | string | Optional condition filter |

Returns a downloadable file. The eBay CSV format follows eBay's **Seller Hub Reports draft-import** specification, with `Action(SiteID=US|Country=US|Currency=USD|Version=1193|CC=UTF-8)` header metadata. Includes Category ID, eBay-optimized title, pipe-delimited PicURLs, Custom Label (SKU), Brand/Model columns, and condition description. CSV responses carry `X-Portage-Total-Rows` and, when applicable, `X-Portage-Missing-Categories` headers.

### Prepare Photo Export

```
POST /items/photos/export/prepare
```

**Auth:** Required

Mints a short-lived download token for a ZIP of the selected items' photos.

**Body:** `{ "ids": ["uuid1", ...] }` — 1–50 UUIDs, all owned by the caller (`403 FORBIDDEN` otherwise). Fails `422 NO_PHOTOS` when no selected item has photos. The export is capped at 60 photos total; items that would exceed the cap are skipped.

**Response** `200`:

```json
{
  "token": "hex...",
  "expiresAt": "2026-07-17T...",
  "itemCount": 3,
  "photoCount": 18,
  "skippedCount": 0
}
```

The token expires after 5 minutes and allows at most 3 downloads.

### Download Photo Export

```
GET /items/photos/export?token=<token>
```

**Auth:** Token only — this endpoint is defined before the auth middleware and does **not** require a JWT; the `token` query parameter from the prepare step is the sole credential.

Streams a ZIP (`portage-photos-YYYY-MM-DD.zip`) of the prepared items' photos. Errors: `400 MISSING_TOKEN`, `401 INVALID_TOKEN` (expired or use count exhausted), `502 PHOTO_FETCH_FAILED` when no photo could be fetched.

### Prepare Listing

```
POST /items/:id/prepare-listing
```

**Auth:** Required

AI-generates optimized listing fields from item data, with comps-based pricing. Billing-gated (consumes one AI listing from the monthly allocation, or a purchased credit).

**Body:**

```json
{
  "targetMarketplaces": ["ebay", "reverb"]
}
```

`targetMarketplaces` accepts `ebay` and/or `reverb`.

**Response** `200` (abridged):

```json
{
  "title": "Fender American Professional II Stratocaster - Excellent Condition",
  "description": "...",
  "condition": "good",
  "brand": "Fender",
  "model": "American Professional II",
  "pricing": { "suggested": 1400, "low": 1250, "high": 1550, "confidence": "high" },
  "comps": { "ebay": { "sold": ["..."], "active": ["..."] }, "reverb": null },
  "ebay": { "categoryId": "33034", "aspects": { "...": ["..."] } },
  "reverb": null,
  "warnings": []
}
```
