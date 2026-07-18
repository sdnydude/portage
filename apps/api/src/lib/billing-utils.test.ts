import { describe, it, expect } from 'vitest';

describe('billing constants', () => {
  it('FREE_TIER_LIMITS has correct billing values', async () => {
    const { FREE_TIER_LIMITS } = await import('@portage/shared');
    expect(FREE_TIER_LIMITS.aiListingsPerMonth).toBe(10);
    expect(FREE_TIER_LIMITS.aiScansPerMonth).toBe(25);
    expect(FREE_TIER_LIMITS.bgRemovalsPerMonth).toBe(5);
    expect(FREE_TIER_LIMITS.porterExchangesPerDay).toBe(5);
    expect(FREE_TIER_LIMITS.marketplaces).toBe(1);
  });

  it('PRO_TIER_LIMITS has correct billing values', async () => {
    const { PRO_TIER_LIMITS } = await import('@portage/shared');
    expect(PRO_TIER_LIMITS.aiListingsPerMonth).toBe(75);
    expect(PRO_TIER_LIMITS.bgRemovalsPerMonth).toBeNull();
    expect(PRO_TIER_LIMITS.porterExchangesPerDay).toBe(500);
    expect(PRO_TIER_LIMITS.marketplaces).toBeNull();
  });

  it('CREDIT_PACK has correct values', async () => {
    const { CREDIT_PACK } = await import('@portage/shared');
    expect(CREDIT_PACK.priceUsd).toBe(5);
    expect(CREDIT_PACK.aiListings).toBe(10);
  });
});

describe('computeEffectiveTier', () => {
  it('returns pro when subscriptionTier is pro', async () => {
    const { computeEffectiveTier } = await import('./billing-utils.js');
    expect(computeEffectiveTier('pro', null)).toBe('pro');
    expect(computeEffectiveTier('pro', new Date('2020-01-01'))).toBe('pro');
  });

  it('returns pro when trial is active', async () => {
    const { computeEffectiveTier } = await import('./billing-utils.js');
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    expect(computeEffectiveTier('free', futureDate)).toBe('pro');
  });

  it('returns free when trial has expired', async () => {
    const { computeEffectiveTier } = await import('./billing-utils.js');
    const pastDate = new Date('2020-01-01');
    expect(computeEffectiveTier('free', pastDate)).toBe('free');
  });

  it('returns free when no trial and tier is free', async () => {
    const { computeEffectiveTier } = await import('./billing-utils.js');
    expect(computeEffectiveTier('free', null)).toBe('free');
    expect(computeEffectiveTier('free', undefined)).toBe('free');
  });

  it('returns beta-tester for the private beta-tester tier regardless of trial', async () => {
    const { computeEffectiveTier } = await import('./billing-utils.js');
    expect(computeEffectiveTier('beta-tester', null)).toBe('beta-tester');
    expect(computeEffectiveTier('beta-tester', new Date('2020-01-01'))).toBe('beta-tester');
  });
});

describe('limitsForTier', () => {
  it('maps each tier to its limit set — beta-tester is unlimited across the board', async () => {
    const { limitsForTier, FREE_TIER_LIMITS, PRO_TIER_LIMITS, BETA_TESTER_TIER_LIMITS } = await import('@portage/shared');
    expect(limitsForTier('free')).toBe(FREE_TIER_LIMITS);
    expect(limitsForTier('pro')).toBe(PRO_TIER_LIMITS);
    expect(limitsForTier('beta-tester')).toBe(BETA_TESTER_TIER_LIMITS);
    expect(BETA_TESTER_TIER_LIMITS.aiScansPerMonth).toBeNull();
    expect(BETA_TESTER_TIER_LIMITS.aiListingsPerMonth).toBeNull();
    expect(BETA_TESTER_TIER_LIMITS.bgRemovalsPerMonth).toBeNull();
    expect(BETA_TESTER_TIER_LIMITS.porterExchangesPerDay).toBeNull();
    expect(BETA_TESTER_TIER_LIMITS.marketplaces).toBeNull();
  });
});
