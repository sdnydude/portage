import { Router } from 'express';
import { z } from 'zod';
import { createLogger } from '../lib/logger.js';
import { db } from '../db/index.js';
import { users, items, listings, orders, conversations, marketplaceAccounts, adminAuditLog, appSettings, faqs } from '../db/schema.js';
import { eq, sql, desc, asc, count, sum, and, isNull, isNotNull, ilike, or, inArray, gte } from 'drizzle-orm';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { getAllowlist, addEmail, removeEmail } from '../lib/cf-allowlist.js';
import { sendBetaInvite } from '../lib/email.js';

const logger = createLogger('admin');

const allowlistEmailSchema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase().trim()),
});

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

async function logAuditAction(adminUserId: string, action: string, targetType: string, targetId: string | null, details?: Record<string, unknown>) {
  await db.insert(adminAuditLog).values({
    adminUserId,
    action,
    targetType,
    targetId,
    details,
  });
}

// ─── Dashboard Stats ───

adminRouter.get('/stats', async (_req, res, next) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [userStats] = await db.select({
      total: count(),
      activeToday: count(sql`CASE WHEN ${users.lastActiveAt} >= CURRENT_DATE THEN 1 END`),
    }).from(users).where(isNull(users.disabledAt));

    const [itemStats] = await db.select({ total: count() }).from(items);

    const [listingStats] = await db.select({
      active: count(sql`CASE WHEN ${listings.status} = 'active' THEN 1 END`),
      total: count(),
    }).from(listings);

    const [orderStats] = await db.select({
      thisMonth: count(sql`CASE WHEN ${orders.soldAt} >= ${monthStart} THEN 1 END`),
      revenueThisMonth: sum(sql`CASE WHEN ${orders.soldAt} >= ${monthStart} THEN ${orders.salePrice} ELSE 0 END`),
    }).from(orders);

    const [usersLastWeek] = await db.select({ total: count() })
      .from(users)
      .where(gte(users.createdAt, new Date(weekAgo)));

    res.json({
      users: { total: userStats.total, activeToday: userStats.activeToday, newLastWeek: usersLastWeek.total },
      items: { total: itemStats.total },
      listings: { active: listingStats.active, total: listingStats.total },
      orders: { thisMonth: orderStats.thisMonth, revenueThisMonth: Number(orderStats.revenueThisMonth) || 0 },
    });
  } catch (err) {
    next(err);
  }
});

// ─── Activity Feed ───

adminRouter.get('/activity', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50);

    const recentItems = await db.select({
      id: items.id,
      title: items.title,
      userId: items.userId,
      createdAt: items.createdAt,
    }).from(items).orderBy(desc(items.createdAt)).limit(limit);

    const recentOrders = await db.select({
      id: orders.id,
      salePrice: orders.salePrice,
      marketplace: orders.marketplace,
      buyerUsername: orders.buyerUsername,
      userId: orders.userId,
      soldAt: orders.soldAt,
    }).from(orders).orderBy(desc(orders.soldAt)).limit(limit);

    const recentUsers = await db.select({
      id: users.id,
      email: users.email,
      createdAt: users.createdAt,
    }).from(users).orderBy(desc(users.createdAt)).limit(limit);

    type ActivityEvent = { type: string; timestamp: Date; data: Record<string, unknown> };
    const events: ActivityEvent[] = [
      ...recentItems.map(i => ({ type: 'item_created' as const, timestamp: i.createdAt, data: { id: i.id, title: i.title, userId: i.userId } })),
      ...recentOrders.map(o => ({ type: 'order_placed' as const, timestamp: o.soldAt, data: { id: o.id, salePrice: o.salePrice, marketplace: o.marketplace, buyer: o.buyerUsername, userId: o.userId } })),
      ...recentUsers.map(u => ({ type: 'user_registered' as const, timestamp: u.createdAt, data: { id: u.id, email: u.email } })),
    ];

    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    res.json(events.slice(0, limit));
  } catch (err) {
    next(err);
  }
});

// ─── User Management ───

adminRouter.get('/users', async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 25, 100);
    const offset = (page - 1) * limit;
    const q = req.query.q as string | undefined;
    const role = req.query.role as string | undefined;
    const tier = req.query.tier as string | undefined;
    const status = req.query.status as string | undefined;

    const conditions = [];
    if (q) {
      const escaped = q.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
      conditions.push(or(ilike(users.email, `%${escaped}%`), ilike(users.displayName, `%${escaped}%`)));
    }
    if (role === 'admin' || role === 'user') conditions.push(eq(users.role, role));
    if (tier === 'free' || tier === 'pro' || tier === 'beta-tester') conditions.push(eq(users.subscriptionTier, tier));
    if (status === 'active') conditions.push(isNull(users.disabledAt));
    if (status === 'disabled') conditions.push(isNotNull(users.disabledAt));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db.select({ total: count() }).from(users).where(where);

    const rows = await db.select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      subscriptionTier: users.subscriptionTier,
      aiScansThisMonth: users.aiScansThisMonth,
      bgRemovalsThisMonth: users.bgRemovalsThisMonth,
      disabledAt: users.disabledAt,
      lastActiveAt: users.lastActiveAt,
      createdAt: users.createdAt,
    }).from(users).where(where).orderBy(desc(users.createdAt)).limit(limit).offset(offset);

    const userIds = rows.map(r => r.id);

    const itemCounts = userIds.length > 0
      ? await db.select({ userId: items.userId, count: count() }).from(items).where(inArray(items.userId, userIds)).groupBy(items.userId)
      : [];

    const listingCounts = userIds.length > 0
      ? await db.select({ userId: listings.userId, count: count() }).from(listings).where(and(inArray(listings.userId, userIds), eq(listings.status, 'active'))).groupBy(listings.userId)
      : [];

    const revenueSums = userIds.length > 0
      ? await db.select({ userId: orders.userId, total: sum(orders.salePrice) }).from(orders).where(inArray(orders.userId, userIds)).groupBy(orders.userId)
      : [];

    const itemMap = Object.fromEntries(itemCounts.map(r => [r.userId, r.count]));
    const listingMap = Object.fromEntries(listingCounts.map(r => [r.userId, r.count]));
    const revenueMap = Object.fromEntries(revenueSums.map(r => [r.userId, Number(r.total) || 0]));

    const enriched = rows.map(u => ({
      ...u,
      itemCount: itemMap[u.id] || 0,
      activeListingCount: listingMap[u.id] || 0,
      totalRevenue: revenueMap[u.id] || 0,
    }));

    res.json({ users: enriched, total, page, limit });
  } catch (err) {
    next(err);
  }
});


const adminUserCreateSchema = z.object({
  email: z.string().trim().email().max(255),
  displayName: z.string().max(255).optional(),
  role: z.enum(['user', 'admin']).optional(),
  subscriptionTier: z.enum(['free', 'pro', 'beta-tester']).optional(),
  invite: z.boolean().optional(),
});

// Create a user ahead of their first login. CF Access is the IdP (no local
// password): the allowlist entry is what actually grants access, the row just
// pre-sets role/tier/name so first login doesn't land on defaults. The invite
// email is best-effort — mail failure never fails the create.
adminRouter.post('/users', async (req, res, next) => {
  try {
    const adminUser = req.user!;
    const body = adminUserCreateSchema.parse(req.body);
    const email = body.email.trim().toLowerCase();

    const [existing] = await db.select({ id: users.id })
      .from(users).where(eq(users.email, email)).limit(1);
    if (existing) throw new AppError(409, 'EMAIL_EXISTS', 'A user with this email already exists');

    const [user] = await db.insert(users).values({
      email,
      displayName: body.displayName ?? null,
      role: body.role ?? 'user',
      subscriptionTier: body.subscriptionTier ?? 'free',
    }).returning();

    // Allowlist BEFORE responding: a row without edge access is a support trap.
    await addEmail(email);
    await logAuditAction(adminUser.sub, 'create_user', 'user', user.id, { email, role: user.role, tier: user.subscriptionTier });

    let invited = false;
    if (body.invite) {
      try {
        await sendBetaInvite(email);
        invited = true;
      } catch (mailErr) {
        logger.warn({ email, err: mailErr instanceof Error ? mailErr.message : String(mailErr) }, 'Invite email failed — user still created + allowlisted');
      }
    }

    logger.info({ adminId: adminUser.sub, userId: user.id, email, invited }, 'Admin created user');
    res.status(201).json({ user, invited });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/users/:id', async (req, res, next) => {
  try {
    const [user] = await db.select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      subscriptionTier: users.subscriptionTier,
      aiScansThisMonth: users.aiScansThisMonth,
      bgRemovalsThisMonth: users.bgRemovalsThisMonth,
      onboardingCompleted: users.onboardingCompleted,
      disabledAt: users.disabledAt,
      disabledReason: users.disabledReason,
      lastActiveAt: users.lastActiveAt,
      createdAt: users.createdAt,
    }).from(users).where(eq(users.id, req.params.id)).limit(1);

    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');

    const [{ itemCount }] = await db.select({ itemCount: count() }).from(items).where(eq(items.userId, user.id));
    const [{ listingCount }] = await db.select({ listingCount: count() }).from(listings).where(eq(listings.userId, user.id));
    const [{ orderCount }] = await db.select({ orderCount: count() }).from(orders).where(eq(orders.userId, user.id));
    const [{ conversationCount }] = await db.select({ conversationCount: count() }).from(conversations).where(eq(conversations.userId, user.id));
    const [{ revenue }] = await db.select({ revenue: sum(orders.salePrice) }).from(orders).where(eq(orders.userId, user.id));

    const marketplaceConns = await db.select({
      marketplace: marketplaceAccounts.marketplace,
      tokenExpiresAt: marketplaceAccounts.tokenExpiresAt,
      createdAt: marketplaceAccounts.createdAt,
    }).from(marketplaceAccounts).where(eq(marketplaceAccounts.userId, user.id));

    res.json({
      ...user,
      itemCount,
      listingCount,
      orderCount,
      conversationCount,
      totalRevenue: Number(revenue) || 0,
      marketplaceConnections: marketplaceConns,
    });
  } catch (err) {
    next(err);
  }
});


const TIER_LIMIT_KEYS = ['aiScansPerMonth', 'aiListingsPerMonth', 'bgRemovalsPerMonth', 'porterExchangesPerDay', 'marketplaces'] as const;
const adminUserUpdateSchema = z.object({
  displayName: z.string().max(255).nullable().optional(),
  // Grant/extend/clear a trial; ISO string or null.
  trialEndsAt: z.string().datetime().nullable().optional(),
  aiListingCredits: z.number().int().min(0).max(100000).optional(),
  // Partial per-meter overrides: number wins over tier, null = unlimited,
  // absent = tier default. Whole-object null clears every override.
  limitOverrides: z.record(z.enum(TIER_LIMIT_KEYS), z.number().int().min(0).max(1000000).nullable()).nullable().optional(),
}).passthrough();

adminRouter.patch('/users/:id', async (req, res, next) => {
  try {
    const adminUser = req.user!;
    const targetId = req.params.id;
    const { role, subscriptionTier, disabled, disabledReason } = req.body;
    const parsed = adminUserUpdateSchema.parse(req.body);

    if (targetId === adminUser.sub) {
      throw new AppError(400, 'SELF_MODIFY', 'Cannot modify your own admin account');
    }

    const [target] = await db.select({ id: users.id, email: users.email, role: users.role, subscriptionTier: users.subscriptionTier })
      .from(users).where(eq(users.id, targetId)).limit(1);

    if (!target) throw new AppError(404, 'NOT_FOUND', 'User not found');

    const updates: Record<string, unknown> = {};

    if (role === 'admin' || role === 'user') {
      updates.role = role;
      await logAuditAction(adminUser.sub, 'change_role', 'user', targetId, { from: target.role, to: role });
    }

    if (subscriptionTier === 'free' || subscriptionTier === 'pro' || subscriptionTier === 'beta-tester') {
      updates.subscriptionTier = subscriptionTier;
      await logAuditAction(adminUser.sub, 'change_tier', 'user', targetId, { from: target.subscriptionTier, to: subscriptionTier });
    }

    if (disabled === true) {
      updates.disabledAt = new Date();
      updates.disabledReason = disabledReason || null;
      // Sessions die at the edge: the DB flag alone leaves the door open — CF
      // Access is the IdP, so archiving must also pull the allowlist entry.
      // Internal access tokens expire within 15 min.
      await removeEmail(target.email);
      await logAuditAction(adminUser.sub, 'disable_user', 'user', targetId, { reason: disabledReason });
    } else if (disabled === false) {
      updates.disabledAt = null;
      updates.disabledReason = null;
      await addEmail(target.email);
      await logAuditAction(adminUser.sub, 'enable_user', 'user', targetId, {});
    }

    if (parsed.displayName !== undefined) updates.displayName = parsed.displayName;
    if (parsed.trialEndsAt !== undefined) {
      updates.trialEndsAt = parsed.trialEndsAt === null ? null : new Date(parsed.trialEndsAt);
      await logAuditAction(adminUser.sub, 'change_trial', 'user', targetId, { to: parsed.trialEndsAt });
    }
    if (parsed.aiListingCredits !== undefined) {
      updates.aiListingCredits = parsed.aiListingCredits;
      await logAuditAction(adminUser.sub, 'set_credits', 'user', targetId, { to: parsed.aiListingCredits });
    }
    if (parsed.limitOverrides !== undefined) {
      updates.limitOverrides = parsed.limitOverrides;
      await logAuditAction(adminUser.sub, 'set_limit_overrides', 'user', targetId, { to: parsed.limitOverrides });
    }

    if (Object.keys(updates).length === 0) {
      throw new AppError(400, 'NO_CHANGES', 'No valid fields to update');
    }

    await db.update(users).set(updates).where(eq(users.id, targetId));

    logger.info({ adminId: adminUser.sub, targetId, updates }, 'Admin updated user');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

adminRouter.delete('/users/:id', async (req, res, next) => {
  try {
    const adminUser = req.user!;
    const targetId = req.params.id;

    if (targetId === adminUser.sub) {
      throw new AppError(400, 'SELF_DELETE', 'Cannot delete your own account');
    }

    const [target] = await db.select({ id: users.id, email: users.email, stripeSubscriptionId: users.stripeSubscriptionId })
      .from(users).where(eq(users.id, targetId)).limit(1);

    if (!target) throw new AppError(404, 'NOT_FOUND', 'User not found');

    // Billing truth lives in Stripe: deleting the row would orphan a live
    // subscription that keeps charging. Cancel it in Stripe first (or archive).
    if (target.stripeSubscriptionId) {
      throw new AppError(409, 'STRIPE_SUBSCRIPTION_ACTIVE',
        'This user has a Stripe subscription. Cancel it in Stripe first, or archive the user instead.');
    }

    try {
      await db.delete(users).where(eq(users.id, targetId));
    } catch (e) {
      // adminAuditLog.adminUserId is RESTRICT: an ex-admin's audit rows block
      // hard-delete by design (the trail must survive). drizzle wraps the PG
      // error — the 23503 code rides on .cause.
      const pgCode = (e as { code?: string }).code ?? ((e as { cause?: { code?: string } }).cause?.code);
      if (pgCode === '23503') {
        throw new AppError(409, 'HAS_AUDIT_HISTORY',
          'This user has admin audit history that must be preserved. Archive them instead.');
      }
      throw e;
    }
    // Pull the edge access too — a lingering allowlist entry would just
    // re-provision a fresh row on the next CF login.
    try {
      await removeEmail(target.email);
    } catch (cfErr) {
      logger.warn({ email: target.email, err: cfErr instanceof Error ? cfErr.message : String(cfErr) }, 'User deleted but allowlist removal failed — remove manually');
    }
    await logAuditAction(adminUser.sub, 'delete_user', 'user', targetId, { email: target.email });

    logger.info({ adminId: adminUser.sub, targetId, email: target.email }, 'Admin deleted user');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/users/:id/reset-usage', async (req, res, next) => {
  try {
    const adminUser = req.user!;
    const targetId = req.params.id;

    const [target] = await db.select({ id: users.id })
      .from(users).where(eq(users.id, targetId)).limit(1);

    if (!target) throw new AppError(404, 'NOT_FOUND', 'User not found');

    await db.update(users).set({
      aiScansThisMonth: 0,
      bgRemovalsThisMonth: 0,
      scanCountResetAt: new Date(),
    }).where(eq(users.id, targetId));

    await logAuditAction(adminUser.sub, 'reset_usage', 'user', targetId, {});

    logger.info({ adminId: adminUser.sub, targetId }, 'Admin reset user usage');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ─── Items Browse ───

adminRouter.get('/items', async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 25, 100);
    const offset = (page - 1) * limit;
    const q = req.query.q as string | undefined;
    const category = req.query.category as string | undefined;
    const userId = req.query.userId as string | undefined;

    const conditions = [];
    if (q) {
      const escaped = q.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
      conditions.push(or(ilike(items.title, `%${escaped}%`), ilike(items.brand, `%${escaped}%`), ilike(items.model, `%${escaped}%`)));
    }
    if (category) conditions.push(eq(items.category, category));
    if (userId) conditions.push(eq(items.userId, userId));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db.select({ total: count() }).from(items).where(where);

    const rows = await db.select({
      id: items.id,
      userId: items.userId,
      title: items.title,
      category: items.category,
      condition: items.condition,
      brand: items.brand,
      model: items.model,
      photos: items.photos,
      estimatedValueMin: items.estimatedValueMin,
      estimatedValueMax: items.estimatedValueMax,
      estimatedValueRecommended: items.estimatedValueRecommended,
      aiConfidenceScore: items.aiConfidenceScore,
      createdAt: items.createdAt,
    }).from(items).where(where).orderBy(desc(items.createdAt)).limit(limit).offset(offset);

    res.json({ items: rows, total, page, limit });
  } catch (err) {
    next(err);
  }
});

// ─── Listings Browse ───

adminRouter.get('/listings', async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 25, 100);
    const offset = (page - 1) * limit;
    const status = req.query.status as string | undefined;
    const marketplace = req.query.marketplace as string | undefined;
    const userId = req.query.userId as string | undefined;

    const conditions = [];
    if (status === 'draft' || status === 'active' || status === 'sold' || status === 'archived') conditions.push(eq(listings.status, status));
    if (marketplace === 'ebay' || marketplace === 'reverb') conditions.push(eq(listings.marketplace, marketplace));
    if (userId) conditions.push(eq(listings.userId, userId));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db.select({ total: count() }).from(listings).where(where);

    const rows = await db.select().from(listings).where(where).orderBy(desc(listings.createdAt)).limit(limit).offset(offset);

    res.json({ listings: rows, total, page, limit });
  } catch (err) {
    next(err);
  }
});

// ─── Orders Browse + Revenue ───

adminRouter.get('/orders', async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 25, 100);
    const offset = (page - 1) * limit;
    const status = req.query.status as string | undefined;
    const marketplace = req.query.marketplace as string | undefined;
    const userId = req.query.userId as string | undefined;

    const conditions = [];
    if (status === 'payment_received' || status === 'label_purchased' || status === 'shipped' || status === 'delivered') conditions.push(eq(orders.status, status));
    if (marketplace === 'ebay' || marketplace === 'reverb') conditions.push(eq(orders.marketplace, marketplace));
    if (userId) conditions.push(eq(orders.userId, userId));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db.select({ total: count() }).from(orders).where(where);

    const rows = await db.select().from(orders).where(where).orderBy(desc(orders.soldAt)).limit(limit).offset(offset);

    res.json({ orders: rows, total, page, limit });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/orders/revenue', async (_req, res, next) => {
  try {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    const [allTime] = await db.select({
      totalSales: sum(orders.salePrice),
      totalFees: sum(orders.marketplaceFees),
      totalShipping: sum(orders.shippingCost),
      orderCount: count(),
    }).from(orders);

    const [thisMonth] = await db.select({
      totalSales: sum(orders.salePrice),
      totalFees: sum(orders.marketplaceFees),
      totalShipping: sum(orders.shippingCost),
      orderCount: count(),
    }).from(orders).where(sql`${orders.soldAt} >= ${monthStart}`);

    res.json({
      allTime: {
        sales: Number(allTime.totalSales) || 0,
        fees: Number(allTime.totalFees) || 0,
        shipping: Number(allTime.totalShipping) || 0,
        net: (Number(allTime.totalSales) || 0) - (Number(allTime.totalFees) || 0) - (Number(allTime.totalShipping) || 0),
        orders: allTime.orderCount,
      },
      thisMonth: {
        sales: Number(thisMonth.totalSales) || 0,
        fees: Number(thisMonth.totalFees) || 0,
        shipping: Number(thisMonth.totalShipping) || 0,
        net: (Number(thisMonth.totalSales) || 0) - (Number(thisMonth.totalFees) || 0) - (Number(thisMonth.totalShipping) || 0),
        orders: thisMonth.orderCount,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── Porter AI Stats + Conversations ───

adminRouter.get('/porter/stats', async (_req, res, next) => {
  try {
    const [stats] = await db.select({
      total: count(),
      totalMessages: sql<number>`coalesce(sum(jsonb_array_length(messages)) filter (where jsonb_typeof(messages) = 'array'), 0)`,
    }).from(conversations);

    const totalMessages = Number(stats.totalMessages);

    res.json({
      totalConversations: stats.total,
      totalMessages,
      avgMessagesPerConversation: stats.total > 0 ? Math.round(totalMessages / stats.total) : 0,
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/conversations', async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 25, 100);
    const offset = (page - 1) * limit;

    const [{ total }] = await db.select({ total: count() }).from(conversations);

    const rows = await db.select({
      id: conversations.id,
      userId: conversations.userId,
      messages: conversations.messages,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
    }).from(conversations).orderBy(desc(conversations.updatedAt)).limit(limit).offset(offset);

    const enriched = rows.map(c => ({
      id: c.id,
      userId: c.userId,
      messageCount: Array.isArray(c.messages) ? c.messages.length : 0,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

    res.json({ conversations: enriched, total, page, limit });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/conversations/:id', async (req, res, next) => {
  try {
    const [convo] = await db.select().from(conversations).where(eq(conversations.id, req.params.id)).limit(1);
    if (!convo) throw new AppError(404, 'NOT_FOUND', 'Conversation not found');
    res.json(convo);
  } catch (err) {
    next(err);
  }
});

// ─── Marketplace Health ───

adminRouter.get('/marketplace/health', async (_req, res, next) => {
  try {
    const accounts = await db.select({
      id: marketplaceAccounts.id,
      userId: marketplaceAccounts.userId,
      marketplace: marketplaceAccounts.marketplace,
      tokenExpiresAt: marketplaceAccounts.tokenExpiresAt,
      createdAt: marketplaceAccounts.createdAt,
    }).from(marketplaceAccounts);

    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const enriched = accounts.map(a => ({
      ...a,
      status: a.tokenExpiresAt < now ? 'expired' : a.tokenExpiresAt < weekFromNow ? 'expiring' : 'healthy',
    }));

    const summary = {
      ebay: { total: 0, healthy: 0, expiring: 0, expired: 0 },
      reverb: { total: 0, healthy: 0, expiring: 0, expired: 0 },
    };

    for (const a of enriched) {
      // A parked-marketplace row (e.g. a stray etsy account) has no summary
      // bucket — skip it rather than crash the admin page.
      const m = summary[a.marketplace as keyof typeof summary];
      if (!m) continue;
      m.total++;
      m[a.status as 'healthy' | 'expiring' | 'expired']++;
    }

    res.json({ accounts: enriched, summary });
  } catch (err) {
    next(err);
  }
});

// ─── CF Access Allowlist ───
// The beta gate lives at the Cloudflare edge: an allow policy of emails on
// the Portage Access applications. These endpoints manage it via the CF API.

adminRouter.get('/allowlist', async (_req, res, next) => {
  try {
    const emails = await getAllowlist();
    res.json({ emails });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/allowlist', async (req, res, next) => {
  try {
    const parsed = allowlistEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'INVALID_EMAIL', 'A valid email address is required');
    }
    const email = parsed.data.email;
    const emails = await addEmail(email);
    await logAuditAction(req.user!.sub, 'allowlist_add', 'access_policy', null, { email });
    // The invite email IS the notification that someone can now log in. Best
    // effort — the allowlist add already succeeded, so a mail failure must not
    // fail the request; surface it via `invited` so the admin can re-send.
    let invited = false;
    try {
      await sendBetaInvite(email);
      invited = true;
    } catch (err) {
      logger.warn({ email, error: (err as Error).message }, 'Beta invite email failed');
    }
    res.json({ emails, invited });
  } catch (err) {
    next(err);
  }
});

adminRouter.delete('/allowlist/:email', async (req, res, next) => {
  try {
    const email = decodeURIComponent(req.params.email).toLowerCase().trim();
    if (email === req.user!.email.toLowerCase()) {
      // Removing yourself from the edge allowlist is a lockout, not a logout.
      throw new AppError(400, 'SELF_REMOVE', 'You cannot remove your own email from the allowlist');
    }
    const emails = await removeEmail(email);
    await logAuditAction(req.user!.sub, 'allowlist_remove', 'access_policy', null, { email });
    res.json({ emails });
  } catch (err) {
    next(err);
  }
});

// ─── App Settings ───

adminRouter.get('/settings', async (_req, res, next) => {
  try {
    const rows = await db.select().from(appSettings);
    const settings: Record<string, unknown> = {};
    for (const r of rows) {
      settings[r.key] = r.value;
    }
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

const ALLOWED_SETTINGS_KEYS = ['maintenance_mode'] as const;

adminRouter.patch('/settings/:key', async (req, res, next) => {
  try {
    const adminUser = req.user!;
    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined) throw new AppError(400, 'MISSING_VALUE', 'value is required');
    if (!ALLOWED_SETTINGS_KEYS.includes(key as typeof ALLOWED_SETTINGS_KEYS[number])) {
      throw new AppError(400, 'INVALID_KEY', `Setting key '${key}' is not allowed`);
    }

    const [existing] = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);

    if (existing) {
      await db.update(appSettings).set({ value, updatedBy: adminUser.sub, updatedAt: new Date() }).where(eq(appSettings.key, key));
    } else {
      await db.insert(appSettings).values({ key, value, updatedBy: adminUser.sub });
    }

    await logAuditAction(adminUser.sub, 'change_setting', 'setting', null, { key, value, previous: existing?.value });

    logger.info({ adminId: adminUser.sub, key, value }, 'Admin updated setting');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ─── Audit Log ───

adminRouter.get('/audit', async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 25, 100);
    const offset = (page - 1) * limit;
    const action = req.query.action as string | undefined;
    const adminUserId = req.query.adminUserId as string | undefined;

    const conditions = [];
    if (action) conditions.push(eq(adminAuditLog.action, action));
    if (adminUserId) conditions.push(eq(adminAuditLog.adminUserId, adminUserId));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db.select({ total: count() }).from(adminAuditLog).where(where);

    const rows = await db.select().from(adminAuditLog).where(where).orderBy(desc(adminAuditLog.createdAt)).limit(limit).offset(offset);

    res.json({ entries: rows, total, page, limit });
  } catch (err) {
    next(err);
  }
});

// ─── FAQ Management ───

const faqCreateSchema = z.object({
  question: z.string().min(1).max(500),
  answer: z.string().min(1).max(5000),
  sortOrder: z.number().int().min(0).optional(),
  published: z.boolean().optional(),
});

adminRouter.post('/faqs', async (req, res, next) => {
  try {
    const body = faqCreateSchema.parse(req.body);
    const [faq] = await db.insert(faqs).values({
      question: body.question,
      answer: body.answer,
      sortOrder: body.sortOrder ?? 0,
      published: body.published ?? true,
    }).returning();
    await logAuditAction(req.user!.sub, 'faq_create', 'faq', faq.id, { question: faq.question });
    res.status(201).json({ faq });
  } catch (err) {
    next(err);
  }
});

const faqUpdateSchema = faqCreateSchema.partial();

adminRouter.patch('/faqs/:id', async (req, res, next) => {
  try {
    const body = faqUpdateSchema.parse(req.body);
    const [faq] = await db.update(faqs)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(faqs.id, req.params.id))
      .returning();
    if (!faq) throw new AppError(404, 'NOT_FOUND', 'FAQ not found');
    await logAuditAction(req.user!.sub, 'faq_update', 'faq', faq.id, { fields: Object.keys(body) });
    res.json({ faq });
  } catch (err) {
    next(err);
  }
});

adminRouter.delete('/faqs/:id', async (req, res, next) => {
  try {
    const [deleted] = await db.delete(faqs)
      .where(eq(faqs.id, req.params.id))
      .returning({ id: faqs.id });
    if (!deleted) throw new AppError(404, 'NOT_FOUND', 'FAQ not found');
    await logAuditAction(req.user!.sub, 'faq_delete', 'faq', deleted.id);
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/faqs', async (_req, res, next) => {
  try {
    const rows = await db.select().from(faqs).orderBy(asc(faqs.sortOrder));
    res.json({ faqs: rows });
  } catch (err) {
    next(err);
  }
});

const faqReorderSchema = z.object({
  ids: z.array(z.string().uuid().or(z.string().min(1))).min(1).max(200),
});

adminRouter.put('/faqs/reorder', async (req, res, next) => {
  try {
    const { ids } = faqReorderSchema.parse(req.body);
    for (let i = 0; i < ids.length; i++) {
      await db.update(faqs)
        .set({ sortOrder: i, updatedAt: new Date() })
        .where(eq(faqs.id, ids[i]));
    }
    await logAuditAction(req.user!.sub, 'faq_reorder', 'faq', null, { count: ids.length });
    res.json({ reordered: true });
  } catch (err) {
    next(err);
  }
});
