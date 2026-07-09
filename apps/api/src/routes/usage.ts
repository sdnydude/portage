import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { computeEffectiveTier, effectiveLimits } from '../lib/billing-utils.js';

export const usageRouter = Router();

usageRouter.use(requireAuth);

usageRouter.get('/', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const [user] = await db.select({
      aiScansThisMonth: users.aiScansThisMonth,
      aiListingsThisMonth: users.aiListingsThisMonth,
      aiListingCredits: users.aiListingCredits,
      bgRemovalsThisMonth: users.bgRemovalsThisMonth,
      subscriptionTier: users.subscriptionTier,
      trialEndsAt: users.trialEndsAt,
      limitOverrides: users.limitOverrides,
    }).from(users).where(eq(users.id, userId)).limit(1);

    if (!user) {
      throw new AppError(404, 'NOT_FOUND', 'User not found');
    }

    const effectiveTier = computeEffectiveTier(user.subscriptionTier, user.trialEndsAt);
    const limits = effectiveLimits(effectiveTier, user.limitOverrides);

    res.json({
      aiScans: { used: user.aiScansThisMonth, limit: limits.aiScansPerMonth },
      aiListings: { used: user.aiListingsThisMonth, limit: limits.aiListingsPerMonth, credits: user.aiListingCredits },
      bgRemovals: { used: user.bgRemovalsThisMonth, limit: limits.bgRemovalsPerMonth },
      tier: effectiveTier,
    });
  } catch (err) {
    next(err);
  }
});

usageRouter.post('/bg-removal', async (req, res, next) => {
  try {
    const userId = req.user!.sub;

    const [bgUser] = await db.select({
      subscriptionTier: users.subscriptionTier,
      trialEndsAt: users.trialEndsAt,
      bgRemovalsThisMonth: users.bgRemovalsThisMonth,
      limitOverrides: users.limitOverrides,
    }).from(users).where(eq(users.id, userId)).limit(1);

    if (!bgUser) throw new AppError(404, 'NOT_FOUND', 'User not found');

    const tier = computeEffectiveTier(bgUser.subscriptionTier, bgUser.trialEndsAt);
    const limit = effectiveLimits(tier, bgUser.limitOverrides).bgRemovalsPerMonth;
    const allowed = limit === null || bgUser.bgRemovalsThisMonth < limit;

    res.json({
      allowed,
      remaining: limit === null ? null : Math.max(0, limit - bgUser.bgRemovalsThisMonth),
      limit,
      used: bgUser.bgRemovalsThisMonth,
    });
  } catch (err) {
    next(err);
  }
});
