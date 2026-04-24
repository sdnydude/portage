import { Router } from 'express';
import { pino } from 'pino';
import { db } from '../db/index.js';
import { users, items, listings, orders, conversations, marketplaceAccounts, adminAuditLog, appSettings } from '../db/schema.js';
import { eq, sql, desc, count, sum, and, isNull, isNotNull, ilike, or } from 'drizzle-orm';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';

const logger = pino({ name: 'admin' });

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
      thisMonth: count(sql`CASE WHEN ${orders.soldAt} >= ${sql.raw(`'${monthStart}'`)} THEN 1 END`),
      revenueThisMonth: sum(sql`CASE WHEN ${orders.soldAt} >= ${sql.raw(`'${monthStart}'`)} THEN ${orders.salePrice} ELSE 0 END`),
    }).from(orders);

    const [usersLastWeek] = await db.select({ total: count() })
      .from(users)
      .where(sql`${users.createdAt} >= ${weekAgo}`);

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
    if (q) conditions.push(or(ilike(users.email, `%${q}%`), ilike(users.displayName, `%${q}%`)));
    if (role === 'admin' || role === 'user') conditions.push(eq(users.role, role));
    if (tier === 'free' || tier === 'pro') conditions.push(eq(users.subscriptionTier, tier));
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
      ? await db.select({ userId: items.userId, count: count() }).from(items).where(sql`${items.userId} IN ${userIds}`).groupBy(items.userId)
      : [];

    const listingCounts = userIds.length > 0
      ? await db.select({ userId: listings.userId, count: count() }).from(listings).where(and(sql`${listings.userId} IN ${userIds}`, eq(listings.status, 'active'))).groupBy(listings.userId)
      : [];

    const revenueSums = userIds.length > 0
      ? await db.select({ userId: orders.userId, total: sum(orders.salePrice) }).from(orders).where(sql`${orders.userId} IN ${userIds}`).groupBy(orders.userId)
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

adminRouter.patch('/users/:id', async (req, res, next) => {
  try {
    const adminUser = req.user!;
    const targetId = req.params.id;
    const { role, subscriptionTier, disabled, disabledReason } = req.body;

    const [target] = await db.select({ id: users.id, email: users.email, role: users.role, subscriptionTier: users.subscriptionTier })
      .from(users).where(eq(users.id, targetId)).limit(1);

    if (!target) throw new AppError(404, 'NOT_FOUND', 'User not found');

    const updates: Record<string, unknown> = {};

    if (role === 'admin' || role === 'user') {
      updates.role = role;
      await logAuditAction(adminUser.sub, 'change_role', 'user', targetId, { from: target.role, to: role });
    }

    if (subscriptionTier === 'free' || subscriptionTier === 'pro') {
      updates.subscriptionTier = subscriptionTier;
      await logAuditAction(adminUser.sub, 'change_tier', 'user', targetId, { from: target.subscriptionTier, to: subscriptionTier });
    }

    if (disabled === true) {
      updates.disabledAt = new Date();
      updates.disabledReason = disabledReason || null;
      await logAuditAction(adminUser.sub, 'disable_user', 'user', targetId, { reason: disabledReason });
    } else if (disabled === false) {
      updates.disabledAt = null;
      updates.disabledReason = null;
      await logAuditAction(adminUser.sub, 'enable_user', 'user', targetId, {});
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

    const [target] = await db.select({ id: users.id, email: users.email })
      .from(users).where(eq(users.id, targetId)).limit(1);

    if (!target) throw new AppError(404, 'NOT_FOUND', 'User not found');

    await db.delete(users).where(eq(users.id, targetId));
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
    if (q) conditions.push(or(ilike(items.title, `%${q}%`), ilike(items.brand, `%${q}%`), ilike(items.model, `%${q}%`)));
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
    if (marketplace === 'ebay' || marketplace === 'etsy') conditions.push(eq(listings.marketplace, marketplace));
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
    if (marketplace === 'ebay' || marketplace === 'etsy') conditions.push(eq(orders.marketplace, marketplace));
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
    const [stats] = await db.select({ total: count() }).from(conversations);

    const allConvos = await db.select({
      messages: conversations.messages,
    }).from(conversations);

    let totalMessages = 0;
    for (const c of allConvos) {
      totalMessages += Array.isArray(c.messages) ? c.messages.length : 0;
    }

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
      etsy: { total: 0, healthy: 0, expiring: 0, expired: 0 },
    };

    for (const a of enriched) {
      const m = summary[a.marketplace];
      m.total++;
      m[a.status as 'healthy' | 'expiring' | 'expired']++;
    }

    res.json({ accounts: enriched, summary });
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

adminRouter.patch('/settings/:key', async (req, res, next) => {
  try {
    const adminUser = req.user!;
    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined) throw new AppError(400, 'MISSING_VALUE', 'value is required');

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
