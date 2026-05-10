---
id: orders
title: Orders
sidebar_position: 5
---

# Orders

Track sales and manage shipping across all connected marketplaces.

## Endpoints

### List Orders

```
GET /orders
```

**Auth:** Required

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
      "status": "awaiting_shipment",
      "salePrice": 1400,
      "shippingAddress": {
        "name": "Jane Doe",
        "street": "456 Oak Ave",
        "city": "Seattle",
        "state": "WA",
        "zip": "98101",
        "country": "US"
      },
      "createdAt": "2026-05-10T..."
    }
  ]
}
```

### Get Order

```
GET /orders/:id
```

**Auth:** Required

### Sync Orders

```
POST /orders/sync
```

**Auth:** Required

Pulls new orders from all connected marketplace accounts. Each adapter's `syncOrders()` method fetches recent orders and matches them to Portage listings via `marketplaceListingId`.

**Response** `200`:

```json
{
  "synced": 3,
  "marketplaces": {
    "ebay": { "new": 2, "updated": 0 },
    "etsy": { "new": 1, "updated": 0 }
  }
}
```

### Mark as Shipped

```
POST /orders/:id/ship
```

**Auth:** Required

**Body:**

```json
{
  "trackingNumber": "1Z999AA10123456784",
  "carrier": "UPS"
}
```

## Order Lifecycle

```
awaiting_shipment → shipped → delivered
```

Orders are created automatically via sync, not manually. The shipping workflow on the frontend handles package configuration, rate shopping, and label purchase before marking an order as shipped.

## Shipping Address

Shipping addresses are stored as a JSONB column on the orders table, preserving the full address object from each marketplace adapter.
