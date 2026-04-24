import { pgTable, uuid, text, varchar, timestamp, boolean, integer, real, jsonb, pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);
export const subscriptionTierEnum = pgEnum('subscription_tier', ['free', 'pro']);
export const conditionEnum = pgEnum('item_condition', ['new', 'like_new', 'good', 'fair', 'poor']);
export const marketplaceEnum = pgEnum('marketplace_type', ['ebay', 'etsy']);
export const listingStatusEnum = pgEnum('listing_status', ['draft', 'active', 'sold', 'archived']);
export const orderStatusEnum = pgEnum('order_status', ['payment_received', 'label_purchased', 'shipped', 'delivered']);
export const notificationTypeEnum = pgEnum('notification_type', ['sale', 'buyer_message', 'listing_expiry', 'price_alert', 'shipping_reminder']);
export const referenceTypeEnum = pgEnum('reference_type', ['order', 'listing', 'item']);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: varchar('display_name', { length: 255 }),
  subscriptionTier: subscriptionTierEnum('subscription_tier').notNull().default('free'),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  aiScansThisMonth: integer('ai_scans_this_month').notNull().default(0),
  bgRemovalsThisMonth: integer('bg_removals_this_month').notNull().default(0),
  scanCountResetAt: timestamp('scan_count_reset_at').notNull().defaultNow(),
  onboardingCompleted: boolean('onboarding_completed').notNull().default(false),
  address: jsonb('address'),
  notificationPreferences: jsonb('notification_preferences'),
  milestonesAchieved: jsonb('milestones_achieved').notNull().default([]),
  role: userRoleEnum('role').notNull().default('user'),
  disabledAt: timestamp('disabled_at'),
  disabledReason: text('disabled_reason'),
  lastActiveAt: timestamp('last_active_at'),
  refreshTokenHash: text('refresh_token_hash'),
  pushSubscription: jsonb('push_subscription'),
  hintsDismissed: jsonb('hints_dismissed').notNull().default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const items = pgTable('items', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  photos: jsonb('photos').notNull().default([]),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description').notNull().default(''),
  category: varchar('category', { length: 255 }).notNull().default(''),
  condition: conditionEnum('condition').notNull().default('good'),
  conditionNotes: text('condition_notes').notNull().default(''),
  brand: varchar('brand', { length: 255 }).notNull().default(''),
  model: varchar('model', { length: 255 }).notNull().default(''),
  features: jsonb('features').notNull().default([]),
  estimatedValueMin: real('estimated_value_min'),
  estimatedValueMax: real('estimated_value_max'),
  estimatedValueRecommended: real('estimated_value_recommended'),
  aiConfidenceScore: real('ai_confidence_score').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const listings = pgTable('listings', {
  id: uuid('id').defaultRandom().primaryKey(),
  itemId: uuid('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  marketplace: marketplaceEnum('marketplace').notNull(),
  marketplaceListingId: varchar('marketplace_listing_id', { length: 255 }),
  marketplaceSpecificFields: jsonb('marketplace_specific_fields'),
  status: listingStatusEnum('status').notNull().default('draft'),
  price: real('price').notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  publishedAt: timestamp('published_at'),
  soldAt: timestamp('sold_at'),
});

export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  listingId: uuid('listing_id').notNull().references(() => listings.id),
  itemId: uuid('item_id').notNull().references(() => items.id),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  marketplace: marketplaceEnum('marketplace').notNull(),
  marketplaceOrderId: varchar('marketplace_order_id', { length: 255 }).notNull(),
  buyerUsername: varchar('buyer_username', { length: 255 }).notNull(),
  salePrice: real('sale_price').notNull(),
  shippingCost: real('shipping_cost').notNull().default(0),
  marketplaceFees: real('marketplace_fees').notNull().default(0),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  status: orderStatusEnum('status').notNull().default('payment_received'),
  trackingNumber: varchar('tracking_number', { length: 255 }),
  carrier: varchar('carrier', { length: 100 }),
  shippingLabelUrl: text('shipping_label_url'),
  soldAt: timestamp('sold_at').notNull().defaultNow(),
  shippedAt: timestamp('shipped_at'),
  deliveredAt: timestamp('delivered_at'),
});

export const conversations = pgTable('conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  messages: jsonb('messages').notNull().default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: notificationTypeEnum('type').notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  body: text('body').notNull(),
  referenceType: referenceTypeEnum('reference_type'),
  referenceId: uuid('reference_id'),
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const marketplaceAccounts = pgTable('marketplace_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  marketplace: marketplaceEnum('marketplace').notNull(),
  accessTokenEncrypted: text('access_token_encrypted').notNull(),
  refreshTokenEncrypted: text('refresh_token_encrypted').notNull(),
  tokenExpiresAt: timestamp('token_expires_at').notNull(),
  marketplaceUserId: varchar('marketplace_user_id', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const adminAuditLog = pgTable('admin_audit_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  adminUserId: uuid('admin_user_id').notNull().references(() => users.id),
  action: varchar('action', { length: 100 }).notNull(),
  targetType: varchar('target_type', { length: 50 }).notNull(),
  targetId: uuid('target_id'),
  details: jsonb('details'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const appSettings = pgTable('app_settings', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: jsonb('value').notNull(),
  updatedBy: uuid('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
