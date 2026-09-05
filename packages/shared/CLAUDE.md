# packages/shared

Type-only monorepo package. Zero external dependencies, zero runtime code.

## Structure

```
src/
├── index.ts         # Barrel export
├── types.ts         # All type definitions (~630 lines)
├── constants.ts     # Enums and limits
└── marketplace.ts   # Adapter interface contract
```

## Import Pattern

```typescript
import type { Item, Listing, PreparedListingData } from '@portage/shared';
import { FREE_TIER_LIMITS, CONDITIONS } from '@portage/shared';
```

Consumers: `apps/api` (route typing, adapter implementation) and `apps/web` (form state, display).

## Build

`tsc` only — output to `dist/`. **Must rebuild after changes:** `npm run build -w packages/shared`

Both `apps/api` and `apps/web` depend on the compiled output, not the source.

## Key Types

| Type | Purpose |
|------|---------|
| `Item` | Scanned item with photos, condition, AI valuation |
| `Listing` | Published to marketplace (draft/active/sold/archived) |
| `Order` | Completed transaction with shipping |
| `ListingFlowState` | Frontend form state across all three listing modes |
| `ListingDraft` | Persistent draft with flow state checkpoint |
| `PreparedListingData` | AI-generated fields + marketplace-specific data |
| `CompResult` / `ReverbCompResult` | Comparable listings with price stats |
| `RecognitionResult` | AI classification candidates with value ranges |
| `SellerProfile` | Policy IDs, shipping defaults, preferred marketplaces |
| `UserPreferences` | Listing interface mode, fork preference, compact mode |

## Marketplace Adapter Interface

```typescript
interface MarketplaceAdapter {
  readonly marketplace: MarketplaceType;
  createListing(input: MarketplaceListingInput): Promise<MarketplaceListingResult>;
  updateListing(id: string, input: Partial<MarketplaceListingInput>): Promise<MarketplaceListingResult>;
  deleteListing(id: string): Promise<void>;
  getListingStatus(id: string): Promise<'active' | 'sold' | 'ended' | 'unknown'>;
  getOrders(since?: Date): Promise<MarketplaceOrderResult[]>;
  searchCategories(query: string): Promise<MarketplaceCategoryResult[]>;
}
```

`MarketplaceListingInput` includes a `marketplaceSpecific: Record<string, unknown>` escape hatch for adapter-specific fields.

## Constants

```typescript
FREE_TIER_LIMITS = { aiScansPerMonth: 25, aiListingsPerMonth: 10, bgRemovalsPerMonth: 5, porterMessagesPerDay: 20, porterExchangesPerDay: 5, marketplaces: 1 }
MARKETPLACE_TYPES = ['ebay', 'reverb']
CONDITIONS = ['new', 'like_new', 'good', 'fair', 'poor']
LISTING_STATUSES = ['draft', 'active', 'sold', 'archived']
PACKAGE_TYPES = ['box', 'envelope', 'poly_mailer']
CURRENT_DISCLAIMER_VERSION = 1
```

## Type Unions

| Union | Values |
|-------|--------|
| `MarketplaceType` | `'ebay' \| 'reverb'` |
| `ItemCondition` | `'new' \| 'like_new' \| 'good' \| 'fair' \| 'poor'` |
| `ListingInterface` | `'conversational' \| 'swipe' \| 'hybrid'` |
| `PricingStrategy` | `'fast' \| 'market' \| 'max' \| 'custom'` |
| `WeightUnit` | `'oz' \| 'lb' \| 'g' \| 'kg'` |
| `PackageType` | `'box' \| 'envelope' \| 'poly_mailer'` |

## No Validation Schemas

Raw TypeScript types only. No Zod, Yup, or runtime validation. All validation happens in consuming packages.
