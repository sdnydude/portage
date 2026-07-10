---
id: items
title: Items
sidebar_position: 1
---

# Items

CRUD operations for inventory items, plus comps search and export.

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
| `condition` | string | Filter by condition |
| `limit` | number | Items per page (default: 50) |
| `offset` | number | Pagination offset (default: 0) |

**Response** `200`:

```json
{
  "items": [
    {
      "id": "uuid",
      "title": "Fender Stratocaster",
      "category": "Musical Instruments",
      "condition": "good",
      "brand": "Fender",
      "model": "American Professional II",
      "photos": [{ "url": "https://...", "key": "...", "isPrimary": true }],
      "valueLow": 1200,
      "valueHigh": 1600,
      "valueMedian": 1400,
      "aiConfidence": 87,
      "createdAt": "2026-05-10T..."
    }
  ],
  "total": 42
}
```

### Get Item

```
GET /items/:id
```

**Auth:** Required

### Create Item

```
POST /items
```

**Auth:** Required

**Body:**

```json
{
  "title": "Fender Stratocaster",
  "category": "Musical Instruments",
  "condition": "good",
  "brand": "Fender",
  "model": "American Professional II",
  "photos": [{ "url": "https://...", "key": "...", "isPrimary": true }],
  "valueLow": 1200,
  "valueHigh": 1600,
  "valueMedian": 1400,
  "aiConfidence": 87,
  "features": ["Alder body", "Rosewood fingerboard"]
}
```

### Update Item

```
PATCH /items/:id
```

**Auth:** Required (owner only)

**Body:** Partial item fields.

### Delete Item

```
DELETE /items/:id
```

**Auth:** Required (owner only)

### Bulk Operations

```
POST /items/bulk/delete          # Delete multiple items
POST /items/bulk/update          # Update fields on multiple items
POST /items/bulk/export          # Export selected items
```

**Auth:** Required

**Body (delete):**

```json
{
  "ids": ["uuid1", "uuid2", "uuid3"]
}
```

### Search Comps

```
GET /items/comps/search?q=<query>
```

**Auth:** Required

Searches eBay's Browse API for comparable sold and active listings. `q` must be at least 3 characters; an optional `category` parameter narrows the search.

**Response** `200`:

```json
{
  "sold": {
    "items": [...],
    "stats": { "count": 15, "average": 1350, "median": 1400 }
  },
  "active": {
    "items": [...],
    "stats": { "count": 23, "average": 1500, "median": 1450 }
  }
}
```

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

Returns a downloadable file. The eBay CSV format follows eBay's **Seller Hub Reports draft-import** specification, with `Action(SiteID=US|Country=US|Currency=USD|Version=1193|CC=UTF-8)` header metadata. Includes Category ID, eBay-optimized title, pipe-delimited PicURLs, Custom Label (SKU), Brand/Model columns, and condition description.

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
