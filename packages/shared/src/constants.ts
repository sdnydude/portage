export const SUBSCRIPTION_TIERS = ['free', 'pro', 'beta-tester'] as const;
export const LISTING_STATUSES = ['draft', 'active', 'sold', 'archived'] as const;
export const ORDER_STATUSES = ['payment_received', 'label_purchased', 'shipped', 'delivered'] as const;
export const MARKETPLACE_TYPES = ['ebay', 'reverb'] as const; // 'etsy' parked 2026-07 (tag etsy-parked-2026-07); DB enum value remains, inert
export const NOTIFICATION_TYPES = ['sale', 'buyer_message', 'listing_expiry', 'price_alert', 'shipping_reminder'] as const;
export const CONDITIONS = ['new', 'like_new', 'good', 'fair', 'poor'] as const;

export interface TierLimits {
  aiScansPerMonth: number | null;
  aiListingsPerMonth: number | null;
  bgRemovalsPerMonth: number | null;
  porterExchangesPerDay: number | null;
  marketplaces: number | null;
}

export const FREE_TIER_LIMITS = {
  aiScansPerMonth: 25,
  aiListingsPerMonth: 10,
  bgRemovalsPerMonth: 5,
  porterMessagesPerDay: 20,
  porterExchangesPerDay: 5,
  marketplaces: 1,
} as const;

export const PRO_TIER_LIMITS = {
  aiScansPerMonth: null,
  aiListingsPerMonth: 75,
  bgRemovalsPerMonth: null,
  porterExchangesPerDay: 500,
  marketplaces: null,
} as const;

// Private tier for invited beta testers: admin-assigned only, never shown on
// the billing page, no Stripe involvement. Unlimited across the board.
export const BETA_TESTER_TIER_LIMITS = {
  aiScansPerMonth: null,
  aiListingsPerMonth: null,
  bgRemovalsPerMonth: null,
  porterExchangesPerDay: null,
  marketplaces: null,
} as const;

export function limitsForTier(tier: 'free' | 'pro' | 'beta-tester'): TierLimits {
  if (tier === 'beta-tester') return BETA_TESTER_TIER_LIMITS;
  if (tier === 'pro') return PRO_TIER_LIMITS;
  return FREE_TIER_LIMITS;
}

export const CREDIT_PACK = {
  priceUsd: 5,
  aiListings: 10,
} as const;

export const PACKAGE_TYPES = ['box', 'envelope', 'poly_mailer'] as const;
export const CURRENT_DISCLAIMER_VERSION = 1;

// App-wide per-item photo cap: min of our UX ceiling vs marketplace maxima
// (eBay 24 PictureURLs, Reverb 25 — verified 2026-07-13, see
// docs/research/2026-07-13-video-tooling-and-marketplace-limits.md).
export const MAX_PHOTOS_PER_ITEM = 24;
