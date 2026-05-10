---
id: marketplace-adapters
title: Marketplace Adapters
sidebar_position: 4
---

# Marketplace Adapters

Portage supports listing and selling across multiple marketplaces through a unified adapter interface defined in `packages/shared/src/marketplace.ts`.

## Adapter Interface

Each marketplace implements the `MarketplaceAdapter` interface:

```typescript
interface MarketplaceAdapter {
  // Authentication
  getAuthUrl(): string;
  exchangeCode(code: string): Promise<MarketplaceTokens>;
  refreshToken(refreshToken: string): Promise<MarketplaceTokens>;

  // Listings
  createListing(listing: ListingData): Promise<MarketplaceListing>;
  updateListing(id: string, listing: Partial<ListingData>): Promise<void>;
  deleteListing(id: string): Promise<void>;

  // Orders
  syncOrders(since?: Date): Promise<MarketplaceOrderResult[]>;

  // Comps
  searchComps(query: string): Promise<CompResult>;
}
```

## eBay

**Status:** Fully operational (OAuth2, Inventory API, Fulfillment API, Taxonomy API, Browse API)

| Feature | Implementation |
|---------|---------------|
| Auth | OAuth2 authorization code grant |
| Listings | Inventory API (SKU → Offer → Publish) |
| Orders | Fulfillment API sync |
| Comps | Browse API (production — `$178` median verified) |
| Categories | Taxonomy API with suggested categories |
| Token storage | AES-256-GCM encrypted at rest |
| Export | File Exchange CSV format |

**Note:** Browse/Taxonomy APIs are hardcoded to production. Selling APIs use sandbox when `EBAY_SANDBOX=true`.

### eBay Comps

The comps system searches eBay's Browse API for recently sold and active listings matching the item:

```
GET /items/comps/search?q=<query>
```

Returns sold and active listing stats (average, median, count) plus individual comp cards that can be used to populate listing fields ("Use Title", "Use Condition" actions).

## Etsy

**Status:** Fully operational (PKCE OAuth2, Listings API, Receipts API, Taxonomy API)

| Feature | Implementation |
|---------|---------------|
| Auth | PKCE OAuth2 flow |
| Listings | Listings API with photo upload |
| Orders | Receipts API sync |
| Categories | Taxonomy API |

## Reverb

**Status:** Adapter implemented (264 lines), comps search working, OAuth pending

| Feature | Implementation |
|---------|---------------|
| Auth | OAuth (not yet connected) |
| Listings | Adapter ready, untested |
| Comps | Search working via Reverb API |

## Token Management

Marketplace tokens are managed through the `marketplace_accounts` table:

1. **Storage**: Tokens encrypted with AES-256-GCM using `ENCRYPTION_KEY`
2. **Refresh**: Automatic token refresh when expired (cached via token manager)
3. **Status**: Connection status tracked per account (connected, expired, disconnected)

The Settings > Marketplace page shows connection status and provides Connect/Disconnect actions for each marketplace.

## Order Sync

All three adapters return `MarketplaceOrderResult[]` from `syncOrders()`:

```typescript
interface MarketplaceOrderResult {
  marketplaceOrderId: string;
  marketplaceListingId: string;  // Used to match to Portage listing
  buyerUsername: string;
  salePrice: number;
  shippingAddress: object;
  status: string;
}
```

Orders match to listings via `marketplaceListingId` (not title or other ambiguous fields).
