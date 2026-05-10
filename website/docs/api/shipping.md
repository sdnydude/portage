---
id: shipping
title: Shipping
sidebar_position: 7
---

# Shipping

Package presets, rate shopping, label purchase, and carrier API configuration. The full shipping UI is built; carrier API integration (EasyPost/Shippo) is pending.

## Endpoints

### Presets

```
GET    /shipping/presets          # List saved package presets
POST   /shipping/presets          # Create a preset
PATCH  /shipping/presets/:id      # Update a preset
DELETE /shipping/presets/:id      # Delete a preset
```

**Auth:** Required

**Preset Body:**

```json
{
  "name": "Standard Box",
  "packageType": "box",
  "length": 12,
  "width": 10,
  "height": 6,
  "weightLbs": 2,
  "weightOz": 8,
  "isDefault": true
}
```

Setting `isDefault: true` is wrapped in a database transaction with a partial unique index to prevent race conditions (TOCTOU protection).

### Rates

```
POST /shipping/rates
```

**Auth:** Required

**Body:**

```json
{
  "orderId": "uuid",
  "packageType": "box",
  "length": 12,
  "width": 10,
  "height": 6,
  "weightLbs": 2,
  "weightOz": 8
}
```

**Response** `200`:

```json
{
  "rates": [
    {
      "carrier": "USPS",
      "service": "Priority Mail",
      "price": 8.95,
      "estimatedDays": 2,
      "tags": ["cheapest"]
    },
    {
      "carrier": "UPS",
      "service": "Ground",
      "price": 12.50,
      "estimatedDays": 5,
      "tags": ["best_value"]
    }
  ]
}
```

> **Note:** Rate data is currently stubbed. Real carrier API calls require EasyPost or Shippo integration.

### Labels

```
POST /shipping/labels
```

**Auth:** Required

Purchases a shipping label for an order.

**Body:**

```json
{
  "orderId": "uuid",
  "rateId": "rate_xyz"
}
```

```
GET /shipping/labels/:orderId
```

**Auth:** Required

Retrieves the label for a shipped order.

### Provider Configuration

```
GET    /shipping/provider         # Get current provider config
POST   /shipping/provider         # Set provider (EasyPost/Shippo/PirateShip)
POST   /shipping/provider/test    # Test provider connection
```

**Auth:** Required

### Settings

```
GET    /shipping/settings         # Get ship-from address + preferences
PATCH  /shipping/settings         # Update ship-from address
```

**Auth:** Required

## Shipping Workflow

1. User taps "Ship It" on an order → navigates to `/orders/[id]/ship`
2. Select or configure package dimensions (saved presets or manual entry)
3. "Get Rates" fetches available carrier rates
4. Rates display with tags (Cheapest, Fastest, Best Value)
5. "Buy Label" purchases the label
6. Success screen shows tracking number with "Mark as Shipped" action

## Package Types

| Type | Description |
|------|-------------|
| `box` | Standard cardboard box |
| `padded_envelope` | Padded/bubble mailer |
| `poly_mailer` | Poly shipping bag |
