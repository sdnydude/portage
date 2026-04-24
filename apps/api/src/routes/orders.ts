import { Router } from 'express';
import { z } from 'zod';
import { eq, desc, and } from 'drizzle-orm';
import { pino } from 'pino';
import { db } from '../db/index.js';
import { orders, listings } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { EbayAdapter } from '../marketplace/ebay-adapter.js';
import { EtsyAdapter } from '../marketplace/etsy-adapter.js';
import { marketplaceAccounts } from '../db/schema.js';

const logger = pino({ name: 'orders' });

export const ordersRouter = Router();

ordersRouter.use(requireAuth);

ordersRouter.get('/', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const status = req.query.status as string | undefined;

    const conditions = [eq(orders.userId, userId)];
    if (status) {
      conditions.push(eq(orders.status, status as 'payment_received' | 'label_purchased' | 'shipped' | 'delivered'));
    }

    const results = await db.select()
      .from(orders)
      .where(and(...conditions))
      .orderBy(desc(orders.soldAt));

    res.json({ orders: results });
  } catch (err) {
    next(err);
  }
});

ordersRouter.get('/:id', async (req, res, next) => {
  try {
    const userId = req.user!.sub;

    const [order] = await db.select()
      .from(orders)
      .where(and(eq(orders.id, req.params.id), eq(orders.userId, userId)))
      .limit(1);

    if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found');

    res.json(order);
  } catch (err) {
    next(err);
  }
});

const updateOrderSchema = z.object({
  status: z.enum(['payment_received', 'label_purchased', 'shipped', 'delivered']).optional(),
  trackingNumber: z.string().optional(),
  carrier: z.string().optional(),
  shippingLabelUrl: z.string().url().optional(),
});

ordersRouter.patch('/:id', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const body = updateOrderSchema.parse(req.body);

    const [existing] = await db.select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.id, req.params.id), eq(orders.userId, userId)))
      .limit(1);

    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Order not found');

    const updates: Record<string, unknown> = {};
    if (body.status) updates.status = body.status;
    if (body.trackingNumber) updates.trackingNumber = body.trackingNumber;
    if (body.carrier) updates.carrier = body.carrier;
    if (body.shippingLabelUrl) updates.shippingLabelUrl = body.shippingLabelUrl;
    if (body.status === 'shipped') updates.shippedAt = new Date();
    if (body.status === 'delivered') updates.deliveredAt = new Date();

    const [updated] = await db.update(orders)
      .set(updates)
      .where(eq(orders.id, req.params.id))
      .returning();

    logger.info({ userId, orderId: updated.id, status: body.status }, 'Order updated');

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

ordersRouter.post('/sync', async (req, res, next) => {
  try {
    const userId = req.user!.sub;

    const accounts = await db.select()
      .from(marketplaceAccounts)
      .where(eq(marketplaceAccounts.userId, userId));

    if (accounts.length === 0) {
      res.json({ synced: 0, newOrders: [] });
      return;
    }

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let totalSynced = 0;
    const newOrderIds: string[] = [];

    for (const account of accounts) {
      const adapter = account.marketplace === 'ebay'
        ? new EbayAdapter(userId)
        : new EtsyAdapter(userId);

      try {
        const marketplaceOrders = await adapter.getOrders(since);

        for (const mOrder of marketplaceOrders) {
          const [existing] = await db.select({ id: orders.id })
            .from(orders)
            .where(and(
              eq(orders.userId, userId),
              eq(orders.marketplaceOrderId, mOrder.marketplaceOrderId),
            ))
            .limit(1);

          if (existing) continue;

          const [activeListing] = await db.select()
            .from(listings)
            .where(and(
              eq(listings.userId, userId),
              eq(listings.marketplace, account.marketplace),
              eq(listings.status, 'active'),
            ))
            .limit(1);

          if (!activeListing) continue;

          const [newOrder] = await db.insert(orders).values({
            listingId: activeListing.id,
            itemId: activeListing.itemId,
            userId,
            marketplace: account.marketplace,
            marketplaceOrderId: mOrder.marketplaceOrderId,
            buyerUsername: mOrder.buyerUsername,
            salePrice: mOrder.salePrice,
            shippingCost: mOrder.shippingCost,
            marketplaceFees: mOrder.marketplaceFees,
            currency: mOrder.currency,
            status: 'payment_received',
          }).returning();

          await db.update(listings)
            .set({ status: 'sold', soldAt: new Date() })
            .where(eq(listings.id, activeListing.id));

          newOrderIds.push(newOrder.id);
          totalSynced++;

          logger.info({
            userId,
            orderId: newOrder.id,
            marketplace: account.marketplace,
            marketplaceOrderId: mOrder.marketplaceOrderId,
          }, 'Order synced and listing marked sold');
        }
      } catch (err) {
        logger.warn({
          marketplace: account.marketplace,
          err: (err as Error).message,
        }, 'Failed to sync orders from marketplace');
      }
    }

    res.json({ synced: totalSynced, newOrders: newOrderIds });
  } catch (err) {
    next(err);
  }
});
