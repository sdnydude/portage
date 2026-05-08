# Three-Interface Listing Flow Design

**Date:** 2026-05-08
**Supersedes:** 2026-05-07-ebay-listing-flow-design.md (form-based create listing sheet replaced entirely)
**Approach:** Shared hooks + three full-page interface implementations with distinct visual personalities
**Scope:** Photo capture → AI recognition → listing creation (eBay/Reverb/Etsy) → post-publish management

---

## Problem

Sellers need to list items on eBay, Reverb, and Etsy. The current form-based listing sheet is functional but generic — it doesn't match the premium mobile-first experience Portage targets. Different sellers have different mental models: some want conversational guidance, some want speed, some want control. One interface can't serve all three.

## Solution

Three fully functional listing interfaces sharing one hook (`useListingFlow`) for all business logic. Users default to Hybrid (C) and discover the other two after their first successful listing. Each interface has a distinct visual personality but identical capability.

**3-tap minimum path:** Photo → AI fills everything → Review & Publish.

---

## 1. User Flow

### First-Time User

```
Sign up → empty inventory → "Add Your First Item" hero CTA
  └─ Photo capture (take / upload / choose from library)
      └─ Crop & enhance (shared camera, pre-adapted to Hybrid theme)
          └─ AI Recognition
              ├─ High confidence (>80%): shows match + reasoning
              ├─ Low confidence (40-80%): "Is this a [guess]?" + alternatives
              ├─ Multi-match: 2-3 candidates, tap to select
              └─ Failure (<40%): manual entry, listing flow continues with empty fields
                  └─ Fork: "List for Sale" / "Save to Inventory"
                      └─ Listing flow (Hybrid C by default)
                          └─ Auto-draft saved at every step
                              └─ Publish
                                  └─ Success screen with "List Another" button
                                      └─ "Try a different listing style?" discovery prompt
```

### Returning User — Two Entry Paths

**Photo FAB (home/inventory tab):**
Photo → recognition → fork → listing flow (user's saved preference)

**Item Detail → "List for Sale":**
Skips photo & recognition → listing flow starts at review screen, pre-filled from item data. Pass `?itemId=<uuid>` as query param.

### Smart Fork

Track consecutive "List for Sale" choices on user profile (`listing_fork_count`). After 5+, skip the fork and go straight to listing. Show subtle "Save to inventory instead?" link. Reset count on any "Save to Inventory" choice.

### Draft Recovery

Inventory shows items with "Draft listing" badge. Tap → resumes listing flow at last completed step. One draft per item per marketplace. Starting a new draft replaces the old one.

---

## 2. Shared Hook: `useListingFlow`

All business logic lives here. Three interface pages consume this hook and render their own UX.

### State Model

```typescript
interface ListingFlowState {
  // Photo
  photos: Photo[];
  primaryPhotoIndex: number;

  // AI Recognition
  recognition: {
    status: 'idle' | 'recognizing' | 'complete' | 'failed';
    candidates: RecognitionResult[];  // 1-3 ranked matches
    selectedIndex: number;
    reasoning: string[];              // "Identified by: pointed pocket flaps..."
    confidence: number;
  };

  // Listing data (pre-filled by AI, all editable)
  title: string;
  description: string;
  category: string;
  categoryPath: string[];
  condition: string;
  brand: string;
  model: string;
  features: string[];

  // Pricing
  price: number | null;
  pricingStrategy: 'fast' | 'market' | 'max' | 'custom';
  acceptOffers: boolean;
  minimumOfferPrice: number | null;
  comps: CompResult | null;
  compsStatus: 'idle' | 'loading' | 'loaded' | 'failed';

  // Marketplace
  marketplace: 'ebay' | 'reverb' | 'etsy';

  // Shipping
  shippingMethod: 'calculated' | 'flat' | 'free';
  shippingCost: number | null;
  packageSize: 'small' | 'medium' | 'large' | 'custom';
  weight: number | null;

  // Flow state
  draftId: string | null;
  publishStatus: 'idle' | 'publishing' | 'published' | 'failed';
  listingId: string | null;
  inventoryItemId: string | null;
}
```

### Hook Methods

| Method | What it does |
|--------|-------------|
| `startFromPhoto(photos)` | Kicks off AI recognition on primary photo |
| `startFromItem(itemId)` | Loads existing item data, skips recognition |
| `confirmRecognition(index)` | Accepts an AI candidate, pre-fills all fields |
| `setField(key, value)` | Updates any listing field, debounced auto-save draft (2s) |
| `fetchComps()` | Loads comparable pricing from eBay Browse API |
| `applyPricingStrategy(strategy)` | Sets price relative to comps (fast=below median, market=median, max=above) |
| `addPhotos(photos)` | Appends photos to the listing |
| `saveDraft()` | Persists full state snapshot to API (UPSERT) |
| `publish()` | Validates required fields, submits to marketplace adapter |
| `crossList(marketplace)` | Creates listing on another marketplace from same data |
| `reset()` | Clears state for next listing |

### Draft Auto-Save Pattern

Local-first optimistic pattern:
- All state lives in the hook (in-memory). UI never reads from server during a session.
- `saveDraft()` sends the full state snapshot. Server does UPSERT keyed on `(userId, itemId, marketplace)`.
- If save fails, silent retry (3 attempts with backoff). Subtle warning after all retries fail.
- On session resume (opening a draft), server state loads once as initial hook state.
- No conflict resolution needed — full state always sent, single-user app.

---

## 3. Three Interface Personalities

### A — Conversational (Porter-First)

**Visual DNA:** Light cream theme (#FAF8F5), DM Serif Display headlines, Forest Green (#2D5A27) accent, chat bubbles with pill quick-actions, soft shadows, warm and personal. iMessage energy.

**Interaction pattern:** The entire listing flow is a conversation with Porter. Each step is a message. User responds via pills (quick-action buttons) or typed input. Porter guides with witty, helpful messages.

**How steps render:**
- Recognition → Porter message: "Found it! This looks like a [item]. Identified by [reasoning]." + Confirm/Not quite pills
- Comps → "Similar items sold for $X-$Y on eBay" (one-line summary in a message)
- Pricing → Three pills: "$79 Sell fast" / "$110 Market" / "$139 Max value"
- Details → Porter pre-fills, asks "Want to edit anything?" with Edit title / Edit description pills
- Shipping → "How should we ship this?" + size/method pills
- Review → Summary message with all details + Publish pill
- Marketplace → Small pill in review message, defaults to eBay, tappable to change

**Loading experience:** Porter typing indicator (three bouncing dots) with status messages: "Examining your item..." → "Checking comparable prices..." → "Almost ready!"

### B — Swipe to Sell (Speed Sells)

**Visual DNA:** Dark black theme (#0A0A0A), Syne ultra-bold headlines, DHG Orange (#F15A22) accent, full-bleed item cards, bold price typography, haptic-feeling transitions. StockX energy.

**Interaction pattern:** Full-screen cards. Each step is a card that slides in. User configures via pills, sliders, and taps. Minimum interaction per card. Designed for speed — list in 3 taps if AI nails the recognition.

**How steps render:**
- Recognition → Full-screen photo with scan animation, item name overlaid in bold type, confidence percentage
- Comps → Comp dots on a horizontal price slider, drag to set price
- Pricing → Integrated into the slider card (fast/market/max as tap zones on the slider)
- Details → Editable title input overlaid on the photo card, description below
- Shipping → Package size pills + weight input on a card
- Review → Summary card with photo strip, fee breakdown, big PUBLISH button
- Marketplace → eBay badge on the review card, tap to cycle

**Loading experience:** Full-screen pulse/scan animation over the photo. Bold percentage counter: "12%... 47%... 94%... MATCH"

### C — Hybrid (Chat + Quick Actions) — DEFAULT

**Visual DNA:** Warm neutral theme (#F5F3EF background, #18191C text), Instrument Sans headlines, Cobalt (#0047AB) accent, chat messages with inline editable data cards, context-aware action bar. Linear/Notion energy.

**Interaction pattern:** Porter chat as command center with inline editable cards that appear in the conversation. Context-aware action pills change at every state. Best of both worlds — conversation when you want guidance, direct manipulation when you want speed.

**How steps render:**
- Recognition → Porter message + inline recognition card with match details and reasoning
- Comps → Expandable inline data table with 8 items, summary stats at top
- Pricing → Inline card with editable price field + strategy pills (fast/market/max)
- Details → Inline card with editable title input, description textarea, regenerate button
- Shipping → Inline card with package/weight/method config
- Review → Full summary card with photo strip, all fields, fee estimate, Publish button
- Marketplace → Pill in the action bar, defaults to eBay

**Loading experience:** Inline skeleton card that progressively fills in data. Title appears first, then category, then price — each with a subtle slide-in.

**Compact mode toggle:** A small toggle in the top-right corner switches between "Chat" (default conversation with inline cards) and "Form" (all editable fields on one screen as a dense form — title, description, price, category, condition, shipping, marketplace, photos — with a single Publish button at the bottom). Same `useListingFlow` hook, same data, two rendering modes. Power users who want to blast through 20 listings use compact mode. New users see chat mode by default. Preference persisted to user profile (`listing_compact_mode: boolean`, default false).

---

## 4. Shared Components

Only genuinely UI-agnostic pieces are shared. Per-interface components that consume the same hooks but render differently are NOT shared.

### Truly Shared (4 components)

| Component | Purpose |
|-----------|---------|
| `photo-capture.tsx` | Camera/upload/library + crop + enhance. Pre-adapted to user's interface personality via CSS variables |
| `recognition-fork.tsx` | "List for Sale" / "Save to Inventory" binary choice. Smart-defaults after 5+ consecutive list choices |
| `publish-success.tsx` | Celebration screen with "List Another" button + cross-list nudge + interface discovery prompt (after first listing) |
| `fee-estimate.tsx` | Marketplace fee calculation — pure data display, minimal styling |

### Per-Interface (each builds their own)

Comps display, pricing UI, details editor, shipping config, review screen, marketplace selector. These consume the same hook data but render with completely different layouts, density, and interaction patterns.

### Theme Pre-Adaptation

Shared components adapt to the user's interface personality via CSS variables:

```typescript
const themes = {
  conversational: { '--flow-bg': '#FAF8F5', '--flow-accent': '#2D5A27', '--flow-text': '#1A1A1A' },
  swipe:          { '--flow-bg': '#0A0A0A', '--flow-accent': '#F15A22', '--flow-text': '#FFFFFF' },
  hybrid:         { '--flow-bg': '#F5F3EF', '--flow-accent': '#0047AB', '--flow-text': '#18191C' },
};
```

Applied to the shared component wrapper. Eliminates visual whiplash between camera → listing flow.

---

## 5. Data Model

### Modified: `users` table

Add 3 columns (Drizzle schema push, non-destructive):

```
listing_interface    text    DEFAULT 'hybrid'    -- 'conversational' | 'swipe' | 'hybrid'
listing_fork_pref    text    DEFAULT 'ask'       -- 'ask' | 'list' | 'inventory'
listing_fork_count   int     DEFAULT 0           -- consecutive "List for Sale" count
listing_compact_mode boolean DEFAULT false       -- Hybrid compact form toggle
```

### New: `listing_drafts` table

```
id                   uuid     PK
user_id              uuid     FK → users
item_id              uuid     FK → items, nullable
marketplace          text     NOT NULL  -- 'ebay' | 'reverb' | 'etsy'
title                text     nullable  -- promoted for queryability
price                numeric  nullable  -- promoted for queryability
status               text     DEFAULT 'draft'
last_step_completed  text     nullable  -- 'recognition' | 'pricing' | 'shipping' etc.
flow_state           jsonb    NOT NULL  -- full ListingFlowState snapshot
created_at           timestamp DEFAULT now()
updated_at           timestamp DEFAULT now()
```

UNIQUE constraint on `(user_id, item_id, marketplace)` where `item_id IS NOT NULL` — one draft per item per marketplace. When `item_id` is null (new item from photo, not yet saved to inventory), UPSERT uses `draft_id` as the key instead.

Drafts older than 30 days hard-deleted on login (simple query in auth middleware, no recycle bin).

### Modified: `/scan` endpoint

Add `?detail=full` query param to existing `/scan` route:
- Without param: current behavior (flat result, backward compatible)
- With `detail=full`: returns `{ candidates: RecognitionResult[], reasoning: string[] }` format

---

## 6. File Structure

```
apps/web/src/
├── app/
│   ├── list/
│   │   └── page.tsx                   # Conditional render based on user pref (no redirect)
│   ├── listings/
│   │   └── [id]/
│   │       └── page.tsx               # Post-publish listing detail (shared)
│   └── (tabs)/home/
│       └── page.tsx                   # MODIFY — "Add Your First Item" empty state, Photo FAB
│
├── components/
│   └── listing-flow/
│       ├── photo-capture.tsx          # Shared: camera/upload/library + crop
│       ├── recognition-fork.tsx       # Shared: list vs inventory choice
│       ├── publish-success.tsx        # Shared: success + "List Another" + cross-list
│       ├── fee-estimate.tsx           # Shared: marketplace fee calc
│       ├── conversational-flow.tsx    # Interface A — full implementation
│       ├── swipe-flow.tsx             # Interface B — full implementation
│       └── hybrid-flow.tsx            # Interface C — full implementation
│
├── hooks/
│   ├── use-listing-flow.ts            # Shared state + API logic
│   ├── use-drafts.ts                  # Draft CRUD + auto-save
│   └── use-user-preferences.ts        # Read/write listing_interface, fork pref
│
apps/api/src/
├── routes/
│   ├── drafts.ts                      # CRUD for listing_drafts (requireAuth)
│   ├── scan.ts                        # MODIFY — add ?detail=full for candidates + reasoning
│   └── listings.ts                    # EXISTING — handles publish via marketplace adapters
├── db/
│   └── schema.ts                      # MODIFY — add listing_drafts table, user pref columns
```

### `/list/page.tsx` — Conditional Render (No Redirect)

```tsx
export default function ListPage() {
  const { preference } = useUserPreferences();

  switch (preference) {
    case 'conversational': return <ConversationalFlow />;
    case 'swipe':          return <SwipeFlow />;
    case 'hybrid':
    default:               return <HybridFlow />;
  }
}
```

URL is always `/list`. No sub-routes. No redirect flash. Query param `?itemId=<uuid>` for item-detail entry point.

---

## 7. API Surface

All endpoints require authentication (existing `requireAuth` middleware).

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/scan` | POST | AI recognition (existing, add `?detail=full`) |
| `/items` | POST | Create inventory item (existing) |
| `/items/:id` | GET | Get item for "List from inventory" entry point (existing) |
| `/items/:id/comps` | GET | Comparable pricing from eBay Browse API (existing) |
| `/drafts` | GET | List user's drafts (new) |
| `/drafts` | POST | Create/upsert draft (new) |
| `/drafts/:id` | GET | Get single draft for resume (new) |
| `/drafts/:id` | DELETE | Delete draft (new, also called on successful publish) |
| `/listings` | POST | Create listing via marketplace adapter (existing) |
| `/listings/:id` | GET | Listing detail with marketplace sync (existing, needs sync addition) |
| `/listings/:id` | PATCH | Update listing (existing) |
| `/listings/:id` | DELETE | End listing (existing) |

No new marketplace adapter code needed — existing eBay/Reverb/Etsy adapters handle all publishing.

---

## 8. Error Handling

| Scenario | Behavior |
|----------|----------|
| AI recognition fails | "Help me identify this" → manual entry, listing flow continues with empty fields |
| AI returns multi-match | Show 2-3 candidates with confidence %, tap to select |
| Comps unavailable | "No comparable listings found." Price field empty, strategy pills hidden, user sets price manually |
| Marketplace not connected | Marketplace pill shows as disabled with "Connect [marketplace]" link → settings |
| Publish fails (marketplace rejects) | Auto-saves as draft. Toast with specific error. User can fix and retry from draft |
| Publish fails (network) | Auto-saves as draft. "Couldn't reach [marketplace]. Your listing is saved as a draft." |
| Draft save fails | Silent retry (3 attempts, exponential backoff). After all fail: subtle warning "Changes may not be saved" |
| Photo upload fails | Retry with backoff. After 3 fails: "Photo couldn't upload. Tap to retry." Photo stays in local state |
| User leaves mid-flow | Draft already saved. Draft badge on inventory item. Tap to resume at last step |

---

## 9. Post-Publish

### Listing Detail Page (Shared)

**File:** `apps/web/src/app/listings/[id]/page.tsx`

Single shared page regardless of which interface created the listing:
- Status banner (Active/Draft/Ended/Sold) with marketplace badge
- Item photos in horizontal scroll
- Editable fields: price, title, description
- Read-only fields: category, condition, SKU, marketplace listing ID
- Actions: Save Changes, End Listing, View on [Marketplace]
- **Cross-list nudge:** "This item could also be listed on [other marketplace] — one tap to cross-list." Persistent but non-blocking.

### Success Screen (Shared)

- Celebration animation
- Listing summary with marketplace link
- **"List Another"** button → straight to camera (maintains momentum for batch listing)
- **Cross-list prompt** (deferred to listing detail page as persistent nudge)
- **Interface discovery** (first listing only): "You used Hybrid mode. Did you know there are two other listing styles? Check them out in Settings."

---

## 10. Interface Discovery

No onboarding picker. Users discover alternatives organically:

1. **After first listing:** Success screen mentions "Try a different listing style?" with link to Settings
2. **Settings page:** "Listing Style" section shows all three with visual preview thumbnails + personality description
3. **In-context hint:** After 10+ listings, subtle prompt: "Speed tip: Swipe mode lets you list in 3 taps" (shown once)

---

## 11. Deployment Notes

### Prerequisites
- Existing eBay sandbox OAuth working
- Existing scan endpoint functional
- R2 storage configured for photo uploads

### Deploy Steps
1. `npm run db:push` — adds `listing_drafts` table + user pref columns
2. `npm run build -w packages/shared` — rebuild shared types if changed
3. Restart API to pick up new drafts route + scan changes
4. Frontend deploys with new `/list` page + components

### What's NOT in This Spec
- Haptic feedback (post-v1 polish)
- Sound design (post-v1 polish)
- Batch listing mode (future — "List Another" provides basic momentum for now)
- Etsy adapter (same pattern as eBay/Reverb, separate spec)
- Promoted Listings / Marketing API (future)
- Buyer messaging (separate spec)
- Analytics on which interface users prefer (future, can add event tracking later)

---

## Files to Create/Modify

| Action | File |
|--------|------|
| **Create** | `apps/web/src/app/list/page.tsx` |
| **Create** | `apps/web/src/components/listing-flow/conversational-flow.tsx` |
| **Create** | `apps/web/src/components/listing-flow/swipe-flow.tsx` |
| **Create** | `apps/web/src/components/listing-flow/hybrid-flow.tsx` |
| **Create** | `apps/web/src/components/listing-flow/photo-capture.tsx` |
| **Create** | `apps/web/src/components/listing-flow/recognition-fork.tsx` |
| **Create** | `apps/web/src/components/listing-flow/publish-success.tsx` |
| **Create** | `apps/web/src/components/listing-flow/fee-estimate.tsx` |
| **Create** | `apps/web/src/hooks/use-listing-flow.ts` |
| **Create** | `apps/web/src/hooks/use-drafts.ts` |
| **Create** | `apps/web/src/hooks/use-user-preferences.ts` |
| **Create** | `apps/web/src/app/listings/[id]/page.tsx` |
| **Create** | `apps/api/src/routes/drafts.ts` |
| **Modify** | `apps/api/src/db/schema.ts` (add listing_drafts, user pref columns) |
| **Modify** | `apps/api/src/routes/scan.ts` (add ?detail=full) |
| **Modify** | `apps/api/src/index.ts` (mount drafts router) |
| **Modify** | `apps/web/src/app/(tabs)/home/page.tsx` (empty state CTA, Photo FAB) |
| **Modify** | `apps/web/src/app/inventory/[id]/page.tsx` ("List for Sale" button) |
| **Modify** | `packages/shared/src/types.ts` (ListingFlowState, RecognitionResult types) |
