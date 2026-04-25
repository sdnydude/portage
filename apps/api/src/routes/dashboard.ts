import { Router } from 'express';
import { db } from '../db/index.js';
import { items, listings, orders, marketplaceAccounts } from '../db/schema.js';
import { eq, sql, desc, count, sum, and } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

dashboardRouter.get('/', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [portfolio, listingStats, salesStats, recentItems, recentOrders, unlistedItems, connectedMarketplaces] = await Promise.all([
      // Portfolio: total items, estimated value range
      db.select({
        totalItems: count(),
        totalValueLow: sum(items.estimatedValueMin),
        totalValueHigh: sum(items.estimatedValueMax),
        totalValueRecommended: sum(items.estimatedValueRecommended),
      }).from(items).where(eq(items.userId, userId)).then(r => r[0]),

      // Listings: active count, total active value
      db.select({
        activeCount: count(sql`CASE WHEN ${listings.status} = 'active' THEN 1 END`),
        draftCount: count(sql`CASE WHEN ${listings.status} = 'draft' THEN 1 END`),
        soldCount: count(sql`CASE WHEN ${listings.status} = 'sold' THEN 1 END`),
        activeValue: sum(sql`CASE WHEN ${listings.status} = 'active' THEN ${listings.price} ELSE 0 END`),
      }).from(listings).where(eq(listings.userId, userId)).then(r => r[0]),

      // Sales this month: count + revenue
      db.select({
        ordersThisMonth: count(),
        revenueThisMonth: sum(orders.salePrice),
        feesThisMonth: sum(orders.marketplaceFees),
      }).from(orders).where(
        and(eq(orders.userId, userId), sql`${orders.soldAt} >= ${monthStart}`)
      ).then(r => r[0]),

      // Recent items (last 5)
      db.select({
        id: items.id,
        title: items.title,
        category: items.category,
        photos: items.photos,
        estimatedValueRecommended: items.estimatedValueRecommended,
        createdAt: items.createdAt,
      }).from(items)
        .where(eq(items.userId, userId))
        .orderBy(desc(items.createdAt))
        .limit(5),

      // Recent orders (last 5)
      db.select({
        id: orders.id,
        salePrice: orders.salePrice,
        marketplace: orders.marketplace,
        buyerUsername: orders.buyerUsername,
        status: orders.status,
        soldAt: orders.soldAt,
      }).from(orders)
        .where(eq(orders.userId, userId))
        .orderBy(desc(orders.soldAt))
        .limit(5),

      // Items without listings (opportunity)
      db.select({ count: count() })
        .from(items)
        .where(and(
          eq(items.userId, userId),
          sql`NOT EXISTS (SELECT 1 FROM ${listings} WHERE ${listings.itemId} = ${items.id})`
        ))
        .then((r: { count: number }[]) => r[0]?.count ?? 0),

      // Connected marketplaces
      db.select({
        marketplace: marketplaceAccounts.marketplace,
      }).from(marketplaceAccounts)
        .where(eq(marketplaceAccounts.userId, userId)),
    ]);

    res.json({
      portfolio: {
        totalItems: portfolio.totalItems,
        estimatedValue: {
          low: Number(portfolio.totalValueLow) || 0,
          high: Number(portfolio.totalValueHigh) || 0,
          recommended: Number(portfolio.totalValueRecommended) || 0,
        },
      },
      listings: {
        active: listingStats.activeCount,
        drafts: listingStats.draftCount,
        sold: listingStats.soldCount,
        activeValue: Number(listingStats.activeValue) || 0,
      },
      sales: {
        ordersThisMonth: salesStats.ordersThisMonth,
        revenueThisMonth: Number(salesStats.revenueThisMonth) || 0,
        feesThisMonth: Number(salesStats.feesThisMonth) || 0,
        netRevenueThisMonth: (Number(salesStats.revenueThisMonth) || 0) - (Number(salesStats.feesThisMonth) || 0),
      },
      recentItems,
      recentOrders,
      momentum: {
        unlistedItems: Number(unlistedItems),
        connectedMarketplaces: connectedMarketplaces.map((m: { marketplace: string }) => m.marketplace),
      },
    });
  } catch (err) {
    next(err);
  }
});
