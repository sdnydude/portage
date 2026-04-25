import { Router } from 'express';
import { eq, desc, sql, and } from 'drizzle-orm';
import { pino } from 'pino';
import { db } from '../db/index.js';
import { items, listings, orders, users } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';

const logger = pino({ name: 'dashboard' });

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get('/', async (req, res, next) => {
  try {
    const userId = req.user!.sub;

    const [
      itemStats,
      recentListingsData,
      pendingShipmentsData,
      userRecord,
      listingStats,
      orderStats,
    ] = await Promise.all([
      // Portfolio value: sum of recommended values, count of items
      db.select({
        totalItems: sql<number>`count(*)`,
        totalValueLow: sql<number>`coalesce(sum(${items.estimatedValueMin}), 0)`,
        totalValueHigh: sql<number>`coalesce(sum(${items.estimatedValueMax}), 0)`,
        totalValueRecommended: sql<number>`coalesce(sum(${items.estimatedValueRecommended}), 0)`,
      })
        .from(items)
        .where(eq(items.userId, userId)),

      // Recent listings (last 10, with item title)
      db.select({
        id: listings.id,
        itemId: listings.itemId,
        marketplace: listings.marketplace,
        status: listings.status,
        price: listings.price,
        currency: listings.currency,
        createdAt: listings.createdAt,
        publishedAt: listings.publishedAt,
        itemTitle: items.title,
        itemPhoto: items.photos,
      })
        .from(listings)
        .innerJoin(items, eq(listings.itemId, items.id))
        .where(eq(listings.userId, userId))
        .orderBy(desc(listings.createdAt))
        .limit(10),

      // Pending shipments (orders with status payment_received)
      db.select({
        id: orders.id,
        marketplace: orders.marketplace,
        buyerUsername: orders.buyerUsername,
        salePrice: orders.salePrice,
        currency: orders.currency,
        status: orders.status,
        soldAt: orders.soldAt,
        itemTitle: items.title,
      })
        .from(orders)
        .innerJoin(items, eq(orders.itemId, items.id))
        .where(and(eq(orders.userId, userId), eq(orders.status, 'payment_received')))
        .orderBy(desc(orders.soldAt))
        .limit(5),

      // User display name
      db.select({
        displayName: users.displayName,
        email: users.email,
      })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1),

      // Listing counts by status
      db.select({
        status: listings.status,
        count: sql<number>`count(*)`,
      })
        .from(listings)
        .where(eq(listings.userId, userId))
        .groupBy(listings.status),

      // Order summary: total revenue
      db.select({
        totalOrders: sql<number>`count(*)`,
        totalRevenue: sql<number>`coalesce(sum(${orders.salePrice}), 0)`,
      })
        .from(orders)
        .where(eq(orders.userId, userId)),
    ]);

    const portfolio = itemStats[0] ?? {
      totalItems: 0,
      totalValueLow: 0,
      totalValueHigh: 0,
      totalValueRecommended: 0,
    };

    const listingCounts: Record<string, number> = {};
    for (const row of listingStats) {
      listingCounts[row.status] = Number(row.count);
    }

    const recentListings = recentListingsData.map((l) => {
      const photos = l.itemPhoto as Array<{ url: string; isPrimary?: boolean }>;
      const primaryPhoto = photos?.find((p) => p.isPrimary) ?? photos?.[0];
      return {
        id: l.id,
        itemId: l.itemId,
        marketplace: l.marketplace,
        status: l.status,
        price: l.price,
        currency: l.currency,
        createdAt: l.createdAt,
        publishedAt: l.publishedAt,
        itemTitle: l.itemTitle,
        itemPhotoUrl: primaryPhoto?.url ?? null,
      };
    });

    const pendingShipments = pendingShipmentsData.map((o) => ({
      id: o.id,
      marketplace: o.marketplace,
      buyerUsername: o.buyerUsername,
      salePrice: o.salePrice,
      currency: o.currency,
      status: o.status,
      soldAt: o.soldAt,
      itemTitle: o.itemTitle,
    }));

    const displayName = userRecord[0]?.displayName
      ?? userRecord[0]?.email?.split('@')[0]
      ?? 'there';

    logger.debug({ userId }, 'Dashboard loaded');

    res.json({
      displayName,
      portfolio: {
        totalItems: Number(portfolio.totalItems),
        totalValueLow: Number(portfolio.totalValueLow),
        totalValueHigh: Number(portfolio.totalValueHigh),
        totalValueRecommended: Number(portfolio.totalValueRecommended),
      },
      recentListings,
      pendingShipments,
      stats: {
        activeListings: listingCounts.active ?? 0,
        draftListings: listingCounts.draft ?? 0,
        soldListings: listingCounts.sold ?? 0,
        totalOrders: Number(orderStats[0]?.totalOrders ?? 0),
        totalRevenue: Number(orderStats[0]?.totalRevenue ?? 0),
      },
    });
  } catch (err) {
    next(err);
  }
});
