import { Router } from 'express';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { eq, desc, ilike, and, sql, inArray } from 'drizzle-orm';
import { Zip, ZipDeflate } from 'fflate';
import { createLogger } from '../lib/logger.js';
import { db } from '../db/index.js';
import { items, exportTokens, listings } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { EbayAdapter } from '../marketplace/ebay-adapter.js';
import { mergeItemShipping, mergeItemAspects } from './listings.js';
import { itemsToEbayCsv } from '../lib/csv-export.js';
import type { MarketplaceCacheEntry, MarketplaceData } from '@portage/shared';
import { isAllowedImageOrigin } from './images.js';

const logger = createLogger('items');

const photoSchema = z.object({
  url: z.string(),
  key: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
  isPrimary: z.boolean().optional(),
});

const validConditions = ['new', 'like_new', 'good', 'fair', 'poor'] as const;

// Per-marketplace resolved category cache (items.marketplaceData JSONB). The
// eBay leaf categoryId persisted here is what resolveEbayCategoryId reads at
// publish — without it, publish falls back to a title guess and can fail with
// EBAY_CATEGORY_REQUIRED. title/cachedAt optional: the edit flow only resolves
// category, and the column is JSONB so partial entries are valid at rest.
const marketplaceCacheEntrySchema = z.object({
  categoryId: z.string().nullable(),
  categoryName: z.string().nullable(),
  // Normalized so the stored entry is a well-formed MarketplaceCacheEntry even
  // when the edit flow only resolved a category: title defaults null, cachedAt
  // is stamped server-side.
  title: z.string().nullable().default(null),
  cachedAt: z.string().default(() => new Date().toISOString()),
});
const marketplaceDataSchema = z.object({
  ebay: marketplaceCacheEntrySchema.optional(),
  etsy: marketplaceCacheEntrySchema.optional(),
  reverb: marketplaceCacheEntrySchema.optional(),
});

const createItemSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  category: z.string().max(255).optional(),
  condition: z.enum(validConditions).optional(),
  conditionNotes: z.string().max(500).optional(),
  brand: z.string().max(255).optional(),
  model: z.string().max(255).optional(),
  features: z.array(z.string().max(100)).max(30).optional(),
  aspects: z.record(z.string(), z.array(z.string())).optional(),
  estimatedValueMin: z.number().min(0).optional(),
  estimatedValueMax: z.number().min(0).optional(),
  estimatedValueRecommended: z.number().min(0).optional(),
  // Seller-set sale price. Floor 0.01 — eBay disallows $0 listings, and null
  // (omitted) means "unset", so it falls through to comps/estimate at publish.
  price: z.number().min(0.01).optional(),
  aiConfidenceScore: z.number().min(0).max(1).optional(),
  quantity: z.number().int().min(1).optional(),
  weightOz: z.number().positive().optional(),
  lengthIn: z.number().positive().optional(),
  widthIn: z.number().positive().optional(),
  heightIn: z.number().positive().optional(),
  ebayPackageType: z.string().max(50).optional(),
  weightEstimated: z.boolean().optional(),
  photos: z.array(photoSchema).optional(),
  marketplaceData: marketplaceDataSchema.optional(),
});

const updateItemSchema = createItemSchema.partial();

const listQuerySchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  condition: z.enum(['new', 'like_new', 'good', 'fair', 'poor']).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export const itemsRouter = Router();

// GET /items/photos/export — token-auth (no requireAuth), defined before middleware
itemsRouter.get('/photos/export', async (req, res, next) => {
  try {
    const token = req.query.token as string | undefined;
    if (!token) throw new AppError(400, 'MISSING_TOKEN', 'token query parameter is required');

    const [row] = await db.select().from(exportTokens)
      .where(and(eq(exportTokens.token, token)));

    if (!row || row.expiresAt < new Date() || row.useCount >= 3)
      throw new AppError(401, 'INVALID_TOKEN', 'Token is invalid or expired');

    await db.update(exportTokens)
      .set({ useCount: row.useCount + 1 })
      .where(eq(exportTokens.token, token));

    const itemRows = await db.select({ id: items.id, title: items.title, photos: items.photos })
      .from(items).where(inArray(items.id, row.itemIds));

    const chunks: Buffer[] = [];
    let totalPhotos = 0;
    let fetchedCount = 0;
    await new Promise<void>((resolve, reject) => {
      const zip = new Zip((err, chunk, final) => {
        if (err) { reject(err); return; }
        chunks.push(Buffer.from(chunk));
        if (final) resolve();
      });

      (async () => {
        let photoIdx = 0;
        for (const item of itemRows) {
          for (const photo of (item.photos as any[]) ?? []) {
            if (!isAllowedImageOrigin(photo.url)) continue;
            totalPhotos++;
            const r = await fetch(photo.url as string);
            if (!r.ok) continue;
            fetchedCount++;
            const buf = new Uint8Array(await r.arrayBuffer());
            const file = new ZipDeflate(`photo_${++photoIdx}.jpg`, { level: 0 });
            zip.add(file);
            file.push(buf, true);
          }
        }
        zip.end();
      })().catch(reject);
    });

    if (totalPhotos > 0 && fetchedCount === 0)
      throw new AppError(502, 'PHOTO_FETCH_FAILED', 'Failed to fetch photos for export');

    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="portage-photos-${date}.zip"`);
    res.end(Buffer.concat(chunks));
  } catch (err) {
    next(err);
  }
});

itemsRouter.use(requireAuth);

itemsRouter.get('/', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const query = listQuerySchema.parse(req.query);

    const conditions = [eq(items.userId, userId)];
    if (query.search) {
      const escaped = query.search.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
      conditions.push(ilike(items.title, `%${escaped}%`));
    }
    if (query.category) {
      conditions.push(eq(items.category, query.category));
    }
    if (query.condition) {
      conditions.push(eq(items.condition, query.condition));
    }

    const [results, countResult] = await Promise.all([
      db.select().from(items)
        .where(and(...conditions))
        .orderBy(desc(items.createdAt))
        .limit(query.limit)
        .offset(query.offset),
      db.select({ count: sql<number>`count(*)` }).from(items)
        .where(and(...conditions)),
    ]);

    logger.debug({ userId, count: results.length, total: countResult[0].count }, 'Items listed');

    res.json({
      items: results,
      total: Number(countResult[0].count),
      limit: query.limit,
      offset: query.offset,
    });
  } catch (err) {
    next(err);
  }
});

const exportQuerySchema = z.object({
  format: z.enum(['ebay_csv', 'json']).default('json'),
  ids: z.string().optional(),
  category: z.string().optional(),
  condition: z.enum(['new', 'like_new', 'good', 'fair', 'poor']).optional(),
});

itemsRouter.get('/export', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const query = exportQuerySchema.parse(req.query);

    const conditions = [eq(items.userId, userId)];

    if (query.ids) {
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const idList = query.ids.split(',').map(s => s.trim()).filter(s => UUID_RE.test(s));
      if (idList.length > 0) {
        conditions.push(inArray(items.id, idList));
      }
    }

    if (query.category) {
      conditions.push(eq(items.category, query.category));
    }

    if (query.condition) {
      conditions.push(eq(items.condition, query.condition));
    }

    const results = await db.select().from(items)
      .where(and(...conditions))
      .orderBy(desc(items.createdAt));

    logger.info({ userId, count: results.length, format: query.format }, 'Items export requested');

    if (query.format === 'ebay_csv') {
      const date = new Date().toISOString().slice(0, 10);
      const { csv, missingCategories, totalRows } = itemsToEbayCsv(results);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="portage-ebay-export-${date}.csv"`);
      if (missingCategories > 0) {
        res.setHeader('X-Portage-Missing-Categories', String(missingCategories));
      }
      res.setHeader('X-Portage-Total-Rows', String(totalRows));
      return res.send(csv);
    }

    // Default: JSON
    res.json(results);
  } catch (err) {
    next(err);
  }
});

itemsRouter.get('/:id', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const [item] = await db.select().from(items)
      .where(and(eq(items.id, req.params.id), eq(items.userId, userId)))
      .limit(1);

    if (!item) {
      throw new AppError(404, 'NOT_FOUND', 'Item not found');
    }

    res.json(item);
  } catch (err) {
    next(err);
  }
});

itemsRouter.get('/:id/comps', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const [item] = await db.select().from(items)
      .where(and(eq(items.id, req.params.id), eq(items.userId, userId)))
      .limit(1);

    if (!item) {
      throw new AppError(404, 'NOT_FOUND', 'Item not found');
    }

    const searchQuery = item.title.slice(0, 200);
    let comps;
    try {
      comps = await EbayAdapter.searchComps(searchQuery, item.category || undefined);
    } catch (ebayErr) {
      logger.warn({ userId, itemId: item.id, error: (ebayErr as Error).message }, 'eBay comps lookup failed');
      throw new AppError(503, 'MARKETPLACE_UNAVAILABLE', 'eBay comps lookup is currently unavailable');
    }

    logger.info({ userId, itemId: item.id, sampleSize: comps.stats.sampleSize }, 'Comps fetched');
    res.json(comps);
  } catch (err) {
    next(err);
  }
});

// Listing optimizer research: which eBay item-specifics buyers filter on that this
// item is still missing, plus comps-based demand. App-token reads (taxonomy +
// browse), so it works before any marketplace is connected.
itemsRouter.get('/:id/research', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const [item] = await db.select().from(items)
      .where(and(eq(items.id, req.params.id), eq(items.userId, userId)))
      .limit(1);

    if (!item) {
      throw new AppError(404, 'NOT_FOUND', 'Item not found');
    }

    const searchQuery = (item.title || [item.brand, item.model].filter(Boolean).join(' ')).slice(0, 200);

    // Prefer the eBay leaf category already cached on the item; else ask Taxonomy.
    const cachedEbay = (item.marketplaceData as MarketplaceData | null)?.ebay;
    let category: { categoryId: string; categoryName: string } | null =
      cachedEbay?.categoryId
        ? { categoryId: cachedEbay.categoryId, categoryName: cachedEbay.categoryName ?? '' }
        : null;
    if (!category) {
      try {
        category = await EbayAdapter.getCategorySuggestion(searchQuery);
      } catch (err) {
        logger.warn({ itemId: item.id, error: (err as Error).message }, 'Category suggestion failed for research');
      }
    }

    const [aspectsMeta, comps] = await Promise.all([
      category ? EbayAdapter.getRequiredAspects(category.categoryId) : Promise.resolve({}),
      EbayAdapter.searchComps(searchQuery, category?.categoryId).catch((err) => {
        logger.warn({ itemId: item.id, error: (err as Error).message }, 'Comps fetch failed for research');
        return null;
      }),
    ]);

    // Aspect gap: an aspect is "filled" when the item already carries a value for it
    // (case-insensitive), with Brand/Model also honored from the dedicated columns.
    const itemAspects = (item.aspects as Record<string, string[]>) ?? {};
    const lowerToValues = new Map(Object.entries(itemAspects).map(([k, v]) => [k.toLowerCase(), v]));
    const valueFor = (name: string): string[] | null => {
      const v = lowerToValues.get(name.toLowerCase());
      if (v && v.length) return v;
      if (name.toLowerCase() === 'brand' && item.brand) return [item.brand];
      if (name.toLowerCase() === 'model' && item.model) return [item.model];
      return null;
    };

    const filled: Array<{ name: string; required: boolean; values: string[] }> = [];
    const missing: Array<{ name: string; required: boolean; suggestedValues: string[] | null; cardinality: string }> = [];
    for (const [name, meta] of Object.entries(aspectsMeta as Record<string, { required: boolean; values: string[] | null; cardinality: string }>)) {
      const values = valueFor(name);
      if (values) filled.push({ name, required: meta.required, values });
      else missing.push({ name, required: meta.required, suggestedValues: meta.values, cardinality: meta.cardinality });
    }
    // Required gaps first, then alphabetical — fix what eBay enforces before the rest.
    const byRequiredThenName = (a: { required: boolean; name: string }, b: { required: boolean; name: string }) =>
      (Number(b.required) - Number(a.required)) || a.name.localeCompare(b.name);
    missing.sort(byRequiredThenName);
    filled.sort(byRequiredThenName);

    const demand = comps
      ? { ...comps.stats, soldCount: comps.sold.length, activeCount: comps.active.length }
      : null;

    // Performance feedback: the Analytics traffic report for the item's published
    // eBay listing. Best-effort — needs a live listing AND the sell.analytics scope
    // on the user token (pre-2026-06 connections lack it until they reconnect), so
    // a missing scope / no listing simply yields null rather than failing research.
    let traffic = null;
    try {
      const [listed] = await db.select({ marketplaceListingId: listings.marketplaceListingId })
        .from(listings).where(and(
          eq(listings.itemId, item.id),
          eq(listings.userId, userId),
          eq(listings.marketplace, 'ebay'),
          eq(listings.status, 'active'),
        )).limit(1);
      if (listed?.marketplaceListingId) {
        traffic = await new EbayAdapter(userId).getTrafficReport(listed.marketplaceListingId);
      }
    } catch (err) {
      logger.warn({ itemId: item.id, error: (err as Error).message }, 'Traffic report fetch failed for research');
    }

    res.json({ category, aspects: { filled, missing }, demand, traffic });
  } catch (err) {
    next(err);
  }
});

itemsRouter.get('/comps/search', async (req, res, next) => {
  try {
    const q = req.query.q as string | undefined;
    if (!q || q.trim().length < 3) {
      throw new AppError(400, 'INVALID_QUERY', 'Query must be at least 3 characters');
    }
    const category = req.query.category as string | undefined;
    const comps = await EbayAdapter.searchComps(q.slice(0, 200), category || undefined);
    res.json(comps);
  } catch (err) {
    next(err);
  }
});

itemsRouter.post('/', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const body = createItemSchema.parse(req.body);

    const [item] = await db.insert(items).values({
      userId,
      title: body.title,
      description: body.description ?? '',
      category: body.category ?? '',
      condition: body.condition ?? 'good',
      conditionNotes: body.conditionNotes ?? '',
      brand: body.brand ?? '',
      model: body.model ?? '',
      features: body.features ?? [],
      aspects: body.aspects ?? {},
      estimatedValueMin: body.estimatedValueMin ?? null,
      estimatedValueMax: body.estimatedValueMax ?? null,
      estimatedValueRecommended: body.estimatedValueRecommended ?? null,
      price: body.price ?? null,
      aiConfidenceScore: body.aiConfidenceScore ?? 0,
      quantity: body.quantity ?? 1,
      weightOz: body.weightOz ?? null,
      lengthIn: body.lengthIn ?? null,
      widthIn: body.widthIn ?? null,
      heightIn: body.heightIn ?? null,
      ebayPackageType: body.ebayPackageType ?? null,
      weightEstimated: body.weightEstimated ?? false,
      photos: body.photos ?? [],
      marketplaceData: body.marketplaceData ?? null,
    }).returning();

    logger.info({ userId, itemId: item.id, title: item.title }, 'Item created');
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

itemsRouter.patch('/:id', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const body = updateItemSchema.parse(req.body);

    const [existing] = await db.select({ id: items.id, marketplaceData: items.marketplaceData, aspects: items.aspects }).from(items)
      .where(and(eq(items.id, req.params.id), eq(items.userId, userId)))
      .limit(1);

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Item not found');
    }

    // marketplaceData is a per-marketplace JSONB cache; a partial PATCH must merge,
    // not wholesale-replace. A category-only edit (the only thing the edit flow sends)
    // would otherwise wipe sibling marketplace entries and null the AI-optimized eBay
    // title that csv-export reads. Mirror the publish-time read-merge in listings.ts.
    const updates: Record<string, unknown> = { ...body, updatedAt: new Date() };
    if (body.marketplaceData) {
      const current = (existing.marketplaceData as Record<string, MarketplaceCacheEntry> | null) ?? {};
      const merged: Record<string, MarketplaceCacheEntry> = { ...current };
      for (const [mk, entry] of Object.entries(body.marketplaceData)) {
        const prev = current[mk];
        merged[mk] = {
          ...prev,
          ...entry,
          // The edit flow never sends a title, so Zod's null default must not clobber
          // a previously cached one.
          title: entry.title ?? prev?.title ?? null,
        };
      }
      updates.marketplaceData = merged;
    }

    // aspects is JSONB like marketplaceData — a partial PATCH must read-merge,
    // not wholesale-replace, or scan-captured specifics absent from this payload
    // are silently wiped. Incoming keys win; existing keys are preserved.
    if (body.aspects) {
      const current = (existing.aspects as Record<string, string[]> | null) ?? {};
      updates.aspects = { ...current, ...body.aspects };
    }

    const [updated] = await db.update(items)
      .set(updates)
      .where(eq(items.id, req.params.id))
      .returning();

    logger.info({ userId, itemId: updated.id }, 'Item updated');

    // Push field edits to the item's eBay listing(s) — eBay rejects UI edits on
    // Inventory-API listings, so Portage is the source of truth. An item can have
    // more than one live/draft eBay row (and orphan drafts with no offer id), so
    // sync every syncable row and skip the rest — never just an arbitrary first.
    // Entire block is best-effort: a failure fetching or syncing listings must
    // not 500 the saved item edit.
    try {
      const ebayListings = await db.select({
        status: listings.status,
        marketplaceListingId: listings.marketplaceListingId,
        ebaySku: listings.ebaySku,
        marketplaceSpecificFields: listings.marketplaceSpecificFields,
        currency: listings.currency,
      }).from(listings).where(and(
        eq(listings.itemId, updated.id),
        eq(listings.userId, userId),
        eq(listings.marketplace, 'ebay'),
        // Only live rows — never a stale archived/sold history row for this item.
        inArray(listings.status, ['active', 'draft']),
      ));

      for (const listed of ebayListings) {
        // Trade-First: only a published listing (active + Trading ItemID) can be revised.
        // A DB-only draft has no live listing to sync until it is published.
        const syncId = listed.marketplaceListingId;
        if (listed.status !== 'active' || !syncId) continue;
        try {
          const adapter = new EbayAdapter(userId);
          await adapter.updateListing(syncId, {
            title: updated.title,
            description: updated.description,
            price: updated.price ?? undefined,
            currency: listed.currency,
            condition: updated.condition,
            quantity: updated.quantity,
            brand: updated.brand,
            model: updated.model,
            photos: (updated.photos as Array<{ url: string; isPrimary?: boolean }>) ?? [],
            features: updated.features as string[],
            ebaySku: listed.ebaySku ?? undefined,
            marketplaceSpecific: mergeItemAspects(updated, mergeItemShipping(updated, listed.marketplaceSpecificFields as Record<string, unknown> | undefined)),
          });
        } catch (err) {
          // One failed row must not block syncing the others.
          logger.warn({ itemId: updated.id, syncId, error: (err as Error).message }, 'Failed to sync item edit to eBay listing');
        }
      }
    } catch (err) {
      logger.warn({ itemId: updated.id, error: (err as Error).message }, 'Failed to load eBay listings for item-edit sync');
    }

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

itemsRouter.delete('/:id', async (req, res, next) => {
  try {
    const userId = req.user!.sub;

    const [existing] = await db.select({ id: items.id }).from(items)
      .where(and(eq(items.id, req.params.id), eq(items.userId, userId)))
      .limit(1);

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Item not found');
    }

    await db.delete(items).where(eq(items.id, req.params.id));

    logger.info({ userId, itemId: req.params.id }, 'Item deleted');
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

// ─── Bulk Endpoints ───────────────────────────────────────────────────────────

const bulkIdsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
});

const bulkExportIdsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});

const validBulkConditions = ['new', 'like_new', 'good', 'fair', 'poor'] as const;

const bulkUpdateSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
  updates: z.object({
    category: z.string().max(255).optional(),
    condition: z.enum(validBulkConditions).optional(),
  }).refine((u) => u.category !== undefined || u.condition !== undefined, {
    message: 'At least one update field (category or condition) must be provided',
  }),
});

itemsRouter.post('/bulk/delete', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const { ids } = bulkIdsSchema.parse(req.body);

    // Verify all items belong to the user before deleting
    const owned = await db.select({ id: items.id }).from(items)
      .where(and(inArray(items.id, ids), eq(items.userId, userId)));

    if (owned.length !== ids.length) {
      throw new AppError(403, 'FORBIDDEN', 'One or more items do not belong to you');
    }

    const deleted = await db.transaction(async (tx) => {
      const result = await tx.delete(items)
        .where(and(inArray(items.id, ids), eq(items.userId, userId)))
        .returning({ id: items.id });
      return result;
    });

    logger.info({ userId, count: deleted.length }, 'Bulk items deleted');
    res.json({ deleted: true, count: deleted.length, ids: deleted.map((r) => r.id) });
  } catch (err) {
    next(err);
  }
});

itemsRouter.post('/bulk/update', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const { ids, updates } = bulkUpdateSchema.parse(req.body);

    // Verify all items belong to the user
    const owned = await db.select({ id: items.id }).from(items)
      .where(and(inArray(items.id, ids), eq(items.userId, userId)));

    if (owned.length !== ids.length) {
      throw new AppError(403, 'FORBIDDEN', 'One or more items do not belong to you');
    }

    const setFields: { category?: string; condition?: typeof validBulkConditions[number]; updatedAt: Date } = {
      updatedAt: new Date(),
    };
    if (updates.category !== undefined) setFields.category = updates.category;
    if (updates.condition !== undefined) setFields.condition = updates.condition;

    const updated = await db.transaction(async (tx) => {
      return tx.update(items)
        .set(setFields)
        .where(and(inArray(items.id, ids), eq(items.userId, userId)))
        .returning({ id: items.id });
    });

    logger.info({ userId, count: updated.length, updates }, 'Bulk items updated');
    res.json({ updated: true, count: updated.length, ids: updated.map((r) => r.id) });
  } catch (err) {
    next(err);
  }
});

itemsRouter.post('/bulk/export', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const { ids } = bulkExportIdsSchema.parse(req.body);

    const results = await db.select().from(items)
      .where(and(inArray(items.id, ids), eq(items.userId, userId)));

    logger.info({ userId, count: results.length }, 'Bulk items exported');
    res.json({ items: results, count: results.length });
  } catch (err) {
    next(err);
  }
});

const preparePhotoExportSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
});

itemsRouter.post('/photos/export/prepare', async (req, res, next) => {
  try {
    const { ids } = preparePhotoExportSchema.parse(req.body);
    const userId = req.user!.sub;
    const dedupedIds = [...new Set(ids)];

    const rows = await db.select({ id: items.id, photos: items.photos, title: items.title })
      .from(items).where(and(inArray(items.id, dedupedIds), eq(items.userId, userId)));

    if (rows.length !== dedupedIds.length)
      throw new AppError(403, 'FORBIDDEN', 'One or more items do not belong to you');

    const hasAnyPhotos = rows.some(row => ((row.photos as any[]) ?? []).length > 0);
    if (!hasAnyPhotos)
      throw new AppError(422, 'NO_PHOTOS', 'No photos available within the 60-photo limit');

    let photoCount = 0;
    let skippedCount = 0;
    const cappedRows: typeof rows = [];
    for (const row of rows) {
      const rowPhotos = ((row.photos as any[]) ?? []).length;
      if (photoCount + rowPhotos > 60) { skippedCount++; continue; }
      photoCount += rowPhotos;
      cappedRows.push(row);
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await db.insert(exportTokens).values({
      token,
      userId,
      itemIds: cappedRows.map(r => r.id),
      expiresAt,
    });

    res.json({ token, expiresAt, itemCount: cappedRows.length, photoCount, skippedCount });
  } catch (err) {
    next(err);
  }
});
