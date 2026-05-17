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
