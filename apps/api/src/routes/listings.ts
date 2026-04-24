import { Router } from 'express';
import { z } from 'zod';
import { eq, desc, and } from 'drizzle-orm';
import { pino } from 'pino';
import { db } from '../db/index.js';
import { listings, items } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { EbayAdapter } from '../marketplace/ebay-adapter.js';
import { EtsyAdapter } from '../marketplace/etsy-adapter.js';
import type { MarketplaceAdapter } from '@portage/shared';

const logger = pino({ name: 'listings' });

function getAdapter(userId: string, marketplace: 'ebay' | 'etsy'): MarketplaceAdapter {
  switch (marketplace) {
    case 'ebay': return new EbayAdapter(userId);
    case 'etsy': return new EtsyAdapter(userId);
  }
}

const createListingSchema = z.object({
  itemId: z.string().uuid(),
  marketplace: z.enum(['ebay', 'etsy']),
  price: z.number().positive(),
  currency: z.string().length(3).default('USD'),
  publishImmediately: z.boolean().default(false),
  marketplaceSpecificFields: z.record(z.unknown()).optional(),
});

const updateListingSchema = z.object({
  price: z.number().positive().optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
  marketplaceSpecificFields: z.record(z.unknown()).optional(),
});

export const listingsRouter = Router();

listingsRouter.use(requireAuth);

listingsRouter.get('/', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const status = req.query.status as string | undefined;
    const marketplace = req.query.marketplace as string | undefined;

    const conditions = [eq(listings.userId, userId)];
    if (status) conditions.push(eq(listings.status, status as 'draft' | 'active' | 'sold' | 'archived'));
    if (marketplace) conditions.push(eq(listings.marketplace, marketplace as 'ebay' | 'etsy'));

    const results = await db.select()
      .from(listings)
      .where(and(...conditions))
      .orderBy(desc(listings.createdAt));

    res.json({ listings: results });
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
    let status: 'draft' | 'active' = 'draft';
    let publishedAt: Date | null = null;

    if (body.publishImmediately) {
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
        brand: item.brand,
        model: item.model,
        features: item.features as string[],
        marketplaceSpecific: body.marketplaceSpecificFields,
      });

      marketplaceListingId = result.marketplaceListingId;
      status = result.status === 'active' ? 'active' : 'draft';
      if (status === 'active') publishedAt = new Date();
    }

    const [listing] = await db.insert(listings).values({
      itemId: body.itemId,
      userId,
      marketplace: body.marketplace,
      marketplaceListingId,
      marketplaceSpecificFields: body.marketplaceSpecificFields ?? null,
      status,
      price: body.price,
      currency: body.currency,
      publishedAt,
    }).returning();

    logger.info({ userId, listingId: listing.id, marketplace: body.marketplace, status }, 'Listing created');

    res.status(201).json(listing);
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

    const updates: Record<string, unknown> = {};
    if (body.price !== undefined) updates.price = body.price;
    if (body.status !== undefined) updates.status = body.status;
    if (body.marketplaceSpecificFields !== undefined) updates.marketplaceSpecificFields = body.marketplaceSpecificFields;

    const [updated] = await db.update(listings)
      .set(updates)
      .where(eq(listings.id, req.params.id))
      .returning();

    logger.info({ userId, listingId: updated.id }, 'Listing updated');

    res.json(updated);
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

    const result = await adapter.createListing({
      title: item.title,
      description: item.description,
      price: listing.price,
      currency: listing.currency,
      category: item.category,
      condition: item.condition,
      photos,
      brand: item.brand,
      model: item.model,
      features: item.features as string[],
      marketplaceSpecific: listing.marketplaceSpecificFields as Record<string, unknown> | undefined,
    });

    const [updated] = await db.update(listings)
      .set({
        marketplaceListingId: result.marketplaceListingId,
        status: result.status === 'active' ? 'active' : 'draft',
        publishedAt: result.status === 'active' ? new Date() : null,
      })
      .where(eq(listings.id, listing.id))
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
