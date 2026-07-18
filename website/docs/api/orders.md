---
id: orders
title: Orders
sidebar_position: 5
---

# Orders

Track sales and fulfillment across all connected marketplaces.

## Endpoints

### List Orders

```
GET /orders
```

**Auth:** Required

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter: `payment_received`, `label_purchased`, `shipped`, `delivered`, `canceled` (unrecognized values are ignored) |
| `limit` | number | Orders per page (default: 50, max: 100) |
| `offset` | number | Pagination offset (default: 0) |

**Response** `200`:

```json
{
  "orders": [
    {
      "id": "uuid",
      "listingId": "uuid",
      "marketplace": "ebay",
      "marketplaceOrderId": "12-34567-89012",
      "buyerUsername": "buyer123",
      "status": "payment_received",
      "salePrice": 1400,
      "shippingAddress": {
        "name": "Jane Doe",
        "street": "456 Oak Ave",
        "city": "Seattle",
        "state": "WA",
        "zip": "98101",
        "country": "US"
      },
      "ebayItemId": "307034606520",
      "listingMarketplace": "ebay",
      "itemTitle": "Fender Stratocaster American Professional II",
      "itemPhotos": [{ "url": "...", "isPrimary": true }],
      "createdAt": "2026-05-10T..."
    }
  ],
  "pagination": { "limit": 50, "offset": 0 }
}
```

Each row is the full order record joined with its listing (`ebayItemId` — the marketplace listing ID the **Ship It** button links to — and `listingMarketplace`) and its item (`itemTitle`, `itemPhotos`) so the sold list can render thumbnail + title rows. Results are ordered by `soldAt` descending.

### Get Order

```
GET /orders/:id
```

**Auth:** Required

Returns the order joined with `ebayItemId` and `listingMarketplace`, plus an `item` object (`{ id, title, photos }`, nullable) for the order detail and ship pages.

### Sync Orders

```
POST /orders/sync
```

**Auth:** Required

Pulls orders from all connected marketplace accounts (eBay via the **Fulfillment API**, Reverb via its orders API) over a 90-day window and matches them to Portage listings via `marketplaceListingId`. The frontend fires this once per browser session on the first Cloudflare Access session exchange (a login event, fire-and-forget from `AuthProvider`) and via the manual **Sync** button on the Orders page; per-marketplace failures are surfaced in `errors` instead of failing the whole sync.

Sync also:

- **Backfills orphans** — an eBay sale with no matching Portage listing gets one item + one listing created per eBay ItemID via Trading API `GetItem`
- **Heals existing rows** — `soldAt`, marketplace fees, and fulfillment status are corrected in place on re-sync; orders shipped or canceled on eBay are marked `shipped` / `canceled` locally (never downgraded the other direction)

**Response** `200`:

```json
{
  "synced": 3,
  "newOrders": ["uuid1", "uuid2", "uuid3"],
  "errors": []
}
```

`errors` entries are `{ "marketplace": "ebay", "message": "..." }` objects. When no marketplace accounts are connected, the response is `{ "synced": 0, "newOrders": [] }` with no `errors` key.

### Update Order / Mark as Shipped

```
PATCH /orders/:id
```

**Auth:** Required

**Body:**

```json
{
  "status": "shipped",
  "trackingNumber": "1Z999AA10123456784",
  "carrier": "UPS",
  "shippingLabelUrl": "https://..."
}
```

`status` accepts `payment_received`, `label_purchased`, `shipped`, `delivered`, `canceled`. `shippingLabelUrl` must be a valid URL. Setting `shipped` or `delivered` stamps the corresponding timestamp.

## Order Lifecycle

```
payment_received → shipped → delivered
                 → canceled (via marketplace sync)
```

Orders are created automatically via sync, not manually. The in-app carrier subsystem was removed in PR #142 — **Ship It** opens the item's eBay page for label purchase, and fulfillment status syncs back from the eBay Fulfillment API (see [Shipping](/docs/api/shipping)).

## Shipping Address

Shipping addresses are stored as a JSONB column on the orders table, preserving the full address object from each marketplace adapter.
