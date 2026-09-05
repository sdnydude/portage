import { Router } from 'express';
import { z } from 'zod';
import { eq, desc, and, getTableColumns } from 'drizzle-orm';
import { createLogger } from '../lib/logger.js';
import { db } from '../db/index.js';
import { orders, listings, items } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { runOrderSync } from '../lib/order-sync.js';

const logger = createLogger('orders');

export const ordersRouter = Router();

ordersRouter.use(requireAuth);

const validStatuses = ['payment_received', 'label_purchased', 'shipped', 'delivered', 'canceled'] as const;
type OrderStatus = typeof validStatuses[number];

ordersRouter.get('/', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const statusParam = req.query.status as string | undefined;
    const status: OrderStatus | undefined = statusParam && validStatuses.includes(statusParam as OrderStatus)
      ? statusParam as OrderStatus
      : undefined;

    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const conditions = [eq(orders.userId, userId)];
    if (status) {
      conditions.push(eq(orders.status, status));
    }

    // Join the listing so each order carries its eBay ItemID (marketplaceListingId)
    // + marketplace — the UI links "Ship It" to the eBay item page from these —
    // and the item so the sold list can render thumbnail + title rows.
    const results = await db.select({
      ...getTableColumns(orders),
      ebayItemId: listings.marketplaceListingId,
      listingMarketplace: listings.marketplace,
      itemTitle: items.title,
      itemPhotos: items.photos,
    })
      .from(orders)
      .leftJoin(listings, eq(orders.listingId, listings.id))
      .leftJoin(items, eq(orders.itemId, items.id))
      .where(and(...conditions))
      .orderBy(desc(orders.soldAt))
      .limit(limit)
      .offset(offset);

    res.json({ orders: results, pagination: { limit, offset } });
  } catch (err) {
    next(err);
  }
});

ordersRouter.get('/:id', async (req, res, next) => {
  try {
    const userId = req.user!.sub;

    const [order] = await db.select({
      ...getTableColumns(orders),
      ebayItemId: listings.marketplaceListingId,
      listingMarketplace: listings.marketplace,
    })
      .from(orders)
      .leftJoin(listings, eq(orders.listingId, listings.id))
      .where(and(eq(orders.id, req.params.id), eq(orders.userId, userId)))
      .limit(1);

    if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found');

    // The order detail + ship pages render the item's title and photos.
    // The FK (onDelete: restrict) means the item should always exist; the
    // null path is purely defensive (transient DB error / future soft-delete)
    // and must not take down the whole order view.
    let item: { id: string; title: string; photos: unknown } | null = null;
    try {
      const [row] = await db.select({ id: items.id, title: items.title, photos: items.photos })
        .from(items)
        .where(eq(items.id, order.itemId))
        .limit(1);
      item = row ?? null;
    } catch (itemErr) {
      logger.warn({ orderId: order.id, err: itemErr instanceof Error ? itemErr.message : String(itemErr) }, 'Order item fetch failed — returning order without item');
    }

    res.json({ ...order, item });
  } catch (err) {
    next(err);
  }
});

const updateOrderSchema = z.object({
  status: z.enum(['payment_received', 'label_purchased', 'shipped', 'delivered', 'canceled']).optional(),
  trackingNumber: z.string().optional(),
  carrier: z.string().optional(),
  shippingLabelUrl: z.url().optional(),
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

    if (Object.keys(updates).length === 0) {
      throw new AppError(400, 'NO_CHANGES', 'No valid fields to update');
    }

    const [updated] = await db.update(orders)
      .set(updates)
      .where(and(eq(orders.id, req.params.id), eq(orders.userId, userId)))
      .returning();

    logger.info({ userId, orderId: updated.id, status: body.status }, 'Order updated');

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

ordersRouter.post('/sync', async (req, res, next) => {
  try {
    // Extracted to lib/order-sync.ts (Phase 2, 98f9f383) so the periodic
    // worker caller and this manual endpoint share one implementation.
    const result = await runOrderSync(req.user!.sub);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
