---
id: database
title: Database
sidebar_position: 2
---

import ThemedImage from '@theme/ThemedImage';

# Database

Portage uses **PostgreSQL 15** with **Drizzle ORM** in schema-push mode (no migration files).

<ThemedImage
  alt="Portage database entity relationships"
  sources={{light: '/portage/img/database-er.svg', dark: '/portage/img/database-er-dark.svg'}}
/>

## Connection

| Setting | Value |
|---------|-------|
| Host | `localhost` (Docker: `portage-db`) |
| Port | `5436` |
| Database | `portage` |
| ORM | Drizzle (`apps/api/src/db/schema.ts`) |

## Schema

The database has 18 tables:

### Core Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | User accounts | `id`, `email`, `displayName`, `role` (`user`\|`admin`), `onboardingCompleted` |
| `items` | Inventory items | `id`, `userId`, `title`, `category`, `condition`, `brand`, `model`, `photos` (JSONB), `aspects` (JSONB), `marketplaceData` (JSONB), `estimatedValueMin`/`estimatedValueMax`/`estimatedValueRecommended`, `price`, `aiConfidenceScore`, `ebaySku` |
| `listings` | Marketplace listings | `id`, `itemId`, `userId`, `marketplace`, `marketplaceListingId`, `status`, `price`, `currency`, `idempotencyKey` |
| `orders` | Sales orders | `id`, `listingId`, `userId`, `marketplace`, `marketplaceOrderId`, `status`, `salePrice`, `shippingAddress` (JSONB) |

Note that `listings` carries **no title or description** — a listing row is the marketplace binding (IDs, status, price); the content lives on the item. `listings.ebayOfferId` is inert since the Trade-First migration (PR #133): the Trading API uses a single ItemID with no SKU/offer split, and the field was removed from the adapter interface.

### Supporting Tables

| Table | Purpose |
|-------|---------|
| `conversations` | Porter AI chat history |
| `notifications` | Notification records (type, title, body, read state) — user preferences live in `users.notificationPreferences`, not here |
| `marketplace_accounts` | OAuth tokens (AES-256-GCM encrypted) |
| `listing_drafts` | Auto-saved listing drafts |
| `seller_profiles` | Return policy, shipping terms |
| `ebay_messages` | Synced eBay buyer messages |
| `faqs` | DB-backed FAQ content (admin CRUD) |
| `export_tokens` | Short-lived tokens for CSV export downloads |
| `admin_audit_log` | Admin action audit trail |
| `app_settings` | System-level configuration |
| `stripe_events` | Idempotent Stripe webhook event log |
| `design_survey_responses` | Design preference survey data |
| `design_review_comments` | Design review feedback |
| `disclaimer_acceptances` | Legal disclaimer tracking |

## Schema Management

Drizzle uses a **schema-push** workflow — the TypeScript schema file is the source of truth, and `db:push` applies changes directly:

```bash
# Apply schema changes
npm run db:push

# Open Drizzle Studio GUI
npm run db:studio
```

The schema file is at `apps/api/src/db/schema.ts`. All table definitions use Drizzle's `pgTable()` builder with TypeScript type inference.

## Key Patterns

### JSONB Columns

Photos, shipping addresses, and marketplace-specific metadata use JSONB columns for flexible nested data:

```typescript
// Item photos
photos: jsonb('photos').notNull().default([])

// Order shipping address
shippingAddress: jsonb('shipping_address')

// eBay category/title cache (from prepare-listing)
marketplaceData: jsonb('marketplace_data').$type<MarketplaceData>()

// eBay item specifics (Brand, MPN, category aspects), keyed name → string[] values
aspects: jsonb('aspects').$type<Record<string, string[]>>()
```

`items.aspects` is AI-filled at scan time and carried into every publish path, so the eBay aspect pop-up never re-asks for data already captured.

### Serialized eBay SKU

`items.ebaySku` (`PRT-000123`) is minted **once per item** from the `portage_ebay_sku_seq` sequence and reused across every (re)publish — retries never churn a fresh SKU, which keeps publishes idempotent and stays out of eBay's "rapid listing" ATO heuristic.

### Encrypted Tokens

Marketplace OAuth tokens are encrypted at rest using AES-256-GCM with a dedicated `ENCRYPTION_KEY` (decoupled from `JWT_SECRET`):

```typescript
// Encrypt before storage
const encrypted = encrypt(accessToken, ENCRYPTION_KEY);

// Decrypt on read
const token = decrypt(encrypted, ENCRYPTION_KEY);
```

### Partial Unique Index

The `listings` table uses a partial unique index on `(user_id, idempotency_key)` to make publishing idempotent — a replayed publish attempt hits the unique constraint instead of creating a duplicate listing:

```typescript
uniqueIndex('uq_listings_idempotency_key')
  .on(t.userId, t.idempotencyKey)
  .where(sql`${t.idempotencyKey} IS NOT NULL`)
```

## Querying

All database access goes through Drizzle's query builder with parameterized queries. `sql.raw()` never carries user input — its one use is a static identifier (`sql.raw('"items"."id"')` in `itemListedExpr`, `apps/api/src/routes/items.ts`) to qualify a correlated-subquery column:

```typescript
// Safe parameterized query
const items = await db
  .select()
  .from(itemsTable)
  .where(eq(itemsTable.userId, userId))
  .limit(limit)
  .offset(offset);
```
