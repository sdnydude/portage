import { Router } from 'express';
import { z } from 'zod';
import { eq, desc, and, sql, inArray } from 'drizzle-orm';
import { createLogger } from '../lib/logger.js';
import { db } from '../db/index.js';
import { listings, items } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { EbayAdapter, resolveEbayCategoryId } from '../marketplace/ebay-adapter.js';
import { EtsyAdapter } from '../marketplace/etsy-adapter.js';
import { ReverbAdapter } from '../marketplace/reverb-adapter.js';
import { env } from '../lib/env.js';
import type { MarketplaceAdapter } from '@portage/shared';

const logger = createLogger('listings');

function getAdapter(userId: string, marketplace: 'ebay' | 'etsy' | 'reverb'): MarketplaceAdapter {
  switch (marketplace) {
    case 'ebay': return new EbayAdapter(userId);
    case 'etsy': return new EtsyAdapter(userId);
    case 'reverb': {
      const reverbToken = env().REVERB_API_TOKEN;
      if (!reverbToken) throw new AppError(400, 'NOT_CONFIGURED', 'Reverb API token not configured');
      return new ReverbAdapter(reverbToken);
    }
  }
}

const createListingSchema = z.object({
  itemId: z.string().uuid(),
  marketplace: z.enum(['ebay', 'etsy', 'reverb']),
  price: z.number().positive(),
  currency: z.string().length(3).default('USD'),
  publishImmediately: z.boolean().default(false),
  publishMode: z.enum(['draft', 'live']).optional(),
  marketplaceSpecificFields: z.record(z.unknown()).optional(),
});

const updateListingSchema = z.object({
  price: z.number().positive().optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
  marketplaceSpecificFields: z.record(z.unknown()).optional(),
});

const listQuerySchema = z.object({
  status: z.enum(['draft', 'active', 'sold', 'archived']).optional(),
  marketplace: z.enum(['ebay', 'etsy', 'reverb']).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export const listingsRouter = Router();

listingsRouter.use(requireAuth);

listingsRouter.get('/', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const query = listQuerySchema.parse(req.query);

    const conditions = [eq(listings.userId, userId)];
    if (query.status) conditions.push(eq(listings.status, query.status));
    if (query.marketplace) conditions.push(eq(listings.marketplace, query.marketplace));

    const [results, countResult] = await Promise.all([
      db.select()
        .from(listings)
        .where(and(...conditions))
        .orderBy(desc(listings.createdAt))
        .limit(query.limit)
        .offset(query.offset),
      db.select({ count: sql<number>`count(*)` })
        .from(listings)
        .where(and(...conditions)),
    ]);

    res.json({
      listings: results,
      total: Number(countResult[0].count),
      limit: query.limit,
      offset: query.offset,
    });
  } catch (err) {
    next(err);
  }
});

listingsRouter.get('/:id', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const [listing] = await db.select()
      .from(listings)
      .where(and(eq(listings.id, req.params.id), eq(listings.userId, userId)))
      .limit(1);

    if (!listing) throw new AppError(404, 'NOT_FOUND', 'Listing not found');

    res.json(listing);
  } catch (err) {
    next(err);
  }
});

listingsRouter.post('/', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const body = createListingSchema.parse(req.body);

    const [item] = await db.select()
      .from(items)
      .where(and(eq(items.id, body.itemId), eq(items.userId, userId)))
      .limit(1);

    if (!item) throw new AppError(404, 'NOT_FOUND', 'Item not found');

    let marketplaceListingId: string | null = null;
    let ebaySku: string | null = null;
    let ebayOfferId: string | null = null;
    let status: 'draft' | 'active' = 'draft';
    let publishedAt: Date | null = null;

    // publishMode (when present) takes precedence over the legacy
    // publishImmediately flag. draft = save to DB only (no marketplace call).
    const shouldPublish = body.publishMode === 'live' || (body.publishMode === undefined && body.publishImmediately);

    if (shouldPublish) {
      const adapter = getAdapter(userId, body.marketplace);
      const photos = (item.photos as Array<{ url: string; isPrimary?: boolean }>) ?? [];

      const result = await adapter.createListing({
        title: item.title,
        description: item.description,
        price: body.price,
        currency: body.currency,
        category: item.category,
        condition: item.condition,
        photos,
        quantity: item.quantity,
        brand: item.brand,
        model: item.model,
        features: item.features as string[],
        marketplaceSpecific: body.marketplaceSpecificFields,
      });

      marketplaceListingId = result.marketplaceListingId;
      ebaySku = result.ebaySku ?? null;
      ebayOfferId = result.ebayOfferId ?? null;
      status = result.status === 'active' ? 'active' : 'draft';
      if (status === 'active') publishedAt = new Date();
    }

    const [listing] = await db.insert(listings).values({
      itemId: body.itemId,
      userId,
      marketplace: body.marketplace,
      marketplaceListingId,
      ebaySku,
      ebayOfferId,
      marketplaceSpecificFields: body.marketplaceSpecificFields ?? null,
      status,
      price: body.price,
      currency: body.currency,
      publishedAt,
    }).returning();

    logger.info({ userId, listingId: listing.id, marketplace: body.marketplace, status }, 'Listing created');

    const response: Record<string, unknown> = { ...listing };
    if (body.publishImmediately && status === 'draft') {
      response.warning = 'Listing was created but could not be published. It has been saved as a draft.';
    }

    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
});

listingsRouter.patch('/:id', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const body = updateListingSchema.parse(req.body);

    const [existing] = await db.select()
      .from(listings)
      .where(and(eq(listings.id, req.params.id), eq(listings.userId, userId)))
      .limit(1);

    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Listing not found');

    let warning: string | undefined;
    // Only call deleteListing when transitioning active→archived; drafts were never pushed to the marketplace.
    const isArchiving = body.status === 'archived' && existing.status === 'active' && !!existing.marketplaceListingId;

    if (isArchiving) {
      try {
        const adapter = getAdapter(userId, existing.marketplace);
        await adapter.deleteListing(existing.marketplaceListingId!);
      } catch (err) {
        if (err instanceof AppError) throw err;
        logger.warn({ listingId: existing.id, error: (err as Error).message }, 'Failed to remove from marketplace during archive');
        warning = 'Archived locally but failed to remove from marketplace';
      }
    }

    const updates: {
      price?: number;
      status?: 'draft' | 'active' | 'sold' | 'archived';
      marketplaceSpecificFields?: Record<string, unknown>;
    } = {};
    if (body.price !== undefined) updates.price = body.price;
    if (body.status !== undefined) updates.status = body.status;
    if (body.marketplaceSpecificFields !== undefined) updates.marketplaceSpecificFields = body.marketplaceSpecificFields;

    const [updated] = await db.update(listings)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(listings.id, req.params.id), eq(listings.userId, userId)))
      .returning();

    // Skip marketplace sync when archiving — the listing was already removed above.
    if (!isArchiving && updated.status === 'active' && updated.marketplaceListingId) {
      const [item] = await db.select()
        .from(items)
        .where(eq(items.id, updated.itemId))
        .limit(1);

      if (item) {
        try {
          const adapter = getAdapter(userId, updated.marketplace);
          await adapter.updateListing(updated.marketplaceListingId, {
            title: item.title,
            description: item.description,
            price: updated.price,
            currency: updated.currency,
            condition: item.condition,
            quantity: item.quantity,
            brand: item.brand,
            model: item.model,
            photos: (item.photos as Array<{ url: string; isPrimary?: boolean }>) ?? [],
            features: item.features as string[],
            ebaySku: updated.ebaySku ?? undefined,
            ebayOfferId: updated.ebayOfferId ?? undefined,
            marketplaceSpecific: updated.marketplaceSpecificFields as Record<string, unknown> | undefined,
          });
        } catch (err) {
          if (err instanceof AppError) throw err;
          logger.warn({ listingId: updated.id, error: (err as Error).message }, 'Failed to sync update to marketplace');
          warning = 'Saved locally but failed to sync to marketplace';
        }
      }
    }

    logger.info({ userId, listingId: updated.id, synced: !warning }, 'Listing updated');

    res.json(warning ? { ...updated, warning } : updated);
  } catch (err) {
    next(err);
  }
});

listingsRouter.post('/:id/publish', async (req, res, next) => {
  try {
    const userId = req.user!.sub;

    const [listing] = await db.select()
      .from(listings)
      .where(and(eq(listings.id, req.params.id), eq(listings.userId, userId)))
      .limit(1);

    if (!listing) throw new AppError(404, 'NOT_FOUND', 'Listing not found');
    if (listing.status !== 'draft') throw new AppError(400, 'INVALID_STATUS', 'Only draft listings can be published');

    const [item] = await db.select()
      .from(items)
      .where(eq(items.id, listing.itemId))
      .limit(1);

    if (!item) throw new AppError(404, 'NOT_FOUND', 'Associated item not found');

    const adapter = getAdapter(userId, listing.marketplace);
    const photos = (item.photos as Array<{ url: string; isPrimary?: boolean }>) ?? [];

    // Self-heal the eBay leaf category: drafts created without prepare-listing (seeded,
    // photo-first, quick-list) have no categoryId, which publish requires. Resolve it
    // (explicit field → item cache → Taxonomy API) and cache a freshly-resolved id on the item.
    let marketplaceSpecific = listing.marketplaceSpecificFields as Record<string, unknown> | undefined;
    if (listing.marketplace === 'ebay') {
      const cat = await resolveEbayCategoryId(marketplaceSpecific, item);
      if (cat.categoryId) {
        marketplaceSpecific = { ...(marketplaceSpecific ?? {}), categoryId: cat.categoryId };
        if (cat.newlyResolved) {
          const md = (item.marketplaceData as Record<string, unknown> | null) ?? {};
          const ebayMd = (md.ebay as { title?: string | null } | undefined) ?? {};
          await db.update(items)
            .set({
              marketplaceData: {
                ...md,
                ebay: {
                  categoryId: cat.categoryId,
                  categoryName: cat.categoryName,
                  title: ebayMd.title ?? null,
                  cachedAt: new Date().toISOString(),
                },
              },
              updatedAt: new Date(),
            })
            .where(eq(items.id, item.id));
          logger.info({ userId, itemId: item.id, categoryId: cat.categoryId }, 'eBay leaf category auto-resolved at publish');
        }
      }
    }

    const result = await adapter.createListing({
      title: item.title,
      description: item.description,
      price: listing.price,
      currency: listing.currency,
      category: item.category,
      condition: item.condition,
      photos,
      quantity: item.quantity,
      brand: item.brand,
      model: item.model,
      features: item.features as string[],
      marketplaceSpecific,
      ebaySku: listing.ebaySku ?? undefined,
      ebayOfferId: listing.ebayOfferId ?? undefined,
    });

    const [updated] = await db.update(listings)
      .set({
        marketplaceListingId: result.marketplaceListingId,
        ebaySku: result.ebaySku ?? null,
        ebayOfferId: result.ebayOfferId ?? null,
        status: result.status === 'active' ? 'active' : 'draft',
        publishedAt: result.status === 'active' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(and(eq(listings.id, listing.id), eq(listings.userId, userId)))
      .returning();

    logger.info({ userId, listingId: updated.id, marketplaceListingId: result.marketplaceListingId }, 'Listing published');

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

listingsRouter.delete('/:id', async (req, res, next) => {
  try {
    const userId = req.user!.sub;

    const [listing] = await db.select()
      .from(listings)
      .where(and(eq(listings.id, req.params.id), eq(listings.userId, userId)))
      .limit(1);

    if (!listing) throw new AppError(404, 'NOT_FOUND', 'Listing not found');

    if (listing.marketplaceListingId && listing.status === 'active') {
      try {
        const adapter = getAdapter(userId, listing.marketplace);
        await adapter.deleteListing(listing.marketplaceListingId);
      } catch (err) {
        logger.warn({ listingId: listing.id, err: (err as Error).message }, 'Failed to delete from marketplace — removing locally');
      }
    }

    await db.delete(listings).where(eq(listings.id, listing.id));

    logger.info({ userId, listingId: listing.id }, 'Listing deleted');
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

// ─── Bulk Endpoints ───────────────────────────────────────────────────────────

const bulkListingIdsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
});

listingsRouter.post('/bulk/delete', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const { ids } = bulkListingIdsSchema.parse(req.body);

    // Verify ownership before deleting
    const owned = await db.select({ id: listings.id, status: listings.status, marketplaceListingId: listings.marketplaceListingId, marketplace: listings.marketplace })
      .from(listings)
      .where(and(inArray(listings.id, ids), eq(listings.userId, userId)));

    if (owned.length !== ids.length) {
      throw new AppError(403, 'FORBIDDEN', 'One or more listings do not belong to you');
    }

    // Best-effort removal from marketplaces for active listings
    await Promise.all(
      owned
        .filter((l) => l.status === 'active' && l.marketplaceListingId)
        .map(async (l) => {
          try {
            const adapter = getAdapter(userId, l.marketplace);
            await adapter.deleteListing(l.marketplaceListingId!);
          } catch (err) {
            logger.warn({ listingId: l.id, error: (err as Error).message }, 'Bulk delete: failed to remove from marketplace');
          }
        })
    );

    const deleted = await db.transaction(async (tx) => {
      return tx.delete(listings)
        .where(and(inArray(listings.id, ids), eq(listings.userId, userId)))
        .returning({ id: listings.id });
    });

    logger.info({ userId, count: deleted.length }, 'Bulk listings deleted');
    res.json({ deleted: true, count: deleted.length, ids: deleted.map((r) => r.id) });
  } catch (err) {
    next(err);
  }
});

listingsRouter.post('/bulk/archive', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const { ids } = bulkListingIdsSchema.parse(req.body);

    // Verify ownership
    const owned = await db.select({ id: listings.id, status: listings.status, marketplaceListingId: listings.marketplaceListingId, marketplace: listings.marketplace })
      .from(listings)
      .where(and(inArray(listings.id, ids), eq(listings.userId, userId)));

    if (owned.length !== ids.length) {
      throw new AppError(403, 'FORBIDDEN', 'One or more listings do not belong to you');
    }

    // Best-effort removal from marketplaces for active listings
    await Promise.all(
      owned
        .filter((l) => l.status === 'active' && l.marketplaceListingId)
        .map(async (l) => {
          try {
            const adapter = getAdapter(userId, l.marketplace);
            await adapter.deleteListing(l.marketplaceListingId!);
          } catch (err) {
            logger.warn({ listingId: l.id, error: (err as Error).message }, 'Bulk archive: failed to remove from marketplace');
          }
        })
    );

    const archived = await db.transaction(async (tx) => {
      return tx.update(listings)
        .set({ status: 'archived' })
        .where(and(inArray(listings.id, ids), eq(listings.userId, userId)))
        .returning({ id: listings.id });
    });

    logger.info({ userId, count: archived.length }, 'Bulk listings archived');
    res.json({ archived: true, count: archived.length, ids: archived.map((r) => r.id) });
  } catch (err) {
    next(err);
  }
});

listingsRouter.post('/bulk/activate', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const { ids } = bulkListingIdsSchema.parse(req.body);

    // Verify ownership — include marketplace fields for eBay bulk publish
    const owned = await db.select({
      id: listings.id,
      status: listings.status,
      marketplace: listings.marketplace,
      marketplaceListingId: listings.marketplaceListingId,
      ebayOfferId: listings.ebayOfferId,
      ebaySku: listings.ebaySku,
    })
      .from(listings)
      .where(and(inArray(listings.id, ids), eq(listings.userId, userId)));

    if (owned.length !== ids.length) {
      throw new AppError(403, 'FORBIDDEN', 'One or more listings do not belong to you');
    }

    // eBay drafts with an offerId can be bulk-published via the eBay batch API
    const ebayPublishable = owned.filter((l) =>
      l.status === 'draft' && l.marketplace === 'ebay' && l.ebayOfferId
    );
    // Non-marketplace drafts/archived can be activated locally
    const activatable = owned.filter((l) =>
      (l.status === 'draft' || l.status === 'archived') && !l.marketplaceListingId
    );
    // Archived marketplace listings need individual re-listing
    const skippedMarketplace = owned.filter((l) =>
      l.status === 'archived' && !!l.marketplaceListingId
    );

    let published = 0;
    const publishedIds: string[] = [];
    const publishFailed: string[] = [];

    if (ebayPublishable.length > 0) {
      const adapter = new EbayAdapter(userId);
      const offerIds = ebayPublishable.map((l) => l.ebayOfferId!);
      const offerToListing = new Map(ebayPublishable.map((l) => [l.ebayOfferId!, l.id]));

      // eBay batch API accepts up to 25 per call
      for (let i = 0; i < offerIds.length; i += 25) {
        const batch = offerIds.slice(i, i + 25);
        const results = await adapter.bulkPublishOffers(batch);
        for (const r of results) {
          const listingId = offerToListing.get(r.offerId);
          if (!listingId) continue;
          if (r.success) {
            await db.update(listings)
              .set({ marketplaceListingId: r.listingId ?? null, status: 'active', publishedAt: new Date(), updatedAt: new Date() })
              .where(eq(listings.id, listingId));
            published++;
            publishedIds.push(listingId);
          } else {
            publishFailed.push(r.offerId);
            logger.warn({ listingId, offerId: r.offerId, error: r.error }, 'Bulk publish failed for offer');
          }
        }
      }
    }

    let activated: { id: string }[] = [];
    if (activatable.length > 0) {
      const activatableIds = activatable.map((l) => l.id);
      activated = await db.update(listings)
        .set({ status: 'active', updatedAt: new Date() })
        .where(and(inArray(listings.id, activatableIds), eq(listings.userId, userId)))
        .returning({ id: listings.id });
    }

    logger.info({ userId, published, activated: activated.length, failed: publishFailed.length }, 'Bulk listings activated');
    res.json({
      activated: true,
      count: activated.length + published,
      ids: [...publishedIds, ...activated.map((r) => r.id)],
      published,
      publishFailed: publishFailed.length,
      skipped: skippedMarketplace.length,
      warning: skippedMarketplace.length > 0
        ? `${skippedMarketplace.length} archived listing(s) were previously published to a marketplace and must be re-listed individually`
        : undefined,
    });
  } catch (err) {
    next(err);
  }
});
