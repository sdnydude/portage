import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { eq, desc, and, sql, inArray } from 'drizzle-orm';
import { createLogger } from '../lib/logger.js';
import { db } from '../db/index.js';
import { listings, items, sellerProfiles, disclaimerAcceptances, users, notifications } from '../db/schema.js';
import { shouldAutoEnd } from '../lib/gtc-renewal.js';
import { CURRENT_DISCLAIMER_VERSION } from '@portage/shared';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { EbayAdapter, resolveEbayCategoryId } from '../marketplace/ebay-adapter.js';
import { ensureItemEbaySku } from '../marketplace/ebay-sku.js';
import { toEbayWeight, toEbayDimensions } from '../lib/shipping-units.js';
import { applyFooter, descriptionLimitFor } from '../lib/footer.js';
import { EtsyAdapter } from '../marketplace/etsy-adapter.js';
import { ReverbAdapter } from '../marketplace/reverb-adapter.js';
import type { MarketplaceAdapter, ReverbCacheEntry } from '@portage/shared';

const logger = createLogger('listings');

/**
 * Inject the item's stored package weight/dimensions into marketplaceSpecific in
 * the eBay shape. Item columns are the single source of truth (populated by the
 * listing flow / edit page), so this runs on EVERY eBay publish path — including
 * photo-first/seeded drafts that never carried weight — to clear error 25020.
 * Ephemeral: the merged object is passed to the adapter, never persisted to the
 * listing row.
 */
type ItemShipping = {
  weightOz: number | null;
  lengthIn: number | null;
  widthIn: number | null;
  heightIn: number | null;
  ebayPackageType: string | null;
};
export function mergeItemShipping(
  item: ItemShipping,
  specific: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const merged = { ...(specific ?? {}) };
  if (item.weightOz != null) merged.weight = toEbayWeight(item.weightOz);
  if (item.lengthIn != null && item.widthIn != null && item.heightIn != null) {
    merged.dimensions = toEbayDimensions(item.lengthIn, item.widthIn, item.heightIn);
  }
  if (item.ebayPackageType) merged.packageType = item.ebayPackageType;
  return merged;
}

/**
 * Carry the item's stored eBay aspects into marketplaceSpecific so every publish
 * path sends the specifics captured at scan/prepare — the aspect pop-up never
 * re-asks for data already on the item (error 25002). Client-supplied aspects win
 * key-by-key (an AspectFillSheet retry overrides the stored value); item.aspects
 * fills the rest. Ephemeral: the merged object goes to the adapter, not persisted.
 */
export function mergeItemAspects(
  item: { aspects?: Record<string, string[]> | null },
  specific: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const ms = { ...(specific ?? {}) };
  const itemAspects = (item.aspects as Record<string, string[]> | null) ?? {};
  const clientAspects = (ms.aspects as Record<string, string[]> | undefined) ?? {};
  ms.aspects = { ...itemAspects, ...clientAspects };
  return ms;
}

/** First MPN value from a merged aspects bag, for the adapter's product.mpn. */
function mpnFromAspects(specific: Record<string, unknown> | undefined): string | undefined {
  return (specific?.aspects as Record<string, string[]> | undefined)?.MPN?.[0];
}

/**
 * Inject the seller's ship-from origin ZIP from their profile when the request
 * carries none — a body-provided value wins, the profile only fills the gap. The
 * Trading API needs OriginatingPostalCode for inline calculated shipping; there are
 * no Business-Policy IDs to resolve anymore (the account is opted out of them).
 */
async function applyShipFromOrigin(
  userId: string,
  specific: Record<string, unknown> | undefined,
): Promise<Record<string, unknown> | undefined> {
  const ms = (specific ?? {}) as Record<string, unknown>;
  if (ms.originPostalCode) return specific;
  const [profile] = await db.select()
    .from(sellerProfiles)
    .where(eq(sellerProfiles.userId, userId))
    .limit(1);
  // seller_profiles.shipFromAddress stores the ZIP under `zip` (FE form + schema);
  // `postalCode` is a fallback for any legacy/eBay-pulled shape.
  const shipFrom = profile?.shipFromAddress as { zip?: string; postalCode?: string } | null | undefined;
  return { ...ms, originPostalCode: shipFrom?.zip ?? shipFrom?.postalCode };
}

function getAdapter(userId: string, marketplace: 'ebay' | 'etsy' | 'reverb'): MarketplaceAdapter {
  switch (marketplace) {
    case 'ebay': return new EbayAdapter(userId);
    case 'etsy': return new EtsyAdapter(userId);
    // Per-user PAT resolved lazily inside the adapter (REVERB_SETUP_REQUIRED when
    // not connected). The global REVERB_API_TOKEN env var remains in use only for
    // seller-agnostic comps reads (ReverbAdapter.searchComps).
    case 'reverb': return new ReverbAdapter(userId);
  }
}

/**
 * Reverb sibling of the eBay self-heal block: fill publish specifics from the
 * item's prepare-time cache (client-supplied keys win) and the seller profile.
 * The profile OWNS offersEnabled — the web sends a hardcoded default, never a
 * user choice, so a client value must not override profile intent.
 */
async function applyReverbEnrichment(
  userId: string,
  item: { id: string; title: string; category: string | null; marketplaceData: unknown },
  adapter: MarketplaceAdapter,
  specific: Record<string, unknown> | undefined,
): Promise<{ specific: Record<string, unknown>; warning?: string }> {
  const ms = { ...(specific ?? {}) };
  const cache = (item.marketplaceData as { reverb?: ReverbCacheEntry } | null)?.reverb;
  if (!ms.categoryUuid && cache?.categoryUuid) ms.categoryUuid = cache.categoryUuid;
  if (!ms.conditionUuid && cache?.conditionUuid) ms.conditionUuid = cache.conditionUuid;
  if (!ms.year && cache?.year) ms.year = cache.year;
  if (!ms.finish && cache?.finish) ms.finish = cache.finish;

  const [profile] = await db.select()
    .from(sellerProfiles)
    .where(eq(sellerProfiles.userId, userId))
    .limit(1);
  const rates = (profile?.reverbDefaultShipping as { rates?: unknown[] } | null)?.rates;
  if (!ms.shippingRates && rates && rates.length > 0) ms.shippingRates = rates;
  if (profile) ms.offersEnabled = profile.reverbOffersEnabled ?? true;

  // Never-prepared items carry no cached category. A Reverb publish without one
  // silently lands wrong (or fails at publish) — guess via category search and
  // persist the guess so the next publish is instant, mirroring the eBay
  // resolveEbayCategoryId self-heal. Surface the guess as a warning.
  let warning: string | undefined;
  if (!ms.categoryUuid) {
    const cats = await adapter.searchCategories(item.category || item.title);
    if (cats.length === 0) {
      throw new AppError(422, 'REVERB_CATEGORY_REQUIRED',
        'No Reverb category could be resolved for this item. Run Prepare Listing or set a category, then publish again.');
    }
    ms.categoryUuid = cats[0].id;
    warning = `Reverb category guessed from search: ${cats[0].name}`;
    const md = (item.marketplaceData as Record<string, unknown> | null) ?? {};
    const prev = (md.reverb as ReverbCacheEntry | undefined) ?? {
      categoryUuid: null, categoryName: null, conditionUuid: null,
      conditionName: null, year: null, finish: null, cachedAt: '',
    };
    try {
      await db.update(items)
        .set({
          marketplaceData: { ...md, reverb: { ...prev, categoryUuid: cats[0].id, categoryName: cats[0].name, cachedAt: new Date().toISOString() } },
          updatedAt: new Date(),
        })
        .where(eq(items.id, item.id));
      logger.info({ userId, itemId: item.id, categoryUuid: cats[0].id }, 'Reverb category auto-resolved at publish');
    } catch (cacheErr) {
      // Persist-back is a next-time optimization — the resolved category is
      // already in memory, so a cache-write blip must not abort this publish.
      logger.warn({ userId, itemId: item.id, error: (cacheErr as Error).message }, 'Reverb category persist-back failed — publishing with in-memory category');
    }
  }
  return { specific: ms, warning };
}

const createListingSchema = z.object({
  itemId: z.string().uuid(),
  marketplace: z.enum(['ebay', 'etsy', 'reverb']),
  price: z.number().positive(),
  currency: z.string().length(3).default('USD'),
  publishImmediately: z.boolean().default(false),
  publishMode: z.enum(['draft', 'live', 'ebay_draft']).optional(),
  marketplaceSpecificFields: z.record(z.unknown()).optional(),
  // R3 idempotency: a client-supplied key that is stable across retries of the same
  // publish intent. When present, a partial unique index serializes concurrent/retried
  // submits so a non-idempotent AddFixedPriceItem can't double-list. Server generates
  // one when absent (gives orphan protection via insert-first, no cross-retry dedup).
  idempotencyKey: z.string().min(1).max(255).optional(),
  // F3a: the seller reviewed + accepted the terms sheet for this live publish.
  // The disclaimer version is stamped server-side (CURRENT) — never trusted from
  // the client — so the legal record reflects the terms actually in force.
  disclaimerAccepted: z.boolean().default(false),
  // F3b: the seller ticked "don't show the terms sheet for 7 days" — a display
  // preference only; consent is still recorded per-listing above.
  suppress7d: z.boolean().default(false),
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

// GTC listings renew monthly with an insertion fee each cycle. When the seller
// opts in, end active eBay listings just before their renewal anniversary.
listingsRouter.post('/gtc-sweep', async (req, res, next) => {
  try {
    const userId = req.user!.sub;

    const [profile] = await db.select()
      .from(sellerProfiles)
      .where(eq(sellerProfiles.userId, userId))
      .limit(1);

    if (!profile?.gtcAutoEnd) {
      res.json({ enabled: false, checked: 0, ended: 0, errors: [] });
      return;
    }

    const candidates = await db.select()
      .from(listings)
      .where(and(
        eq(listings.userId, userId),
        eq(listings.marketplace, 'ebay'),
        eq(listings.status, 'active'),
      ));

    const now = new Date();
    const adapter = new EbayAdapter(userId);
    let ended = 0;
    let checked = 0;
    const errors: Array<{ listingId: string; error: string }> = [];

    for (const listing of candidates) {
      if (!listing.marketplaceListingId || !listing.publishedAt) continue;
      checked += 1;
      if (!shouldAutoEnd(listing.publishedAt, now)) continue;

      try {
        await adapter.deleteListing(listing.marketplaceListingId);
        await db.update(listings)
          .set({ status: 'archived', updatedAt: now })
          .where(eq(listings.id, listing.id));
        try {
          await db.insert(notifications).values({
            userId,
            type: 'listing_expiry',
            title: 'Listing ended before GTC renewal',
            body: `Ended eBay listing ${listing.marketplaceListingId} ahead of its monthly Good 'Til Cancelled renewal to avoid the insertion fee. Relist any time from the listing page.`,
            referenceType: 'listing',
            referenceId: listing.id,
          });
        } catch (notifyErr) {
          logger.warn({ err: notifyErr, listingId: listing.id }, 'GTC sweep: notification insert failed');
        }
        ended += 1;
      } catch (endErr) {
        const message = endErr instanceof Error ? endErr.message : String(endErr);
        logger.warn({ err: endErr, listingId: listing.id }, 'GTC sweep: EndFixedPriceItem failed');
        errors.push({ listingId: listing.id, error: message });
      }
    }

    logger.info({ userId, checked, ended, failed: errors.length }, 'GTC sweep completed');
    res.json({ enabled: true, checked, ended, errors });
  } catch (err) {
    next(err);
  }
});

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

// F-GATE: read back the live eBay state (item specifics incl. MPN + the offer) for a
// listing's SKU, so a publish / eBay-draft can be verified in-app. A standalone tsx
// script deadlocks on token refresh, so this runs in-process under the seller's auth.
listingsRouter.get('/:id/ebay-offer', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const [listing] = await db.select()
      .from(listings)
      .where(and(eq(listings.id, req.params.id), eq(listings.userId, userId)))
      .limit(1);

    if (!listing) throw new AppError(404, 'NOT_FOUND', 'Listing not found');

    // Trade-First: GetItem is keyed by the Trading ItemID (marketplaceListingId).
    // A listing that was never published to eBay has no ItemID — report not-found
    // rather than calling eBay with an empty id.
    if (!listing.marketplaceListingId) {
      res.json({ sku: listing.ebaySku ?? null, found: false, aspects: {}, mpn: null, brand: null, status: null, listingId: null, price: null });
      return;
    }

    const adapter = new EbayAdapter(userId);
    const verification = await adapter.getEbayItemVerification(listing.marketplaceListingId);
    res.json(verification);
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

    // publishMode (when present) takes precedence over the legacy publishImmediately
    // flag. Only 'live' (or legacy publishImmediately) calls eBay. Both 'draft' and
    // 'ebay_draft' stay DB-only: under the Trading API a listing publishes live via
    // AddFixedPriceItem with no unpublished-offer concept, so an "eBay draft" is just
    // a local draft (N1) — no marketplace call.
    const shouldPublish = body.publishMode === 'live' || (body.publishMode === undefined && body.publishImmediately);

    // R3 insert-first: persist the row BEFORE any eBay call so a crash/throw between
    // the AddFixedPriceItem 200 and the DB write cannot orphan a live listing. The row
    // starts as a draft with a null marketplaceListingId and an idempotency key; a
    // successful publish UPDATEs it in place below. The partial unique index on
    // (userId, idempotencyKey) serializes concurrent submits that share a key.
    const idempotencyKey = body.idempotencyKey ?? randomUUID();
    let listing: typeof listings.$inferSelect;
    try {
      [listing] = await db.insert(listings).values({
        itemId: body.itemId,
        userId,
        marketplace: body.marketplace,
        marketplaceListingId: null,
        ebaySku: null,
        ebayOfferId: null,
        marketplaceSpecificFields: body.marketplaceSpecificFields ?? null,
        status: 'draft',
        price: body.price,
        currency: body.currency,
        publishedAt: null,
        idempotencyKey,
      }).returning();
    } catch (e) {
      // A duplicate (userId, idempotencyKey) means a concurrent or retried submit already
      // created this listing (R3). The partial unique index is what raises 23505 before
      // any AddFixedPriceItem call. A row that already reached the marketplace (or a
      // draft-mode submit) replays as-is — never double-list. But a live-publish retry
      // against a row stuck as an unpublished draft (insert succeeded, adapter call
      // failed) must RESUME the publish: returning the stale draft would report a
      // silent no-op "success" to the client.
      if ((e as { code?: string }).code === '23505') {
        const [existing] = await db.select().from(listings)
          .where(and(eq(listings.userId, userId), eq(listings.idempotencyKey, idempotencyKey)))
          .limit(1);
        if (existing) {
          const resumable = shouldPublish && existing.status === 'draft' && !existing.marketplaceListingId;
          if (!resumable) return res.status(201).json(existing);
          // Refresh the stuck row from the retry body — the user may have edited
          // price/fields between attempts, and the publish below reads body.*.
          [listing] = await db.update(listings)
            .set({
              price: body.price,
              currency: body.currency,
              marketplaceSpecificFields: body.marketplaceSpecificFields ?? null,
              updatedAt: new Date(),
            })
            .where(eq(listings.id, existing.id))
            .returning();
        } else {
          throw e;
        }
      } else {
        throw e;
      }
    }

    let status: 'draft' | 'active' = 'draft';
    let adapterWarning: string | undefined;

    if (shouldPublish) {
      const adapter = getAdapter(userId, body.marketplace);
      const photos = (item.photos as Array<{ url: string; isPrimary?: boolean }>) ?? [];

      // Same self-heal as POST /:id/publish: resolve the eBay leaf category, fill
      // missing policy IDs/location from the seller profile, then merge item
      // weight/dimensions in eBay shape.
      let marketplaceSpecific = body.marketplaceSpecificFields;
      // Stable, serialized SKU minted once per item and reused on every publish.
      // Resolved BEFORE the adapter call so it persists even if publish throws —
      // the next attempt reuses it instead of churning a new inventory item (an
      // ATO "rapid listing" signal).
      let stableSku: string | undefined;
      if (body.marketplace === 'ebay') {
        const cat = await resolveEbayCategoryId(marketplaceSpecific, item);
        if (cat.categoryId) marketplaceSpecific = { ...(marketplaceSpecific ?? {}), categoryId: cat.categoryId };
        marketplaceSpecific = await applyShipFromOrigin(userId, marketplaceSpecific);
        marketplaceSpecific = mergeItemShipping(item, marketplaceSpecific);
        marketplaceSpecific = mergeItemAspects(item, marketplaceSpecific);
        stableSku = await ensureItemEbaySku(item);
      } else if (body.marketplace === 'reverb') {
        const enriched = await applyReverbEnrichment(userId, item, adapter, marketplaceSpecific);
        marketplaceSpecific = enriched.specific;
        adapterWarning = enriched.warning;
      }

      const [footerRow] = await db.select({ footer: sellerProfiles.defaultListingFooter })
        .from(sellerProfiles)
        .where(eq(sellerProfiles.userId, userId))
        .limit(1);

      const result = await adapter.createListing({
        title: item.title,
        description: applyFooter(item.description, footerRow?.footer, descriptionLimitFor(body.marketplace)),
        price: body.price,
        currency: body.currency,
        category: item.category,
        condition: item.condition,
        photos,
        quantity: item.quantity,
        brand: item.brand,
        model: item.model,
        mpn: mpnFromAspects(marketplaceSpecific),
        features: item.features as string[],
        marketplaceSpecific,
        ebaySku: stableSku,
      });

      // UPDATE the pre-inserted row with the eBay result. createListing already folds
      // Warning/PartialFailure into result (the ItemID is still present), so the row
      // reflects the live listing even on a non-fatal eBay warning.
      [listing] = await db.update(listings)
        .set({
          marketplaceListingId: result.marketplaceListingId,
          ebaySku: result.ebaySku ?? null,
          status: result.status === 'active' ? 'active' : 'draft',
          publishedAt: result.status === 'active' ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(listings.id, listing.id))
        .returning();
      status = listing.status as 'draft' | 'active';
      // Keep an enrichment warning (guessed category) even when the adapter
      // itself returned none — both matter to the seller.
      adapterWarning = [adapterWarning, result.warning].filter(Boolean).join('; ') || undefined;
    }

    logger.info({ userId, listingId: listing.id, marketplace: body.marketplace, status }, 'Listing created');

    // F3a: record the explicit disclaimer acceptance against the REAL listing id
    // (live publish only — drafts never show the terms sheet). Version is stamped
    // server-side from the shared constant, never trusted from the client.
    if (body.disclaimerAccepted && status === 'active') {
      const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
        || req.socket.remoteAddress
        || null;
      await db.insert(disclaimerAcceptances).values({
        userId,
        listingId: listing.id,
        disclaimerVersion: CURRENT_DISCLAIMER_VERSION,
        ipAddress: ipAddress?.slice(0, 45) ?? null,
      });

      // F3b: opt-in display suppression — skip the terms sheet for 7 days. Stamped
      // with the current version so a disclaimer bump voids it. Display-only; the
      // acceptance above is the consent record.
      if (body.suppress7d) {
        await db.update(users)
          .set({
            disclaimerSuppressUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            disclaimerSuppressVersion: CURRENT_DISCLAIMER_VERSION,
          })
          .where(eq(users.id, userId));
      }
    }

    const response: Record<string, unknown> = { ...listing };
    if (adapterWarning) {
      response.warning = adapterWarning;
    } else if (body.publishImmediately && status === 'draft') {
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
        // Trade-First: a published eBay listing is ended by EndFixedPriceItem
        // (deleteListing), keyed by the Trading ItemID = marketplaceListingId.
        // There is no separate offer to withdraw.
        await getAdapter(userId, existing.marketplace).deleteListing(existing.marketplaceListingId!);
      } catch (err) {
        // Best-effort: archive locally even if the marketplace call fails (e.g. the
        // offer was already ended). Surface a warning rather than blocking the archive.
        logger.warn({ listingId: existing.id, error: (err as Error).message }, 'Failed to remove from marketplace during archive');
        warning = 'Archived locally but failed to remove from the marketplace';
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
    // Sync edits (e.g. price) to the marketplace only for a published listing. Under
    // Trade-First an eBay "draft" is DB-only (no live listing), so there is nothing to
    // sync until it is published via AddFixedPriceItem.
    const ebaySyncId = updated.marketplaceListingId;
    const shouldSyncMarketplace = !isArchiving && updated.status === 'active' && !!ebaySyncId;
    if (shouldSyncMarketplace) {
      const [item] = await db.select()
        .from(items)
        .where(eq(items.id, updated.itemId))
        .limit(1);

      if (item) {
        try {
          const adapter = getAdapter(userId, updated.marketplace);
          const [profileRow] = await db.select({ footer: sellerProfiles.defaultListingFooter, shipFromAddress: sellerProfiles.shipFromAddress })
            .from(sellerProfiles)
            .where(eq(sellerProfiles.userId, userId))
            .limit(1);
          // mergeItemShipping too (not just aspects): a published eBay update must
          // re-send the package weight/dims or eBay rejects it (error 25020).
          let syncSpecific = mergeItemAspects(item, mergeItemShipping(item, updated.marketplaceSpecificFields as Record<string, unknown> | undefined));
          // A Trade-First content revise rebuilds the full Trading item body, which
          // needs the ship-from origin ZIP for inline calculated shipping — same
          // requirement as publish. Fill it from the seller profile when absent.
          if (updated.marketplace === 'ebay' && !syncSpecific.originPostalCode) {
            const shipFrom = profileRow?.shipFromAddress as { zip?: string; postalCode?: string } | null | undefined;
            const zip = shipFrom?.zip ?? shipFrom?.postalCode;
            if (zip) syncSpecific = { ...syncSpecific, originPostalCode: zip };
          }
          // Re-enrich on every reverb sync: the LIVE profile owns offersEnabled,
          // so a Settings change after publish propagates on the next edit
          // instead of being pinned to the publish-time stored value.
          if (updated.marketplace === 'reverb') {
            syncSpecific = (await applyReverbEnrichment(userId, item, adapter, syncSpecific)).specific;
          }
          const syncResult = await adapter.updateListing(ebaySyncId!, {
            title: item.title,
            description: applyFooter(item.description, profileRow?.footer, descriptionLimitFor(updated.marketplace)),
            price: updated.price,
            currency: updated.currency,
            condition: item.condition,
            quantity: item.quantity,
            brand: item.brand,
            model: item.model,
            photos: (item.photos as Array<{ url: string; isPrimary?: boolean }>) ?? [],
            features: item.features as string[],
            ebaySku: updated.ebaySku ?? undefined,
            marketplaceSpecific: syncSpecific,
          });
          // Degraded-sync warnings (e.g. Best Offer downgrade) belong to the user.
          if (syncResult?.warning) warning = syncResult.warning;
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

      // Self-heal eBay setup fields (policy IDs + inventory location) from the seller
      // profile. Drafts created without prepare-listing (seeded, photo-first, quick-list)
      // carry none of these, which publish requires; the profile is the source of truth.
      const ms = (marketplaceSpecific ?? {}) as Record<string, unknown>;
      const fp = ms.fulfillmentPolicyId as string | undefined;
      const pp = ms.paymentPolicyId as string | undefined;
      const rp = ms.returnPolicyId as string | undefined;
      const loc = ms.merchantLocationKey as string | undefined;
      if (!fp || !pp || !rp || !loc) {
        const [profile] = await db.select()
          .from(sellerProfiles)
          .where(eq(sellerProfiles.userId, userId))
          .limit(1);
        marketplaceSpecific = {
          ...ms,
          fulfillmentPolicyId: fp || profile?.ebayFulfillmentPolicyId || undefined,
          paymentPolicyId: pp || profile?.ebayPaymentPolicyId || undefined,
          returnPolicyId: rp || profile?.ebayReturnPolicyId || undefined,
          merchantLocationKey: loc || profile?.ebayMerchantLocationKey || undefined,
        };
      }

      // Inline calculated shipping needs OriginatingPostalCode — fill it from the
      // seller profile's ship-from when the draft carries none (a body/draft value
      // still wins). Without this a seeded/photo-first draft published here throws
      // EBAY_SHIP_FROM_REQUIRED (the create route does the same at POST /).
      marketplaceSpecific = await applyShipFromOrigin(userId, marketplaceSpecific);

      // Item columns are the source of truth for package weight/dimensions —
      // merge them in eBay shape so calculated-shipping publishes carry weight.
      marketplaceSpecific = mergeItemShipping(item, marketplaceSpecific);
      marketplaceSpecific = mergeItemAspects(item, marketplaceSpecific);
    }

    // Reverb sibling of the eBay self-heal above — cache + profile enrichment,
    // category-guess fallback with persist-back (same helper as POST /).
    let enrichWarning: string | undefined;
    if (listing.marketplace === 'reverb') {
      const enriched = await applyReverbEnrichment(userId, item, adapter, marketplaceSpecific);
      marketplaceSpecific = enriched.specific;
      enrichWarning = enriched.warning;
    }

    const [footerRow] = await db.select({ footer: sellerProfiles.defaultListingFooter })
      .from(sellerProfiles)
      .where(eq(sellerProfiles.userId, userId))
      .limit(1);

    const result = await adapter.createListing({
      title: item.title,
      description: applyFooter(item.description, footerRow?.footer, descriptionLimitFor(listing.marketplace)),
      price: listing.price,
      currency: listing.currency,
      category: item.category,
      condition: item.condition,
      photos,
      quantity: item.quantity,
      brand: item.brand,
      model: item.model,
      mpn: mpnFromAspects(marketplaceSpecific),
      features: item.features as string[],
      marketplaceSpecific,
      // Prefer the listing's own SKU when it already has one (a legacy draft whose
      // item column was never backfilled) — minting a fresh one would PUT a new
      // inventory_item but publish the OLD offer bound to the OLD SKU, orphaning
      // the new item. Only mint (via the item's stable SKU) when the listing has
      // none, so retries reuse it instead of churning inventory (an ATO signal).
      ebaySku: listing.marketplace === 'ebay'
        ? (listing.ebaySku ?? await ensureItemEbaySku(item))
        : (listing.ebaySku ?? undefined),
      // POST /:id/publish is always a live publish — state it explicitly.
      publishMode: 'live',
    });

    const [updated] = await db.update(listings)
      .set({
        marketplaceListingId: result.marketplaceListingId,
        ebaySku: result.ebaySku ?? null,
        status: result.status === 'active' ? 'active' : 'draft',
        publishedAt: result.status === 'active' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(and(eq(listings.id, listing.id), eq(listings.userId, userId)))
      .returning();

    if (result.status === 'active') {
      logger.info({ userId, listingId: updated.id, marketplaceListingId: result.marketplaceListingId }, 'Listing published');
    } else {
      logger.warn({ userId, listingId: updated.id, warning: result.warning }, 'Listing publish did not go live — saved as draft');
    }

    // Carry the adapter's warning (publish fell back to draft) and any
    // enrichment warning (guessed category) through to the client so a
    // non-active result is never presented as a successful publish.
    res.json({ ...updated, warning: [enrichWarning, result.warning].filter(Boolean).join('; ') || undefined });
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

    // Under Trade-First an eBay listing is either published (has a Trading ItemID =
    // marketplaceListingId) or a DB-only draft with nothing live to clean up.
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

    // Best-effort removal from marketplaces for active listings (Trade-First: a
    // DB-only eBay draft has no live listing to clean up).
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

    // Verify ownership
    const owned = await db.select({
      id: listings.id,
      status: listings.status,
      marketplace: listings.marketplace,
      marketplaceListingId: listings.marketplaceListingId,
      ebaySku: listings.ebaySku,
    })
      .from(listings)
      .where(and(inArray(listings.id, ids), eq(listings.userId, userId)));

    if (owned.length !== ids.length) {
      throw new AppError(403, 'FORBIDDEN', 'One or more listings do not belong to you');
    }

    // Only drafts/archived that were never published can be activated locally.
    // eBay AND Reverb are excluded: their drafts are DB-only (publish is a real
    // marketplace call — AddFixedPriceItem / POST /listings with publish:true),
    // so flipping them to "active" with no marketplace call would lie (G6).
    const PUBLISH_REQUIRED = ['ebay', 'reverb'];
    const activatable = owned.filter((l) =>
      (l.status === 'draft' || l.status === 'archived') && !l.marketplaceListingId && !PUBLISH_REQUIRED.includes(l.marketplace)
    );
    // DB-only drafts on publish-required marketplaces must be published
    // individually via the listing's Publish action (the publish call needs the
    // full item payload — there is no bulk publish). Never silent-activate (G6).
    const ebayNeedsPublish = owned.filter((l) =>
      PUBLISH_REQUIRED.includes(l.marketplace) && !l.marketplaceListingId && (l.status === 'draft' || l.status === 'archived')
    );
    // Archived marketplace listings need individual re-listing
    const skippedMarketplace = owned.filter((l) =>
      l.status === 'archived' && !!l.marketplaceListingId
    );

    let activated: { id: string }[] = [];
    if (activatable.length > 0) {
      const activatableIds = activatable.map((l) => l.id);
      activated = await db.update(listings)
        .set({ status: 'active', updatedAt: new Date() })
        .where(and(inArray(listings.id, activatableIds), eq(listings.userId, userId)))
        .returning({ id: listings.id });
    }

    logger.info({ userId, activated: activated.length, needsPublish: ebayNeedsPublish.length }, 'Bulk listings activated');
    const warnings: string[] = [];
    if (skippedMarketplace.length > 0) {
      warnings.push(`${skippedMarketplace.length} archived listing(s) were previously published to a marketplace and must be re-listed individually`);
    }
    if (ebayNeedsPublish.length > 0) {
      warnings.push(`${ebayNeedsPublish.length} draft(s) must be published individually — bulk activate cannot publish to eBay or Reverb`);
    }
    res.json({
      activated: true,
      count: activated.length,
      ids: activated.map((r) => r.id),
      skipped: skippedMarketplace.length,
      needsPublish: ebayNeedsPublish.length,
      warning: warnings.length > 0 ? warnings.join('; ') : undefined,
    });
  } catch (err) {
    next(err);
  }
});
