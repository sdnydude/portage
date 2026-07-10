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
| `marketplace` | string | Filter: `ebay`, `reverb` |
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
      "marketplaceListingId": "307034606520",
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
  "price": 1400,
  "currency": "USD",
  "publishImmediately": false,
  "marketplaceSpecificFields": { "categoryId": "33034", "aspects": { "Brand": ["Fender"] } },
  "idempotencyKey": "itemId:ebay:abc123",
  "disclaimerAccepted": true
}
```

`marketplace` accepts `ebay` or `reverb`. Title, description, and condition come from the item and `marketplaceSpecificFields`. When `publishImmediately` is true, the listing is published to the marketplace in the same request.

**Publish idempotency:** the optional `idempotencyKey` (scoped `itemId:marketplace:random` per publish attempt) is enforced insert-first via a partial unique index on `listings.idempotency_key`, so a retried publish can never double-list; the server resumes the stuck draft on a replay instead of creating an orphan.

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

Publishes a draft listing to its marketplace. For eBay this is a **Trading API** `AddFixedPriceItem` call with inline shipping terms (no Business Policies); the leaf category, item aspects, and package weight/dimensions are self-healed from the item when the draft lacks them. Only `draft` listings can be published.

### GTC Auto-End Sweep

```
POST /listings/gtc-sweep
```

**Auth:** Required

Opt-in (per-user `gtc_auto_end` setting), triggered post-login: ends active eBay listings via `EndFixedPriceItem` two days before their monthly GTC renewal anniversary, archives them, and notifies the seller. No auto-relist.

### Bulk Delete

```
POST /listings/bulk/delete
```

**Auth:** Required

**Body:**

```json
{ "ids": ["uuid1", "uuid2"] }
```

### Bulk Archive

```
POST /listings/bulk/archive
```

**Auth:** Required

### Bulk Activate

```
POST /listings/bulk/activate
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
