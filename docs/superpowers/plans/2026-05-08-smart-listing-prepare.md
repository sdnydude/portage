# Smart Listing Prepare Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Deploy multiple subagents in parallel** for independent tasks.

**Goal:** Replace single-photo capture with a 4-12 photo grid (crop, rotate, enhance, BG remove), add a seller profile settings page, build a `prepare-listing` endpoint that auto-fetches comps + AI-generates all eBay/Reverb fields, and display results in a preview card with comps pricing widget.

**Architecture:** Backend-first — shared types → DB schema → server endpoints → frontend components. The `prepare-listing` endpoint runs eBay category suggestion, eBay comps, and Reverb comps in parallel, then feeds all data to a Claude second-pass that returns `PreparedListingData`. Frontend consumes this via `usePrepareListingHook` and renders a tap-to-edit preview card.

**Tech Stack:** TypeScript, Express 5, Drizzle ORM, Sharp, React 19, Next.js 16, Tailwind v4, Claude Vision API (multi-provider), eBay Inventory/Taxonomy/Browse APIs, Reverb REST API.

**Spec:** `docs/superpowers/specs/2026-05-08-smart-listing-prepare-design.md`

---

## Phase 1: Foundation (Types + Schema)

### Task 1: Shared Types — PreparedListingData + SellerProfile

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/marketplace.ts`

- [ ] **Step 1: Add types to `packages/shared/src/types.ts`**

Append after the existing `UserPreferences` interface (line ~311):

```typescript
export type ItemCondition = 'new' | 'like_new' | 'good' | 'fair' | 'poor';

export type WeightUnit = 'oz' | 'lb' | 'g' | 'kg';
export type DimensionUnit = 'in' | 'cm';

export interface SellerProfile {
  id: string;
  userId: string;
  ebayFulfillmentPolicyId: string | null;
  ebayPaymentPolicyId: string | null;
  ebayReturnPolicyId: string | null;
  ebayMerchantLocationKey: string | null;
  reverbOffersEnabled: boolean;
  reverbDefaultShipping: ReverbShippingDefaults | null;
  shipFromAddress: ShipFromAddress | null;
  defaultWeightUnit: WeightUnit;
  defaultDimensionUnit: DimensionUnit;
  defaultPackageType: PackageType;
  preferredMarketplaces: MarketplaceType[];
  autoPublish: boolean;
  defaultCurrency: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReverbShippingDefaults {
  rates: Array<{ regionCode: string; rate: { amount: string; currency: string } }>;
  local: boolean;
}

export interface PricingData {
  suggested: number;
  low: number;
  high: number;
  currency: string;
  confidence: 'high' | 'medium' | 'low';
  basedOn: number;
  conditionMatch: 'exact' | 'nearby' | 'all';
}

export interface ReverbCompListing {
  title: string;
  price: number;
  currency: string;
  condition: string;
  imageUrl: string | null;
  listingUrl: string;
}

export interface ReverbCompResult {
  listings: ReverbCompListing[];
  stats: {
    median: number | null;
    avg: number | null;
    sampleSize: number;
  };
}

export interface EbayPreparedFields {
  title: string;
  categoryId: string;
  categoryName: string;
  condition: string;
  conditionDescription: string;
  aspects: Record<string, string[]>;
  upc: string | null;
  epid: string | null;
  weight: { value: number; unit: string };
  dimensions: { length: number; width: number; height: number; unit: string };
  packageType: string;
  fulfillmentPolicyId: string;
  paymentPolicyId: string;
  returnPolicyId: string;
  merchantLocationKey: string;
}

export interface ReverbPreparedFields {
  make: string;
  model: string;
  title: string;
  categoryUuid: string;
  categoryName: string;
  conditionUuid: string;
  conditionName: string;
  year: string | null;
  finish: string | null;
  description: string;
  shippingRates: Array<{ regionCode: string; rate: { amount: string; currency: string } }>;
  offersEnabled: boolean;
}

export interface PreparedListingData {
  title: string;
  description: string;
  condition: ItemCondition;
  conditionDescription: string;
  brand: string;
  model: string;
  pricing: PricingData;
  comps: {
    ebay: CompResult | null;
    reverb: ReverbCompResult | null;
  };
  ebay: EbayPreparedFields | null;
  reverb: ReverbPreparedFields | null;
  isMusicGear: boolean;
  aiConfidence: number;
  warnings: string[];
}

export interface EbayPolicy {
  policyId: string;
  name: string;
  description?: string;
}

export interface EbayPoliciesResponse {
  fulfillment: EbayPolicy[];
  payment: EbayPolicy[];
  returnPolicy: EbayPolicy[];
}
```

- [ ] **Step 2: Add `MarketplaceType` re-export to `packages/shared/src/marketplace.ts`**

The `MarketplaceType` already exists in marketplace.ts. No change needed — the new types in types.ts reference it. Verify it's exported:

```bash
grep "MarketplaceType" packages/shared/src/marketplace.ts
```

Expected: `export type MarketplaceType = 'ebay' | 'etsy' | 'reverb';`

- [ ] **Step 3: Rebuild shared package**

```bash
npm run build -w packages/shared
```

Expected: clean build, no errors.

- [ ] **Step 4: Typecheck all workspaces**

```bash
npm run typecheck
```

Expected: passes (new types are additive, nothing consumes them yet).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat(shared): add PreparedListingData, SellerProfile, and pricing types"
```

---

### Task 2: Database Schema — seller_profiles Table

**Files:**
- Modify: `apps/api/src/db/schema.ts`

- [ ] **Step 1: Add `sellerProfiles` table to schema**

Add after the `listingDrafts` table definition (after line ~223):

```typescript
export const sellerProfiles = pgTable('seller_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  ebayFulfillmentPolicyId: varchar('ebay_fulfillment_policy_id', { length: 100 }),
  ebayPaymentPolicyId: varchar('ebay_payment_policy_id', { length: 100 }),
  ebayReturnPolicyId: varchar('ebay_return_policy_id', { length: 100 }),
  ebayMerchantLocationKey: varchar('ebay_merchant_location_key', { length: 100 }),
  reverbOffersEnabled: boolean('reverb_offers_enabled').notNull().default(true),
  reverbDefaultShipping: jsonb('reverb_default_shipping'),
  shipFromAddress: jsonb('ship_from_address'),
  defaultWeightUnit: varchar('default_weight_unit', { length: 5 }).notNull().default('oz'),
  defaultDimensionUnit: varchar('default_dimension_unit', { length: 5 }).notNull().default('in'),
  defaultPackageType: packageTypeEnum('default_package_type').notNull().default('box'),
  preferredMarketplaces: jsonb('preferred_marketplaces').notNull().default(['ebay']),
  autoPublish: boolean('auto_publish').notNull().default(false),
  defaultCurrency: varchar('default_currency', { length: 3 }).notNull().default('USD'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

- [ ] **Step 2: Push schema to database**

```bash
npm run db:push
```

Expected: creates `seller_profiles` table. Drizzle outputs the SQL it runs.

- [ ] **Step 3: Verify with typecheck**

```bash
npm run typecheck
```

Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/db/schema.ts
git commit -m "feat(db): add seller_profiles table for marketplace account settings"
```

---

## Phase 2A: Backend — Image Endpoints + Seller Profile Route

> Tasks 3 and 4 are independent and can run in **parallel**.

### Task 3: Image Rotate + Crop Endpoints

**Files:**
- Modify: `apps/api/src/routes/images.ts`
- Modify: `apps/api/src/lib/image.ts`

- [ ] **Step 1: Add `rotateImage` and `cropImage` to `apps/api/src/lib/image.ts`**

Append after the `generateThumbnail` function:

```typescript
export async function rotateImage(input: Buffer, degrees: 90 | 180 | 270): Promise<ProcessedImage> {
  const image = sharp(input).rotate(degrees).webp({ quality: QUALITY });
  const buffer = await image.toBuffer();
  const meta = await sharp(buffer).metadata();

  return {
    buffer,
    width: meta.width!,
    height: meta.height!,
    format: 'webp',
    size: buffer.length,
  };
}

export async function cropImage(
  input: Buffer,
  crop: { x: number; y: number; width: number; height: number },
): Promise<ProcessedImage> {
  const image = sharp(input)
    .extract({ left: Math.round(crop.x), top: Math.round(crop.y), width: Math.round(crop.width), height: Math.round(crop.height) })
    .webp({ quality: QUALITY });

  const buffer = await image.toBuffer();
  const meta = await sharp(buffer).metadata();

  return {
    buffer,
    width: meta.width!,
    height: meta.height!,
    format: 'webp',
    size: buffer.length,
  };
}
```

- [ ] **Step 2: Add rotate endpoint to `apps/api/src/routes/images.ts`**

Add after the `remove-bg` endpoint (after line ~191), before the `GET /r2/*` route:

```typescript
const rotateSchema = z.object({
  imageUrl: z.string().url(),
  degrees: z.union([z.literal(90), z.literal(180), z.literal(270)]),
});

imagesRouter.post('/rotate', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const { imageUrl, degrees } = rotateSchema.parse(req.body);

    if (!isAllowedImageOrigin(imageUrl)) {
      throw new AppError(400, 'INVALID_ORIGIN', 'Image URL must be from Portage storage');
    }

    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new AppError(400, 'FETCH_FAILED', 'Could not fetch the image');
    }

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_FETCH_SIZE) {
      throw new AppError(400, 'FILE_TOO_LARGE', `Image exceeds ${MAX_FETCH_SIZE / 1024 / 1024}MB limit`);
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_FETCH_SIZE) {
      throw new AppError(400, 'FILE_TOO_LARGE', `Image exceeds ${MAX_FETCH_SIZE / 1024 / 1024}MB limit`);
    }
    const inputBuffer = Buffer.from(arrayBuffer);

    const rotated = await rotateImage(inputBuffer, degrees);
    const uploaded = await uploadImage(userId, rotated.buffer, 'image/webp', '_rotated.webp');

    logger.info({ userId, key: uploaded.key, degrees }, 'Image rotated');

    res.json({
      image: {
        key: uploaded.key,
        url: uploaded.url,
        width: rotated.width,
        height: rotated.height,
        size: rotated.size,
      },
    });
  } catch (err) {
    next(err);
  }
});
```

Add the import at the top of images.ts:

```typescript
import { processImage, generateThumbnail, enhanceImage, rotateImage, cropImage } from '../lib/image.js';
```

- [ ] **Step 3: Add crop endpoint to `apps/api/src/routes/images.ts`**

Add after the rotate endpoint:

```typescript
const cropSchema = z.object({
  imageUrl: z.string().url(),
  crop: z.object({
    x: z.number().min(0),
    y: z.number().min(0),
    width: z.number().positive(),
    height: z.number().positive(),
  }),
});

imagesRouter.post('/crop', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const { imageUrl, crop } = cropSchema.parse(req.body);

    if (!isAllowedImageOrigin(imageUrl)) {
      throw new AppError(400, 'INVALID_ORIGIN', 'Image URL must be from Portage storage');
    }

    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new AppError(400, 'FETCH_FAILED', 'Could not fetch the image');
    }

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_FETCH_SIZE) {
      throw new AppError(400, 'FILE_TOO_LARGE', `Image exceeds ${MAX_FETCH_SIZE / 1024 / 1024}MB limit`);
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_FETCH_SIZE) {
      throw new AppError(400, 'FILE_TOO_LARGE', `Image exceeds ${MAX_FETCH_SIZE / 1024 / 1024}MB limit`);
    }
    const inputBuffer = Buffer.from(arrayBuffer);

    const cropped = await cropImage(inputBuffer, crop);
    const uploaded = await uploadImage(userId, cropped.buffer, 'image/webp', '_cropped.webp');

    logger.info({ userId, key: uploaded.key }, 'Image cropped');

    res.json({
      image: {
        key: uploaded.key,
        url: uploaded.url,
        width: cropped.width,
        height: cropped.height,
        size: cropped.size,
      },
    });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: passes.

- [ ] **Step 5: Test manually**

Restart the API server and test with curl:

```bash
curl -X POST https://10.0.0.251:8016/images/rotate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"imageUrl": "https://portage-images.digitalharmonyai.com/items/test/photo.webp", "degrees": 90}'
```

Expected: 200 with `{ image: { key, url, width, height, size } }`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/lib/image.ts apps/api/src/routes/images.ts
git commit -m "feat(api): add rotate and crop image endpoints"
```

---

### Task 4: Seller Profile Route

**Files:**
- Create: `apps/api/src/routes/seller-profile.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Create `apps/api/src/routes/seller-profile.ts`**

```typescript
import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { db } from '../db/index.js';
import { sellerProfiles, marketplaceAccounts } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { getEbayAccessToken } from '../marketplace/token-manager.js';
import { env } from '../lib/env.js';

const logger = pino({ name: 'seller-profile' });

export const sellerProfileRouter = Router();

sellerProfileRouter.use(requireAuth);

sellerProfileRouter.get('/', async (req, res, next) => {
  try {
    const userId = req.user!.sub;

    let [profile] = await db.select()
      .from(sellerProfiles)
      .where(eq(sellerProfiles.userId, userId))
      .limit(1);

    if (!profile) {
      [profile] = await db.insert(sellerProfiles)
        .values({ userId })
        .returning();
      logger.info({ userId }, 'Created default seller profile');
    }

    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

const updateSchema = z.object({
  ebayFulfillmentPolicyId: z.string().nullable().optional(),
  ebayPaymentPolicyId: z.string().nullable().optional(),
  ebayReturnPolicyId: z.string().nullable().optional(),
  ebayMerchantLocationKey: z.string().nullable().optional(),
  reverbOffersEnabled: z.boolean().optional(),
  reverbDefaultShipping: z.object({
    rates: z.array(z.object({
      regionCode: z.string(),
      rate: z.object({ amount: z.string(), currency: z.string() }),
    })),
    local: z.boolean(),
  }).nullable().optional(),
  shipFromAddress: z.object({
    name: z.string(),
    street1: z.string(),
    street2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    country: z.string(),
  }).nullable().optional(),
  defaultWeightUnit: z.enum(['oz', 'lb', 'g', 'kg']).optional(),
  defaultDimensionUnit: z.enum(['in', 'cm']).optional(),
  defaultPackageType: z.enum(['box', 'envelope', 'poly_mailer']).optional(),
  preferredMarketplaces: z.array(z.enum(['ebay', 'etsy', 'reverb'])).optional(),
  autoPublish: z.boolean().optional(),
  defaultCurrency: z.string().length(3).optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field required' });

sellerProfileRouter.patch('/', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const body = updateSchema.parse(req.body);

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined) updates[key] = value;
    }

    const [existing] = await db.select({ id: sellerProfiles.id })
      .from(sellerProfiles)
      .where(eq(sellerProfiles.userId, userId))
      .limit(1);

    let profile;
    if (existing) {
      [profile] = await db.update(sellerProfiles)
        .set(updates)
        .where(eq(sellerProfiles.userId, userId))
        .returning();
    } else {
      [profile] = await db.insert(sellerProfiles)
        .values({ userId, ...updates })
        .returning();
    }

    logger.info({ userId, updatedFields: Object.keys(body) }, 'Seller profile updated');
    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

sellerProfileRouter.get('/ebay-policies', async (req, res, next) => {
  try {
    const userId = req.user!.sub;

    const [account] = await db.select()
      .from(marketplaceAccounts)
      .where(eq(marketplaceAccounts.userId, userId))
      .limit(1);

    if (!account) {
      res.json({ fulfillment: [], payment: [], returnPolicy: [] });
      return;
    }

    const token = await getEbayAccessToken(userId);
    const baseUrl = env().EBAY_SANDBOX
      ? 'https://api.sandbox.ebay.com'
      : 'https://api.ebay.com';

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const [fulfillmentRes, paymentRes, returnRes] = await Promise.allSettled([
      fetch(`${baseUrl}/sell/account/v1/fulfillment_policy?marketplace_id=EBAY_US`, { headers }),
      fetch(`${baseUrl}/sell/account/v1/payment_policy?marketplace_id=EBAY_US`, { headers }),
      fetch(`${baseUrl}/sell/account/v1/return_policy?marketplace_id=EBAY_US`, { headers }),
    ]);

    const extractPolicies = async (result: PromiseSettledResult<Response>, key: string) => {
      if (result.status === 'rejected') return [];
      if (!result.value.ok) return [];
      const data = await result.value.json() as Record<string, Array<{ [k: string]: string }>>;
      const policies = data[key] ?? [];
      return policies.map((p: Record<string, string>) => ({
        policyId: p.fulfillmentPolicyId ?? p.paymentPolicyId ?? p.returnPolicyId ?? p.policyId,
        name: p.name ?? 'Unnamed',
        description: p.description,
      }));
    };

    const fulfillment = await extractPolicies(fulfillmentRes, 'fulfillmentPolicies');
    const payment = await extractPolicies(paymentRes, 'paymentPolicies');
    const returnPolicy = await extractPolicies(returnRes, 'returnPolicies');

    res.json({ fulfillment, payment, returnPolicy });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 2: Register route in `apps/api/src/index.ts`**

Add import:
```typescript
import { sellerProfileRouter } from './routes/seller-profile.js';
```

Add route registration (after the preferences line):
```typescript
app.use('/seller-profile', sellerProfileRouter);
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/seller-profile.ts apps/api/src/index.ts
git commit -m "feat(api): add seller profile route with eBay policies fetch"
```

---

## Phase 2B: Backend — Reverb Adapter + eBay Enhancements

> Tasks 5 and 6 are independent and can run in **parallel**.

### Task 5: Reverb Adapter

**Files:**
- Create: `apps/api/src/marketplace/reverb-adapter.ts`

- [ ] **Step 1: Create `apps/api/src/marketplace/reverb-adapter.ts`**

```typescript
import { pino } from 'pino';
import { env } from '../lib/env.js';
import type {
  MarketplaceAdapter,
  MarketplaceListingInput,
  MarketplaceListingResult,
  MarketplaceOrderResult,
  MarketplaceCategoryResult,
} from '@portage/shared';

const logger = pino({ name: 'reverb-adapter' });

const REVERB_BASE = 'https://api.reverb.com/api';

const CONDITION_MAP: Record<string, string> = {
  new: 'fbf35668-96a0-4baa-bcde-ab18d6b1b329',
  like_new: 'ac5b9c1e-dc78-466d-b0b3-a19b46876097',
  good: 'f7a3f48c-972a-44c6-b01a-0cd27488d3ab',
  fair: '98777886-76d0-44a8-8e36-e0b8884c4c6f',
  poor: 'cda44a45-f57a-4891-a29e-a75e0afb8df0',
};

let cachedConditions: Array<{ uuid: string; displayName: string }> | null = null;

export class ReverbAdapter implements MarketplaceAdapter {
  readonly marketplace = 'reverb' as const;

  constructor(private readonly apiToken: string) {}

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${REVERB_BASE}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/hal+json',
        'Accept': 'application/hal+json',
        'Accept-Version': '3.0',
        ...options.headers as Record<string, string>,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error({ status: response.status, path, body: errorBody }, 'Reverb API error');
      throw new Error(`Reverb API error: ${response.status} on ${path}`);
    }

    if (response.status === 204) return {} as T;
    return response.json() as Promise<T>;
  }

  async createListing(input: MarketplaceListingInput): Promise<MarketplaceListingResult> {
    const specific = input.marketplaceSpecific ?? {};
    const conditionUuid = specific.conditionUuid as string
      ?? CONDITION_MAP[input.condition] ?? CONDITION_MAP.good;

    const body: Record<string, unknown> = {
      make: input.brand ?? '',
      model: input.model ?? '',
      title: input.title,
      description: input.description,
      condition: { uuid: conditionUuid },
      price: { amount: String(input.price), currency: input.currency },
      has_inventory: true,
      inventory: 1,
      photos: input.photos.map(p => p.url),
    };

    if (specific.categoryUuid) {
      body.categories = [{ uuid: specific.categoryUuid }];
    }
    if (specific.year) body.year = specific.year;
    if (specific.finish) body.finish = specific.finish;
    if (specific.offersEnabled !== undefined) body.offers_enabled = specific.offersEnabled;
    if (specific.shippingRates) {
      body.shipping = { rates: specific.shippingRates, local: specific.localPickup ?? false };
    }

    const data = await this.request<{ listing: { id: number; state: string; _links: { web: { href: string } } } }>(
      '/listings',
      { method: 'POST', body: JSON.stringify(body) },
    );

    logger.info({ listingId: data.listing.id }, 'Reverb listing created');

    return {
      marketplaceListingId: String(data.listing.id),
      marketplaceUrl: data.listing._links.web.href,
      status: data.listing.state === 'live' ? 'active' : 'draft',
    };
  }

  async updateListing(marketplaceListingId: string, input: Partial<MarketplaceListingInput>): Promise<MarketplaceListingResult> {
    const updates: Record<string, unknown> = {};
    if (input.title) updates.title = input.title;
    if (input.description) updates.description = input.description;
    if (input.price) updates.price = { amount: String(input.price), currency: input.currency ?? 'USD' };

    await this.request(`/listings/${marketplaceListingId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });

    return {
      marketplaceListingId,
      marketplaceUrl: `https://reverb.com/item/${marketplaceListingId}`,
      status: 'active',
    };
  }

  async deleteListing(marketplaceListingId: string): Promise<void> {
    await this.request(`/listings/${marketplaceListingId}`, { method: 'DELETE' });
  }

  async getListingStatus(marketplaceListingId: string): Promise<'active' | 'sold' | 'ended' | 'unknown'> {
    try {
      const data = await this.request<{ state: string }>(`/listings/${marketplaceListingId}`);
      switch (data.state) {
        case 'live': return 'active';
        case 'sold': return 'sold';
        case 'ended': return 'ended';
        default: return 'unknown';
      }
    } catch {
      return 'unknown';
    }
  }

  async getOrders(since?: Date): Promise<MarketplaceOrderResult[]> {
    const params = new URLSearchParams();
    if (since) params.set('created_after', since.toISOString());

    const data = await this.request<{
      orders?: Array<{
        order_number: string;
        buyer_name: string;
        amount_product: { amount: string; currency: string };
        shipping: { amount: string };
        shipping_address?: {
          name: string;
          street_address: string;
          extended_address?: string;
          locality: string;
          region: string;
          postal_code: string;
          country_code: string;
        };
      }>;
    }>(`/my/orders/selling?${params}`);

    return (data.orders ?? []).map(order => ({
      marketplaceOrderId: order.order_number,
      buyerUsername: order.buyer_name,
      salePrice: parseFloat(order.amount_product.amount),
      shippingCost: parseFloat(order.shipping?.amount ?? '0'),
      marketplaceFees: 0,
      currency: order.amount_product.currency,
      shippingAddress: {
        name: order.shipping_address?.name ?? '',
        street1: order.shipping_address?.street_address ?? '',
        street2: order.shipping_address?.extended_address,
        city: order.shipping_address?.locality ?? '',
        state: order.shipping_address?.region ?? '',
        zip: order.shipping_address?.postal_code ?? '',
        country: order.shipping_address?.country_code ?? 'US',
      },
    }));
  }

  async searchCategories(query: string): Promise<MarketplaceCategoryResult[]> {
    const data = await this.request<{
      categories?: Array<{
        uuid: string;
        full_name: string;
      }>;
    }>(`/categories/flat?query=${encodeURIComponent(query)}`);

    return (data.categories ?? []).map(cat => ({
      id: cat.uuid,
      name: cat.full_name,
      path: cat.full_name.split(' > '),
      isLeaf: true,
    }));
  }

  static async getConditions(): Promise<Array<{ uuid: string; displayName: string }>> {
    if (cachedConditions) return cachedConditions;

    const response = await fetch(`${REVERB_BASE}/listing_conditions`, {
      headers: { 'Accept': 'application/hal+json', 'Accept-Version': '3.0' },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Reverb conditions: ${response.status}`);
    }

    const data = await response.json() as {
      conditions: Array<{ uuid: string; display_name: string }>;
    };

    cachedConditions = data.conditions.map(c => ({
      uuid: c.uuid,
      displayName: c.display_name,
    }));

    return cachedConditions;
  }

  static async searchComps(query: string): Promise<{
    listings: Array<{ title: string; price: number; currency: string; condition: string; imageUrl: string | null; listingUrl: string }>;
    stats: { median: number | null; avg: number | null; sampleSize: number };
  }> {
    const token = env().REVERB_API_TOKEN;
    if (!token) {
      return { listings: [], stats: { median: null, avg: null, sampleSize: 0 } };
    }

    const response = await fetch(
      `${REVERB_BASE}/comparison_shopping_pages?query=${encodeURIComponent(query)}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/hal+json',
          'Accept-Version': '3.0',
        },
      },
    );

    if (!response.ok) {
      logger.error({ status: response.status, query }, 'Reverb comps search failed');
      return { listings: [], stats: { median: null, avg: null, sampleSize: 0 } };
    }

    const data = await response.json() as {
      comparison_shopping_pages?: Array<{
        title: string;
        estimated_value?: { price_center?: { amount: string; currency: string } };
        _links?: { web?: { href: string } };
      }>;
    };

    const pages = data.comparison_shopping_pages ?? [];
    const listings = pages.map(p => ({
      title: p.title,
      price: parseFloat(p.estimated_value?.price_center?.amount ?? '0'),
      currency: p.estimated_value?.price_center?.currency ?? 'USD',
      condition: 'Various',
      imageUrl: null,
      listingUrl: p._links?.web?.href ?? '',
    })).filter(l => l.price > 0);

    const prices = listings.map(l => l.price);
    const sorted = [...prices].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length === 0 ? null
      : sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    const avg = prices.length === 0 ? null
      : Math.round(prices.reduce((s, p) => s + p, 0) / prices.length * 100) / 100;

    return {
      listings,
      stats: { median, avg, sampleSize: listings.length },
    };
  }
}
```

- [ ] **Step 2: Add `REVERB_API_TOKEN` to env schema**

In `apps/api/src/lib/env.ts`, add after `EASYPOST_API_KEY`:

```typescript
REVERB_API_TOKEN: z.string().optional(),
```

- [ ] **Step 3: Wire Reverb into listings route**

In `apps/api/src/routes/listings.ts`, update the `getAdapter` function:

```typescript
import { ReverbAdapter } from '../marketplace/reverb-adapter.js';
```

Replace the reverb case:
```typescript
case 'reverb': {
  const reverbToken = env().REVERB_API_TOKEN;
  if (!reverbToken) throw new AppError(400, 'NOT_CONFIGURED', 'Reverb API token not configured');
  return new ReverbAdapter(reverbToken);
}
```

Add env import if not present:
```typescript
import { env } from '../lib/env.js';
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/marketplace/reverb-adapter.ts apps/api/src/lib/env.ts apps/api/src/routes/listings.ts
git commit -m "feat(api): add Reverb marketplace adapter with comps search"
```

---

### Task 6: eBay Adapter — Category Suggestion + Required Aspects

**Files:**
- Modify: `apps/api/src/marketplace/ebay-adapter.ts`

- [ ] **Step 1: Add `getCategorySuggestion` method**

Add as a static method on `EbayAdapter` (after `searchComps`):

```typescript
static async getCategorySuggestion(query: string): Promise<{ categoryId: string; categoryName: string } | null> {
  const token = await getEbayProdAppToken();

  const response = await fetch(
    `https://api.ebay.com/commerce/taxonomy/v1/category_tree/0/get_category_suggestions?q=${encodeURIComponent(query)}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    },
  );

  if (!response.ok) {
    logger.error({ status: response.status, query }, 'eBay category suggestion failed');
    return null;
  }

  const data = await response.json() as {
    categorySuggestions?: Array<{
      category: { categoryId: string; categoryName: string };
    }>;
  };

  const first = data.categorySuggestions?.[0];
  if (!first) return null;

  return {
    categoryId: first.category.categoryId,
    categoryName: first.category.categoryName,
  };
}
```

- [ ] **Step 2: Add `getRequiredAspects` method**

Add as another static method:

```typescript
static async getRequiredAspects(categoryId: string): Promise<Record<string, { required: boolean; values: string[] | null }>> {
  const token = await getEbayProdAppToken();

  const response = await fetch(
    `https://api.ebay.com/commerce/taxonomy/v1/category_tree/0/get_item_aspects_for_category?category_id=${categoryId}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    },
  );

  if (!response.ok) {
    logger.error({ status: response.status, categoryId }, 'eBay aspects fetch failed');
    return {};
  }

  const data = await response.json() as {
    aspects?: Array<{
      localizedAspectName: string;
      aspectConstraint?: { aspectRequired?: boolean };
      aspectValues?: Array<{ localizedValue: string }>;
    }>;
  };

  const result: Record<string, { required: boolean; values: string[] | null }> = {};
  for (const aspect of data.aspects ?? []) {
    result[aspect.localizedAspectName] = {
      required: aspect.aspectConstraint?.aspectRequired ?? false,
      values: aspect.aspectValues?.map(v => v.localizedValue) ?? null,
    };
  }

  return result;
}
```

- [ ] **Step 3: Update `createListing` to send full fields**

Replace the `createListing` method body to include aspects, conditionDescription, weight, dimensions, UPC, ePID:

```typescript
async createListing(input: MarketplaceListingInput): Promise<MarketplaceListingResult> {
  const sku = `portage-${Date.now()}`;
  const ebayCondition = CONDITION_MAP[input.condition] ?? 'GOOD';
  const specific = input.marketplaceSpecific ?? {};

  const product: Record<string, unknown> = {
    title: input.title,
    description: input.description,
    imageUrls: input.photos.map((p) => p.url),
  };

  if (input.brand) product.brand = input.brand;
  if (input.model) product.mpn = input.model;
  if (specific.upc) product.upc = [specific.upc as string];
  if (specific.epid) product.epid = specific.epid;
  if (specific.aspects) product.aspects = specific.aspects;

  const inventoryItem: Record<string, unknown> = {
    availability: { shipToLocationAvailability: { quantity: 1 } },
    condition: ebayCondition,
    product,
  };

  if (specific.conditionDescription) {
    inventoryItem.conditionDescription = specific.conditionDescription;
  }

  if (specific.weight || specific.dimensions) {
    const pkg: Record<string, unknown> = {};
    if (specific.weight) {
      pkg.weight = specific.weight;
    }
    if (specific.dimensions) {
      pkg.dimensions = specific.dimensions;
    }
    if (specific.packageType) {
      pkg.packageType = specific.packageType;
    }
    inventoryItem.packageWeightAndSize = pkg;
  }

  await this.request(`/sell/inventory/v1/inventory_item/${sku}`, {
    method: 'PUT',
    body: JSON.stringify(inventoryItem),
  });

  logger.info({ userId: this.userId, sku }, 'eBay inventory item created');

  const categoryId = specific.categoryId as string | undefined;

  const offerData = await this.request<{ offerId: string }>('/sell/inventory/v1/offer', {
    method: 'POST',
    body: JSON.stringify({
      sku,
      marketplaceId: 'EBAY_US',
      format: 'FIXED_PRICE',
      listingDescription: input.description,
      pricingSummary: {
        price: { value: String(input.price), currency: input.currency },
      },
      categoryId: categoryId ?? '99',
      merchantLocationKey: (specific.merchantLocationKey as string) ?? 'default',
      listingPolicies: {
        fulfillmentPolicyId: specific.fulfillmentPolicyId,
        paymentPolicyId: specific.paymentPolicyId,
        returnPolicyId: specific.returnPolicyId,
      },
    }),
  });

  let listingId: string;
  let status: 'active' | 'draft' | 'pending' = 'draft';

  try {
    const publishResult = await this.request<{ listingId: string }>(
      `/sell/inventory/v1/offer/${offerData.offerId}/publish`,
      { method: 'POST' },
    );
    listingId = publishResult.listingId;
    status = 'active';
    logger.info({ userId: this.userId, listingId }, 'eBay listing published');
  } catch {
    listingId = offerData.offerId;
    status = 'draft';
    logger.warn({ userId: this.userId, offerId: offerData.offerId }, 'eBay listing created as draft — publish failed');
  }

  return {
    marketplaceListingId: listingId,
    marketplaceUrl: `https://www.ebay.com/itm/${listingId}`,
    status,
  };
}
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/marketplace/ebay-adapter.ts
git commit -m "feat(api): add eBay category suggestion, aspects, and full inventory fields"
```

---

## Phase 2C: Backend — Prepare Listing Endpoint

> Depends on Tasks 4, 5, 6 being complete.

### Task 7: AI Second-Pass Prompt + Prepare Listing Route

**Files:**
- Modify: `apps/api/src/lib/vision.ts`
- Create: `apps/api/src/routes/prepare-listing.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Add `generateListingFields` to `apps/api/src/lib/vision.ts`**

Append after the existing `identifyItemDetailed` function:

```typescript
const LISTING_FIELDS_SYSTEM_PROMPT = `You are a marketplace listing expert. Generate production-quality fields for selling a used item on eBay and optionally Reverb.

RULES:
- eBay title must be ≤80 characters. Pack keywords: Brand + Model + Key Attributes + Condition hint
- Fill ALL required item specifics from the provided aspects list. Use "N/A" only as last resort.
- Condition description must reference specific wear visible in photos (scratches, scuffs, patina, etc.)
- If no wear is visible, say "Item appears to be in [condition] condition with no visible wear."
- Price suggestion should target slightly below sold median for faster sale
- Weight and dimensions are visual estimates — always flag as estimated
- Determine if item is music gear (instruments, amps, pedals, audio equipment, accessories)
- If music gear, fill Reverb fields. If not, set reverb to null and isMusicGear to false.

OUTPUT: JSON matching the schema provided. No markdown, no explanation — ONLY valid JSON.`;

export interface ListingFieldsInput {
  scanData: {
    brand: string;
    model: string;
    category: string;
    condition: string;
    conditionNotes: string;
    features: string[];
    description: string;
  };
  photoUrls: string[];
  ebayCategorySuggestion: { categoryId: string; categoryName: string } | null;
  requiredAspects: Record<string, { required: boolean; values: string[] | null }>;
  soldComps: Array<{ title: string; price: number; condition: string; soldDate: string | null }>;
  activeComps: Array<{ title: string; price: number; condition: string }>;
  reverbComps: Array<{ title: string; price: number; condition: string }>;
  sellerDefaults: {
    weightUnit: string;
    dimensionUnit: string;
    packageType: string;
    currency: string;
  };
}

export interface ListingFieldsOutput {
  title: string;
  description: string;
  condition: string;
  conditionDescription: string;
  brand: string;
  model: string;
  isMusicGear: boolean;
  aiConfidence: number;
  ebay: {
    title: string;
    categoryId: string;
    categoryName: string;
    condition: string;
    conditionDescription: string;
    aspects: Record<string, string[]>;
    upc: string | null;
    epid: string | null;
    weight: { value: number; unit: string };
    dimensions: { length: number; width: number; height: number; unit: string };
    packageType: string;
  } | null;
  reverb: {
    make: string;
    model: string;
    title: string;
    categoryUuid: string;
    categoryName: string;
    conditionUuid: string;
    conditionName: string;
    year: string | null;
    finish: string | null;
    description: string;
  } | null;
}

export async function generateListingFields(input: ListingFieldsInput): Promise<ListingFieldsOutput> {
  const userPrompt = `ITEM SCAN DATA:
${JSON.stringify(input.scanData, null, 2)}

PHOTOS: ${JSON.stringify(input.photoUrls)}

EBAY CATEGORY SUGGESTION: ${JSON.stringify(input.ebayCategorySuggestion)}

REQUIRED ITEM SPECIFICS FOR THIS CATEGORY:
${JSON.stringify(input.requiredAspects, null, 2)}

SOLD COMPS (eBay): ${JSON.stringify(input.soldComps.slice(0, 10))}

ACTIVE COMPS (eBay): ${JSON.stringify(input.activeComps.slice(0, 10))}

REVERB COMPS: ${JSON.stringify(input.reverbComps.slice(0, 10))}

SELLER DEFAULTS: ${JSON.stringify(input.sellerDefaults)}

Generate all listing fields as JSON.`;

  const { text } = await analyzeImage(
    '',
    'text/plain',
    LISTING_FIELDS_SYSTEM_PROMPT,
    userPrompt,
  );

  return JSON.parse(extractJSON(text)) as ListingFieldsOutput;
}
```

Note: The `analyzeImage` function needs to be updated to handle text-only calls (no image). If the existing implementation requires an image, add a separate `analyzeText` function to `ai-client.ts` that uses the chat chain instead of the vision chain. The subagent implementing this should check whether `analyzeImage` works with an empty base64 string and adapt accordingly.

- [ ] **Step 2: Create `apps/api/src/routes/prepare-listing.ts`**

```typescript
import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { db } from '../db/index.js';
import { items, sellerProfiles } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { EbayAdapter } from '../marketplace/ebay-adapter.js';
import { ReverbAdapter } from '../marketplace/reverb-adapter.js';
import { generateListingFields } from '../lib/vision.js';
import type { PreparedListingData, PricingData, CompResult, ReverbCompResult } from '@portage/shared';

const logger = pino({ name: 'prepare-listing' });

export const prepareListingRouter = Router();

prepareListingRouter.use(requireAuth);

const prepareSchema = z.object({
  targetMarketplaces: z.array(z.enum(['ebay', 'reverb'])).min(1),
});

const EBAY_CONDITION_MAP: Record<string, string> = {
  new: 'NEW',
  like_new: 'LIKE_NEW',
  good: 'GOOD',
  fair: 'GOOD',
  poor: 'ACCEPTABLE',
};

const EBAY_CONDITION_ORDER = ['NEW', 'LIKE_NEW', 'VERY_GOOD', 'GOOD', 'ACCEPTABLE'];

function conditionNeighbors(condition: string): string[] {
  const idx = EBAY_CONDITION_ORDER.indexOf(condition);
  if (idx === -1) return EBAY_CONDITION_ORDER;
  const result = [condition];
  if (idx > 0) result.push(EBAY_CONDITION_ORDER[idx - 1]);
  if (idx < EBAY_CONDITION_ORDER.length - 1) result.push(EBAY_CONDITION_ORDER[idx + 1]);
  return result;
}

function computePricing(
  soldComps: Array<{ price: number; condition: string }>,
  aiCondition: string,
  currency: string,
): PricingData {
  const ebayCondition = EBAY_CONDITION_MAP[aiCondition] ?? 'GOOD';

  const exactMatch = soldComps.filter(c => c.condition === ebayCondition);
  let pool: Array<{ price: number }>;
  let conditionMatch: 'exact' | 'nearby' | 'all';

  if (exactMatch.length >= 3) {
    pool = exactMatch;
    conditionMatch = 'exact';
  } else {
    const neighbors = conditionNeighbors(ebayCondition);
    const nearbyMatch = soldComps.filter(c => neighbors.includes(c.condition));
    if (nearbyMatch.length >= 3) {
      pool = nearbyMatch;
      conditionMatch = 'nearby';
    } else {
      pool = soldComps;
      conditionMatch = 'all';
    }
  }

  if (pool.length === 0) {
    return {
      suggested: 0,
      low: 0,
      high: 0,
      currency,
      confidence: 'low',
      basedOn: 0,
      conditionMatch: 'all',
    };
  }

  const prices = pool.map(p => p.price).sort((a, b) => a - b);
  const mid = Math.floor(prices.length / 2);
  const median = prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;
  const p25 = prices[Math.floor(prices.length * 0.25)] ?? prices[0];
  const p75 = prices[Math.ceil(prices.length * 0.75) - 1] ?? prices[prices.length - 1];

  const confidence = conditionMatch === 'exact' ? 'high' : conditionMatch === 'nearby' ? 'medium' : 'low';

  return {
    suggested: Math.round(median * 0.97 * 100) / 100,
    low: Math.round(p25 * 100) / 100,
    high: Math.round(p75 * 100) / 100,
    currency,
    confidence,
    basedOn: pool.length,
    conditionMatch,
  };
}

prepareListingRouter.post('/:id/prepare-listing', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const itemId = req.params.id;
    const { targetMarketplaces } = prepareSchema.parse(req.body);

    const [item] = await db.select().from(items).where(eq(items.id, itemId)).limit(1);
    if (!item || item.userId !== userId) {
      throw new AppError(404, 'NOT_FOUND', 'Item not found');
    }

    const [profile] = await db.select().from(sellerProfiles)
      .where(eq(sellerProfiles.userId, userId)).limit(1);

    const warnings: string[] = [];
    if (!profile) {
      warnings.push('Seller profile incomplete — set up business policies before publishing');
    }

    const photos = (item.photos as Array<{ url: string }>) ?? [];
    const photoUrls = photos.map(p => p.url);
    const searchQuery = `${item.brand} ${item.model} ${item.title}`.trim();

    // Parallel: eBay category + eBay comps + Reverb comps
    const [categoryResult, ebayCompsResult, reverbCompsResult] = await Promise.allSettled([
      EbayAdapter.getCategorySuggestion(searchQuery),
      EbayAdapter.searchComps(searchQuery),
      targetMarketplaces.includes('reverb')
        ? ReverbAdapter.searchComps(searchQuery)
        : Promise.resolve({ listings: [], stats: { median: null, avg: null, sampleSize: 0 } }),
    ]);

    const categorySuggestion = categoryResult.status === 'fulfilled' ? categoryResult.value : null;
    const ebayComps: CompResult = ebayCompsResult.status === 'fulfilled'
      ? ebayCompsResult.value
      : { sold: [], active: [], stats: { soldMedian: null, soldAvg: null, activeMedian: null, activeAvg: null, sampleSize: 0 } };
    const reverbComps: ReverbCompResult = reverbCompsResult.status === 'fulfilled'
      ? reverbCompsResult.value
      : { listings: [], stats: { median: null, avg: null, sampleSize: 0 } };

    // Get required aspects if we have a category
    let requiredAspects: Record<string, { required: boolean; values: string[] | null }> = {};
    if (categorySuggestion) {
      try {
        requiredAspects = await EbayAdapter.getRequiredAspects(categorySuggestion.categoryId);
      } catch {
        logger.warn({ categoryId: categorySuggestion.categoryId }, 'Failed to fetch required aspects');
      }
    }

    const currency = profile?.defaultCurrency ?? 'USD';

    // AI second pass
    const aiFields = await generateListingFields({
      scanData: {
        brand: item.brand,
        model: item.model,
        category: item.category,
        condition: item.condition,
        conditionNotes: item.conditionNotes,
        features: (item.features as string[]) ?? [],
        description: item.description,
      },
      photoUrls,
      ebayCategorySuggestion: categorySuggestion,
      requiredAspects,
      soldComps: ebayComps.sold.map(s => ({
        title: s.title,
        price: s.price,
        condition: s.condition,
        soldDate: s.soldDate,
      })),
      activeComps: ebayComps.active.map(a => ({
        title: a.title,
        price: a.price,
        condition: a.condition,
      })),
      reverbComps: reverbComps.listings.map(r => ({
        title: r.title,
        price: r.price,
        condition: r.condition,
      })),
      sellerDefaults: {
        weightUnit: profile?.defaultWeightUnit ?? 'oz',
        dimensionUnit: profile?.defaultDimensionUnit ?? 'in',
        packageType: profile?.defaultPackageType ?? 'box',
        currency,
      },
    });

    // Compute pricing from comps + condition cross-reference
    const soldWithCondition = ebayComps.sold.map(s => ({
      price: s.price,
      condition: s.condition,
    }));
    const pricing = computePricing(soldWithCondition, aiFields.condition, currency);

    if (pricing.conditionMatch === 'all' && pricing.basedOn > 0) {
      warnings.push('Limited comps at this condition — price may be less accurate');
    }
    if (pricing.basedOn === 0) {
      warnings.push('No sold comps found — price suggestion unavailable');
    }
    if (aiFields.ebay?.weight) {
      warnings.push('Weight is AI-estimated — verify before shipping');
    }
    if (aiFields.ebay?.dimensions) {
      warnings.push('Dimensions are AI-estimated — verify before shipping');
    }

    // Merge seller profile into eBay fields
    const ebayFields = aiFields.ebay ? {
      ...aiFields.ebay,
      fulfillmentPolicyId: profile?.ebayFulfillmentPolicyId ?? '',
      paymentPolicyId: profile?.ebayPaymentPolicyId ?? '',
      returnPolicyId: profile?.ebayReturnPolicyId ?? '',
      merchantLocationKey: profile?.ebayMerchantLocationKey ?? 'default',
    } : null;

    // Merge seller profile into Reverb fields
    const reverbFields = aiFields.reverb ? {
      ...aiFields.reverb,
      shippingRates: (profile?.reverbDefaultShipping as { rates: Array<{ regionCode: string; rate: { amount: string; currency: string } }> } | null)?.rates ?? [],
      offersEnabled: profile?.reverbOffersEnabled ?? true,
    } : null;

    const result: PreparedListingData = {
      title: aiFields.title,
      description: aiFields.description,
      condition: aiFields.condition as PreparedListingData['condition'],
      conditionDescription: aiFields.conditionDescription,
      brand: aiFields.brand,
      model: aiFields.model,
      pricing,
      comps: {
        ebay: ebayComps.sold.length > 0 || ebayComps.active.length > 0 ? ebayComps : null,
        reverb: reverbComps.listings.length > 0 ? reverbComps : null,
      },
      ebay: ebayFields,
      reverb: reverbFields,
      isMusicGear: aiFields.isMusicGear,
      aiConfidence: aiFields.aiConfidence,
      warnings,
    };

    logger.info({
      userId,
      itemId,
      isMusicGear: result.isMusicGear,
      pricingSuggested: pricing.suggested,
      compsEbay: ebayComps.stats.sampleSize,
      compsReverb: reverbComps.stats.sampleSize,
    }, 'Listing prepared');

    res.json(result);
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 3: Register route in `apps/api/src/index.ts`**

Add import:
```typescript
import { prepareListingRouter } from './routes/prepare-listing.js';
```

Add route (under `'/items'`):
```typescript
app.use('/items', prepareListingRouter);
```

This puts the endpoint at `POST /items/:id/prepare-listing`, which nests naturally under the items resource.

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 5: Test manually**

Restart the API and test:

```bash
curl -X POST https://10.0.0.251:8016/items/<ITEM_ID>/prepare-listing \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"targetMarketplaces": ["ebay"]}'
```

Expected: 200 with full `PreparedListingData` JSON response.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/lib/vision.ts apps/api/src/routes/prepare-listing.ts apps/api/src/index.ts
git commit -m "feat(api): add prepare-listing endpoint with AI field generation and comps pricing"
```

---

## Phase 3A: Frontend — Photo Capture Components

> Tasks 8, 9, 10 can be built **in parallel** (they're leaf components with no cross-dependencies).

### Task 8: Crop Tool Component

**Files:**
- Create: `apps/web/src/components/listing-flow/crop-tool.tsx`

- [ ] **Step 1: Create `apps/web/src/components/listing-flow/crop-tool.tsx`**

```typescript
"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

type AspectRatio = "free" | "1:1" | "4:3" | "3:4";

interface CropToolProps {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  onApply: (crop: CropRegion) => void;
  onCancel: () => void;
}

export function CropTool({ imageUrl, imageWidth, imageHeight, onApply, onCancel }: CropToolProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [aspect, setAspect] = useState<AspectRatio>("free");
  const [crop, setCrop] = useState<CropRegion>(() => ({
    x: imageWidth * 0.1,
    y: imageHeight * 0.1,
    width: imageWidth * 0.8,
    height: imageHeight * 0.8,
  }));
  const [dragging, setDragging] = useState<"move" | "nw" | "ne" | "sw" | "se" | null>(null);
  const dragStart = useRef({ mx: 0, my: 0, crop: crop });
  const [displayScale, setDisplayScale] = useState(1);

  useEffect(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = rect.width / imageWidth;
    const scaleY = rect.height / imageHeight;
    setDisplayScale(Math.min(scaleX, scaleY, 1));
  }, [imageWidth, imageHeight]);

  const applyAspectConstraint = useCallback((region: CropRegion, ratio: AspectRatio): CropRegion => {
    if (ratio === "free") return region;
    const [w, h] = ratio === "1:1" ? [1, 1] : ratio === "4:3" ? [4, 3] : [3, 4];
    const targetRatio = w / h;
    let newW = region.width;
    let newH = region.width / targetRatio;
    if (newH > imageHeight) {
      newH = region.height;
      newW = region.height * targetRatio;
    }
    return {
      x: Math.max(0, Math.min(region.x, imageWidth - newW)),
      y: Math.max(0, Math.min(region.y, imageHeight - newH)),
      width: Math.min(newW, imageWidth),
      height: Math.min(newH, imageHeight),
    };
  }, [imageWidth, imageHeight]);

  const handlePointerDown = useCallback((e: React.PointerEvent, handle: typeof dragging) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(handle);
    dragStart.current = { mx: e.clientX, my: e.clientY, crop: { ...crop } };
  }, [crop]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = (e.clientX - dragStart.current.mx) / displayScale;
    const dy = (e.clientY - dragStart.current.my) / displayScale;
    const prev = dragStart.current.crop;

    let next: CropRegion;

    if (dragging === "move") {
      next = {
        ...prev,
        x: Math.max(0, Math.min(prev.x + dx, imageWidth - prev.width)),
        y: Math.max(0, Math.min(prev.y + dy, imageHeight - prev.height)),
      };
    } else {
      const isLeft = dragging.includes("w");
      const isTop = dragging.includes("n");
      let newX = isLeft ? prev.x + dx : prev.x;
      let newY = isTop ? prev.y + dy : prev.y;
      let newW = isLeft ? prev.width - dx : prev.width + dx;
      let newH = isTop ? prev.height - dy : prev.height + dy;

      newW = Math.max(50, newW);
      newH = Math.max(50, newH);
      newX = Math.max(0, newX);
      newY = Math.max(0, newY);
      if (newX + newW > imageWidth) newW = imageWidth - newX;
      if (newY + newH > imageHeight) newH = imageHeight - newY;

      next = { x: newX, y: newY, width: newW, height: newH };
    }

    setCrop(applyAspectConstraint(next, aspect));
  }, [dragging, displayScale, imageWidth, imageHeight, aspect, applyAspectConstraint]);

  const handlePointerUp = useCallback(() => {
    setDragging(null);
  }, []);

  const handleAspectChange = useCallback((ratio: AspectRatio) => {
    setAspect(ratio);
    setCrop(prev => applyAspectConstraint(prev, ratio));
  }, [applyAspectConstraint]);

  const s = displayScale;

  return (
    <div className="fixed inset-0 z-[80] bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ paddingTop: "calc(0.75rem + var(--safe-area-top, 0px))" }}>
        <button onClick={onCancel} className="text-white text-base font-medium">Cancel</button>
        <button
          onClick={() => onApply({ x: Math.round(crop.x), y: Math.round(crop.y), width: Math.round(crop.width), height: Math.round(crop.height) })}
          className="text-white text-base font-semibold px-4 py-1.5 rounded-lg"
          style={{ background: "var(--flow-accent, #2D5A27)" }}
        >
          Apply
        </button>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden flex items-center justify-center"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="Crop" style={{ width: imageWidth * s, height: imageHeight * s }} className="select-none" draggable={false} />

        {/* Dim overlay — 4 rectangles around the crop region */}
        <div className="absolute inset-0 pointer-events-none" style={{ left: 0, top: 0 }}>
          <div className="absolute bg-black/60" style={{ left: 0, top: 0, width: "100%", height: crop.y * s }} />
          <div className="absolute bg-black/60" style={{ left: 0, top: (crop.y + crop.height) * s, width: "100%", bottom: 0 }} />
          <div className="absolute bg-black/60" style={{ left: 0, top: crop.y * s, width: crop.x * s, height: crop.height * s }} />
          <div className="absolute bg-black/60" style={{ left: (crop.x + crop.width) * s, top: crop.y * s, right: 0, height: crop.height * s }} />
        </div>

        {/* Crop region border + handles */}
        <div
          className="absolute border-2 border-white cursor-move"
          style={{ left: crop.x * s, top: crop.y * s, width: crop.width * s, height: crop.height * s }}
          onPointerDown={(e) => handlePointerDown(e, "move")}
        >
          {(["nw", "ne", "sw", "se"] as const).map(corner => (
            <div
              key={corner}
              className="absolute w-5 h-5 bg-white rounded-full -translate-x-1/2 -translate-y-1/2 cursor-pointer"
              style={{
                left: corner.includes("e") ? "100%" : 0,
                top: corner.includes("s") ? "100%" : 0,
              }}
              onPointerDown={(e) => handlePointerDown(e, corner)}
            />
          ))}
        </div>
      </div>

      {/* Aspect ratio buttons */}
      <div className="flex gap-3 justify-center py-4 px-4" style={{ paddingBottom: "calc(1rem + var(--safe-area-bottom, 0px))" }}>
        {(["free", "1:1", "4:3", "3:4"] as const).map(ratio => (
          <button
            key={ratio}
            onClick={() => handleAspectChange(ratio)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: aspect === ratio ? "var(--flow-accent, #2D5A27)" : "rgba(255,255,255,0.15)",
              color: "white",
            }}
          >
            {ratio === "free" ? "Free" : ratio}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/listing-flow/crop-tool.tsx
git commit -m "feat(web): add CropTool component with aspect ratio presets"
```

---

### Task 9: Photo Editor Component

**Files:**
- Create: `apps/web/src/components/listing-flow/photo-editor.tsx`

- [ ] **Step 1: Create `apps/web/src/components/listing-flow/photo-editor.tsx`**

```typescript
"use client";

import { useState, useCallback } from "react";
import { useEnhance } from "@/hooks/use-enhance";
import { useBgRemoval } from "@/hooks/use-bg-removal";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { CropTool } from "./crop-tool";

interface CapturedPhoto {
  url: string;
  key: string;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
}

interface PhotoEditorProps {
  photo: CapturedPhoto;
  onSave: (updated: CapturedPhoto) => void;
  onCancel: () => void;
}

type ActiveTool = "none" | "crop";

export function PhotoEditor({ photo, onSave, onCancel }: PhotoEditorProps) {
  const { token } = useAuth();
  const enhance = useEnhance();
  const bgRemoval = useBgRemoval();
  const [currentPhoto, setCurrentPhoto] = useState<CapturedPhoto>(photo);
  const [activeTool, setActiveTool] = useState<ActiveTool>("none");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleRotate = useCallback(async () => {
    if (!token || isProcessing) return;
    setIsProcessing(true);
    try {
      const result = await api<{ image: { key: string; url: string; width: number; height: number; size: number } }>(
        "/images/rotate",
        { method: "POST", body: { imageUrl: currentPhoto.url, degrees: 90 }, token },
      );
      setCurrentPhoto(prev => ({
        ...prev,
        url: result.image.url,
        key: result.image.key,
        width: result.image.width,
        height: result.image.height,
      }));
    } catch {
      // rotation failed — photo stays as-is
    } finally {
      setIsProcessing(false);
    }
  }, [token, currentPhoto.url, isProcessing]);

  const handleCrop = useCallback(async (crop: { x: number; y: number; width: number; height: number }) => {
    if (!token) return;
    setIsProcessing(true);
    try {
      const result = await api<{ image: { key: string; url: string; width: number; height: number; size: number } }>(
        "/images/crop",
        { method: "POST", body: { imageUrl: currentPhoto.url, crop }, token },
      );
      setCurrentPhoto(prev => ({
        ...prev,
        url: result.image.url,
        key: result.image.key,
        width: result.image.width,
        height: result.image.height,
      }));
    } catch {
      // crop failed
    } finally {
      setActiveTool("none");
      setIsProcessing(false);
    }
  }, [token, currentPhoto.url]);

  const handleEnhance = useCallback(async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    await enhance.enhance(currentPhoto.url);
    if (enhance.result) {
      setCurrentPhoto(prev => ({
        ...prev,
        url: enhance.result!.image.url,
        key: enhance.result!.image.key,
        width: enhance.result!.image.width,
        height: enhance.result!.image.height,
      }));
    }
    setIsProcessing(false);
  }, [currentPhoto.url, enhance, isProcessing]);

  const handleBgRemove = useCallback(async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    await bgRemoval.removeBackground(currentPhoto.url);
    if (bgRemoval.resultUrl) {
      setCurrentPhoto(prev => ({ ...prev, url: bgRemoval.resultUrl! }));
    }
    setIsProcessing(false);
  }, [currentPhoto.url, bgRemoval, isProcessing]);

  if (activeTool === "crop") {
    return (
      <CropTool
        imageUrl={currentPhoto.url}
        imageWidth={currentPhoto.width ?? 1024}
        imageHeight={currentPhoto.height ?? 1024}
        onApply={handleCrop}
        onCancel={() => setActiveTool("none")}
      />
    );
  }

  const tools = [
    { id: "rotate", label: "Rotate", icon: "⟲", action: handleRotate },
    { id: "crop", label: "Crop", icon: "⬒", action: () => setActiveTool("crop") },
    { id: "enhance", label: "Enhance", icon: "✦", action: handleEnhance },
    { id: "bg", label: "BG Remove", icon: "◐", action: handleBgRemove },
  ];

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ paddingTop: "calc(0.75rem + var(--safe-area-top, 0px))" }}>
        <button onClick={onCancel} className="text-white/70 text-base">
          ← Back
        </button>
        <button
          onClick={() => onSave(currentPhoto)}
          className="text-white text-base font-semibold px-4 py-1.5 rounded-lg"
          style={{ background: "var(--flow-accent, #2D5A27)" }}
        >
          Done
        </button>
      </div>

      {/* Photo display */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={currentPhoto.url}
          alt="Edit"
          className="max-w-full max-h-full object-contain rounded-lg"
        />
        {isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="w-10 h-10 border-3 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex gap-2 justify-center px-4 py-4" style={{ paddingBottom: "calc(1rem + var(--safe-area-bottom, 0px))" }}>
        {tools.map(tool => (
          <button
            key={tool.id}
            onClick={tool.action}
            disabled={isProcessing}
            className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-opacity disabled:opacity-40"
            style={{ background: "rgba(255,255,255,0.1)" }}
          >
            <span className="text-xl">{tool.icon}</span>
            <span className="text-[11px] text-white/70">{tool.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/listing-flow/photo-editor.tsx
git commit -m "feat(web): add PhotoEditor with rotate, crop, enhance, BG remove tools"
```

---

### Task 10: Photo Grid Component

**Files:**
- Create: `apps/web/src/components/listing-flow/photo-grid.tsx`

- [ ] **Step 1: Create `apps/web/src/components/listing-flow/photo-grid.tsx`**

```typescript
"use client";

import { useState, useCallback, useRef } from "react";

interface CapturedPhoto {
  url: string;
  key: string;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
}

interface PhotoGridProps {
  photos: CapturedPhoto[];
  minPhotos: number;
  maxPhotos: number;
  onAdd: () => void;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

const TIPS: Record<number, string> = {
  0: "Start with the front of the item — this becomes your hero photo",
  1: "Now capture the back",
  2: "Add side views and any labels or serial numbers",
  3: "One more needed! Show any flaws, scratches, or wear",
};

function getTip(count: number, max: number): string {
  if (count >= max) return "Maximum photos reached";
  if (TIPS[count]) return TIPS[count];
  if (count < 8) return "Looking good! More angles help buyers feel confident";
  return "Great coverage! Add detail shots of unique features";
}

export function PhotoGrid({ photos, minPhotos, maxPhotos, onAdd, onEdit, onDelete, onReorder }: PhotoGridProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const slots = Array.from({ length: maxPhotos }, (_, i) => photos[i] ?? null);
  const canAdd = photos.length < maxPhotos;
  const canDone = photos.length >= minPhotos;
  const remaining = Math.max(0, minPhotos - photos.length);

  const handleLongPressStart = useCallback((index: number) => {
    if (!photos[index]) return;
    longPressTimer.current = setTimeout(() => {
      setDragIndex(index);
      setIsDragging(true);
    }, 500);
  }, [photos]);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (isDragging && dragIndex !== null) {
      setIsDragging(false);
      setDragIndex(null);
    }
  }, [isDragging, dragIndex]);

  const handleDrop = useCallback((toIndex: number) => {
    if (dragIndex !== null && dragIndex !== toIndex && photos[toIndex] !== undefined) {
      onReorder(dragIndex, toIndex);
    }
    setDragIndex(null);
    setIsDragging(false);
  }, [dragIndex, onReorder, photos]);

  return (
    <div className="flex flex-col h-full">
      {/* Grid */}
      <div className="grid grid-cols-3 gap-2 p-4">
        {slots.map((photo, i) => (
          <div
            key={i}
            className="relative aspect-square rounded-xl overflow-hidden transition-all"
            style={{
              background: photo ? undefined : "rgba(0,0,0,0.04)",
              border: photo ? "none" : "2px dashed rgba(0,0,0,0.15)",
              opacity: dragIndex === i ? 0.5 : 1,
              transform: dragIndex === i ? "scale(0.95)" : "scale(1)",
            }}
            onPointerDown={() => handleLongPressStart(i)}
            onPointerUp={() => {
              handleLongPressEnd();
              if (!isDragging && photo) onEdit(i);
            }}
            onPointerEnter={() => { if (isDragging) handleDrop(i); }}
          >
            {photo ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.thumbnailUrl ?? photo.url}
                  alt={`Photo ${i + 1}`}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
                {i === 0 && (
                  <div className="absolute top-1 left-1 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                    ★ HERO
                  </div>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(i); }}
                  className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center"
                >
                  <span className="text-white text-xs">✕</span>
                </button>
              </>
            ) : (
              i === photos.length && canAdd ? (
                <button
                  onClick={onAdd}
                  className="w-full h-full flex flex-col items-center justify-center gap-1"
                >
                  <span className="text-2xl" style={{ color: "var(--flow-accent, #2D5A27)" }}>+</span>
                  <span className="text-[11px]" style={{ color: "rgba(0,0,0,0.4)" }}>Add</span>
                </button>
              ) : null
            )}
          </div>
        ))}
      </div>

      {/* Tip */}
      <div className="px-6 py-2">
        <p className="text-sm text-center" style={{ color: "rgba(0,0,0,0.45)" }}>
          {getTip(photos.length, maxPhotos)}
        </p>
      </div>

      {/* Done button area is handled by parent (PhotoCaptureFlow) */}
      {/* Export canDone and remaining for parent to use */}
      <div className="hidden" data-can-done={canDone} data-remaining={remaining} />
    </div>
  );
}

export function usePhotoGridState() {
  return { canDone: true, remaining: 0 };
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/listing-flow/photo-grid.tsx
git commit -m "feat(web): add PhotoGrid component with 12-slot grid, hero badge, reorder"
```

---

### Task 11: PhotoCaptureFlow — Main Orchestrator

**Files:**
- Create: `apps/web/src/components/listing-flow/photo-capture-flow.tsx`

Depends on Tasks 8, 9, 10.

- [ ] **Step 1: Create `apps/web/src/components/listing-flow/photo-capture-flow.tsx`**

```typescript
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useCamera } from "@/hooks/use-camera";
import { API_BASE } from "@/lib/api";
import { PhotoGrid } from "./photo-grid";
import { PhotoEditor } from "./photo-editor";

interface CapturedPhoto {
  url: string;
  key: string;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
}

export interface PhotoCaptureFlowProps {
  onComplete: (photos: CapturedPhoto[]) => void;
  onCancel: () => void;
  initialPhotos?: CapturedPhoto[];
  minPhotos?: number;
  maxPhotos?: number;
}

type Mode = "grid" | "choose" | "camera" | "editor";

export function PhotoCaptureFlow({
  onComplete,
  onCancel,
  initialPhotos = [],
  minPhotos = 4,
  maxPhotos = 12,
}: PhotoCaptureFlowProps) {
  const { token } = useAuth();
  const [photos, setPhotos] = useState<CapturedPhoto[]>(initialPhotos);
  const [mode, setMode] = useState<Mode>("grid");
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { videoRef, canvasRef, isReady, error: cameraError, start, stop, capture, switchCamera } = useCamera();

  const canDone = photos.length >= minPhotos;
  const remaining = Math.max(0, minPhotos - photos.length);

  // Upload a blob, return CapturedPhoto
  const uploadPhoto = useCallback(async (blob: Blob): Promise<CapturedPhoto | null> => {
    if (!token) return null;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", blob, `photo-${Date.now()}.jpg`);

      const res = await fetch(`${API_BASE}/images`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) return null;

      const data = await res.json() as {
        image: { key: string; url: string; width?: number; height?: number };
        thumbnail: { key: string; url: string };
      };

      return {
        key: data.image.key,
        url: data.image.url,
        width: data.image.width,
        height: data.image.height,
        thumbnailUrl: data.thumbnail?.url,
      };
    } catch {
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [token]);

  // Camera capture handler
  const handleCameraCapture = useCallback(async () => {
    const blob = await capture();
    if (!blob) return;
    stop();
    const photo = await uploadPhoto(blob);
    if (photo) {
      setPhotos(prev => [...prev, photo]);
    }
    setMode("grid");
  }, [capture, stop, uploadPhoto]);

  // File select handler (upload or library)
  const handleFileSelected = useCallback(async (file: File) => {
    const photo = await uploadPhoto(file);
    if (photo) {
      setPhotos(prev => [...prev, photo]);
    }
    setMode("grid");
  }, [uploadPhoto]);

  // Grid handlers
  const handleAddPhoto = useCallback(() => setMode("choose"), []);

  const handleEditPhoto = useCallback((index: number) => {
    setEditIndex(index);
    setMode("editor");
  }, []);

  const handleDeletePhoto = useCallback((index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleReorder = useCallback((from: number, to: number) => {
    setPhotos(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const handleEditorSave = useCallback((updated: CapturedPhoto) => {
    if (editIndex !== null) {
      setPhotos(prev => prev.map((p, i) => i === editIndex ? updated : p));
    }
    setEditIndex(null);
    setMode("grid");
  }, [editIndex]);

  // Inject spinner keyframe
  useEffect(() => {
    const id = "photo-flow-keyframes";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
    return () => { document.getElementById(id)?.remove(); };
  }, []);

  // --- EDITOR MODE ---
  if (mode === "editor" && editIndex !== null && photos[editIndex]) {
    return (
      <PhotoEditor
        photo={photos[editIndex]}
        onSave={handleEditorSave}
        onCancel={() => { setEditIndex(null); setMode("grid"); }}
      />
    );
  }

  // --- CAMERA MODE ---
  if (mode === "camera") {
    return (
      <div className="fixed inset-0 z-[70] bg-black flex flex-col">
        <div className="flex-1 relative overflow-hidden">
          <video
            ref={(el) => { videoRef.current = el; }}
            autoPlay playsInline muted
            className="absolute inset-0 w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />

          {cameraError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6">
              <div className="text-center">
                <p className="text-white text-lg mb-2">Camera unavailable</p>
                <p className="text-white/60 text-sm">{cameraError}</p>
              </div>
            </div>
          )}

          <button
            onClick={() => { stop(); setMode("grid"); }}
            className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white"
            style={{ top: "calc(1rem + var(--safe-area-top, 0px))" }}
          >
            ←
          </button>

          <button
            onClick={switchCamera}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white text-sm"
            style={{ top: "calc(1rem + var(--safe-area-top, 0px))" }}
          >
            ⟲
          </button>
        </div>

        <div className="bg-black px-6 py-8 flex items-center justify-center" style={{ paddingBottom: "calc(2rem + var(--safe-area-bottom, 0px))" }}>
          <button
            onClick={handleCameraCapture}
            disabled={!isReady || isUploading}
            className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center disabled:opacity-40 active:scale-95"
          >
            <div className={`w-16 h-16 rounded-full transition-colors ${isUploading ? "bg-red-500" : "bg-white"}`} />
          </button>
        </div>
      </div>
    );
  }

  // --- CHOOSE MODE ---
  if (mode === "choose") {
    const uploadRef = { current: null as HTMLInputElement | null };

    return (
      <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: "var(--flow-bg, #F5F3EF)" }}>
        <div className="flex items-center px-4 pt-4 pb-3" style={{ paddingTop: "calc(1rem + var(--safe-area-top, 0px))" }}>
          <button onClick={() => setMode("grid")} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.06)" }}>
            <span style={{ color: "var(--flow-text, #18191C)" }}>←</span>
          </button>
          <h2 className="flex-1 text-center text-lg font-semibold" style={{ color: "var(--flow-text, #18191C)" }}>Add Photo</h2>
          <div className="w-10" />
        </div>
        <div className="h-px" style={{ background: "rgba(0,0,0,0.08)" }} />
        <div className="flex-1 flex flex-col justify-center px-6 gap-4">
          <button
            onClick={() => { start(); setMode("camera"); }}
            className="flex items-center gap-4 rounded-xl px-5 py-5 bg-white shadow-sm active:scale-[0.98]"
          >
            <span className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg" style={{ background: "var(--flow-accent, #2D5A27)" }}>📷</span>
            <div className="text-left">
              <p className="text-base font-semibold" style={{ color: "var(--flow-text, #18191C)" }}>Take Photo</p>
              <p className="text-sm mt-0.5" style={{ color: "rgba(24,25,28,0.5)" }}>Use your camera</p>
            </div>
          </button>
          <button
            onClick={() => uploadRef.current?.click()}
            className="flex items-center gap-4 rounded-xl px-5 py-5 bg-white shadow-sm active:scale-[0.98]"
          >
            <span className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg" style={{ background: "var(--flow-accent, #2D5A27)" }}>📁</span>
            <div className="text-left">
              <p className="text-base font-semibold" style={{ color: "var(--flow-text, #18191C)" }}>Upload / Choose</p>
              <p className="text-sm mt-0.5" style={{ color: "rgba(24,25,28,0.5)" }}>JPEG, PNG, WebP, HEIC</p>
            </div>
          </button>
          <input
            ref={(el) => { uploadRef.current = el; }}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            multiple
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelected(file);
              e.target.value = "";
            }}
          />
        </div>
      </div>
    );
  }

  // --- GRID MODE (default) ---
  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: "var(--flow-bg, #F5F3EF)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3" style={{ paddingTop: "calc(1rem + var(--safe-area-top, 0px))" }}>
        <button onClick={onCancel} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.06)" }}>
          <span style={{ color: "var(--flow-text, #18191C)" }}>✕</span>
        </button>
        <h2 className="text-lg font-semibold" style={{ color: "var(--flow-text, #18191C)" }}>Add Photos</h2>
        <span className="text-sm font-medium" style={{ color: "var(--flow-accent, #2D5A27)" }}>
          {photos.length}/{maxPhotos}
          {!canDone && <span className="text-xs ml-1" style={{ color: "rgba(0,0,0,0.4)" }}>(min {minPhotos})</span>}
        </span>
      </div>

      <div className="h-px" style={{ background: "rgba(0,0,0,0.08)" }} />

      {/* Grid */}
      <div className="flex-1 overflow-y-auto">
        <PhotoGrid
          photos={photos}
          minPhotos={minPhotos}
          maxPhotos={maxPhotos}
          onAdd={handleAddPhoto}
          onEdit={handleEditPhoto}
          onDelete={handleDeletePhoto}
          onReorder={handleReorder}
        />
      </div>

      {/* Done button */}
      <div className="px-4 py-4" style={{ paddingBottom: "calc(1rem + var(--safe-area-bottom, 0px))" }}>
        <button
          onClick={() => onComplete(photos)}
          disabled={!canDone}
          className="w-full py-4 rounded-xl text-base font-semibold text-white transition-opacity disabled:opacity-40"
          style={{ background: "var(--flow-accent, #2D5A27)" }}
        >
          {canDone
            ? "Done — scan with AI"
            : `Need ${remaining} more photo${remaining !== 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/listing-flow/photo-capture-flow.tsx
git commit -m "feat(web): add PhotoCaptureFlow orchestrator with grid, camera, editor modes"
```

---

## Phase 3B: Frontend — Preview Card + Comps Widget + Seller Profile Page

> Tasks 12, 13, 14 can run in **parallel**.

### Task 12: Comps Pricing Widget

**Files:**
- Create: `apps/web/src/components/listing/comps-pricing-widget.tsx`

- [ ] **Step 1: Create `apps/web/src/components/listing/comps-pricing-widget.tsx`**

```typescript
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { PricingData, CompResult, ReverbCompResult } from "@portage/shared";

interface CompsPricingWidgetProps {
  pricing: PricingData;
  comps: { ebay: CompResult | null; reverb: ReverbCompResult | null };
  currentPrice: number;
  onPriceChange: (price: number) => void;
}

export function CompsPricingWidget({ pricing, comps, currentPrice, onPriceChange }: CompsPricingWidgetProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(currentPrice));
  const [activeTab, setActiveTab] = useState<"ebay" | "reverb">("ebay");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handlePriceSubmit = useCallback(() => {
    const num = parseFloat(editValue);
    if (!isNaN(num) && num > 0) {
      onPriceChange(Math.round(num * 100) / 100);
    }
    setIsEditing(false);
  }, [editValue, onPriceChange]);

  const confidenceLabel = pricing.conditionMatch === "exact"
    ? "exact match"
    : pricing.conditionMatch === "nearby"
    ? "similar condition"
    : "all conditions";

  const confidenceColor = pricing.confidence === "high"
    ? "#2D5A27"
    : pricing.confidence === "medium"
    ? "#B8860B"
    : "#CC3333";

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.08)" }}>
      {/* Price display */}
      <div className="px-4 py-3">
        <p className="text-xs font-medium mb-1" style={{ color: "rgba(0,0,0,0.5)" }}>Suggested Price</p>
        {isEditing ? (
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">$</span>
            <input
              ref={inputRef}
              type="number"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={handlePriceSubmit}
              onKeyDown={e => { if (e.key === "Enter") handlePriceSubmit(); }}
              className="text-2xl font-bold bg-transparent border-b-2 outline-none w-32"
              style={{ borderColor: "var(--flow-accent, #2D5A27)" }}
              step="0.01"
            />
          </div>
        ) : (
          <button onClick={() => { setEditValue(String(currentPrice)); setIsEditing(true); }} className="text-left">
            <span className="text-2xl font-bold">${currentPrice.toFixed(2)}</span>
            <span className="text-xs ml-2" style={{ color: "rgba(0,0,0,0.4)" }}>tap to change</span>
          </button>
        )}

        {pricing.basedOn > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <p className="text-sm" style={{ color: "rgba(0,0,0,0.6)" }}>
              Range: ${pricing.low.toFixed(0)} — ${pricing.high.toFixed(0)}
            </p>
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: confidenceColor, background: `${confidenceColor}15` }}>
              {pricing.basedOn} sold comps ({confidenceLabel})
            </span>
          </div>
        )}
      </div>

      {/* Marketplace tabs */}
      {comps.reverb && (
        <div className="flex border-t" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          {(["ebay", "reverb"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 py-2 text-sm font-medium text-center transition-colors"
              style={{
                color: activeTab === tab ? "var(--flow-accent, #2D5A27)" : "rgba(0,0,0,0.4)",
                borderBottom: activeTab === tab ? "2px solid var(--flow-accent, #2D5A27)" : "2px solid transparent",
              }}
            >
              {tab === "ebay" ? "eBay" : "Reverb"}
            </button>
          ))}
        </div>
      )}

      {/* Comps list */}
      <div className="px-4 py-3 max-h-48 overflow-y-auto">
        {activeTab === "ebay" && comps.ebay && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <p className="text-xs font-medium mb-1" style={{ color: "rgba(0,0,0,0.5)" }}>Sold</p>
            <p className="text-xs font-medium mb-1" style={{ color: "rgba(0,0,0,0.5)" }}>Active</p>
            {Array.from({ length: Math.max(comps.ebay.sold.length, comps.ebay.active.length) }).map((_, i) => (
              <div key={i} className="contents">
                <div className="text-sm py-0.5">
                  {comps.ebay!.sold[i] && (
                    <span>● ${comps.ebay!.sold[i].price.toFixed(0)} <span className="text-xs" style={{ color: "rgba(0,0,0,0.4)" }}>{comps.ebay!.sold[i].condition}</span></span>
                  )}
                </div>
                <div className="text-sm py-0.5">
                  {comps.ebay!.active[i] && (
                    <span>○ ${comps.ebay!.active[i].price.toFixed(0)} <span className="text-xs" style={{ color: "rgba(0,0,0,0.4)" }}>{comps.ebay!.active[i].condition}</span></span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {activeTab === "reverb" && comps.reverb && (
          <div className="space-y-1">
            {comps.reverb.listings.map((comp, i) => (
              <div key={i} className="text-sm py-0.5">
                ● ${comp.price.toFixed(0)} <span className="text-xs" style={{ color: "rgba(0,0,0,0.4)" }}>{comp.condition}</span>
              </div>
            ))}
          </div>
        )}
        {pricing.basedOn === 0 && (
          <p className="text-sm text-center py-4" style={{ color: "rgba(0,0,0,0.4)" }}>No comps found for this item</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + Commit**

```bash
npm run typecheck
git add apps/web/src/components/listing/comps-pricing-widget.tsx
git commit -m "feat(web): add CompsPricingWidget with inline price editing and marketplace tabs"
```

---

### Task 13: Listing Preview Card

**Files:**
- Create: `apps/web/src/components/listing/listing-preview-card.tsx`

- [ ] **Step 1: Create `apps/web/src/components/listing/listing-preview-card.tsx`**

```typescript
"use client";

import { useState, useCallback } from "react";
import { CompsPricingWidget } from "./comps-pricing-widget";
import type { PreparedListingData } from "@portage/shared";

interface ListingPreviewCardProps {
  data: PreparedListingData;
  photos: Array<{ url: string; key: string }>;
  onFieldChange: (field: string, value: unknown) => void;
  onPriceChange: (price: number) => void;
  onPublish: (marketplace: "ebay" | "reverb") => void;
  isPublishing: boolean;
  sellerProfileComplete: boolean;
}

function InlineEdit({ value, field, onSave }: { value: string; field: string; onSave: (field: string, value: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);

  if (editing) {
    return (
      <input
        autoFocus
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={() => { onSave(field, text); setEditing(false); }}
        onKeyDown={e => { if (e.key === "Enter") { onSave(field, text); setEditing(false); } }}
        className="w-full bg-transparent border-b-2 outline-none text-inherit font-inherit"
        style={{ borderColor: "var(--flow-accent, #2D5A27)" }}
      />
    );
  }

  return (
    <span onClick={() => setEditing(true)} className="cursor-pointer hover:underline decoration-dotted underline-offset-4">
      {value}
    </span>
  );
}

export function ListingPreviewCard({
  data,
  photos,
  onFieldChange,
  onPriceChange,
  onPublish,
  isPublishing,
  sellerProfileComplete,
}: ListingPreviewCardProps) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [showAspects, setShowAspects] = useState(false);
  const [activeMarketplace, setActiveMarketplace] = useState<"ebay" | "reverb">("ebay");

  const handleFieldSave = useCallback((field: string, value: string) => {
    onFieldChange(field, value);
  }, [onFieldChange]);

  const currentPrice = data.pricing.suggested;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "white", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
      {/* Photo carousel */}
      <div className="relative aspect-square bg-gray-100">
        {photos.length > 0 && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photos[photoIndex]?.url}
              alt="Listing"
              className="w-full h-full object-cover"
            />
            {photos.length > 1 && (
              <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                {photos.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPhotoIndex(i)}
                    className="w-2 h-2 rounded-full transition-colors"
                    style={{ background: i === photoIndex ? "white" : "rgba(255,255,255,0.5)" }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Title */}
        <h3 className="text-lg font-semibold" style={{ color: "var(--flow-text, #18191C)" }}>
          <InlineEdit value={data.title} field="title" onSave={handleFieldSave} />
        </h3>

        {/* Condition + brand */}
        <div className="flex items-center gap-2 text-sm">
          <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: "rgba(45,90,39,0.1)", color: "#2D5A27" }}>
            {data.condition.replace("_", " ")}
          </span>
          <span style={{ color: "rgba(0,0,0,0.5)" }}>{data.brand} · {data.model}</span>
        </div>

        {/* Condition description */}
        <p className="text-sm italic" style={{ color: "rgba(0,0,0,0.6)" }}>
          "{data.conditionDescription}"
        </p>

        {/* Pricing widget */}
        <CompsPricingWidget
          pricing={data.pricing}
          comps={data.comps}
          currentPrice={currentPrice}
          onPriceChange={onPriceChange}
        />

        {/* Item specifics (collapsible) */}
        {data.ebay?.aspects && (
          <div>
            <button
              onClick={() => setShowAspects(!showAspects)}
              className="flex items-center justify-between w-full text-sm font-medium py-2"
            >
              <span>Item Specifics</span>
              <span style={{ color: "rgba(0,0,0,0.4)" }}>{showAspects ? "▲" : "▼"}</span>
            </button>
            {showAspects && (
              <div className="space-y-1 pb-2">
                {Object.entries(data.ebay.aspects).map(([key, values]) => (
                  <div key={key} className="flex text-sm">
                    <span className="w-1/3 shrink-0" style={{ color: "rgba(0,0,0,0.5)" }}>{key}</span>
                    <span>{values.join(", ")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Weight + Dimensions */}
        {data.ebay && (
          <div className="text-sm space-y-1" style={{ color: "rgba(0,0,0,0.6)" }}>
            <p>Weight: ~{data.ebay.weight.value} {data.ebay.weight.unit} (estimated)</p>
            <p>Dimensions: {data.ebay.dimensions.length}×{data.ebay.dimensions.width}×{data.ebay.dimensions.height} {data.ebay.dimensions.unit} (estimated)</p>
          </div>
        )}

        {/* Warnings */}
        {data.warnings.length > 0 && (
          <div className="space-y-1">
            {data.warnings.map((w, i) => (
              <p key={i} className="text-xs px-2 py-1 rounded" style={{ background: "rgba(204,51,51,0.08)", color: "#CC3333" }}>
                {w}
              </p>
            ))}
          </div>
        )}

        {/* Marketplace tabs + publish */}
        <div className="pt-2">
          {data.isMusicGear && (
            <div className="flex gap-2 mb-3">
              {(["ebay", "reverb"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setActiveMarketplace(m)}
                  className="flex-1 py-2 text-sm font-medium rounded-lg transition-colors"
                  style={{
                    background: activeMarketplace === m ? "var(--flow-accent, #2D5A27)" : "rgba(0,0,0,0.05)",
                    color: activeMarketplace === m ? "white" : "rgba(0,0,0,0.6)",
                  }}
                >
                  {m === "ebay" ? "eBay" : "Reverb"}
                </button>
              ))}
            </div>
          )}

          {!sellerProfileComplete && (
            <a
              href="/settings/seller-profile"
              className="block text-center text-sm py-2 mb-3 rounded-lg"
              style={{ background: "rgba(204,153,0,0.1)", color: "#B8860B" }}
            >
              Set up seller profile to publish →
            </a>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => onPublish("ebay")}
              disabled={isPublishing || !sellerProfileComplete}
              className="flex-1 py-3.5 rounded-xl text-base font-semibold text-white disabled:opacity-40"
              style={{ background: "var(--flow-accent, #2D5A27)" }}
            >
              {isPublishing ? "Publishing…" : "Publish to eBay"}
            </button>
            {data.isMusicGear && (
              <button
                onClick={() => onPublish("reverb")}
                disabled={isPublishing || !sellerProfileComplete}
                className="flex-1 py-3.5 rounded-xl text-base font-semibold text-white disabled:opacity-40"
                style={{ background: "#E8620A" }}
              >
                {isPublishing ? "Publishing…" : "Publish to Reverb"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + Commit**

```bash
npm run typecheck
git add apps/web/src/components/listing/listing-preview-card.tsx
git commit -m "feat(web): add ListingPreviewCard with inline editing, comps widget, and publish buttons"
```

---

### Task 14: Seller Profile Settings Page

**Files:**
- Create: `apps/web/src/app/settings/seller-profile/page.tsx`

- [ ] **Step 1: Create `apps/web/src/app/settings/seller-profile/page.tsx`**

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import type { SellerProfile, EbayPolicy, EbayPoliciesResponse } from "@portage/shared";

export default function SellerProfilePage() {
  const { token } = useAuth();
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [policies, setPolicies] = useState<EbayPoliciesResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api<{ profile: SellerProfile }>("/seller-profile", { token })
      .then(data => setProfile(data.profile))
      .catch(() => {});

    api<EbayPoliciesResponse>("/seller-profile/ebay-policies", { token })
      .then(data => setPolicies(data))
      .catch(() => {});
  }, [token]);

  const updateField = useCallback(async (field: string, value: unknown) => {
    if (!token) return;
    setSaving(true);
    setMessage(null);
    try {
      const result = await api<{ profile: SellerProfile }>("/seller-profile", {
        method: "PATCH",
        body: { [field]: value },
        token,
      });
      setProfile(result.profile);
      setMessage("Saved");
      setTimeout(() => setMessage(null), 2000);
    } catch {
      setMessage("Failed to save");
    } finally {
      setSaving(false);
    }
  }, [token]);

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Seller Profile</h1>

      {message && (
        <div className="text-sm py-2 px-3 rounded-lg" style={{ background: message === "Saved" ? "rgba(45,90,39,0.1)" : "rgba(204,51,51,0.1)", color: message === "Saved" ? "#2D5A27" : "#CC3333" }}>
          {message}
        </div>
      )}

      {/* eBay Policies */}
      <section className="rounded-xl p-4 space-y-3" style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.08)" }}>
        <h2 className="text-lg font-semibold">eBay Account</h2>

        <label className="block text-sm">
          <span className="text-sm font-medium mb-1 block">Fulfillment Policy</span>
          <select
            value={profile.ebayFulfillmentPolicyId ?? ""}
            onChange={e => updateField("ebayFulfillmentPolicyId", e.target.value || null)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">Select...</option>
            {policies?.fulfillment.map(p => <option key={p.policyId} value={p.policyId}>{p.name}</option>)}
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-sm font-medium mb-1 block">Payment Policy</span>
          <select
            value={profile.ebayPaymentPolicyId ?? ""}
            onChange={e => updateField("ebayPaymentPolicyId", e.target.value || null)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">Select...</option>
            {policies?.payment.map(p => <option key={p.policyId} value={p.policyId}>{p.name}</option>)}
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-sm font-medium mb-1 block">Return Policy</span>
          <select
            value={profile.ebayReturnPolicyId ?? ""}
            onChange={e => updateField("ebayReturnPolicyId", e.target.value || null)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">Select...</option>
            {policies?.returnPolicy.map(p => <option key={p.policyId} value={p.policyId}>{p.name}</option>)}
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-sm font-medium mb-1 block">Merchant Location Key</span>
          <input
            type="text"
            value={profile.ebayMerchantLocationKey ?? ""}
            onChange={e => updateField("ebayMerchantLocationKey", e.target.value || null)}
            placeholder="default"
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
        </label>
      </section>

      {/* Reverb */}
      <section className="rounded-xl p-4 space-y-3" style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.08)" }}>
        <h2 className="text-lg font-semibold">Reverb Defaults</h2>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={profile.reverbOffersEnabled}
            onChange={e => updateField("reverbOffersEnabled", e.target.checked)}
            className="rounded"
          />
          <span>Accept offers on Reverb listings</span>
        </label>
      </section>

      {/* Shipping */}
      <section className="rounded-xl p-4 space-y-3" style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.08)" }}>
        <h2 className="text-lg font-semibold">Shipping Defaults</h2>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="font-medium mb-1 block">Weight Unit</span>
            <select
              value={profile.defaultWeightUnit}
              onChange={e => updateField("defaultWeightUnit", e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="oz">oz</option>
              <option value="lb">lb</option>
              <option value="g">g</option>
              <option value="kg">kg</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium mb-1 block">Dimension Unit</span>
            <select
              value={profile.defaultDimensionUnit}
              onChange={e => updateField("defaultDimensionUnit", e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="in">inches</option>
              <option value="cm">cm</option>
            </select>
          </label>
        </div>

        <label className="block text-sm">
          <span className="font-medium mb-1 block">Default Package Type</span>
          <select
            value={profile.defaultPackageType}
            onChange={e => updateField("defaultPackageType", e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="box">Box</option>
            <option value="envelope">Envelope</option>
            <option value="poly_mailer">Poly Mailer</option>
          </select>
        </label>
      </section>

      {/* Listing Preferences */}
      <section className="rounded-xl p-4 space-y-3" style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.08)" }}>
        <h2 className="text-lg font-semibold">Listing Preferences</h2>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={profile.autoPublish}
            onChange={e => updateField("autoPublish", e.target.checked)}
            className="rounded"
          />
          <span>Auto-publish listings (skip review)</span>
        </label>
      </section>

      {saving && <p className="text-sm text-center" style={{ color: "rgba(0,0,0,0.4)" }}>Saving...</p>}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + Commit**

```bash
npm run typecheck
git add apps/web/src/app/settings/seller-profile/page.tsx
git commit -m "feat(web): add seller profile settings page with eBay policies and shipping defaults"
```

---

## Phase 4: Integration — Wire Everything Together

### Task 15: usPrepareListing Hook

**Files:**
- Create: `apps/web/src/hooks/use-prepare-listing.ts`

- [ ] **Step 1: Create `apps/web/src/hooks/use-prepare-listing.ts`**

```typescript
"use client";

import { useState, useCallback } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "./use-auth";
import type { PreparedListingData } from "@portage/shared";

interface UsePrepareListingReturn {
  data: PreparedListingData | null;
  isLoading: boolean;
  error: string | null;
  prepare: (itemId: string, targetMarketplaces: ("ebay" | "reverb")[]) => Promise<void>;
  reset: () => void;
}

export function usePrepareListing(): UsePrepareListingReturn {
  const { token } = useAuth();
  const [data, setData] = useState<PreparedListingData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prepare = useCallback(async (itemId: string, targetMarketplaces: ("ebay" | "reverb")[]) => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    setData(null);

    try {
      const result = await api<PreparedListingData>(
        `/items/${itemId}/prepare-listing`,
        {
          method: "POST",
          body: { targetMarketplaces },
          token,
        },
      );
      setData(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to prepare listing");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return { data, isLoading, error, prepare, reset };
}
```

- [ ] **Step 2: Typecheck + Commit**

```bash
npm run typecheck
git add apps/web/src/hooks/use-prepare-listing.ts
git commit -m "feat(web): add usePrepareListing hook"
```

---

### Task 16: Wire PhotoCaptureFlow + Preview Card into Hybrid Flow

**Files:**
- Modify: `apps/web/src/components/listing-flow/hybrid-flow.tsx`

This is the most complex integration task. The subagent must:

1. Replace the `PhotoCapture` import with `PhotoCaptureFlow`
2. Update the `showCapture` logic: `PhotoCaptureFlow.onComplete` now returns an array of 4-12 photos (not 1)
3. After `flow.startFromPhoto(photos)` and recognition completes, auto-call `prepareListing`
4. Add a new step/state for the preview card that appears after `prepareListing` returns
5. Render `ListingPreviewCard` with the prepared data

- [ ] **Step 1: Update imports**

Replace:
```typescript
import { PhotoCapture } from "./photo-capture";
```
With:
```typescript
import { PhotoCaptureFlow } from "./photo-capture-flow";
import { ListingPreviewCard } from "../listing/listing-preview-card";
import { usePrepareListing } from "@/hooks/use-prepare-listing";
```

- [ ] **Step 2: Add `usePrepareListing` hook call inside the component**

Inside the `HybridFlow` component function, add:
```typescript
const prepareListing = usePrepareListing();
```

- [ ] **Step 3: Replace `<PhotoCapture>` with `<PhotoCaptureFlow>`**

Replace the existing `{showCapture && (<PhotoCapture ... />)}` block with:
```typescript
{showCapture && (
  <PhotoCaptureFlow
    onComplete={(photos) => {
      setShowCapture(false);
      if (photos.length > 0) {
        flow.startFromPhoto(photos);
      }
    }}
    onCancel={() => setShowCapture(false)}
  />
)}
```

- [ ] **Step 4: Add prepare-listing trigger after recognition completes**

After recognition succeeds and the user confirms, trigger prepare:
```typescript
// Add after confirmRecognition call or in the step transition:
if (flow.state.inventoryItemId) {
  prepareListing.prepare(flow.state.inventoryItemId, ['ebay']);
}
```

The exact integration point depends on the hybrid flow's step management. The subagent should read the full hybrid flow and find where recognition transitions to the review/listing step.

- [ ] **Step 5: Add preview card rendering in the review step**

Find the review/pricing section of the hybrid flow and add:
```typescript
{prepareListing.data && (
  <ListingPreviewCard
    data={prepareListing.data}
    photos={flow.state.photos}
    onFieldChange={(field, value) => flow.setField(field as keyof typeof flow.state, value as never)}
    onPriceChange={(price) => flow.setField('price', price)}
    onPublish={(marketplace) => {
      flow.setField('marketplace', marketplace);
      flow.publish();
    }}
    isPublishing={flow.state.publishStatus === 'publishing'}
    sellerProfileComplete={!prepareListing.data.warnings.some(w => w.includes('Seller profile incomplete'))}
  />
)}
{prepareListing.isLoading && (
  <div className="flex flex-col items-center justify-center py-12 gap-3">
    <div className="w-10 h-10 border-3 border-green-200 border-t-green-600 rounded-full animate-spin" />
    <p className="text-sm" style={{ color: "rgba(0,0,0,0.5)" }}>Preparing your listing...</p>
  </div>
)}
```

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/listing-flow/hybrid-flow.tsx
git commit -m "feat(web): wire PhotoCaptureFlow and ListingPreviewCard into HybridFlow"
```

---

### Task 17: Wire into Conversational + Swipe Flows

**Files:**
- Modify: `apps/web/src/components/listing-flow/conversational-flow.tsx`
- Modify: `apps/web/src/components/listing-flow/swipe-flow.tsx`

Apply the same pattern as Task 16:
1. Replace `PhotoCapture` import with `PhotoCaptureFlow`
2. Add `usePrepareListing` hook
3. Replace `<PhotoCapture>` with `<PhotoCaptureFlow>`
4. Add prepare trigger after recognition
5. Add `ListingPreviewCard` in the review step

The subagent should read each flow file fully and adapt the integration to match that flow's step management pattern.

- [ ] **Step 1: Update conversational-flow.tsx**

Same pattern as Task 16 Steps 1-5, adapted for ConversationalFlow's step system.

- [ ] **Step 2: Update swipe-flow.tsx**

Same pattern as Task 16 Steps 1-5, adapted for SwipeFlow's card system.

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/listing-flow/conversational-flow.tsx apps/web/src/components/listing-flow/swipe-flow.tsx
git commit -m "feat(web): wire PhotoCaptureFlow and ListingPreviewCard into Conversational and Swipe flows"
```

---

## Phase 5: Verification

### Task 18: Full Build + Manual Testing

- [ ] **Step 1: Typecheck all workspaces**

```bash
npm run typecheck
```

- [ ] **Step 2: Lint**

```bash
npm run lint
```

- [ ] **Step 3: Build shared package**

```bash
npm run build -w packages/shared
```

- [ ] **Step 4: Restart API**

```bash
# Kill existing API process and restart
npm run dev:api
```

- [ ] **Step 5: Build and start web**

```bash
npm run dev:web
```

- [ ] **Step 6: Manual test — seller profile**

1. Navigate to `/settings/seller-profile`
2. Verify eBay policies load in dropdowns
3. Select fulfillment, payment, return policies
4. Verify save confirmation appears

- [ ] **Step 7: Manual test — photo capture flow**

1. Navigate to `/list`
2. Start a new listing (Hybrid flow)
3. Verify 3×4 photo grid appears
4. Add 4 photos (camera or upload)
5. Test rotate and crop on one photo
6. Verify "Done — scan with AI" button enables at 4 photos
7. Tap done, verify AI scan starts

- [ ] **Step 8: Manual test — prepare listing + preview card**

1. After recognition completes, verify "Preparing your listing..." spinner
2. Verify preview card appears with:
   - Photo carousel
   - AI-generated title (tap to edit)
   - Condition badge + description
   - Comps pricing widget with suggested price
   - Item specifics (expandable)
   - Weight/dimensions estimates
   - Publish button(s)
3. Verify comps data shows sold and active listings
4. Test inline price editing

- [ ] **Step 9: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found during manual testing"
```

---

## Parallel Execution Map

```
Phase 1: [Task 1] → [Task 2]  (sequential — types before schema)

Phase 2A: [Task 3 ║ Task 4]   (parallel — image endpoints + seller profile)

Phase 2B: [Task 5 ║ Task 6]   (parallel — Reverb adapter + eBay enhancements)

Phase 2C: [Task 7]             (sequential — needs 4, 5, 6 done)

Phase 3A: [Task 8 ║ Task 9 ║ Task 10] → [Task 11]  (leaf components parallel, then orchestrator)

Phase 3B: [Task 12 ║ Task 13 ║ Task 14]  (parallel — all independent UI)

Phase 4:  [Task 15] → [Task 16] → [Task 17]  (sequential — hook → hybrid → other flows)

Phase 5:  [Task 18]  (verification)
```

Maximum parallelism: **3 agents at once** (Phases 2A, 2B, 3A, 3B).
