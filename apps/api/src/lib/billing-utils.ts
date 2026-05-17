import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, marketplaceAccounts } from '../db/schema.js';
import { FREE_TIER_LIMITS, PRO_TIER_LIMITS } from '@portage/shared';
import { AppError } from '../middleware/error.js';

export type EffectiveTier = 'free' | 'pro';

export function computeEffectiveTier(
  subscriptionTier: string,
  trialEndsAt: Date | string | null | undefined,
): EffectiveTier {
  if (subscriptionTier === 'pro') return 'pro';
  if (trialEndsAt) {
    const expiresAt = typeof trialEndsAt === 'string' ? new Date(trialEndsAt) : trialEndsAt;
    if (expiresAt.getTime() > Date.now()) return 'pro';
  }
  return 'free';
}

export async function checkMarketplaceLimit(userId: string): Promise<void> {
  const [user] = await db.select({
    subscriptionTier: users.subscriptionTier,
    trialEndsAt: users.trialEndsAt,
  }).from(users).where(eq(users.id, userId)).limit(1);

  if (!user) throw new AppError(401, 'UNAUTHORIZED', 'User not found');

  const tier = computeEffectiveTier(user.subscriptionTier, user.trialEndsAt);
  const limit = tier === 'pro' ? PRO_TIER_LIMITS.marketplaces : FREE_TIER_LIMITS.marketplaces;

  if (limit === null) return;

  const [{ count }] = await db.select({
    count: sql<number>`count(*)::int`,
  }).from(marketplaceAccounts).where(eq(marketplaceAccounts.userId, userId));

  if (count >= limit) {
    throw new AppError(403, 'MARKETPLACE_LIMIT_REACHED',
      `Free tier is limited to ${limit} marketplace connection${limit === 1 ? '' : 's'}. Upgrade to Pro for unlimited.`);
  }
}
