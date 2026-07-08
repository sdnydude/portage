import { pgTable, uuid, text, varchar, timestamp, boolean, integer, real, doublePrecision, jsonb, pgEnum, pgSequence, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Serialized eBay SKU source (PRT-000123). Minted once per item and persisted on
// items.ebaySku so retried publishes reuse the same SKU — keeping eBay's
// inventory_item PUT idempotent and out of the "rapid listing" ATO heuristic.
export const ebaySkuSeq = pgSequence('portage_ebay_sku_seq', { startWith: 1 });

export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);
export const subscriptionTierEnum = pgEnum('subscription_tier', ['free', 'pro']);
export const conditionEnum = pgEnum('item_condition', ['new', 'like_new', 'good', 'fair', 'poor']);
export const marketplaceEnum = pgEnum('marketplace_type', ['ebay', 'etsy', 'reverb']);
export const listingStatusEnum = pgEnum('listing_status', ['draft', 'active', 'sold', 'archived']);
export const orderStatusEnum = pgEnum('order_status', ['payment_received', 'label_purchased', 'shipped', 'delivered']);
export const notificationTypeEnum = pgEnum('notification_type', ['sale', 'buyer_message', 'listing_expiry', 'price_alert', 'shipping_reminder']);
export const referenceTypeEnum = pgEnum('reference_type', ['order', 'listing', 'item']);
export const packageTypeEnum = pgEnum('package_type', ['box', 'envelope', 'poly_mailer']);
export const messageDirectionEnum = pgEnum('message_direction', ['inbound', 'outbound']);
export const messageTypeEnum = pgEnum('message_type', ['asq', 'rtq', 'aaq']);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  // Nullable since the Cloudflare Access migration: CF is the IdP, accounts
  // auto-provisioned at /auth/session have no local password.
  passwordHash: text('password_hash'),
  displayName: varchar('display_name', { length: 255 }),
  subscriptionTier: subscriptionTierEnum('subscription_tier').notNull().default('free'),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
  stripePriceId: varchar('stripe_price_id', { length: 255 }),
  trialEndsAt: timestamp('trial_ends_at'),
  aiScansThisMonth: integer('ai_scans_this_month').notNull().default(0),
  aiListingsThisMonth: integer('ai_listings_this_month').notNull().default(0),
  aiListingCredits: integer('ai_listing_credits').notNull().default(0),
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
  pushSubscription: jsonb('push_subscription'),
  shipFromAddress: jsonb('ship_from_address'),
  shippingAutoMark: boolean('shipping_auto_mark').notNull().default(false),
  hintsDismissed: jsonb('hints_dismissed').notNull().default([]),
  listingInterface: text('listing_interface').notNull().default('hybrid'),
  listingForkPref: text('listing_fork_pref').notNull().default('ask'),
  listingForkCount: integer('listing_fork_count').notNull().default(0),
  listingCompactMode: boolean('listing_compact_mode').notNull().default(false),
  // F3b: display-only suppression of the publish terms sheet ("don't show for 7
  // days"). NOT a consent record — that lives in disclaimerAcceptances. Suppressed
  // only when suppressUntil > now AND suppressVersion === CURRENT_DISCLAIMER_VERSION
  // (a version bump voids it). Null = never suppressed.
  disclaimerSuppressUntil: timestamp('disclaimer_suppress_until'),
  disclaimerSuppressVersion: integer('disclaimer_suppress_version'),
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
  // eBay item specifics (Brand, MPN, category aspects) keyed → string[] values.
  // AI-filled at scan, carried into every publish path so the aspect pop-up never
  // re-asks for data already captured. Existing rows default to {}.
  aspects: jsonb('aspects').$type<Record<string, string[]>>().notNull().default({}),
  estimatedValueMin: doublePrecision('estimated_value_min'),
  estimatedValueMax: doublePrecision('estimated_value_max'),
  estimatedValueRecommended: doublePrecision('estimated_value_recommended'),
  // Seller-set sale price (distinct from the AI estimate above). Prefills the
  // editable price field shown on every eBay publish; nullable (existing rows).
  price: doublePrecision('price'),
  aiConfidenceScore: real('ai_confidence_score').notNull().default(0),
  quantity: integer('quantity').notNull().default(1),
  // eBay Calculated shipping requires package weight + dimensions (error 25020).
  // Normalized: weight in ounces, dimensions in inches; nullable (existing rows).
  weightOz: real('weight_oz'),
  lengthIn: real('length_in'),
  widthIn: real('width_in'),
  heightIn: real('height_in'),
  // eBay enum string (MAILING_BOX/LETTER/...) — deliberately varchar, not packageTypeEnum.
  ebayPackageType: varchar('ebay_package_type', { length: 50 }),
  // true when AI-populated the metrics; flips false on seller edit.
  weightEstimated: boolean('weight_estimated').notNull().default(false),
  marketplaceData: jsonb('marketplace_data').$type<import('@portage/shared').MarketplaceData>(),
  // Stable serialized eBay SKU (PRT-000123), minted once per item from
  // ebaySkuSeq and reused across every (re)publish so eBay's inventory_item PUT
  // stays idempotent — no churning SKUs that trip ATO. Nullable (existing rows;
  // minted lazily on first eBay publish).
  ebaySku: varchar('ebay_sku', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  index('idx_items_user_id').on(t.userId),
]);

export const listings = pgTable('listings', {
  id: uuid('id').defaultRandom().primaryKey(),
  itemId: uuid('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  marketplace: marketplaceEnum('marketplace').notNull(),
  marketplaceListingId: varchar('marketplace_listing_id', { length: 255 }),
  ebaySku: varchar('ebay_sku', { length: 255 }),
  ebayOfferId: varchar('ebay_offer_id', { length: 255 }),
  marketplaceSpecificFields: jsonb('marketplace_specific_fields'),
  status: listingStatusEnum('status').notNull().default('draft'),
  price: doublePrecision('price').notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  // Idempotency anchor (R3): the row is inserted FIRST with a null marketplaceListingId
  // and this key, then eBay is called, then the row is UPDATEd. The partial unique
  // index below serializes concurrent submits that share a key so a non-idempotent
  // AddFixedPriceItem can't double-list. Null for non-publish drafts / legacy rows.
  idempotencyKey: varchar('idempotency_key', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  publishedAt: timestamp('published_at'),
  soldAt: timestamp('sold_at'),
}, (t) => [
  index('idx_listings_user_id').on(t.userId),
  index('idx_listings_item_id').on(t.itemId),
  index('idx_listings_marketplace_listing_id').on(t.marketplaceListingId),
  uniqueIndex('uq_listings_idempotency_key')
    .on(t.userId, t.idempotencyKey)
    .where(sql`${t.idempotencyKey} IS NOT NULL`),
]);

export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  listingId: uuid('listing_id').notNull().references(() => listings.id, { onDelete: 'restrict' }),
  itemId: uuid('item_id').notNull().references(() => items.id, { onDelete: 'restrict' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  marketplace: marketplaceEnum('marketplace').notNull(),
  marketplaceOrderId: varchar('marketplace_order_id', { length: 255 }).notNull(),
  buyerUsername: varchar('buyer_username', { length: 255 }).notNull(),
  salePrice: doublePrecision('sale_price').notNull(),
  shippingCost: doublePrecision('shipping_cost').notNull().default(0),
  marketplaceFees: doublePrecision('marketplace_fees').notNull().default(0),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  status: orderStatusEnum('status').notNull().default('payment_received'),
  trackingNumber: varchar('tracking_number', { length: 255 }),
  carrier: varchar('carrier', { length: 100 }),
  shippingLabelUrl: text('shipping_label_url'),
  shippingAddress: jsonb('shipping_address'),
  soldAt: timestamp('sold_at').notNull(),
  shippedAt: timestamp('shipped_at'),
  deliveredAt: timestamp('delivered_at'),
}, (t) => [
  index('idx_orders_user_id').on(t.userId),
  index('idx_orders_listing_id').on(t.listingId),
  index('idx_orders_marketplace_order_id').on(t.marketplaceOrderId),
]);

export const conversations = pgTable('conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  messages: jsonb('messages').notNull().default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  index('idx_conversations_user_id').on(t.userId),
]);

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
}, (t) => [
  index('idx_notifications_user_id').on(t.userId),
]);

export const marketplaceAccounts = pgTable('marketplace_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  marketplace: marketplaceEnum('marketplace').notNull(),
  accessTokenEncrypted: text('access_token_encrypted').notNull(),
  refreshTokenEncrypted: text('refresh_token_encrypted').notNull(),
  tokenExpiresAt: timestamp('token_expires_at').notNull(),
  marketplaceUserId: varchar('marketplace_user_id', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_marketplace_accounts_user_mkt').on(t.userId, t.marketplace),
]);

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

export const designSurveyResponses = pgTable('design_survey_responses', {
  id: uuid('id').defaultRandom().primaryKey(),
  preferredDirection: varchar('preferred_direction', { length: 1 }).notNull(),
  ratingsEaseA: integer('ratings_ease_a'),
  ratingsEaseB: integer('ratings_ease_b'),
  ratingsEaseC: integer('ratings_ease_c'),
  ratingsAppealA: integer('ratings_appeal_a'),
  ratingsAppealB: integer('ratings_appeal_b'),
  ratingsAppealC: integer('ratings_appeal_c'),
  likedMost: text('liked_most'),
  concerns: text('concerns'),
  additionalFeedback: text('additional_feedback'),
  detailedResponses: jsonb('detailed_responses'),
  respondentName: varchar('respondent_name', { length: 255 }),
  respondentRole: varchar('respondent_role', { length: 100 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const designReviewComments = pgTable('design_review_comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  direction: varchar('direction', { length: 30 }).notNull(),
  stepNumber: integer('step_number'),
  comment: text('comment').notNull(),
  reviewerName: varchar('reviewer_name', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const disclaimerAcceptances = pgTable('disclaimer_acceptances', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  listingId: uuid('listing_id').notNull().references(() => listings.id, { onDelete: 'cascade' }),
  disclaimerVersion: integer('disclaimer_version').notNull(),
  acceptedAt: timestamp('accepted_at').notNull().defaultNow(),
  ipAddress: varchar('ip_address', { length: 45 }),
});

export const listingDrafts = pgTable('listing_drafts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  itemId: uuid('item_id').references(() => items.id, { onDelete: 'cascade' }),
  marketplace: marketplaceEnum('marketplace').notNull(),
  title: varchar('title', { length: 500 }),
  price: doublePrecision('price'),
  status: text('status').notNull().default('draft'),
  lastStepCompleted: text('last_step_completed'),
  flowState: jsonb('flow_state').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_drafts_user_item_mkt')
    .on(t.userId, t.itemId, t.marketplace)
    .where(sql`item_id IS NOT NULL`),
  uniqueIndex('uq_drafts_user_null_item_mkt')
    .on(t.userId, t.marketplace)
    .where(sql`item_id IS NULL`),
]);

export const stripeEvents = pgTable('stripe_events', {
  eventId: varchar('event_id', { length: 255 }).primaryKey(),
  type: varchar('type', { length: 100 }).notNull(),
  processedAt: timestamp('processed_at').notNull().defaultNow(),
});

export const sellerProfiles = pgTable('seller_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  ebayFulfillmentPolicyId: varchar('ebay_fulfillment_policy_id', { length: 100 }),
  ebayPaymentPolicyId: varchar('ebay_payment_policy_id', { length: 100 }),
  ebayReturnPolicyId: varchar('ebay_return_policy_id', { length: 100 }),
  ebayMerchantLocationKey: varchar('ebay_merchant_location_key', { length: 100 }),
  ebayPublishMode: varchar('ebay_publish_mode', { length: 10 }).notNull().default('live'),
  reverbOffersEnabled: boolean('reverb_offers_enabled').notNull().default(true),
  reverbDefaultShipping: jsonb('reverb_default_shipping'),
  shipFromAddress: jsonb('ship_from_address'),
  defaultWeightUnit: varchar('default_weight_unit', { length: 5 }).notNull().default('oz'),
  defaultDimensionUnit: varchar('default_dimension_unit', { length: 5 }).notNull().default('in'),
  defaultPackageType: packageTypeEnum('default_package_type').notNull().default('box'),
  preferredMarketplaces: jsonb('preferred_marketplaces').notNull().default(['ebay']),
  autoPublish: boolean('auto_publish').notNull().default(false),
  defaultCurrency: varchar('default_currency', { length: 3 }).notNull().default('USD'),
  pricingSuggestPercentile: integer('pricing_suggest_percentile').notNull().default(50),
  pricingFloorPercentile: integer('pricing_floor_percentile').notNull().default(25),
  bestOfferAutoAcceptEnabled: boolean('best_offer_auto_accept_enabled').notNull().default(false),
  gtcAutoEnd: boolean('gtc_auto_end').notNull().default(false),
  defaultListingFooter: text('default_listing_footer'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const ebayMessages = pgTable('ebay_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  ebayMessageId: varchar('ebay_message_id', { length: 255 }).notNull().unique(),
  conversationKey: varchar('conversation_key', { length: 600 }).notNull(),
  buyerUsername: varchar('buyer_username', { length: 255 }).notNull(),
  itemId: varchar('item_id', { length: 255 }).notNull(),
  itemTitle: varchar('item_title', { length: 500 }),
  subject: varchar('subject', { length: 500 }).notNull().default(''),
  body: text('body').notNull().default(''),
  direction: messageDirectionEnum('direction').notNull(),
  messageType: messageTypeEnum('message_type').notNull().default('asq'),
  readAt: timestamp('read_at'),
  ebayCreatedAt: timestamp('ebay_created_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  index('idx_ebay_messages_user_id').on(t.userId),
  index('idx_ebay_messages_conversation_key').on(t.conversationKey),
  index('idx_ebay_messages_user_unread').on(t.userId, t.direction, t.readAt),
]);

export const exportTokens = pgTable('export_tokens', {
  token: varchar('token', { length: 64 }).primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  itemIds: text('item_ids').array().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  useCount: integer('use_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('idx_export_tokens_user_id').on(t.userId),
]);
