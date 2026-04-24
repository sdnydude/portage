import { Router } from 'express';
import { pino } from 'pino';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { FREE_TIER_LIMITS } from '@portage/shared';

const logger = pino({ name: 'usage' });

export const usageRouter = Router();

usageRouter.use(requireAuth);

usageRouter.get('/', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const [user] = await db.select({
      aiScansThisMonth: users.aiScansThisMonth,
      bgRemovalsThisMonth: users.bgRemovalsThisMonth,
      subscriptionTier: users.subscriptionTier,
    }).from(users).where(eq(users.id, userId)).limit(1);

    if (!user) {
      throw new AppError(404, 'NOT_FOUND', 'User not found');
    }

    const isPro = user.subscriptionTier === 'pro';

    res.json({
      aiScans: { used: user.aiScansThisMonth, limit: isPro ? null : FREE_TIER_LIMITS.aiScansPerMonth },
      bgRemovals: { used: user.bgRemovalsThisMonth, limit: isPro ? null : FREE_TIER_LIMITS.bgRemovalsPerMonth },
      tier: user.subscriptionTier,
    });
  } catch (err) {
    next(err);
  }
});

usageRouter.post('/bg-removal', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const tier = req.user!.tier;

    if (tier === 'free') {
      const [user] = await db.select({ bgRemovalsThisMonth: users.bgRemovalsThisMonth })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (user && user.bgRemovalsThisMonth >= FREE_TIER_LIMITS.bgRemovalsPerMonth) {
        throw new AppError(429, 'BG_REMOVAL_LIMIT_REACHED', `Free tier limit: ${FREE_TIER_LIMITS.bgRemovalsPerMonth} background removals per month. Upgrade to Pro for unlimited.`);
      }
    }

    await db.update(users)
      .set({ bgRemovalsThisMonth: sql`${users.bgRemovalsThisMonth} + 1` })
      .where(eq(users.id, userId));

    logger.info({ userId }, 'Background removal credit consumed');

    res.json({ consumed: true });
  } catch (err) {
    next(err);
  }
});
