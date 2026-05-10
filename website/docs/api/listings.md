---
id: listings
title: Listings
sidebar_position: 4
---

# Listings

Create, manage, and sync marketplace listings.

## Endpoints

### List Listings

```
GET /listings
```

**Auth:** Required

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter: `active`, `draft`, `sold`, `archived` |
| `marketplace` | string | Filter: `ebay`, `etsy`, `reverb` |
| `limit` | number | Items per page (default: 50) |
| `offset` | number | Pagination offset (default: 0) |

**Response** `200`:

```json
{
  "listings": [
    {
      "id": "uuid",
      "itemId": "uuid",
      "marketplace": "ebay",
      "marketplaceListingId": "v1|123456|0",
      "status": "active",
      "title": "Fender Stratocaster American Professional II",
      "description": "...",
      "price": 1400,
      "createdAt": "2026-05-10T..."
    }
  ],
  "total": 15
}
```

### Get Listing

```
GET /listings/:id
```

**Auth:** Required

### Create Listing

```
POST /listings
```

**Auth:** Required

**Body:**

```json
{
  "itemId": "uuid",
  "marketplace": "ebay",
  "title": "Fender Stratocaster American Professional II",
  "description": "...",
  "price": 1400,
  "condition": "good",
  "categoryId": "33034"
}
```

### Update Listing

```
PATCH /listings/:id
```

**Auth:** Required (owner only)

Updates both the local listing and syncs changes to the marketplace.

### Delete Listing

```
DELETE /listings/:id
```

**Auth:** Required (owner only)

Removes from marketplace and deletes local record.

### Publish Listing

```
POST /listings/:id/publish
```

**Auth:** Required

Publishes a draft listing to its marketplace.

### Bulk Delete

```
POST /listings/bulk-delete
```

**Auth:** Required

**Body:**

```json
{ "ids": ["uuid1", "uuid2"] }
```

### Bulk Archive

```
POST /listings/bulk-archive
```

**Auth:** Required

### Bulk Activate

```
POST /listings/bulk-activate
```

**Auth:** Required

## Listing Lifecycle

```
draft → active → sold (via order sync)
                → archived (manual)
```

- **Draft**: Created locally, not yet on marketplace
- **Active**: Published and live on marketplace
- **Sold**: Matched to an incoming order via `marketplaceListingId`
- **Archived**: Manually removed from marketplace
