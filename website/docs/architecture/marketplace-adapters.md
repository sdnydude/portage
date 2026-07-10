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
  readonly marketplace: MarketplaceType; // 'ebay' | 'reverb'

  // Listings
  createListing(input: MarketplaceListingInput): Promise<MarketplaceListingResult>;
  updateListing(marketplaceListingId: string, input: Partial<MarketplaceListingInput>): Promise<MarketplaceListingResult>;
  deleteListing(marketplaceListingId: string): Promise<void>;
  getListingStatus(marketplaceListingId: string): Promise<'active' | 'sold' | 'ended' | 'unknown'>;

  // Orders
  getOrders(since?: Date): Promise<MarketplaceOrderResult[]>;

  // Categories
  searchCategories(query: string): Promise<MarketplaceCategoryResult[]>;
}
```

Auth flows (OAuth for eBay, token-paste for Reverb) live in dedicated route files under `apps/api/src/routes/marketplace/`, not on the adapter interface.

## eBay

**Status:** Fully operational in production (OAuth2, Trading API, Fulfillment API, Taxonomy API, Browse API)

| Feature | Implementation |
|---------|---------------|
| Auth | OAuth2 authorization code grant |
| Listings | Trading API — AddFixedPriceItem / ReviseFixedPriceItem / ReviseInventoryStatus / EndFixedPriceItem / GetItem, with inline shipping terms (no Business Policies, no Inventory-API offers) |
| Publish idempotency | Insert-first via `listings.idempotency_key` partial unique index |
| Orders | Fulfillment API sync |
| Comps | Browse API (production — `$178` median verified) |
| Categories | Taxonomy API with suggested categories |
| GTC auto-end | Opt-in login-triggered sweep ends listings 2 days before the monthly GTC renewal anniversary |
| Token storage | AES-256-GCM encrypted at rest |
| Export | Seller Hub Reports draft-import CSV |
| Messaging | Buyer message inbox sync + reply via Trading API |

The listing lifecycle moved from the Inventory API to the Trading API in the Trade-First migration (PR #133, live-proven). Browse/Taxonomy APIs are hardcoded to production; all eBay APIs run in production mode (`EBAY_SANDBOX=false`).

### eBay Comps

The comps system searches eBay's Browse API for recently sold and active listings matching the item:

```
GET /items/comps/search?q=<query>
```

Returns sold and active listing stats (average, median, count) plus individual comp cards that can be used to populate listing fields ("Use Title", "Use Condition" actions).

## Etsy

**Status:** Parked 2026-07-09 pending Etsy API key approval

The Etsy adapter, auth routes, and UI were removed from the codebase (pre-removal code preserved at git tag `etsy-parked-2026-07`). The `etsy` value in the marketplace DB enum remains but is inert — zero Etsy rows existed at park time.

## Reverb

**Status:** Publish path shipped and live-proven — a real Reverb listing has been published

| Feature | Implementation |
|---------|---------------|
| Auth | Per-user Personal Access Token (validated against `GET /my/account`) |
| Listings | Create/update listing shipped, live-proven |
| Comps | Search working via Reverb API |
| Endpoints | `POST /marketplace/reverb/connect`, `GET .../status`, `DELETE .../disconnect` |

OAuth code-grant auth remains planned; token-paste auth is the shipped flow.

## Token Management

Marketplace tokens are managed through the `marketplace_accounts` table:

1. **Storage**: Tokens encrypted with AES-256-GCM using `ENCRYPTION_KEY`
2. **Refresh**: Automatic token refresh when expired (cached via token manager)
3. **Status**: Connection status tracked per account (connected, expired, disconnected)

The Settings > Marketplace page shows connection status and provides Connect/Disconnect actions for each marketplace.

## Order Sync

Adapters return `MarketplaceOrderResult[]` from `getOrders()`:

```typescript
interface MarketplaceOrderResult {
  marketplaceOrderId: string;
  marketplaceListingId: string | null;  // Used to match to Portage listing
  title?: string;                       // Backfill source when the listing isn't in Portage
  buyerUsername: string;
  salePrice: number;
  shippingCost: number;
  marketplaceFees: number;
  currency: string;
  soldAt?: Date;
  fulfillmentStatus?: 'shipped' | 'unshipped' | 'canceled';
  shippingAddress: { name: string; street1: string; /* ... */ };
}
```

Orders match to listings via `marketplaceListingId` (not title or other ambiguous fields). External eBay sales with no Portage listing are ingested via GetItem backfill as one item + listing per ItemID.
