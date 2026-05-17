---
id: database
title: Database
sidebar_position: 2
---

# Database

Portage uses **PostgreSQL 15** with **Drizzle ORM** in schema-push mode (no migration files).

## Connection

| Setting | Value |
|---------|-------|
| Host | `localhost` (Docker: `portage-db`) |
| Port | `5436` |
| Database | `portage` |
| ORM | Drizzle (`apps/api/src/db/schema.ts`) |

## Schema

The database has 16 tables:

### Core Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | User accounts | `id`, `email`, `displayName`, `role` (`user`\|`admin`), `onboardingCompleted` |
| `items` | Inventory items | `id`, `userId`, `name`, `category`, `condition`, `brand`, `model`, `photos` (JSONB), `marketplaceData` (JSONB), `valueLow`/`valueHigh`/`valueMedian`, `aiConfidence` |
| `listings` | Marketplace listings | `id`, `itemId`, `userId`, `marketplace`, `marketplaceListingId`, `status`, `price`, `title`, `description` |
| `orders` | Sales orders | `id`, `listingId`, `userId`, `marketplace`, `marketplaceOrderId`, `status`, `salePrice`, `shippingAddress` (JSONB) |

### Supporting Tables

| Table | Purpose |
|-------|---------|
| `conversations` | Porter AI chat history |
| `notifications` | User notification preferences |
| `marketplace_accounts` | OAuth tokens (AES-256-GCM encrypted) |
| `listing_drafts` | Auto-saved listing drafts |
| `seller_profiles` | Return policy, shipping terms |
| `shipping_presets` | Saved package dimensions |
| `shipping_providers` | Carrier API keys (EasyPost/Shippo) |
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
photos: jsonb('photos').$type<ItemPhoto[]>()

// Order shipping address
shippingAddress: jsonb('shipping_address')

// eBay category/title cache (from prepare-listing)
marketplaceData: jsonb('marketplace_data').$type<MarketplaceData>()
```

### Encrypted Tokens

Marketplace OAuth tokens are encrypted at rest using AES-256-GCM with a dedicated `ENCRYPTION_KEY` (decoupled from `JWT_SECRET`):

```typescript
// Encrypt before storage
const encrypted = encrypt(accessToken, ENCRYPTION_KEY);

// Decrypt on read
const token = decrypt(encrypted, ENCRYPTION_KEY);
```

### Partial Unique Index

The `shipping_presets` table uses a partial unique index to enforce a single default preset per user:

```sql
CREATE UNIQUE INDEX shipping_presets_one_default_per_user
ON shipping_presets (user_id)
WHERE is_default = true;
```

This is wrapped in a database transaction for TOCTOU race protection.

## Querying

All database access goes through Drizzle's query builder with parameterized queries (no `sql.raw()`):

```typescript
// Safe parameterized query
const items = await db
  .select()
  .from(itemsTable)
  .where(eq(itemsTable.userId, userId))
  .limit(limit)
  .offset(offset);
```
