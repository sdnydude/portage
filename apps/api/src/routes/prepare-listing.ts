import { Router } from 'express';
import { z } from 'zod';
import { eq, and, sql } from 'drizzle-orm';
import { createLogger } from '../lib/logger.js';
import { db } from '../db/index.js';
import { items, sellerProfiles, users } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { EbayAdapter } from '../marketplace/ebay-adapter.js';
import { ReverbAdapter } from '../marketplace/reverb-adapter.js';
import { generateListingFields } from '../lib/vision.js';
import { computeEffectiveTier } from '../lib/billing-utils.js';
import { FREE_TIER_LIMITS, PRO_TIER_LIMITS } from '@portage/shared';
import type { PreparedListingData, PricingData, CompResult, ReverbCompResult } from '@portage/shared';

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
    }).from(users).where(eq(users.id, userId)).limit(1);

    if (!billingUser) throw new AppError(401, 'UNAUTHORIZED', 'User not found');

    // C3: Monthly reset check
    const now = new Date();
    const resetAt = billingUser.scanCountResetAt;
    if (resetAt.getMonth() !== now.getMonth() || resetAt.getFullYear() !== now.getFullYear()) {
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
    const limit = effectiveTier === 'pro'
      ? PRO_TIER_LIMITS.aiListingsPerMonth
      : FREE_TIER_LIMITS.aiListingsPerMonth;

    // C2: Atomic reserve — try monthly allocation first
    const reserved = await db.update(users)
      .set({ aiListingsThisMonth: sql`${users.aiListingsThisMonth} + 1` })
      .where(and(
        eq(users.id, userId),
        sql`${users.aiListingsThisMonth} < ${limit}`,
      ))
      .returning({ aiListingsThisMonth: users.aiListingsThisMonth });

    let usedCredit = false;
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

    const [ebayCompsResult, aspectsResult, reverbCompsResult] = await Promise.allSettled([
      EbayAdapter.searchComps(searchQuery, categorySuggestion?.categoryId),
      categorySuggestion
        ? EbayAdapter.getRequiredAspects(categorySuggestion.categoryId)
        : Promise.resolve({}),
      targetMarketplaces.includes('reverb')
        ? ReverbAdapter.searchComps(searchQuery)
        : Promise.resolve({ listings: [], stats: { median: null, avg: null, sampleSize: 0 } }),
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
      : { listings: [], stats: { median: null, avg: null, sampleSize: 0 } };
    const requiredAspects = aspectsResult.status === 'fulfilled'
      ? aspectsResult.value as Record<string, { required: boolean; values: string[] | null }>
      : {};

    const currency = profile?.defaultCurrency ?? 'USD';

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

    const ebayFields = aiFields.ebay ? {
      ...aiFields.ebay,
      fulfillmentPolicyId: profile?.ebayFulfillmentPolicyId ?? '',
      paymentPolicyId: profile?.ebayPaymentPolicyId ?? '',
      returnPolicyId: profile?.ebayReturnPolicyId ?? '',
      merchantLocationKey: profile?.ebayMerchantLocationKey ?? 'default',
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
