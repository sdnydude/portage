---
id: seller-profile
title: Seller Profile
sidebar_position: 13
---

# Seller Profile

Per-user selling defaults: shipping units, ship-from address, pricing percentiles, marketplace preferences, and listing boilerplate. The profile feeds AI listing preparation (see [Prepare Listing](/docs/api/items#prepare-listing)) — it supplies the default currency, weight/dimension/package units, pricing suggest/floor percentiles, best-offer floor behavior, Reverb shipping rates and offers toggle, and the default listing footer. The `gtcAutoEnd` flag opts the user into the [GTC auto-end sweep](/docs/api/listings#gtc-auto-end-sweep).

All endpoints require auth. Each user has exactly one profile row.

## Endpoints

### Get Seller Profile

```
GET /seller-profile
```

**Auth:** Required

Returns the caller's profile. **Auto-creates** a default row on first fetch — this endpoint never 404s for an authenticated user.

**Response** `200` (a fresh profile, showing the column defaults):

```json
{
  "profile": {
    "id": "uuid",
    "userId": "uuid",
    "ebayFulfillmentPolicyId": null,
    "ebayPaymentPolicyId": null,
    "ebayReturnPolicyId": null,
    "ebayMerchantLocationKey": null,
    "ebayPublishMode": "live",
    "reverbOffersEnabled": true,
    "reverbDefaultShipping": null,
    "shipFromAddress": null,
    "defaultWeightUnit": "oz",
    "defaultDimensionUnit": "in",
    "defaultPackageType": "box",
    "preferredMarketplaces": ["ebay"],
    "autoPublish": false,
    "defaultCurrency": "USD",
    "pricingSuggestPercentile": 50,
    "pricingFloorPercentile": 25,
    "bestOfferAutoAcceptEnabled": false,
    "gtcAutoEnd": false,
    "defaultListingFooter": null,
    "createdAt": "2026-07-16T...",
    "updatedAt": "2026-07-16T..."
  }
}
```

### Update Seller Profile

```
PATCH /seller-profile
```

**Auth:** Required

Partial update — send any subset of the fields below (at least one is required, otherwise `400 VALIDATION_ERROR`). Upserts: if the row doesn't exist yet, it is created with the supplied fields.

**Accepted fields:**

| Field | Type | Constraints |
|-------|------|-------------|
| `ebayFulfillmentPolicyId` | string \| null | — |
| `ebayPaymentPolicyId` | string \| null | — |
| `ebayReturnPolicyId` | string \| null | — |
| `ebayMerchantLocationKey` | string \| null | — |
| `reverbOffersEnabled` | boolean | — |
| `reverbDefaultShipping` | object \| null | `{ rates: [{ regionCode, rate: { amount, currency } }], local: boolean }` |
| `shipFromAddress` | object \| null | `{ name, street1, street2?, city, state, zip, country }` |
| `defaultWeightUnit` | string | `oz`, `lb`, `g`, `kg` |
| `defaultDimensionUnit` | string | `in`, `cm` |
| `defaultPackageType` | string | `box`, `envelope`, `poly_mailer` |
| `ebayPublishMode` | string | `draft`, `live` |
| `preferredMarketplaces` | string[] | entries: `ebay`, `reverb` |
| `autoPublish` | boolean | — |
| `defaultCurrency` | string | exactly 3 characters (ISO code, e.g. `USD`) |
| `pricingSuggestPercentile` | integer | 10–90 |
| `pricingFloorPercentile` | integer | 5–75 |
| `bestOfferAutoAcceptEnabled` | boolean | — |
| `gtcAutoEnd` | boolean | — |
| `defaultListingFooter` | string \| null | max 2000 characters |

The eBay Business Policy ID fields are still accepted and stored, but the endpoints that populated them (`GET /ebay-policies`, `POST /ebay/auto-setup`) were removed 2026-07-09 — Trade-First publishing uses inline shipping terms instead of Business Policies (see [Listings](/docs/api/listings)).

**Body** (example):

```json
{
  "defaultCurrency": "USD",
  "pricingSuggestPercentile": 60,
  "pricingFloorPercentile": 30,
  "defaultListingFooter": "Ships within 1 business day from a smoke-free studio."
}
```

**Response** `200`: `{ "profile": { ... } }` — the full updated profile.

#### Pricing percentile cross-field validation

`pricingFloorPercentile` must be strictly **below** `pricingSuggestPercentile`. Because a partial PATCH may carry only one of the two fields, the check merges the request with the stored row (or the column defaults `50`/`25` when no row exists) before comparing. If the merged floor is greater than or equal to the merged suggest value, the request fails:

```json
{ "error": "Floor percentile must be below the suggested-price percentile", "code": "PRICING_FLOOR_INVALID" }
```

## How the Profile Is Used

During [Prepare Listing](/docs/api/items#prepare-listing) (`POST /items/:id/prepare-listing`):

- `defaultCurrency` sets the pricing currency (falls back to `USD`)
- `defaultWeightUnit` / `defaultDimensionUnit` / `defaultPackageType` fill the package defaults
- `pricingSuggestPercentile` / `pricingFloorPercentile` drive comps-based price suggestion
- `bestOfferAutoAcceptEnabled` adds a best-offer floor to eBay fields when pricing produces one
- `reverbDefaultShipping` rates and `reverbOffersEnabled` populate Reverb listing fields
- `defaultListingFooter` is appended to the generated listing description
- A missing profile adds the warning `"Seller profile incomplete — set up business policies before publishing"` to the response

## Error Codes

| Status | Code | When |
|--------|------|------|
| `400` | `VALIDATION_ERROR` | Empty PATCH body, or a field fails its constraint (returned with a `details` array) |
| `400` | `PRICING_FLOOR_INVALID` | Merged floor percentile ≥ merged suggest percentile |
| `401` | `UNAUTHORIZED` | Missing or invalid JWT |
