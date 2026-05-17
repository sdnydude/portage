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
| `search` | string | Filter by name (partial match) |
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
      "name": "Fender Stratocaster",
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
  "name": "Fender Stratocaster",
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

### Bulk Delete

```
POST /items/bulk-delete
```

**Auth:** Required

**Body:**

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

Searches eBay's Browse API for comparable sold and active listings.

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
| `format` | string | `ebay-csv`, `json` |

Returns a downloadable file. The eBay CSV format follows eBay's **Seller Hub Reports draft-import** specification, with `Action(SiteID=US|Country=US|Currency=USD|Version=1193|CC=UTF-8)` header metadata. Includes Category ID, eBay-optimized title, pipe-delimited PicURLs, Custom Label (SKU), Brand/Model columns, and condition description.

### Prepare Listing

```
POST /items/:id/prepare-listing
```

**Auth:** Required

AI-generates optimized listing fields from item data.

**Body:**

```json
{
  "targetMarketplaces": ["ebay", "etsy"]
}
```

**Response** `200`:

```json
{
  "title": "Fender American Professional II Stratocaster - Excellent Condition",
  "description": "...",
  "suggestedPrice": 1400,
  "categoryMappings": { "ebay": "33034", "etsy": "..." }
}
```
