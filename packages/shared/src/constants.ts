export const SUBSCRIPTION_TIERS = ['free', 'pro'] as const;
export const LISTING_STATUSES = ['draft', 'active', 'sold', 'archived'] as const;
export const ORDER_STATUSES = ['payment_received', 'label_purchased', 'shipped', 'delivered'] as const;
export const MARKETPLACE_TYPES = ['ebay', 'etsy', 'reverb'] as const;
export const NOTIFICATION_TYPES = ['sale', 'buyer_message', 'listing_expiry', 'price_alert', 'shipping_reminder'] as const;
export const CONDITIONS = ['new', 'like_new', 'good', 'fair', 'poor'] as const;

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
  porterExchangesPerDay: 15,
  marketplaces: null,
} as const;

export const CREDIT_PACK = {
  priceUsd: 5,
  aiListings: 10,
} as const;

export const PACKAGE_TYPES = ['box', 'envelope', 'poly_mailer'] as const;
export const SHIPPING_PROVIDERS = ['shippo', 'easypost', 'pirate_ship'] as const;
export const CURRENT_DISCLAIMER_VERSION = 1;
