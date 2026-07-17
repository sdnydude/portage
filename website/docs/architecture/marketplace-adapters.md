---
id: marketplace-adapters
title: Marketplace Adapters
sidebar_position: 4
---

import ThemedImage from '@theme/ThemedImage';

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

### Listing Contract

`MarketplaceListingInput` is the normalized listing payload every adapter accepts: title, description, price + currency, category, condition, photos (with an `isPrimary` flag), optional brand/model/features, quantity, `publishMode: 'draft' | 'live'`, shipping weight + unit, and a `marketplaceSpecific: Record<string, unknown>` escape hatch for adapter-only fields. Adapters return `MarketplaceListingResult`: the `marketplaceListingId`, an optional `marketplaceUrl`, a `status` of `'active' | 'draft' | 'pending'`, and an optional non-fatal `warning`.

One field is a known trap — **`mpn` is the Manufacturer Part Number, a real part/SKU number, never the model name**. eBay's BrandMPN rule (error 25002) rejects a model name submitted as MPN, which is why the contract keeps `model` and `mpn` as separate fields (when no real MPN exists, the eBay adapter sends the "Does Not Apply" sentinel).

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

The listing lifecycle moved from the Inventory API to the Trading API in the Trade-First migration (PR #133, merged 2026-06-30, live-proven). Browse/Taxonomy APIs are hardcoded to production; all eBay APIs run in production mode (`EBAY_SANDBOX=false`). The full lifecycle mechanics — the five Trading calls, inline shipping terms, insert-first idempotency, and the serialized SKU — are documented in [eBay Trade-First Publishing](/docs/reference/ebay-trade-first).

**Why Trade-First matters to sellers.** The Trading API path removes the two biggest friction points of the old Inventory-API path. First, **no Business Policies are required to publish** — shipping terms are built inline into the `AddFixedPriceItem` payload (calculated shipping from the item's weight and dimensions, origin ZIP, USPS service), so a seller never has to set up eBay Business Policies before their first listing. Second, there is **no SKU/offer split and therefore no silent offer-state failures**: a draft is just a database row (no eBay call at all), and a live publish is a single XML round-trip that either returns a real ItemID or surfaces the error — a failed publish leaves no orphan offer behind on eBay.

### Publish Lifecycle

<ThemedImage
  alt="eBay Trade-First publish and listing lifecycle: draft = DB row only; live = single AddFixedPriceItem XML round-trip returning one ItemID, with edit/end/status operations after go-live"
  sources={{light: '/portage/img/ebay-trade-first-workflow.svg', dark: '/portage/img/ebay-trade-first-workflow-dark.svg'}}
/>

*Publish/lifecycle flow on the Trading path: drafts never touch eBay, a failed publish exits cleanly with no orphan offer, and the returned ItemID is the single handle for every later edit, end, and status operation.*

### Trade-First Migration (June 2026)

<ThemedImage
  alt="eBay Trade-First refactor architecture: route layer to adapter layer to eBay platform APIs, with the new Trading path alongside the frozen legacy Inventory path and the unchanged Browse/Taxonomy/Account/Fulfillment/Analytics APIs"
  sources={{light: '/portage/img/ebay-trade-first-architecture.svg', dark: '/portage/img/ebay-trade-first-architecture-dark.svg'}}
/>

*Migration-era architecture (dated 2026-06-27). The "Legacy — Inventory (frozen)" panel is a snapshot of the migration design: the Inventory path was kept frozen to serve pre-existing live listings during the cutover. In the shipped code the Trading lifecycle lives in `EbayAdapter` (`apps/api/src/marketplace/ebay-adapter.ts`) on the shared `ebay-trading-client.ts` transport — there is no separate `ebay-trading-adapter.ts` file.*

<ThemedImage
  alt="eBay Trade-First phase rollout timeline: five sequential phases from foundation (no eBay calls) through read path, first live create, update/end, and the deferred Inventory sunset"
  sources={{light: '/portage/img/ebay-trade-first-phases.svg', dark: '/portage/img/ebay-trade-first-phases-dark.svg'}}
/>

*The dated (2026-06-27) rollout record for the migration: five independently shippable phases, live phases gated behind `E2E_EBAY_LIVE`, with the Inventory sunset (Phase 5) deferred until active Inventory-path listings drain to zero.*

### eBay Comps

The comps system searches eBay's Browse API for recently sold and active listings matching the item:

```
GET /items/comps/search?q=<query>
```

Returns sold and active listing stats (average, median, count) plus individual comp cards that can be used to populate listing fields ("Use Title", "Use Condition" actions).

### From Scan to Fulfilled Order

<ThemedImage
  alt="End-to-end eBay pipeline: AI scan creates the item, prepare-listing adds AI fields plus comps pricing and category, AddFixedPriceItem publishes it live, then order sync via the Fulfillment API through shipping and fulfillment"
  sources={{light: '/portage/img/ebay-trade-first-pipeline.svg', dark: '/portage/img/ebay-trade-first-pipeline-dark.svg'}}
/>

*The full eBay journey — scan → item → prepare (comps + category) → Trading-API publish → order sync → ship → fulfilled — showing the data each stage hands to the next (aspects → ItemSpecifics, weight/dims → inline shipping terms). Drawn 2026-06-27 during the migration; the `ebay_api_version` marker on the listings row was a migration-era design detail and is not a column in the shipped schema.*

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

OAuth code-grant auth is obsolete — it was declared unnecessary on 2026-07-09 once per-user PAT auth was live-proven (PRs #173–#177, real Reverb listing published 2026-07-08). Token-paste PAT auth is the shipped flow.

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

For the eBay account-takeover protection model and the SKU/User-Agent hardening that backs this publish path, see [eBay ATO & Publish Hardening](/docs/reference/ebay-ato-and-publish-hardening).
