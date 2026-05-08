# Three-Interface Listing Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build three fully functional listing interfaces (Conversational/Swipe/Hybrid) sharing a single `useListingFlow` hook, with auto-draft persistence, AI recognition, and distinct visual personalities.

**Architecture:** Shared `useListingFlow` hook owns all state and API calls. Three page components consume it and render their own UX. Backend adds `listing_drafts` table, user preference columns, drafts CRUD route, preferences route, and enhanced scan endpoint. `/list` page conditionally renders the correct interface based on user preference.

**Tech Stack:** Next.js 16 + React 19 + Tailwind v4 (frontend), Express 5 + Drizzle ORM + PostgreSQL 15 (backend), Claude Vision API (AI recognition), eBay Browse API (comps).

**Spec:** `docs/superpowers/specs/2026-05-08-three-interface-listing-flow-design.md`

---

## File Structure

### Backend (apps/api/src/)

| File | Responsibility |
|------|---------------|
| `db/schema.ts` | MODIFY — add `listingDrafts` table, add 4 columns to `users`, add `'reverb'` to marketplace enum |
| `routes/drafts.ts` | CREATE — CRUD for listing drafts (GET list, POST upsert, GET single, DELETE) |
| `routes/preferences.ts` | CREATE — GET/PATCH for user listing preferences |
| `routes/scan.ts` | MODIFY — add `?detail=full` for multi-candidate recognition |
| `lib/vision.ts` | MODIFY — add `identifyItemDetailed()` returning candidates + reasoning |
| `index.ts` | MODIFY — mount drafts and preferences routers |

### Shared Types (packages/shared/src/)

| File | Responsibility |
|------|---------------|
| `types.ts` | MODIFY — add `ListingFlowState`, `RecognitionResult`, `ListingDraft`, `UserPreferences` types; add `'reverb'` to marketplace unions |

### Frontend Hooks (apps/web/src/hooks/)

| File | Responsibility |
|------|---------------|
| `use-user-preferences.ts` | CREATE — read/write listing interface, fork pref, compact mode |
| `use-drafts.ts` | CREATE — draft CRUD + debounced auto-save |
| `use-listing-flow.ts` | CREATE — all listing business logic: state, recognition, comps, pricing, publish |

### Frontend Shared Components (apps/web/src/components/listing-flow/)

| File | Responsibility |
|------|---------------|
| `photo-capture.tsx` | CREATE — camera/upload/library + crop. Theme-adapted via CSS vars |
| `recognition-fork.tsx` | CREATE — "List for Sale" / "Save to Inventory" binary choice |
| `fee-estimate.tsx` | CREATE — marketplace fee calculation display |
| `publish-success.tsx` | CREATE — celebration + "List Another" + cross-list nudge + interface discovery |

### Frontend Interface Implementations (apps/web/src/components/listing-flow/)

| File | Responsibility |
|------|---------------|
| `hybrid-flow.tsx` | CREATE — Interface C: chat + inline cards + compact form toggle. DEFAULT |
| `conversational-flow.tsx` | CREATE — Interface A: Porter chat with pill actions |
| `swipe-flow.tsx` | CREATE — Interface B: full-screen cards, bold typography, speed-first |

### Frontend Pages (apps/web/src/app/)

| File | Responsibility |
|------|---------------|
| `list/page.tsx` | CREATE — conditional render based on user preference |
| `listings/[id]/page.tsx` | CREATE — post-publish listing detail (shared) |
| `(tabs)/home/page.tsx` | MODIFY — "Add Your First Item" empty state, Photo FAB |
| `inventory/[id]/page.tsx` | MODIFY — "List for Sale" button |

---

## Phase 1: Backend Foundation

### Task 1: Schema Changes

**Files:**
- Modify: `apps/api/src/db/schema.ts`
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Add reverb to marketplace enum and user preference columns**

In `apps/api/src/db/schema.ts`, make these changes:

```typescript
// Change this line:
export const marketplaceEnum = pgEnum('marketplace_type', ['ebay', 'etsy']);

// To:
export const marketplaceEnum = pgEnum('marketplace_type', ['ebay', 'etsy', 'reverb']);
```

Add 4 new columns to the `users` table definition (after `hintsDismissed`):

```typescript
  listingInterface: text('listing_interface').notNull().default('hybrid'),
  listingForkPref: text('listing_fork_pref').notNull().default('ask'),
  listingForkCount: integer('listing_fork_count').notNull().default(0),
  listingCompactMode: boolean('listing_compact_mode').notNull().default(false),
```

- [ ] **Step 2: Add listing_drafts table**

Add after the `disclaimerAcceptances` table in `schema.ts`:

```typescript
export const listingDrafts = pgTable('listing_drafts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  itemId: uuid('item_id').references(() => items.id, { onDelete: 'cascade' }),
  marketplace: marketplaceEnum('marketplace').notNull(),
  title: varchar('title', { length: 500 }),
  price: real('price'),
  status: text('status').notNull().default('draft'),
  lastStepCompleted: text('last_step_completed'),
  flowState: jsonb('flow_state').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

- [ ] **Step 3: Add shared types**

In `packages/shared/src/types.ts`, update marketplace unions:

```typescript
// Update Listing interface:
marketplace: 'ebay' | 'etsy' | 'reverb';

// Update Order interface:
marketplace: 'ebay' | 'etsy' | 'reverb';

// Update MarketplaceAccount interface:
marketplace: 'ebay' | 'etsy' | 'reverb';
```

Add new types at the end of the file:

```typescript
export interface RecognitionCandidate {
  name: string;
  description: string;
  category: string;
  condition: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
  conditionNotes: string;
  brand: string | null;
  model: string | null;
  features: string[];
  estimatedValueLow: number;
  estimatedValueHigh: number;
  confidence: number;
}

export interface RecognitionResult {
  candidates: RecognitionCandidate[];
  reasoning: string[];
}

export type ListingInterface = 'conversational' | 'swipe' | 'hybrid';
export type ListingForkPref = 'ask' | 'list' | 'inventory';
export type PricingStrategy = 'fast' | 'market' | 'max' | 'custom';
export type ShippingMethod = 'calculated' | 'flat' | 'free';
export type PackageSize = 'small' | 'medium' | 'large' | 'custom';

export interface ListingFlowState {
  photos: Array<{ url: string; key: string; width?: number; height?: number; isPrimary?: boolean }>;
  primaryPhotoIndex: number;

  recognition: {
    status: 'idle' | 'recognizing' | 'complete' | 'failed';
    candidates: RecognitionCandidate[];
    selectedIndex: number;
    reasoning: string[];
    confidence: number;
  };

  title: string;
  description: string;
  category: string;
  categoryPath: string[];
  condition: string;
  brand: string;
  model: string;
  features: string[];

  price: number | null;
  pricingStrategy: PricingStrategy;
  acceptOffers: boolean;
  minimumOfferPrice: number | null;
  comps: CompResult | null;
  compsStatus: 'idle' | 'loading' | 'loaded' | 'failed';

  marketplace: 'ebay' | 'reverb' | 'etsy';

  shippingMethod: ShippingMethod;
  shippingCost: number | null;
  packageSize: PackageSize;
  weight: number | null;

  draftId: string | null;
  publishStatus: 'idle' | 'publishing' | 'published' | 'failed';
  listingId: string | null;
  inventoryItemId: string | null;
}

export interface ListingDraft {
  id: string;
  userId: string;
  itemId: string | null;
  marketplace: 'ebay' | 'reverb' | 'etsy';
  title: string | null;
  price: number | null;
  status: string;
  lastStepCompleted: string | null;
  flowState: ListingFlowState;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  listingInterface: ListingInterface;
  listingForkPref: ListingForkPref;
  listingForkCount: number;
  listingCompactMode: boolean;
}
```

- [ ] **Step 4: Rebuild shared package and push schema**

```bash
npm run build -w packages/shared
npm run db:push
```

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```

Expected: Clean pass. If the marketplace enum change causes type errors in `listings.ts` or `ebay-adapter.ts`, update the `getAdapter()` function signature to accept `'ebay' | 'etsy' | 'reverb'` and add a `case 'reverb'` that throws `new AppError(501, 'NOT_IMPLEMENTED', 'Reverb adapter not yet available')`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/db/schema.ts packages/shared/src/types.ts packages/shared/src/index.ts
git commit -m "feat(schema): add listing_drafts table, user prefs columns, reverb marketplace, and listing flow types"
```

---

### Task 2: Drafts API Route

**Files:**
- Create: `apps/api/src/routes/drafts.ts`

- [ ] **Step 1: Create drafts route**

```typescript
import { Router } from 'express';
import { z } from 'zod';
import { eq, and, desc, lt } from 'drizzle-orm';
import { pino } from 'pino';
import { db } from '../db/index.js';
import { listingDrafts } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';

const logger = pino({ name: 'drafts' });

const upsertDraftSchema = z.object({
  id: z.string().uuid().optional(),
  itemId: z.string().uuid().nullable().optional(),
  marketplace: z.enum(['ebay', 'etsy', 'reverb']),
  title: z.string().max(500).nullable().optional(),
  price: z.number().positive().nullable().optional(),
  lastStepCompleted: z.string().max(50).nullable().optional(),
  flowState: z.record(z.unknown()),
});

export const draftsRouter = Router();

draftsRouter.use(requireAuth);

draftsRouter.get('/', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const results = await db.select()
      .from(listingDrafts)
      .where(eq(listingDrafts.userId, userId))
      .orderBy(desc(listingDrafts.updatedAt));

    res.json({ drafts: results });
  } catch (err) {
    next(err);
  }
});

draftsRouter.get('/:id', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const [draft] = await db.select()
      .from(listingDrafts)
      .where(and(eq(listingDrafts.id, req.params.id), eq(listingDrafts.userId, userId)))
      .limit(1);

    if (!draft) throw new AppError(404, 'NOT_FOUND', 'Draft not found');
    res.json(draft);
  } catch (err) {
    next(err);
  }
});

draftsRouter.post('/', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const body = upsertDraftSchema.parse(req.body);

    if (body.id) {
      const [existing] = await db.select({ id: listingDrafts.id })
        .from(listingDrafts)
        .where(and(eq(listingDrafts.id, body.id), eq(listingDrafts.userId, userId)))
        .limit(1);

      if (existing) {
        const [updated] = await db.update(listingDrafts)
          .set({
            marketplace: body.marketplace,
            title: body.title ?? null,
            price: body.price ?? null,
            lastStepCompleted: body.lastStepCompleted ?? null,
            flowState: body.flowState,
            updatedAt: new Date(),
          })
          .where(eq(listingDrafts.id, body.id))
          .returning();

        logger.debug({ userId, draftId: updated.id }, 'Draft updated');
        res.json(updated);
        return;
      }
    }

    if (body.itemId) {
      const [existing] = await db.select({ id: listingDrafts.id })
        .from(listingDrafts)
        .where(and(
          eq(listingDrafts.userId, userId),
          eq(listingDrafts.itemId, body.itemId),
          eq(listingDrafts.marketplace, body.marketplace),
        ))
        .limit(1);

      if (existing) {
        const [updated] = await db.update(listingDrafts)
          .set({
            title: body.title ?? null,
            price: body.price ?? null,
            lastStepCompleted: body.lastStepCompleted ?? null,
            flowState: body.flowState,
            updatedAt: new Date(),
          })
          .where(eq(listingDrafts.id, existing.id))
          .returning();

        logger.debug({ userId, draftId: updated.id }, 'Draft upserted by itemId');
        res.json(updated);
        return;
      }
    }

    const [draft] = await db.insert(listingDrafts).values({
      userId,
      itemId: body.itemId ?? null,
      marketplace: body.marketplace,
      title: body.title ?? null,
      price: body.price ?? null,
      lastStepCompleted: body.lastStepCompleted ?? null,
      flowState: body.flowState,
    }).returning();

    logger.info({ userId, draftId: draft.id }, 'Draft created');
    res.status(201).json(draft);
  } catch (err) {
    next(err);
  }
});

draftsRouter.delete('/:id', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const [existing] = await db.select({ id: listingDrafts.id })
      .from(listingDrafts)
      .where(and(eq(listingDrafts.id, req.params.id), eq(listingDrafts.userId, userId)))
      .limit(1);

    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Draft not found');

    await db.delete(listingDrafts).where(eq(listingDrafts.id, req.params.id));
    logger.info({ userId, draftId: req.params.id }, 'Draft deleted');
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

draftsRouter.delete('/', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = await db.delete(listingDrafts)
      .where(and(eq(listingDrafts.userId, userId), lt(listingDrafts.updatedAt, thirtyDaysAgo)));

    logger.info({ userId }, 'Stale drafts cleaned');
    res.json({ cleaned: true });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/drafts.ts
git commit -m "feat(api): add drafts CRUD route with upsert and stale cleanup"
```

---

### Task 3: Preferences API Route

**Files:**
- Create: `apps/api/src/routes/preferences.ts`

- [ ] **Step 1: Create preferences route**

```typescript
import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';

const updatePrefsSchema = z.object({
  listingInterface: z.enum(['conversational', 'swipe', 'hybrid']).optional(),
  listingForkPref: z.enum(['ask', 'list', 'inventory']).optional(),
  listingCompactMode: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field required' });

export const preferencesRouter = Router();

preferencesRouter.use(requireAuth);

preferencesRouter.get('/', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const [user] = await db.select({
      listingInterface: users.listingInterface,
      listingForkPref: users.listingForkPref,
      listingForkCount: users.listingForkCount,
      listingCompactMode: users.listingCompactMode,
    }).from(users).where(eq(users.id, userId)).limit(1);

    res.json(user);
  } catch (err) {
    next(err);
  }
});

preferencesRouter.patch('/', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const body = updatePrefsSchema.parse(req.body);

    const updates: Record<string, unknown> = {};
    if (body.listingInterface !== undefined) updates.listingInterface = body.listingInterface;
    if (body.listingForkPref !== undefined) updates.listingForkPref = body.listingForkPref;
    if (body.listingCompactMode !== undefined) updates.listingCompactMode = body.listingCompactMode;

    const [updated] = await db.update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning({
        listingInterface: users.listingInterface,
        listingForkPref: users.listingForkPref,
        listingForkCount: users.listingForkCount,
        listingCompactMode: users.listingCompactMode,
      });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/routes/preferences.ts
git commit -m "feat(api): add user preferences GET/PATCH route"
```

---

### Task 4: Enhanced Scan Endpoint

**Files:**
- Modify: `apps/api/src/lib/vision.ts`
- Modify: `apps/api/src/routes/scan.ts`

- [ ] **Step 1: Add identifyItemDetailed to vision.ts**

Add a new system prompt and function after the existing `identifyItem()`:

```typescript
const DETAILED_SYSTEM_PROMPT = `You are Porter, an AI assistant for Portage — an inventory and marketplace seller app.
Your job is to identify items from photos and provide multiple possible matches with reasoning.

Analyze the image and return a JSON object with:
- candidates: array of 1-3 possible matches, each with:
  - name, description, category, condition, conditionNotes
  - brand (string|null), model (string|null), features (string[])
  - estimatedValueLow (int), estimatedValueHigh (int)
  - confidence (float 0-1, your confidence this is the correct identification)
- reasoning: array of 3-5 strings explaining what visual features led to the identification
  (e.g. "Pointed pocket flaps indicate Type III", "Tab logo suggests pre-1971")

Order candidates by confidence (highest first). Respond with ONLY valid JSON.`;

export interface DetailedVisionResult {
  candidates: Array<VisionResult & { confidence: number }>;
  reasoning: string[];
}

export async function identifyItemDetailed(imageBase64: string, mediaType: string): Promise<DetailedVisionResult> {
  const { text } = await analyzeImage(
    imageBase64,
    mediaType,
    DETAILED_SYSTEM_PROMPT,
    'Identify this item with multiple candidates and reasoning.',
  );

  const json = JSON.parse(extractJSON(text));

  if (!json.candidates || !Array.isArray(json.candidates) || json.candidates.length === 0) {
    const flat = json as VisionResult;
    return {
      candidates: [{ ...flat, confidence: 0.8 }],
      reasoning: json.reasoning ?? ['Identified by visual analysis'],
    };
  }

  return {
    candidates: json.candidates,
    reasoning: json.reasoning ?? [],
  };
}
```

- [ ] **Step 2: Add detail=full support to scan route**

In `apps/api/src/routes/scan.ts`, import the new function and modify the POST handler. After the existing `identifyItem` call, add a branch:

```typescript
import { identifyItem, identifyItemDetailed } from '../lib/vision.js';
```

In the POST handler, replace the identification call with:

```typescript
    const detail = req.query.detail as string | undefined;

    let identification;
    let detailedResult;

    if (detail === 'full') {
      detailedResult = await identifyItemDetailed(imageBase64, 'image/webp');
      identification = detailedResult.candidates[0];
    } else {
      identification = await identifyItem(imageBase64, 'image/webp');
    }
```

And in the response, add the detailed result when available:

```typescript
    res.status(201).json({
      identification,
      ...(detailedResult && { detailed: detailedResult }),
      image: mainImage ? { ... } : null,
      thumbnail: thumbnailResult ? { ... } : null,
    });
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/lib/vision.ts apps/api/src/routes/scan.ts
git commit -m "feat(scan): add detail=full mode for multi-candidate recognition with reasoning"
```

---

### Task 5: Mount New Routes

**Files:**
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/src/routes/listings.ts`

- [ ] **Step 1: Mount drafts and preferences routers**

In `apps/api/src/index.ts`, add imports:

```typescript
import { draftsRouter } from './routes/drafts.js';
import { preferencesRouter } from './routes/preferences.js';
```

Add routes (after the survey router):

```typescript
app.use('/drafts', draftsRouter);
app.use('/users/me/preferences', preferencesRouter);
```

- [ ] **Step 2: Add reverb to listings route adapter factory**

In `apps/api/src/routes/listings.ts`, update the `getAdapter` function:

```typescript
function getAdapter(userId: string, marketplace: 'ebay' | 'etsy' | 'reverb'): MarketplaceAdapter {
  switch (marketplace) {
    case 'ebay': return new EbayAdapter(userId);
    case 'etsy': return new EtsyAdapter(userId);
    case 'reverb': throw new AppError(501, 'NOT_IMPLEMENTED', 'Reverb adapter is not yet available');
  }
}
```

Update the `createListingSchema` marketplace enum:

```typescript
marketplace: z.enum(['ebay', 'etsy', 'reverb']),
```

- [ ] **Step 3: Restart API and verify**

```bash
npm run typecheck
# Restart the API server and test:
curl -s https://portage-api.digitalharmonyai.com/health | jq .
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/index.ts apps/api/src/routes/listings.ts
git commit -m "feat(api): mount drafts and preferences routes, add reverb to adapter factory"
```

---

## Phase 2: Frontend Hooks

### Task 6: useUserPreferences Hook

**Files:**
- Create: `apps/web/src/hooks/use-user-preferences.ts`

- [ ] **Step 1: Create the hook**

```typescript
"use client";

import { useState, useCallback, useEffect } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "./use-auth";
import type { UserPreferences, ListingInterface, ListingForkPref } from "@portage/shared";

const DEFAULT_PREFS: UserPreferences = {
  listingInterface: 'hybrid',
  listingForkPref: 'ask',
  listingForkCount: 0,
  listingCompactMode: false,
};

export function useUserPreferences() {
  const { token } = useAuth();
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    api<UserPreferences>('/users/me/preferences', { token })
      .then(setPrefs)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [token]);

  const updatePrefs = useCallback(async (updates: Partial<Pick<UserPreferences, 'listingInterface' | 'listingForkPref' | 'listingCompactMode'>>) => {
    if (!token) return;
    try {
      const updated = await api<UserPreferences>('/users/me/preferences', {
        method: 'PATCH',
        body: updates,
        token,
      });
      setPrefs(updated);
    } catch (err) {
      console.error('Failed to update preferences:', err instanceof ApiError ? err.message : err);
    }
  }, [token]);

  return {
    preference: prefs.listingInterface,
    forkPref: prefs.listingForkPref,
    forkCount: prefs.listingForkCount,
    compactMode: prefs.listingCompactMode,
    isLoading,
    updatePrefs,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/use-user-preferences.ts
git commit -m "feat(web): add useUserPreferences hook for listing interface selection"
```

---

### Task 7: useDrafts Hook

**Files:**
- Create: `apps/web/src/hooks/use-drafts.ts`

- [ ] **Step 1: Create the hook**

```typescript
"use client";

import { useState, useCallback, useRef } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "./use-auth";
import type { ListingDraft, ListingFlowState } from "@portage/shared";

export function useDrafts() {
  const { token } = useAuth();
  const [drafts, setDrafts] = useState<ListingDraft[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);

  const fetchDrafts = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const data = await api<{ drafts: ListingDraft[] }>('/drafts', { token });
      setDrafts(data.drafts);
    } catch { /* offline */ }
    setIsLoading(false);
  }, [token]);

  const getDraft = useCallback(async (draftId: string): Promise<ListingDraft | null> => {
    if (!token) return null;
    try {
      return await api<ListingDraft>(`/drafts/${draftId}`, { token });
    } catch {
      return null;
    }
  }, [token]);

  const saveDraft = useCallback(async (
    state: ListingFlowState,
    meta: {
      draftId?: string;
      itemId?: string | null;
      marketplace: 'ebay' | 'reverb' | 'etsy';
      lastStepCompleted?: string;
    }
  ): Promise<ListingDraft | null> => {
    if (!token) return null;
    try {
      const draft = await api<ListingDraft>('/drafts', {
        method: 'POST',
        body: {
          id: meta.draftId,
          itemId: meta.itemId ?? null,
          marketplace: meta.marketplace,
          title: state.title || null,
          price: state.price,
          lastStepCompleted: meta.lastStepCompleted,
          flowState: state,
        },
        token,
      });
      retryCountRef.current = 0;
      return draft;
    } catch {
      retryCountRef.current++;
      if (retryCountRef.current < 3) {
        const delay = Math.pow(2, retryCountRef.current) * 1000;
        return new Promise((resolve) => {
          setTimeout(async () => {
            resolve(await saveDraft(state, meta));
          }, delay);
        });
      }
      return null;
    }
  }, [token]);

  const debouncedSave = useCallback((
    state: ListingFlowState,
    meta: Parameters<typeof saveDraft>[1]
  ) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveDraft(state, meta), 2000);
  }, [saveDraft]);

  const deleteDraft = useCallback(async (draftId: string) => {
    if (!token) return;
    try {
      await api(`/drafts/${draftId}`, { method: 'DELETE', token });
      setDrafts(prev => prev.filter(d => d.id !== draftId));
    } catch { /* ignore */ }
  }, [token]);

  return { drafts, isLoading, fetchDrafts, getDraft, saveDraft, debouncedSave, deleteDraft };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/use-drafts.ts
git commit -m "feat(web): add useDrafts hook with debounced auto-save and retry"
```

---

### Task 8: useListingFlow Hook

**Files:**
- Create: `apps/web/src/hooks/use-listing-flow.ts`

This is the core hook. It owns all listing flow state and exposes methods that the three interfaces call.

- [ ] **Step 1: Create the hook**

```typescript
"use client";

import { useState, useCallback, useRef } from "react";
import { api, ApiError, API_BASE } from "@/lib/api";
import { useAuth } from "./use-auth";
import { useDrafts } from "./use-drafts";
import type {
  ListingFlowState,
  CompResult,
  RecognitionResult,
  PricingStrategy,
} from "@portage/shared";

const INITIAL_STATE: ListingFlowState = {
  photos: [],
  primaryPhotoIndex: 0,
  recognition: {
    status: 'idle',
    candidates: [],
    selectedIndex: 0,
    reasoning: [],
    confidence: 0,
  },
  title: '',
  description: '',
  category: '',
  categoryPath: [],
  condition: 'good',
  brand: '',
  model: '',
  features: [],
  price: null,
  pricingStrategy: 'market',
  acceptOffers: true,
  minimumOfferPrice: null,
  comps: null,
  compsStatus: 'idle',
  marketplace: 'ebay',
  shippingMethod: 'calculated',
  shippingCost: null,
  packageSize: 'medium',
  weight: null,
  draftId: null,
  publishStatus: 'idle',
  listingId: null,
  inventoryItemId: null,
};

export function useListingFlow() {
  const { token } = useAuth();
  const { debouncedSave, saveDraft, deleteDraft, getDraft } = useDrafts();
  const [state, setState] = useState<ListingFlowState>(INITIAL_STATE);
  const [lastStep, setLastStep] = useState<string>('idle');
  const [saveWarning, setSaveWarning] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const triggerAutoSave = useCallback((newState: ListingFlowState, step?: string) => {
    const s = step ?? lastStep;
    const draft = debouncedSave(newState, {
      draftId: newState.draftId ?? undefined,
      itemId: newState.inventoryItemId,
      marketplace: newState.marketplace,
      lastStepCompleted: s,
    });
    if (draft === null) setSaveWarning(true);
  }, [debouncedSave, lastStep]);

  const setField = useCallback(<K extends keyof ListingFlowState>(key: K, value: ListingFlowState[K]) => {
    setState(prev => {
      const next = { ...prev, [key]: value };
      triggerAutoSave(next);
      return next;
    });
  }, [triggerAutoSave]);

  const startFromPhoto = useCallback(async (photos: ListingFlowState['photos']) => {
    if (!token) return;
    const newState: ListingFlowState = {
      ...INITIAL_STATE,
      photos,
      recognition: { ...INITIAL_STATE.recognition, status: 'recognizing' },
    };
    setState(newState);
    setLastStep('recognizing');

    try {
      const formData = new FormData();
      const photoUrl = photos[0]?.url;
      if (photoUrl) {
        const response = await fetch(photoUrl);
        const blob = await response.blob();
        formData.append('image', blob, 'photo.webp');
      }

      const result = await fetch(`${API_BASE}/scan?detail=full`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!result.ok) throw new Error('Scan failed');
      const data = await result.json();

      const detailed = data.detailed as RecognitionResult | undefined;
      const candidates = detailed?.candidates ?? [{
        ...data.identification,
        confidence: 0.8,
      }];
      const reasoning = detailed?.reasoning ?? [];

      setState(prev => ({
        ...prev,
        recognition: {
          status: 'complete',
          candidates,
          selectedIndex: 0,
          reasoning,
          confidence: candidates[0]?.confidence ?? 0,
        },
        photos: data.image ? [{
          url: data.image.url,
          key: data.image.key,
          width: data.image.width,
          height: data.image.height,
          isPrimary: true,
        }] : prev.photos,
      }));
      setLastStep('recognition');
    } catch {
      setState(prev => ({
        ...prev,
        recognition: { ...prev.recognition, status: 'failed' },
      }));
      setLastStep('recognition-failed');
    }
  }, [token]);

  const startFromItem = useCallback(async (itemId: string) => {
    if (!token) return;
    try {
      const item = await api<{
        id: string; title: string; description: string; category: string;
        condition: string; brand: string; model: string; features: string[];
        photos: ListingFlowState['photos'];
        estimatedValueRecommended: number | null;
      }>(`/items/${itemId}`, { token });

      setState({
        ...INITIAL_STATE,
        inventoryItemId: item.id,
        title: item.title,
        description: item.description,
        category: item.category,
        condition: item.condition,
        brand: item.brand ?? '',
        model: item.model ?? '',
        features: (item.features ?? []) as string[],
        photos: item.photos ?? [],
        price: item.estimatedValueRecommended ?? null,
        recognition: {
          status: 'complete',
          candidates: [],
          selectedIndex: 0,
          reasoning: [],
          confidence: 1,
        },
      });
      setLastStep('details');
    } catch {
      setState(INITIAL_STATE);
    }
  }, [token]);

  const resumeDraft = useCallback(async (draftId: string) => {
    const draft = await getDraft(draftId);
    if (!draft) return;
    setState({ ...INITIAL_STATE, ...draft.flowState, draftId: draft.id });
    setLastStep(draft.lastStepCompleted ?? 'idle');
  }, [getDraft]);

  const confirmRecognition = useCallback((index: number) => {
    setState(prev => {
      const candidate = prev.recognition.candidates[index];
      if (!candidate) return prev;

      const next: ListingFlowState = {
        ...prev,
        recognition: { ...prev.recognition, selectedIndex: index },
        title: candidate.name,
        description: candidate.description,
        category: candidate.category,
        condition: candidate.condition,
        brand: candidate.brand ?? '',
        model: candidate.model ?? '',
        features: candidate.features ?? [],
      };
      triggerAutoSave(next, 'confirmed');
      return next;
    });
    setLastStep('confirmed');
  }, [triggerAutoSave]);

  const fetchComps = useCallback(async () => {
    if (!token || !stateRef.current.inventoryItemId) {
      setState(prev => ({ ...prev, compsStatus: 'failed' }));
      return;
    }
    setState(prev => ({ ...prev, compsStatus: 'loading' }));
    try {
      const comps = await api<CompResult>(
        `/items/${stateRef.current.inventoryItemId}/comps`,
        { token }
      );
      setState(prev => ({ ...prev, comps, compsStatus: 'loaded' }));
    } catch {
      setState(prev => ({ ...prev, compsStatus: 'failed' }));
    }
  }, [token]);

  const applyPricingStrategy = useCallback((strategy: PricingStrategy) => {
    setState(prev => {
      if (!prev.comps?.stats.soldMedian) {
        return { ...prev, pricingStrategy: strategy };
      }
      const median = prev.comps.stats.soldMedian;
      let price: number;
      switch (strategy) {
        case 'fast': price = Math.round(median * 0.85); break;
        case 'max': price = Math.round(median * 1.2); break;
        case 'market':
        default: price = Math.round(median); break;
      }
      const next = { ...prev, price, pricingStrategy: strategy };
      triggerAutoSave(next, 'pricing');
      return next;
    });
    setLastStep('pricing');
  }, [triggerAutoSave]);

  const addPhotos = useCallback((photos: ListingFlowState['photos']) => {
    setState(prev => {
      const next = { ...prev, photos: [...prev.photos, ...photos] };
      triggerAutoSave(next);
      return next;
    });
  }, [triggerAutoSave]);

  const publish = useCallback(async (): Promise<{ success: boolean; listingId?: string; error?: string }> => {
    if (!token) return { success: false, error: 'Not authenticated' };

    const s = stateRef.current;
    if (!s.title) return { success: false, error: 'Title is required' };
    if (!s.price) return { success: false, error: 'Price is required' };
    if (s.photos.length === 0) return { success: false, error: 'At least one photo is required' };

    setState(prev => ({ ...prev, publishStatus: 'publishing' }));

    try {
      let itemId = s.inventoryItemId;

      if (!itemId) {
        const item = await api<{ id: string }>('/items', {
          method: 'POST',
          body: {
            title: s.title,
            description: s.description,
            category: s.category,
            condition: s.condition,
            brand: s.brand,
            model: s.model,
            features: s.features,
            photos: s.photos,
            estimatedValueRecommended: s.price,
            aiConfidenceScore: s.recognition.confidence,
          },
          token,
        });
        itemId = item.id;
      }

      const listing = await api<{ id: string; status: string }>('/listings', {
        method: 'POST',
        body: {
          itemId,
          marketplace: s.marketplace,
          price: s.price,
          publishImmediately: true,
          marketplaceSpecificFields: s.marketplace === 'reverb' ? {
            make: s.brand,
            model: s.model,
            acceptOffers: s.acceptOffers,
            ...(s.minimumOfferPrice && { minimumOfferPrice: s.minimumOfferPrice }),
          } : undefined,
        },
        token,
      });

      if (s.draftId) {
        await deleteDraft(s.draftId);
      }

      setState(prev => ({
        ...prev,
        publishStatus: 'published',
        listingId: listing.id,
        inventoryItemId: itemId,
      }));
      setLastStep('published');

      return { success: true, listingId: listing.id };
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Publishing failed';
      await saveDraft(stateRef.current, {
        draftId: s.draftId ?? undefined,
        itemId: s.inventoryItemId,
        marketplace: s.marketplace,
        lastStepCompleted: 'publish-failed',
      });
      setState(prev => ({ ...prev, publishStatus: 'failed' }));
      return { success: false, error: msg };
    }
  }, [token, deleteDraft, saveDraft]);

  const cancel = useCallback(async () => {
    await saveDraft(stateRef.current, {
      draftId: stateRef.current.draftId ?? undefined,
      itemId: stateRef.current.inventoryItemId,
      marketplace: stateRef.current.marketplace,
      lastStepCompleted: lastStep,
    });
  }, [saveDraft, lastStep]);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
    setLastStep('idle');
    setSaveWarning(false);
  }, []);

  return {
    state,
    lastStep,
    saveWarning,
    setField,
    startFromPhoto,
    startFromItem,
    resumeDraft,
    confirmRecognition,
    fetchComps,
    applyPricingStrategy,
    addPhotos,
    publish,
    cancel,
    reset,
  };
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/use-listing-flow.ts
git commit -m "feat(web): add useListingFlow hook — shared listing flow state and business logic"
```

---

## Phase 3: Shared UI Components

### Task 9: Recognition Fork Component

**Files:**
- Create: `apps/web/src/components/listing-flow/recognition-fork.tsx`

- [ ] **Step 1: Create the component**

This is the "List for Sale" / "Save to Inventory" binary choice after AI recognition. It handles the smart-default logic (skip fork after 5+ consecutive listing choices).

```typescript
"use client";

import { useUserPreferences } from "@/hooks/use-user-preferences";

interface RecognitionForkProps {
  onListForSale: () => void;
  onSaveToInventory: () => void;
}

export function RecognitionFork({ onListForSale, onSaveToInventory }: RecognitionForkProps) {
  const { forkPref, forkCount, updatePrefs } = useUserPreferences();

  if (forkPref === 'list' || forkCount >= 5) {
    onListForSale();
    return null;
  }
  if (forkPref === 'inventory') {
    onSaveToInventory();
    return null;
  }

  const handleList = () => {
    updatePrefs({});
    onListForSale();
  };

  return (
    <div className="flex flex-col items-center gap-4 px-6 py-8">
      <h2 className="text-xl font-semibold font-[family-name:var(--font-instrument)]" style={{ color: 'var(--flow-text)' }}>
        What would you like to do?
      </h2>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={handleList}
          className="w-full py-3.5 rounded-xl font-semibold text-white text-[15px] transition-all active:scale-[0.97]"
          style={{ background: 'var(--flow-accent)' }}
        >
          List for Sale
        </button>
        <button
          onClick={onSaveToInventory}
          className="w-full py-3.5 rounded-xl font-semibold text-[15px] border transition-all active:scale-[0.97]"
          style={{ color: 'var(--flow-text)', borderColor: 'var(--flow-accent)', opacity: 0.7 }}
        >
          Save to Inventory
        </button>
      </div>
      <p className="text-xs mt-2" style={{ color: 'var(--flow-text)', opacity: 0.4 }}>
        You can always list items later from your inventory
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/listing-flow/recognition-fork.tsx
git commit -m "feat(web): add RecognitionFork component with smart-default behavior"
```

---

### Task 10: Fee Estimate & Publish Success Components

**Files:**
- Create: `apps/web/src/components/listing-flow/fee-estimate.tsx`
- Create: `apps/web/src/components/listing-flow/publish-success.tsx`

- [ ] **Step 1: Create fee-estimate.tsx**

```typescript
"use client";

interface FeeEstimateProps {
  price: number;
  marketplace: 'ebay' | 'reverb' | 'etsy';
}

const FEE_RATES: Record<string, { rate: number; label: string }> = {
  ebay: { rate: 0.1325, label: 'eBay fees (13.25%)' },
  reverb: { rate: 0.08, label: 'Reverb fees (8%)' },
  etsy: { rate: 0.065, label: 'Etsy fees (6.5%)' },
};

export function FeeEstimate({ price, marketplace }: FeeEstimateProps) {
  const { rate, label } = FEE_RATES[marketplace] ?? FEE_RATES.ebay;
  const fees = Math.round(price * rate * 100) / 100;
  const net = Math.round((price - fees) * 100) / 100;

  return (
    <div className="space-y-1.5 text-[13px]" style={{ color: 'var(--flow-text)' }}>
      <div className="flex justify-between opacity-60">
        <span>Sale price</span>
        <span>${price.toFixed(2)}</span>
      </div>
      <div className="flex justify-between opacity-60">
        <span>{label}</span>
        <span>-${fees.toFixed(2)}</span>
      </div>
      <div className="h-px w-full" style={{ background: 'var(--flow-text)', opacity: 0.1 }} />
      <div className="flex justify-between font-semibold">
        <span>You earn</span>
        <span>${net.toFixed(2)}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create publish-success.tsx**

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface PublishSuccessProps {
  listingId: string;
  marketplace: 'ebay' | 'reverb' | 'etsy';
  title: string;
  price: number;
  photoUrl: string | null;
  isFirstListing: boolean;
  onListAnother: () => void;
}

export function PublishSuccess({
  listingId, marketplace, title, price, photoUrl,
  isFirstListing, onListAnother,
}: PublishSuccessProps) {
  const router = useRouter();
  const [showDiscovery, setShowDiscovery] = useState(isFirstListing);

  const marketplaceLabel = { ebay: 'eBay', reverb: 'Reverb', etsy: 'Etsy' }[marketplace];

  return (
    <div className="flex flex-col items-center px-6 py-10 text-center" style={{ color: 'var(--flow-text)' }}>
      <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'var(--flow-accent)', opacity: 0.15 }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--flow-accent)" strokeWidth="2.5">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold font-[family-name:var(--font-instrument)] mb-1">Listed!</h2>
      <p className="text-sm opacity-60 mb-6">Published on {marketplaceLabel}</p>

      <div className="w-full max-w-xs rounded-xl p-4 mb-6" style={{ background: 'var(--flow-text)', opacity: 0.05 }}>
        {photoUrl && (
          <div className="w-full h-32 rounded-lg mb-3 overflow-hidden bg-black/5">
            <img src={photoUrl} alt={title} className="w-full h-full object-cover" />
          </div>
        )}
        <p className="font-semibold text-[15px] mb-1">{title}</p>
        <p className="text-lg font-bold" style={{ color: 'var(--flow-accent)' }}>${price.toFixed(2)}</p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={() => router.push(`/listings/${listingId}`)}
          className="w-full py-3 rounded-xl font-semibold text-white text-[15px]"
          style={{ background: 'var(--flow-accent)' }}
        >
          View Listing
        </button>
        <button
          onClick={onListAnother}
          className="w-full py-3 rounded-xl font-semibold text-[15px] border"
          style={{ color: 'var(--flow-accent)', borderColor: 'var(--flow-accent)' }}
        >
          List Another
        </button>
      </div>

      {showDiscovery && (
        <div className="mt-6 p-4 rounded-xl text-left w-full max-w-xs" style={{ background: 'var(--flow-text)', opacity: 0.05 }}>
          <p className="text-[13px] font-medium mb-1">Try a different listing style?</p>
          <p className="text-[12px] opacity-60 mb-2">
            You used Hybrid mode. There are two other listing styles — check them out in Settings.
          </p>
          <button
            onClick={() => router.push('/settings')}
            className="text-[12px] font-semibold"
            style={{ color: 'var(--flow-accent)' }}
          >
            Go to Settings →
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/listing-flow/fee-estimate.tsx apps/web/src/components/listing-flow/publish-success.tsx
git commit -m "feat(web): add FeeEstimate and PublishSuccess shared components"
```

---

## Phase 4: Interface Implementations

### Task 11: Hybrid Flow (Default Interface)

**Files:**
- Create: `apps/web/src/components/listing-flow/hybrid-flow.tsx`

This is the largest single file — Interface C with chat + inline cards + compact form toggle. Build this first since it's the default.

- [ ] **Step 1: Create hybrid-flow.tsx**

The hybrid flow renders Porter chat messages with inline editable data cards. Key structure:

```typescript
"use client";

import { useState, useEffect, useRef } from "react";
import { useListingFlow } from "@/hooks/use-listing-flow";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { FeeEstimate } from "./fee-estimate";
import { PublishSuccess } from "./publish-success";

interface HybridFlowProps {
  itemId?: string;
}

export function HybridFlow({ itemId }: HybridFlowProps) {
  const flow = useListingFlow();
  const { compactMode, updatePrefs } = useUserPreferences();
  const [isCompact, setIsCompact] = useState(compactMode);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ... implementation
}
```

The component should implement:

1. **Chat mode (default):** Scrollable message list. Porter messages appear as left-aligned bubbles with the "P" avatar. Inline cards render for: recognition result (title + reasoning + confirm/reject), comps (expandable table), pricing (price input + fast/market/max pills), details (editable title/description), shipping (package/weight/method), review (full summary + fee estimate + publish button). Context-aware action pills at the bottom change based on flow state.

2. **Compact mode:** All editable fields on one screen — title input, description textarea, price input with strategy pills, category display, condition, marketplace pill, shipping config, photo strip with add button, fee estimate, publish button. No chat, no Porter. Dense form layout.

3. **Toggle:** Small icon button in the top-right corner switches between modes. Persist preference via `updatePrefs({ listingCompactMode })`.

4. **Loading states:** Inline skeleton cards that progressively fill with data. Title first, then category, then price — each with a subtle slide-in animation.

5. **Visual personality:** Warm neutral theme (`#F5F3EF` bg, `#18191C` text, `#0047AB` cobalt accent). Instrument Sans headlines. Dense, capable, Linear/Notion energy.

**Reference:** The existing mockup at `apps/web/src/app/mockups/hybrid/page.tsx` has the interaction patterns — port the UX but connect to real `useListingFlow` hook instead of fake state.

If `itemId` is provided (from query param), call `flow.startFromItem(itemId)` on mount instead of showing the camera.

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/listing-flow/hybrid-flow.tsx
git commit -m "feat(web): add HybridFlow — Interface C with chat + inline cards + compact form toggle"
```

---

### Task 12: Conversational Flow

**Files:**
- Create: `apps/web/src/components/listing-flow/conversational-flow.tsx`

- [ ] **Step 1: Create conversational-flow.tsx**

Interface A — Porter-first conversational commerce. Key structure:

```typescript
"use client";

import { useState, useEffect, useRef } from "react";
import { useListingFlow } from "@/hooks/use-listing-flow";
import { FeeEstimate } from "./fee-estimate";
import { PublishSuccess } from "./publish-success";

interface ConversationalFlowProps {
  itemId?: string;
}

export function ConversationalFlow({ itemId }: ConversationalFlowProps) {
  const flow = useListingFlow();
  const scrollRef = useRef<HTMLDivElement>(null);

  // ... implementation
}
```

The component should implement:

1. **Message list:** Every flow step renders as one or more chat messages. Porter messages (left) use cream bubbles with Forest Green "Porter" label. User responses (right) use Forest Green bubbles. Messages auto-scroll to bottom.

2. **Pill quick-actions:** Each Porter message can include pills below the text. Pills trigger state changes via the hook. Examples: "Looks right" / "Not quite" for recognition, "$79 Sell fast" / "$110 Market" / "$139 Max" for pricing.

3. **Steps as messages:**
   - Recognition: Porter shows AI result with confidence + reasoning, Confirm/Reject pills
   - Comps: "Similar items sold for $X-$Y on eBay" in a message (one-line)
   - Pricing: Three strategy pills
   - Details: "Want to edit anything?" with Edit title / Edit description pills. Tapping opens inline input.
   - Shipping: Package size + method pills
   - Review: Summary message with all details + marketplace pill + Publish button
   - Marketplace: Small pill in the review message

4. **Loading:** Porter typing indicator (three bouncing dots) with status messages that change over time.

5. **Visual personality:** Light cream theme (`#FAF8F5` bg, `#1A1A1A` text, `#2D5A27` Forest Green accent). DM Serif Display headlines. Warm, personal, iMessage energy.

**Reference:** Port from `apps/web/src/app/mockups/conversational/page.tsx` but connect to real hook.

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/listing-flow/conversational-flow.tsx
git commit -m "feat(web): add ConversationalFlow — Interface A with Porter chat and pill actions"
```

---

### Task 13: Swipe Flow

**Files:**
- Create: `apps/web/src/components/listing-flow/swipe-flow.tsx`

- [ ] **Step 1: Create swipe-flow.tsx**

Interface B — speed-first card-based listing. Key structure:

```typescript
"use client";

import { useState, useEffect } from "react";
import { useListingFlow } from "@/hooks/use-listing-flow";
import { FeeEstimate } from "./fee-estimate";
import { PublishSuccess } from "./publish-success";

interface SwipeFlowProps {
  itemId?: string;
}

export function SwipeFlow({ itemId }: SwipeFlowProps) {
  const flow = useListingFlow();
  const [phase, setPhase] = useState<'recognition' | 'configure' | 'details' | 'shipping' | 'review' | 'publishing' | 'success'>('recognition');

  // ... implementation
}
```

The component should implement:

1. **Phase-based full-screen cards:** Each phase fills the viewport. Transition between phases with horizontal slide animation.

2. **Recognition phase:** Full-screen photo with scan animation overlay (pulsing rings, scan line), item name overlaid in bold uppercase Syne font, confidence percentage.

3. **Configure phase:** Photo at top, price slider with comp dots overlaid. Fast/market/max as tap zones on the slider. Drag or tap to set price.

4. **Details phase:** Photo background with title input overlaid (bold, large), description textarea below. Edit inline, AI badges showing fields were AI-generated.

5. **Shipping phase:** Package size pills (small/medium/large) + weight input on a dark card.

6. **Review phase:** Summary card with horizontal photo strip, all field values, fee breakdown, big orange PUBLISH button. Marketplace badge (tap to cycle).

7. **Loading:** Full-screen pulse/scan animation. Bold percentage counter: "12%... 47%... 94%... MATCH"

8. **Visual personality:** Dark black theme (`#0A0A0A` bg, `#FFFFFF` text, `#F15A22` orange accent). Syne ultra-bold headlines. Kinetic, urgent, StockX energy.

**Reference:** Port from `apps/web/src/app/mockups/swipe-to-sell/page.tsx` but connect to real hook.

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/listing-flow/swipe-flow.tsx
git commit -m "feat(web): add SwipeFlow — Interface B with full-screen cards and speed-first UX"
```

---

## Phase 5: Pages & Integration

### Task 14: List Page (Conditional Renderer)

**Files:**
- Create: `apps/web/src/app/list/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { ConversationalFlow } from "@/components/listing-flow/conversational-flow";
import { SwipeFlow } from "@/components/listing-flow/swipe-flow";
import { HybridFlow } from "@/components/listing-flow/hybrid-flow";

function ListContent() {
  const { preference, isLoading } = useUserPreferences();
  const searchParams = useSearchParams();
  const itemId = searchParams.get('itemId') ?? undefined;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--flow-bg, #F5F3EF)' }}>
        <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin opacity-30" />
      </div>
    );
  }

  switch (preference) {
    case 'conversational':
      return <ConversationalFlow itemId={itemId} />;
    case 'swipe':
      return <SwipeFlow itemId={itemId} />;
    case 'hybrid':
    default:
      return <HybridFlow itemId={itemId} />;
  }
}

export default function ListPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#F5F3EF]">
        <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin opacity-30" />
      </div>
    }>
      <ListContent />
    </Suspense>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/list/page.tsx
git commit -m "feat(web): add /list page with conditional interface rendering"
```

---

### Task 15: Listing Detail Page

**Files:**
- Create: `apps/web/src/app/listings/[id]/page.tsx`

- [ ] **Step 1: Create the listing detail page**

Shared page regardless of which interface created the listing. Layout:

1. **Status banner** — color-coded pill (Active=green, Draft=amber, Ended=gray, Sold=blue) + marketplace badge
2. **Photo strip** — horizontal scrolling thumbnails
3. **Editable fields** — tap-to-edit: price, title, description
4. **Read-only fields** — category, condition, SKU, marketplace listing ID (external link)
5. **Actions** — Save Changes, End Listing, View on [Marketplace]
6. **Cross-list nudge** — "Also list on [other marketplace]?" card with link to `/list?itemId=X`

Uses the existing `useListings` hook for data fetching and the `api()` client for PATCH/DELETE.

Build as a mobile-first single-scroll page following the app's established patterns (see `apps/web/src/app/inventory/[id]/page.tsx` for reference styling).

- [ ] **Step 2: Verify typecheck and lint**

```bash
npm run typecheck && npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/listings/\[id\]/page.tsx
git commit -m "feat(web): add listing detail page with status sync, inline editing, and cross-list nudge"
```

---

### Task 16: Home Page Updates

**Files:**
- Modify: `apps/web/src/app/(tabs)/home/page.tsx`
- Modify: `apps/web/src/app/inventory/[id]/page.tsx`

- [ ] **Step 1: Update home page empty state and add Photo FAB**

In the home page, find the empty inventory state and change the CTA text from any existing copy to "Add Your First Item". Add a floating action button (camera icon) fixed to the bottom-right that navigates to `/list`.

```typescript
// Photo FAB — add at the end of the page component's return, before closing </div>
<button
  onClick={() => router.push('/list')}
  className="fixed bottom-24 right-6 z-50 w-14 h-14 rounded-full bg-[#2D5A27] text-white shadow-lg flex items-center justify-center hover:bg-[#234A1F] active:scale-95 transition-all"
  style={{ boxShadow: '0 4px 20px rgba(45,90,39,0.3)' }}
  aria-label="List an item"
>
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
</button>
```

- [ ] **Step 2: Add "List for Sale" button to item detail page**

In `apps/web/src/app/inventory/[id]/page.tsx`, add a "List for Sale" button in the action area that navigates to `/list?itemId=${item.id}`.

```typescript
<button
  onClick={() => router.push(`/list?itemId=${item.id}`)}
  className="w-full py-3 rounded-xl bg-[#2D5A27] text-white font-semibold text-[15px] active:scale-[0.97] transition-transform"
>
  List for Sale
</button>
```

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(tabs\)/home/page.tsx apps/web/src/app/inventory/\[id\]/page.tsx
git commit -m "feat(web): add Photo FAB on home, 'Add Your First Item' empty state, 'List for Sale' on item detail"
```

---

## Phase 6: Photo Capture Component

### Task 17: Photo Capture

**Files:**
- Create: `apps/web/src/components/listing-flow/photo-capture.tsx`

- [ ] **Step 1: Create photo-capture.tsx**

Shared camera/upload/library component. Pre-adapted to user's interface personality via CSS variables. Structure:

```typescript
"use client";

import { useState, useRef, useCallback } from "react";

interface PhotoCaptureProps {
  onPhotoCaptured: (photos: Array<{ url: string; key: string; width?: number; height?: number; isPrimary?: boolean }>) => void;
  onCancel: () => void;
}

export function PhotoCapture({ onPhotoCaptured, onCancel }: PhotoCaptureProps) {
  const [mode, setMode] = useState<'choose' | 'camera' | 'crop'>('choose');
  // ... implementation
}
```

Implement three modes:

1. **Choose mode:** Three large buttons — "Take Photo" (opens camera), "Upload" (file picker), "Choose from Library" (file picker with accept="image/*").

2. **Camera mode:** Uses `navigator.mediaDevices.getUserMedia()`. Live preview. Capture button. Switch front/back camera. Reference existing `apps/web/src/hooks/use-camera.ts` for camera API patterns.

3. **Crop mode:** After photo is taken/selected. Canvas-based crop with drag handles. Aspect ratio toggle (1:1, 4:3, Free). Apply button sends cropped image. Reference existing `apps/web/src/app/mockups/camera/page.tsx` for crop implementation.

After apply, upload the photo to R2 via the existing `/images/upload` endpoint, then call `onPhotoCaptured` with the result.

Theme-adapted: uses `var(--flow-bg)`, `var(--flow-accent)`, `var(--flow-text)` throughout.

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/listing-flow/photo-capture.tsx
git commit -m "feat(web): add PhotoCapture component with camera, upload, crop, and theme adaptation"
```

---

## Phase 7: Final Integration & Verification

### Task 18: End-to-End Verification

- [ ] **Step 1: Build and deploy**

```bash
npm run typecheck
npm run lint
npm run build -w packages/shared
npm run db:push
# Restart API
npm run build -w apps/web
```

- [ ] **Step 2: Test the happy path**

Open the app. Navigate to `/list`. The Hybrid (C) interface should load by default. Test:

1. Photo capture (upload a test image)
2. AI recognition appears with candidates
3. Confirm recognition → fields pre-fill
4. Price section shows with strategy pills
5. Edit title/description inline
6. Review shows fee estimate
7. Publish button sends to eBay (sandbox)
8. Success screen with "List Another" and interface discovery prompt

- [ ] **Step 3: Test entry points**

1. Photo FAB on home page → navigates to `/list`
2. "List for Sale" on item detail → navigates to `/list?itemId=X` → skips recognition
3. Draft recovery: start a listing, leave mid-flow, verify draft badge on inventory item, tap to resume

- [ ] **Step 4: Test interface switching**

1. Go to Settings → change listing interface to Conversational (A)
2. Start a new listing → verify Conversational interface loads
3. Change to Swipe (B) → verify Swipe interface loads
4. All three should be fully functional with real API calls

- [ ] **Step 5: Commit final state**

```bash
git add -A
git commit -m "feat: three-interface listing flow — complete end-to-end implementation"
```

---

## Summary

| Phase | Tasks | Files | Description |
|-------|-------|-------|-------------|
| 1. Backend Foundation | 1-5 | 7 | Schema, drafts route, preferences route, enhanced scan, route mounting |
| 2. Frontend Hooks | 6-8 | 3 | User preferences, drafts, listing flow hooks |
| 3. Shared Components | 9-10 | 3 | Recognition fork, fee estimate, publish success |
| 4. Interface Implementations | 11-13 | 3 | Hybrid (default), Conversational, Swipe flows |
| 5. Pages & Integration | 14-16 | 4 | /list page, listing detail, home + item detail updates |
| 6. Photo Capture | 17 | 1 | Shared camera/upload/crop component |
| 7. Verification | 18 | 0 | Build, deploy, end-to-end testing |

**Total: 18 tasks, 21 files**
