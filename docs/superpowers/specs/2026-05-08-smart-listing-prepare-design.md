# Smart Listing Prepare — Comps, AI Fields, Seller Profile

**Date:** 2026-05-08
**Extends:** 2026-05-08-three-interface-listing-flow-design.md
**Scope:** Auto-comps pricing widget, AI second-pass field generation, seller profile settings, condition cross-referencing

---

## Problem

The three-interface listing flow (PR #25) handles photo capture → AI recognition → listing creation, but:

1. **No comps at creation time.** Comps exist as a separate query button — they aren't fetched automatically or used to inform pricing.
2. **Missing eBay fields.** Current `createListing` sends title, description, photos, condition, price — but omits item specifics (aspects), UPC/ePID, weight/dimensions, and condition description. Listings look incomplete on eBay.
3. **No condition cross-referencing.** The AI grades condition from photos but doesn't compare against what similar items sold for at that condition level.
4. **No seller profile.** eBay business policies (fulfillment/payment/return) are required to publish but currently passed ad-hoc from `marketplaceSpecific`. No UI to set them.
5. **No Reverb fields.** The Reverb adapter is designed but fields like make, year, finish, condition UUID, and category UUID aren't generated.

## Solution

A single `POST /api/items/:id/prepare-listing` endpoint that runs comps + category lookup + AI field generation in parallel, returning a fully-populated preview card. Combined with a **Seller Profile** settings page that captures global fields (business policies, shipping defaults, marketplace preferences) set once and reused across all listings.

---

## 1. Seller Profile (Global Settings)

### 1a. New Schema: `seller_profiles` Table

```sql
seller_profiles (
  id              uuid PK default random
  user_id         uuid FK → users.id (unique, one per user)
  
  -- eBay business policies (fetched from eBay account)
  ebay_fulfillment_policy_id   varchar(100)
  ebay_payment_policy_id       varchar(100)
  ebay_return_policy_id        varchar(100)
  ebay_merchant_location_key   varchar(100)
  
  -- Reverb defaults
  reverb_offers_enabled        boolean default true
  reverb_default_shipping      jsonb   -- { rates: [{ regionCode, rate }], local: bool }
  
  -- Shipping defaults
  ship_from_address            jsonb   -- { street1, street2, city, state, zip, country }
  default_weight_unit          varchar(5) default 'oz'   -- oz | lb | g | kg
  default_dimension_unit       varchar(5) default 'in'   -- in | cm
  default_package_type         varchar(20) default 'box' -- box | envelope | poly_mailer
  
  -- Listing preferences
  preferred_marketplaces       jsonb default '["ebay"]'  -- which marketplace tabs show
  auto_publish                 boolean default false      -- publish immediately or review first
  default_currency             varchar(3) default 'USD'
  
  created_at     timestamp default now()
  updated_at     timestamp default now()
)
```

### 1b. Why a Separate Table (Not More JSONB on `users`)

The `users` table already has 30+ columns including `shipFromAddress`, `address`, notification prefs, listing prefs, milestones, etc. Seller profile data is a distinct domain — marketplace account configuration — that will grow as we add marketplaces. A dedicated table keeps `users` focused on identity/auth and makes seller profile queries cheaper (no loading password hashes to read shipping prefs).

### 1c. Seller Profile API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/seller-profile` | Get current profile (create empty if none) |
| PATCH | `/api/seller-profile` | Update any subset of fields |
| GET | `/api/seller-profile/ebay-policies` | Fetch user's eBay business policies from eBay API |

The `ebay-policies` endpoint calls eBay's Account API to list the user's fulfillment, payment, and return policies, returning them as selectable options for the profile form.

### 1d. Seller Profile UI

Settings page at `/settings/seller-profile` with sections:

1. **eBay Account** — Connected status, business policy dropdowns (fulfillment, payment, return), location key
2. **Reverb Account** — Connected status, offers toggle, default shipping rates
3. **Shipping Defaults** — Ship-from address (pre-populated from `users.shipFromAddress` if set), preferred units, default package type
4. **Listing Preferences** — Default marketplaces, auto-publish toggle, currency

Each section is a card with inline editing. Save on field blur or explicit save button.

### 1e. Onboarding Gate

Before first listing, check if seller profile has required fields (at minimum: one marketplace connected + business policies set for that marketplace). If not, redirect to seller profile with a banner: "Set up your seller profile to start listing."

---

## 2. Prepare Listing Endpoint

### 2a. Endpoint: `POST /api/items/:id/prepare-listing`

**Request body:**
```typescript
{
  targetMarketplaces: ('ebay' | 'reverb')[];  // which marketplaces to prepare for
}
```

**Pipeline (server-side):**

```
Item (photos + scan data) + Seller Profile
                │
    ┌───────────┼───────────────┐
    ▼           ▼               ▼
[1] eBay      [2] eBay        [3] Reverb
Category      Comps            Comps
Suggestion    (Browse API,     (if music gear)
  │           production)
  ▼
[1b] Get
Required
Aspects
    └───────────┼───────────────┘
                ▼
        [4] AI Second Pass (Claude)
        Inputs: photos, scan, comps,
                required aspects, seller profile
                ▼
        PreparedListingData (all fields)
```

Steps 1, 2, 3 run in **parallel**. Step 4 waits for all three.

**Missing seller profile handling:** If the user hasn't set up a seller profile, `prepare-listing` still runs (comps + AI fields are independent of profile). The response includes `warnings: ["Seller profile incomplete — set up business policies before publishing"]` and the publish buttons are disabled until the profile is configured. The preview card shows a banner linking to `/settings/seller-profile`.

### 2b. Response: `PreparedListingData`

```typescript
interface PreparedListingData {
  // Shared fields (AI-generated)
  title: string;                        // Optimized, ≤80 chars
  description: string;                  // HTML for eBay, markdown for Reverb
  condition: ItemCondition;             // Portage 5-level grade
  conditionDescription: string;         // 2-3 sentences on wear/defects
  brand: string;
  model: string;
  
  // Pricing (from comps analysis)
  pricing: {
    suggested: number;                  // Median of sold comps at this condition
    low: number;                        // 25th percentile
    high: number;                       // 75th percentile
    currency: string;
    confidence: 'high' | 'medium' | 'low';
    basedOn: number;                    // Number of comps used
    conditionMatch: 'exact' | 'nearby' | 'all';  // How closely comps match condition
  };
  
  // Comps data for widget display
  comps: {
    ebay: CompResult | null;
    reverb: ReverbCompResult | null;
  };
  
  // eBay-specific
  ebay: {
    title: string;                      // eBay-optimized (may differ from shared title)
    categoryId: string;
    categoryName: string;
    condition: string;                  // eBay condition enum (NEW, LIKE_NEW, etc.)
    conditionDescription: string;
    aspects: Record<string, string[]>;  // Item specifics filled from required list
    upc: string | null;                 // "Does not apply" if not visible
    epid: string | null;
    weight: { value: number; unit: string };
    dimensions: { length: number; width: number; height: number; unit: string };
    packageType: string;
    // Merged from seller profile:
    fulfillmentPolicyId: string;
    paymentPolicyId: string;
    returnPolicyId: string;
    merchantLocationKey: string;
  } | null;
  
  // Reverb-specific (null if not music gear)
  reverb: {
    make: string;
    model: string;
    title: string;                      // Reverb-optimized
    categoryUuid: string;
    categoryName: string;
    conditionUuid: string;
    conditionName: string;
    year: string | null;
    finish: string | null;
    description: string;                // Markdown
    shippingRates: Array<{ regionCode: string; rate: { amount: string; currency: string } }>;
    offersEnabled: boolean;
  } | null;
  
  // Metadata
  isMusicGear: boolean;                 // Determines if Reverb tab appears
  aiConfidence: number;                 // 0-1, overall confidence in generated fields
  warnings: string[];                   // e.g. "Weight is AI-estimated", "No UPC detected"
}
```

### 2c. AI Prompt Design

The Claude call receives:

**System prompt:**
```
You are a marketplace listing expert. Generate production-quality fields
for selling a used item on eBay and optionally Reverb.

RULES:
- eBay title must be ≤80 characters. Pack keywords: Brand + Model + Key Attributes + Condition hint
- Fill ALL required item specifics from the provided aspects list. Use "N/A" only as last resort.
- Condition description must reference specific wear visible in photos (scratches, scuffs, patina, etc.)
- If no wear is visible, say "Item appears to be in [condition] condition with no visible wear."
- Price suggestion should target slightly below sold median for faster sale
- Weight and dimensions are visual estimates — always flag as estimated
- Determine if item is music gear (instruments, amps, pedals, audio equipment, accessories)
- If music gear, fill Reverb fields. If not, set reverb to null and isMusicGear to false.

OUTPUT: JSON matching the PreparedListingData schema exactly.
```

**User prompt includes:**
```
ITEM SCAN DATA:
{brand, model, category, condition, features, description from initial scan}

PHOTOS: [photo URLs or base64]

EBAY CATEGORY SUGGESTION: {categoryId, categoryName}

REQUIRED ITEM SPECIFICS FOR THIS CATEGORY:
{aspectName: {required: bool, values: string[] | null}, ...}

SOLD COMPS (eBay):
[{title, price, condition, soldDate}, ...]

ACTIVE COMPS (eBay):
[{title, price, condition}, ...]

REVERB COMPS (if applicable):
[{title, price, condition}, ...]

SELLER PROFILE:
{defaultWeightUnit, defaultDimensionUnit, defaultPackageType, currency}
```

### 2d. Condition Cross-Referencing

After the AI grades condition and comps are fetched:

1. **Filter comps by condition:** Find sold comps at the same eBay condition level.
2. **If ≥3 comps at exact condition:** `conditionMatch: 'exact'`, price from this subset.
3. **If 1-2 comps at exact condition:** Expand to ±1 grade (e.g., GOOD → LIKE_NEW + GOOD + ACCEPTABLE). `conditionMatch: 'nearby'`.
4. **If 0 comps at nearby conditions:** Use all comps. `conditionMatch: 'all'`. Add warning: "Limited comps at this condition — price may be less accurate."

The pricing widget displays this confidence level so the user knows how reliable the suggestion is.

---

## 3. Comps Pricing Widget

### 3a. Widget Design (Embedded in Preview Card)

```
┌─────────────────────────────────────┐
│  💰 Suggested Price                 │
│  ┌─────────────────────────────┐    │
│  │         $178                │    │
│  │   tap to change             │    │
│  └─────────────────────────────┘    │
│                                     │
│  Range: $145 — $210                 │
│  Based on 8 sold comps (exact match)│
│                                     │
│  ── Sold ──────── Active ────────   │
│  ●  $165  Good    ○  $189  Good    │
│  ●  $172  Good    ○  $195  Good    │
│  ●  $178  Good    ○  $199  VGood   │
│  ●  $185  LikeNew ○  $210  New     │
│                                     │
│  [eBay] [Reverb]  ← marketplace tab │
└─────────────────────────────────────┘
```

- Suggested price is large, tappable → opens inline number editor
- Range shows 25th-75th percentile
- Comp count + condition match confidence
- Scrollable list of individual comps (sold on left, active on right)
- Marketplace tabs switch between eBay and Reverb comps

### 3b. Widget Component

`apps/web/src/components/listing/comps-pricing-widget.tsx`

Props:
```typescript
{
  pricing: PreparedListingData['pricing'];
  comps: PreparedListingData['comps'];
  currentPrice: number;
  onPriceChange: (price: number) => void;
}
```

---

## 4. Preview Card Integration

The existing three interfaces (Conversational, Swipe, Hybrid) each have a review/confirm step. The `prepare-listing` response populates that step as a **preview card** (not a form):

```
┌──────────────────────────────────────┐
│  [photo carousel]                    │
│                                      │
│  Fender Stratocaster MIM 2019        │
│  Sunburst · Good condition           │
│  "Light pick wear on body, neck      │
│   is clean with minimal fret wear"   │
│                                      │
│  ┌── Comps Pricing Widget ────────┐  │
│  │  $178  ·  $145-$210 range      │  │
│  │  8 sold comps (exact match)    │  │
│  └────────────────────────────────┘  │
│                                      │
│  Item Specifics          [expand ▼]  │
│  Brand: Fender                       │
│  MPN: 0144502500                     │
│  Body Type: Solid Body               │
│  ...                                 │
│                                      │
│  [eBay]  [Reverb]                    │
│                                      │
│  Weight: ~8 lbs (estimated)          │
│  Dimensions: 46×16×5 in (estimated)  │
│                                      │
│  ┌──────────────┐ ┌───────────────┐  │
│  │ Publish eBay │ │ Publish Reverb│  │
│  └──────────────┘ └───────────────┘  │
└──────────────────────────────────────┘
```

Every text field is tap-to-edit inline. Tapping opens a small editor overlay — not a form page. The card IS the listing preview.

---

## 5. eBay Field Inventory (Confirmed via API Documentation)

### 5a. Inventory Item (`createOrReplaceInventoryItem`)

| Field | Type | Required | AI Fills | Source |
|-------|------|----------|----------|--------|
| product.title | string (≤80) | Yes | Yes | AI optimized from scan |
| product.description | string (HTML) | Yes | Yes | AI generated |
| product.imageUrls | string[] | Yes | No | From photo capture |
| product.brand | string | No* | Yes | Scan + AI |
| product.mpn | string | No* | Yes | Scan + AI |
| product.upc | string[] | No* | Yes | Photo barcode or "Does not apply" |
| product.epid | string | No | Yes | eBay catalog match if found |
| product.aspects | Record<string, string[]> | Category-dependent | Yes | AI fills from required list |
| condition | enum | Yes | Yes | AI grade → eBay mapping |
| conditionDescription | string | Yes (used) | Yes | AI from photo analysis |
| availability.shipToLocationAvailability.quantity | number | Yes | No | Always 1 for single items |
| packageWeightAndSize.weight | {value, unit} | Recommended | Yes | AI visual estimate |
| packageWeightAndSize.dimensions | {l, w, h, unit} | Recommended | Yes | AI visual estimate |
| packageWeightAndSize.packageType | enum | Recommended | No | From seller profile default |

*Required for some categories via aspects

### 5b. Offer (`createOffer`)

| Field | Type | Required | Source |
|-------|------|----------|--------|
| sku | string | Yes | Generated: `portage-{timestamp}` |
| marketplaceId | string | Yes | `EBAY_US` |
| format | string | Yes | `FIXED_PRICE` |
| categoryId | string | Yes | From Taxonomy API suggestion |
| pricingSummary.price | {value, currency} | Yes | User-confirmed (AI suggested) |
| listingDescription | string | No | Same as product.description |
| merchantLocationKey | string | Yes | From seller profile |
| listingPolicies.fulfillmentPolicyId | string | Yes | From seller profile |
| listingPolicies.paymentPolicyId | string | Yes | From seller profile |
| listingPolicies.returnPolicyId | string | Yes | From seller profile |

### 5c. Current Code Gaps (6 items)

| # | Gap | Fix |
|---|-----|-----|
| 1 | No item specifics/aspects sent | AI generates, included in inventory item body |
| 2 | No UPC/ePID fields | AI detects from photos or sets "Does not apply" |
| 3 | No weight/dimensions | AI estimates, flagged as estimated in warnings |
| 4 | No conditionDescription | AI generates from photo analysis |
| 5 | No business policy validation | Checked from seller profile before publish |
| 6 | categoryId hardcoded to `'99'` as fallback | Taxonomy API suggestion, no fallback |

---

## 6. Reverb Field Inventory (Confirmed via Live API Testing)

### 6a. Listing (`POST /api/listings`)

| Field | Type | Required | AI Fills | Source |
|-------|------|----------|----------|--------|
| make | string | Yes | Yes | Brand from scan |
| model | string | Yes | Yes | Model from scan |
| title | string | Yes | Yes | AI optimized for Reverb |
| description | string (markdown) | Yes | Yes | AI generated |
| condition.uuid | uuid | Yes | Yes | AI grade → Reverb condition map |
| categories[].uuid | uuid | Yes | Yes | Reverb `/api/categories/flat` match |
| price.amount | string | Yes | No | User-confirmed |
| price.currency | string | Yes | No | From seller profile |
| has_inventory | boolean | Yes | No | `true` |
| inventory | number | Yes | No | `1` |
| offers_enabled | boolean | No | No | From seller profile |
| year | string | No | Yes | AI from model/serial |
| finish | string | No | Yes | AI from photos |
| photos | string[] | No | No | From photo capture |
| shipping.rates[] | array | Yes | No | From seller profile defaults |
| shipping.local | boolean | No | No | Default `false` |

**Note:** Reverb requires at minimum one shipping rate for US Continental. The seller profile's `reverb_default_shipping` must include this region or the listing will fail validation.

### 6b. Reverb Condition Mapping

| Reverb Condition | UUID | Portage Grade |
|-----------------|------|---------------|
| Brand New | `fbf35668-96a0-4baa-bcde-ab18d6b1b329` | new |
| Mint | `ac5b9c1e-dc78-466d-b0b3-a19b46876097` | like_new |
| Excellent | `df268ad1-c462-4ba6-b6e0-164c5ca008ce` | like_new |
| Very Good | `ae4d9114-1bd7-4ec5-a4ba-6653af5ac84d` | good |
| Good | `f7a3f48c-972a-44c6-b01a-0cd27488d3ab` | good |
| Fair | `98777886-76d0-44a8-8e36-e0b8884c4c6f` | fair |
| Poor | `cda44a45-f57a-4891-a29e-a75e0afb8df0` | poor |
| Non-Functioning | *(fetch from `/api/listing_conditions` at runtime)* | poor |

The AI picks the specific Reverb condition (e.g., Excellent vs Mint for `like_new`) based on photo analysis. The mapping above is the default fallback. Condition UUIDs should be cached from `/api/listing_conditions` on first use — they rarely change but are not guaranteed stable across Reverb API versions.

---

## 7. Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `apps/api/src/db/schema.ts` | Modify | Add `sellerProfiles` table |
| 2 | `apps/api/src/routes/seller-profile.ts` | Create | GET/PATCH profile + eBay policies fetch |
| 3 | `apps/api/src/routes/prepare-listing.ts` | Create | Smart prepare endpoint (comps + AI) |
| 4 | `apps/api/src/marketplace/ebay-adapter.ts` | Modify | Add `getCategorySuggestion`, `getRequiredAspects`, update `createListing` with full fields |
| 5 | `apps/api/src/marketplace/reverb-adapter.ts` | Create | Full Reverb adapter (list, comps, categories, conditions) |
| 6 | `apps/api/src/lib/vision.ts` | Modify | Add second-pass prompt for marketplace field generation |
| 7 | `packages/shared/src/types.ts` | Modify | Add `PreparedListingData`, `SellerProfile` types |
| 8 | `apps/web/src/components/listing/comps-pricing-widget.tsx` | Create | Pricing widget with comps display |
| 9 | `apps/web/src/components/listing/listing-preview-card.tsx` | Create | Tap-to-edit preview card |
| 10 | `apps/web/src/hooks/use-prepare-listing.ts` | Create | Hook calling prepare endpoint |
| 11 | `apps/web/src/app/settings/seller-profile/page.tsx` | Create | Seller profile settings page |
| 12 | `apps/api/src/index.ts` | Modify | Register new routes |
| 13 | `apps/web/src/components/listing/conversational-flow.tsx` | Modify | Integrate preview card + comps widget |
| 14 | `apps/web/src/components/listing/swipe-flow.tsx` | Modify | Integrate preview card + comps widget |
| 15 | `apps/web/src/components/listing/hybrid-flow.tsx` | Modify | Integrate preview card + comps widget |

---

## 8. Condition Cross-Reference Algorithm

```
Given: aiCondition (from photo analysis), soldComps[]

1. Map aiCondition → eBay condition enum
2. Filter soldComps where comp.condition === ebayCondition
3. If filtered.length >= 3:
     conditionMatch = 'exact'
     pricePool = filtered
4. Else:
     Expand to ±1 grade on eBay scale (LIKE_NEW ↔ GOOD ↔ ACCEPTABLE)
     Filter soldComps where comp.condition in [grade-1, grade, grade+1]
     If filtered.length >= 3:
       conditionMatch = 'nearby'
       pricePool = filtered
     Else:
       conditionMatch = 'all'
       pricePool = allSoldComps
       warnings.push("Limited comps at this condition")

5. suggested = median(pricePool.map(c => c.price))
6. low = percentile(pricePool, 25)
7. high = percentile(pricePool, 75)
8. confidence = exact → 'high', nearby → 'medium', all → 'low'
```

---

## 9. Non-Goals (Explicitly Out of Scope)

- Etsy adapter (third marketplace, separate spec)
- Auction format (FIXED_PRICE only)
- Multi-quantity listings (always quantity 1)
- Automatic re-listing on price drop
- Bulk listing (prepare handles one item at a time)
- Shipping rate calculation (uses seller profile defaults, not real-time carrier quotes)
