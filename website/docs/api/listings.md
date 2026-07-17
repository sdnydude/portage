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
| `itemId` | uuid | Filter to listings of a single item |
| `limit` | number | Items per page (default: 50, max: 100) |
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
      "itemTitle": "Fender Stratocaster American Professional II",
      "createdAt": "2026-05-10T..."
    }
  ],
  "total": 15,
  "limit": 50,
  "offset": 0
}
```

Each row is the full listing record joined with the item's title (`itemTitle`) so the listings page can show what each listing is.

### Get Listing

```
GET /listings/:id
```

**Auth:** Required

### Get Listing's Live eBay State

```
GET /listings/:id/ebay-offer
```

**Auth:** Required (owner only)

Reads back the live eBay state for the listing via Trading API `GetItem`, keyed by the listing's Trading **ItemID** (`marketplaceListingId`, not the SKU) — item specifics (including MPN and brand), status, ItemID, and price — so a publish can be verified in-app. A listing that was never published to eBay (no `marketplaceListingId`) returns `{ "found": false }` with null fields instead of calling eBay.

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
  "publishMode": "live",
  "publishImmediately": false,
  "marketplaceSpecificFields": { "categoryId": "33034", "aspects": { "Brand": ["Fender"] } },
  "idempotencyKey": "itemId:ebay:abc123",
  "disclaimerAccepted": true,
  "suppress7d": false
}
```

`marketplace` accepts `ebay` or `reverb`. Title, description, and condition come from the item and `marketplaceSpecificFields`.

`publishMode` accepts `draft`, `live`, or `ebay_draft` and, when present, takes precedence over the legacy `publishImmediately` flag. Only `live` (or legacy `publishImmediately: true`) calls the marketplace; both `draft` and `ebay_draft` stay DB-only — under the Trading API there is no unpublished-offer concept, so an "eBay draft" is just a local draft.

`suppress7d: true` records the seller's "don't show the terms sheet for 7 days" choice — a display preference only; disclaimer consent is still recorded per-listing via `disclaimerAccepted`.

**Publish idempotency:** the optional `idempotencyKey` (scoped `itemId:marketplace:random` per publish attempt) is enforced insert-first via a partial unique index on `listings.idempotency_key`, so a retried publish can never double-list; the server resumes the stuck draft on a replay instead of creating an orphan.

### Update Listing

```
PATCH /listings/:id
```

**Auth:** Required (owner only)

Accepts `price`, `status`, and `marketplaceSpecificFields` (all optional). Updates the local listing, then syncs to the marketplace when the listing is `active` and published. At sync time the content fields — title, description, condition, quantity, brand, model, photos, features — are re-read from the **item** row: item columns win, and they cannot be overridden per-listing via this endpoint.

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
