import { Router } from 'express';
import { z } from 'zod';
import { eq, and, sql } from 'drizzle-orm';
import { createLogger } from '../lib/logger.js';
import { computePriceBands } from '../lib/pricing.js';
import { db } from '../db/index.js';
import { items, sellerProfiles, users } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { EbayAdapter, resolveEbayCategoryCondition } from '../marketplace/ebay-adapter.js';
import { ReverbAdapter } from '../marketplace/reverb-adapter.js';
import { generateListingFields } from '../lib/vision.js';
import { computeEffectiveTier, effectiveLimits } from '../lib/billing-utils.js';
import { limitsForTier } from '@portage/shared';
import type { PreparedListingData, PricingData, CompResult, ReverbCompResult, MarketplaceCacheEntry, ReverbCacheEntry } from '@portage/shared';

const logger = createLogger('prepare-listing');

export const prepareListingRouter = Router();

prepareListingRouter.use(requireAuth);

const prepareSchema = z.object({
  targetMarketplaces: z.array(z.enum(['ebay', 'reverb'])).min(1),
});

export const EBAY_CONDITION_MAP: Record<string, string> = {
  new: 'NEW',
  like_new: 'LIKE_NEW',
  good: 'GOOD',
  fair: 'GOOD',
  poor: 'ACCEPTABLE',
};

export const EBAY_CONDITION_ORDER = ['NEW', 'LIKE_NEW', 'VERY_GOOD', 'GOOD', 'ACCEPTABLE'];

/**
 * Cache entries merged into items.marketplace_data after a prepare run. The
 * ebay entry always writes (category self-heal depends on it); the reverb
 * entry writes only when the AI produced reverb fields (music gear), so a
 * non-gear prepare never clobbers an earlier gear scan's slot.
 */
export function buildMarketplaceCacheEntries(
  aiFields: {
    ebay?: { categoryId?: string | null; categoryName?: string | null; title?: string | null } | null;
    reverb?: {
      categoryUuid?: string | null; categoryName?: string | null;
      conditionUuid?: string | null; conditionName?: string | null;
      year?: string | null; finish?: string | null;
    } | null;
  },
  categorySuggestion: { categoryId: string; categoryName: string } | null,
): { ebay: MarketplaceCacheEntry; reverb?: ReverbCacheEntry } {
  const entries: { ebay: MarketplaceCacheEntry; reverb?: ReverbCacheEntry } = {
    ebay: {
      categoryId: categorySuggestion?.categoryId ?? aiFields.ebay?.categoryId ?? null,
      categoryName: categorySuggestion?.categoryName ?? aiFields.ebay?.categoryName ?? null,
      title: aiFields.ebay?.title ?? null,
      cachedAt: new Date().toISOString(),
    },
  };
  if (aiFields.reverb) {
    entries.reverb = {
      categoryUuid: aiFields.reverb.categoryUuid ?? null,
      categoryName: aiFields.reverb.categoryName ?? null,
      conditionUuid: aiFields.reverb.conditionUuid ?? null,
      conditionName: aiFields.reverb.conditionName ?? null,
      year: aiFields.reverb.year ?? null,
      finish: aiFields.reverb.finish ?? null,
      cachedAt: new Date().toISOString(),
    };
  }
  return entries;
}

/**
 * The vision prompt asks the model for Reverb categoryUuid/conditionUuid with
 * no list of valid values, so it invents them. An invented UUID either 422s at
 * Reverb or (when blank) falls through to the publish-time category guess.
 * Keep an AI UUID only when it exists in the real list; otherwise resolve by
 * name against the live condition list / category search, else blank the pair
 * so downstream treats it as unresolved rather than trusting a hallucination.
 */
export function sanitizeReverbAiFields<T extends {
  categoryUuid?: string | null; categoryName?: string | null;
  conditionUuid?: string | null; conditionName?: string | null;
}>(
  ai: T,
  validConditions: Array<{ uuid: string; displayName: string }>,
  categoryMatches: Array<{ id: string; name: string }>,
): T {
  const condition = validConditions.find(c => c.uuid === ai.conditionUuid)
    ?? validConditions.find(c => c.displayName.toLowerCase() === (ai.conditionName ?? '').toLowerCase());
  const category = categoryMatches.find(c => c.id === ai.categoryUuid) ?? categoryMatches[0];
  return {
    ...ai,
    categoryUuid: category?.id ?? '',
    categoryName: category?.name ?? '',
    conditionUuid: condition?.uuid ?? '',
    conditionName: condition?.displayName ?? '',
  };
}

/**
 * A degraded comps result means the Reverb API call itself failed — the empty
 * list is "couldn't ask", not "no comparable listings", and pricing built on
 * it deserves a seller-visible caveat.
 */
export function reverbCompsWarning(comps: ReverbCompResult): string | undefined {
  return comps.degraded ? 'Reverb comps search failed — pricing may be less accurate' : undefined;
}

/** Cache-write-failure warning that names every marketplace whose data was lost. */
export function cacheFailWarning(entries: { ebay: MarketplaceCacheEntry; reverb?: ReverbCacheEntry }): string {
  const names = [entries.ebay && 'eBay', entries.reverb && 'Reverb'].filter(Boolean).join(' + ');
  return `${names} category data could not be saved — re-run prepare before publishing`;
}

export function conditionNeighbors(condition: string): string[] {
  const idx = EBAY_CONDITION_ORDER.indexOf(condition);
  if (idx === -1) return EBAY_CONDITION_ORDER;
  const result = [condition];
  if (idx > 0) result.push(EBAY_CONDITION_ORDER[idx - 1]);
  if (idx < EBAY_CONDITION_ORDER.length - 1) result.push(EBAY_CONDITION_ORDER[idx + 1]);
  return result;
}

export function computePricing(
  soldComps: Array<{ price: number; condition: string }>,
  aiCondition: string,
  currency: string,
  opts: { suggestPercentile?: number; floorPercentile?: number } = {},
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
      // Same "no floor" encoding as the engine path — null, never omitted.
      bestOfferFloor: null,
    };
  }

  // Bands from the condition-selected pool via the shared engine (R-7,
  // round-once, undercut-at-p50) — pool is non-empty here, so bands exist.
  const bands = computePriceBands(pool.map(p => p.price), {
    suggestPercentile: opts.suggestPercentile,
    floorPercentile: opts.floorPercentile,
  });
  if (!bands) throw new Error('unreachable: pool verified non-empty above');

  const confidence = conditionMatch === 'exact' ? 'high' : conditionMatch === 'nearby' ? 'medium' : 'low';

  return {
    suggested: bands.suggested,
    low: bands.p25,
    high: bands.p75,
    currency,
    confidence,
    basedOn: bands.basedOn,
    conditionMatch,
    bestOfferFloor: bands.floor,
  };
}

prepareListingRouter.post('/:id/prepare-listing', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const itemId = req.params.id;
    const { targetMarketplaces } = prepareSchema.parse(req.body);

    // Validate item exists before billing gate — prevents credit leak on 404
    const [item] = await db.select().from(items).where(eq(items.id, itemId)).limit(1);
    if (!item || item.userId !== userId) {
      throw new AppError(404, 'NOT_FOUND', 'Item not found');
    }

    const [profile] = await db.select().from(sellerProfiles)
      .where(eq(sellerProfiles.userId, userId)).limit(1);

    // --- Billing gate (C4: query DB directly, not JWT) ---
    const [billingUser] = await db.select({
      subscriptionTier: users.subscriptionTier,
      trialEndsAt: users.trialEndsAt,
      aiListingsThisMonth: users.aiListingsThisMonth,
      aiListingCredits: users.aiListingCredits,
      scanCountResetAt: users.scanCountResetAt,
      limitOverrides: users.limitOverrides,
    }).from(users).where(eq(users.id, userId)).limit(1);

    if (!billingUser) throw new AppError(401, 'UNAUTHORIZED', 'User not found');

    // C3: Monthly reset check
    const now = new Date();
    const resetAt = billingUser.scanCountResetAt;
    if (resetAt.getUTCMonth() !== now.getUTCMonth() || resetAt.getUTCFullYear() !== now.getUTCFullYear()) {
      await db.update(users)
        .set({
          aiListingsThisMonth: 0,
          aiScansThisMonth: 0,
          bgRemovalsThisMonth: 0,
          scanCountResetAt: now,
        })
        .where(eq(users.id, userId));
      billingUser.aiListingsThisMonth = 0;
    }

    const effectiveTier = computeEffectiveTier(billingUser.subscriptionTier, billingUser.trialEndsAt);
    const limit = effectiveLimits(effectiveTier, billingUser.limitOverrides).aiListingsPerMonth;

    // C2: Atomic reserve — try monthly allocation first. A null limit means
    // UNLIMITED (pro/beta tiers): it must skip the SQL ceiling entirely —
    // `count < NULL` is NULL, so the conditional reserve matches no row and
    // unlimited read as zero (live 429 "(null/month)" repro 2026-07-21).
    let usedCredit = false;
    if (limit === null) {
      await db.update(users)
        .set({ aiListingsThisMonth: sql`${users.aiListingsThisMonth} + 1` })
        .where(eq(users.id, userId))
        .returning({ aiListingsThisMonth: users.aiListingsThisMonth });
    } else {
    const reserved = await db.update(users)
      .set({ aiListingsThisMonth: sql`${users.aiListingsThisMonth} + 1` })
      .where(and(
        eq(users.id, userId),
        sql`${users.aiListingsThisMonth} < ${limit}`,
      ))
      .returning({ aiListingsThisMonth: users.aiListingsThisMonth });

    if (reserved.length === 0) {
      // Monthly limit hit — try credit path
      const credited = await db.update(users)
        .set({ aiListingCredits: sql`${users.aiListingCredits} - 1` })
        .where(and(
          eq(users.id, userId),
          sql`${users.aiListingCredits} > 0`,
        ))
        .returning({ aiListingCredits: users.aiListingCredits });

      if (credited.length === 0) {
        throw new AppError(429, 'LIMIT_REACHED', `AI listing limit reached (${limit}/month). Upgrade or buy credits.`);
      }
      usedCredit = true;
    }
    }
    // --- End billing gate ---

    const warnings: string[] = [];
    if (!profile) {
      warnings.push('Seller profile incomplete — set up business policies before publishing');
    }

    const photos = (item.photos as Array<{ url: string }>) ?? [];
    const photoUrls = photos.map(p => p.url);
    const searchQuery = item.title || [item.brand, item.model].filter(Boolean).join(' ');

    let categorySuggestion: { categoryId: string; categoryName: string } | null = null;
    try {
      categorySuggestion = await EbayAdapter.getCategorySuggestion(searchQuery);
    } catch (err) {
      logger.warn({ searchQuery, error: (err as Error).message }, 'Category suggestion failed — searching without category');
    }

    const [ebayCompsResult, aspectsResult, reverbCompsResult, validConditionsResult] = await Promise.allSettled([
      EbayAdapter.searchComps(searchQuery, categorySuggestion?.categoryId),
      categorySuggestion
        ? EbayAdapter.getRequiredAspects(categorySuggestion.categoryId)
        : Promise.resolve({}),
      targetMarketplaces.includes('reverb')
        ? ReverbAdapter.searchComps(searchQuery)
        : Promise.resolve({ listings: [], stats: { median: null, avg: null, sampleSize: 0 } }),
      categorySuggestion
        ? EbayAdapter.getValidConditions(categorySuggestion.categoryId)
        : Promise.resolve([] as string[]),
    ]);

    if (ebayCompsResult.status === 'rejected') {
      logger.warn({ error: (ebayCompsResult.reason as Error).message, searchQuery }, 'eBay comps fetch failed');
    }
    if (reverbCompsResult.status === 'rejected') {
      logger.warn({ error: (reverbCompsResult.reason as Error).message, searchQuery }, 'Reverb comps fetch failed');
    }
    if (aspectsResult.status === 'rejected') {
      logger.warn({ error: (aspectsResult.reason as Error).message, categoryId: categorySuggestion?.categoryId }, 'Required aspects fetch failed');
    }

    const ebayComps: CompResult = ebayCompsResult.status === 'fulfilled'
      ? ebayCompsResult.value
      : { sold: [], active: [], stats: { soldMedian: null, soldAvg: null, activeMedian: null, activeAvg: null, sampleSize: 0 } };
    const reverbComps: ReverbCompResult = reverbCompsResult.status === 'fulfilled'
      ? reverbCompsResult.value
      : { listings: [], stats: { median: null, avg: null, sampleSize: 0 }, degraded: true };
    const compsWarning = reverbCompsWarning(reverbComps);
    if (compsWarning) warnings.push(compsWarning);
    const requiredAspects = aspectsResult.status === 'fulfilled'
      ? aspectsResult.value as Record<string, { required: boolean; values: string[] | null }>
      : {};

    const currency = profile?.defaultCurrency ?? 'USD';

    // The AI must pick the Reverb category FROM Reverb's real flat list —
    // free-text names/invented uuids don't resolve. Cached 24h, public
    // endpoint; a fetch failure just omits the list (sanitize still guards).
    let reverbCategories: string[] | undefined;
    if (targetMarketplaces.includes('reverb')) {
      try {
        reverbCategories = (await ReverbAdapter.getFlatCategories()).map(c => c.fullName);
      } catch (catErr) {
        logger.warn({ userId, itemId, error: (catErr as Error).message }, 'Reverb flat-category fetch failed — AI runs without the list');
      }
    }

    let aiFields;
    try {
      aiFields = await generateListingFields({
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
      reverbCategories,
    });
    } catch (aiError) {
      // I2: Rollback reservation on AI failure — user not charged for failed calls
      if (usedCredit) {
        await db.update(users)
          .set({ aiListingCredits: sql`${users.aiListingCredits} + 1` })
          .where(eq(users.id, userId));
      } else {
        await db.update(users)
          .set({ aiListingsThisMonth: sql`${users.aiListingsThisMonth} - 1` })
          .where(eq(users.id, userId));
      }
      throw aiError;
    }

    // Validate the AI's Reverb uuids against the live lists BEFORE they enter
    // the cache or the response — hallucinated uuids must never persist. On a
    // lookup failure (e.g. Reverb not connected) blank them instead: publish
    // will 422 with guidance rather than send an invented uuid.
    if (aiFields.reverb) {
      try {
        const [reverbConditions, reverbCats] = await Promise.all([
          ReverbAdapter.getConditions(),
          new ReverbAdapter(userId).searchCategories(
            aiFields.reverb.categoryName || item.category || item.title,
          ),
        ]);
        aiFields.reverb = sanitizeReverbAiFields(aiFields.reverb, reverbConditions, reverbCats);
      } catch (reverbErr) {
        logger.warn({ userId, itemId, error: (reverbErr as Error).message }, 'Reverb uuid validation failed — blanking AI-supplied uuids');
        aiFields.reverb = { ...aiFields.reverb, categoryUuid: '', conditionUuid: '' };
        warnings.push('Reverb category/condition could not be validated — pick them on the listing before publishing to Reverb.');
      }
    }

    const cacheEntries = buildMarketplaceCacheEntries(aiFields, categorySuggestion);

    try {
      await db.update(items)
        .set({
          marketplaceData: sql`COALESCE(marketplace_data, '{}'::jsonb) || ${JSON.stringify(cacheEntries)}::jsonb`,
          updatedAt: new Date(),
        })
        .where(eq(items.id, itemId));
    } catch (cacheErr) {
      logger.warn({ itemId, error: (cacheErr as Error).message }, 'Failed to cache marketplace data');
      warnings.push(cacheFailWarning(cacheEntries));
    }

    const soldWithCondition = ebayComps.sold.map(s => ({
      price: s.price,
      condition: s.condition,
    }));
    const pricing = computePricing(soldWithCondition, aiFields.condition, currency, {
      suggestPercentile: profile?.pricingSuggestPercentile,
      floorPercentile: profile?.pricingFloorPercentile,
    });

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

    // T6: per-category condition auto-correct. eBay validates condition against
    // the category's allowed set at publish; the static CONDITION_MAP default
    // isn't valid in every category (esp. media/apparel). When the category's
    // supported conditions are known, snap to the closest supported grade and
    // surface any deviation as a warning.
    const validConditionIds = validConditionsResult.status === 'fulfilled' ? validConditionsResult.value : [];
    const conditionFix = aiFields.ebay
      ? resolveEbayCategoryCondition(aiFields.condition, validConditionIds)
      : {};
    if (conditionFix.warning) warnings.push(conditionFix.warning);

    // Opted-in Best Offer with no usable floor (n<3 or inversion) degrades
    // silently at publish otherwise — tell the seller at prepare time.
    if (aiFields.ebay && profile?.bestOfferAutoAcceptEnabled && !pricing.bestOfferFloor) {
      warnings.push('Too few comparable sales to set a Best Offer auto-accept floor — the listing will publish without one.');
    }

    const ebayFields = aiFields.ebay ? {
      ...aiFields.ebay,
      ...(conditionFix.condition ? { condition: conditionFix.condition } : {}),
      ...(profile?.bestOfferAutoAcceptEnabled && pricing.bestOfferFloor
        ? { bestOfferAutoAcceptPrice: pricing.bestOfferFloor }
        : {}),
    } : null;

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
      listingFooter: profile?.defaultListingFooter ?? null,
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
