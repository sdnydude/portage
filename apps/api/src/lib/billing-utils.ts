import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, marketplaceAccounts } from '../db/schema.js';
import { limitsForTier } from '@portage/shared';
import { AppError } from '../middleware/error.js';

export type EffectiveTier = 'free' | 'pro' | 'beta-tester';

export function computeEffectiveTier(
  subscriptionTier: string,
  trialEndsAt: Date | string | null | undefined,
): EffectiveTier {
  // Private tier for invited beta testers — assigned by admins only, never
  // shown on the billing page, no Stripe involvement.
  if (subscriptionTier === 'beta-tester') return 'beta-tester';
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
    limitOverrides: users.limitOverrides,
  }).from(users).where(eq(users.id, userId)).limit(1);

  if (!user) throw new AppError(401, 'UNAUTHORIZED', 'User not found');

  const tier = computeEffectiveTier(user.subscriptionTier, user.trialEndsAt);
  const limit = effectiveLimits(tier, user.limitOverrides).marketplaces;

  if (limit === null) return;

  const [{ count }] = await db.select({
    count: sql<number>`count(*)::int`,
  }).from(marketplaceAccounts).where(eq(marketplaceAccounts.userId, userId));

  if (count >= limit) {
    throw new AppError(403, 'MARKETPLACE_LIMIT_REACHED',
      `Free tier is limited to ${limit} marketplace connection${limit === 1 ? '' : 's'}. Upgrade to Pro for unlimited.`);
  }
}

/**
 * Tier limits with the user's admin-set overrides applied. An override key
 * wins over the tier value (explicit null = unlimited); absent keys fall
 * through to the tier default. Every meter gate reads limits through this.
 */
export function effectiveLimits(
  tier: Parameters<typeof limitsForTier>[0],
  overrides: unknown,
): ReturnType<typeof limitsForTier> {
  const base = limitsForTier(tier);
  if (!overrides || typeof overrides !== 'object') return base;
  const o = overrides as Partial<Record<keyof typeof base, number | null>>;
  const merged = { ...base };
  for (const key of Object.keys(base) as Array<keyof typeof base>) {
    if (key in o && (typeof o[key] === 'number' || o[key] === null)) {
      merged[key] = o[key] as number | null;
    }
  }
  return merged;
}
