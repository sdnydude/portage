export const SUBSCRIPTION_TIERS = ['free', 'pro'] as const;
export const LISTING_STATUSES = ['draft', 'active', 'sold', 'archived'] as const;
export const ORDER_STATUSES = ['payment_received', 'label_purchased', 'shipped', 'delivered'] as const;
export const MARKETPLACE_TYPES = ['ebay', 'etsy'] as const;
export const NOTIFICATION_TYPES = ['sale', 'buyer_message', 'listing_expiry', 'price_alert', 'shipping_reminder'] as const;
export const CONDITIONS = ['new', 'like_new', 'good', 'fair', 'poor'] as const;

export const FREE_TIER_LIMITS = {
  aiScansPerMonth: 25,
  bgRemovalsPerMonth: 5,
  porterMessagesPerDay: 20,
  marketplaces: 1,
} as const;
