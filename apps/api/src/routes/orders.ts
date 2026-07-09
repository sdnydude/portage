import { Router } from 'express';
import { z } from 'zod';
import { eq, desc, and, isNotNull, getTableColumns } from 'drizzle-orm';
import { createLogger } from '../lib/logger.js';
import { db } from '../db/index.js';
import { orders, listings, items } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { EbayAdapter } from '../marketplace/ebay-adapter.js';
import { ReverbAdapter } from '../marketplace/reverb-adapter.js';
import { marketplaceAccounts } from '../db/schema.js';

const logger = createLogger('orders');

export const ordersRouter = Router();

ordersRouter.use(requireAuth);

const validStatuses = ['payment_received', 'label_purchased', 'shipped', 'delivered'] as const;
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
    const userId = req.user!.sub;

    const accounts = await db.select()
      .from(marketplaceAccounts)
      .where(eq(marketplaceAccounts.userId, userId));

    if (accounts.length === 0) {
      res.json({ synced: 0, newOrders: [] });
      return;
    }

    // 90 days: the status/soldAt heals can only repair rows the marketplace
    // returns — a 30-day window left older mis-imported orders stuck forever.
    // (eBay fetch caps at 50 orders per call, no pagination — acceptable at
    // current volume; widen with pagination if a seller exceeds it.)
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    let totalSynced = 0;
    const newOrderIds: string[] = [];
    const errors: { marketplace: string; message: string }[] = [];
    // Within one sync run, reuse a just-backfilled item+listing across every order
    // that shares the same marketplace listing — one local item per eBay ItemID.
    const backfilledListings = new Map<string, { id: string; itemId: string }>();

    for (const account of accounts) {
      let adapter;
      switch (account.marketplace) {
        case 'ebay':
          adapter = new EbayAdapter(userId);
          break;
        case 'reverb':
          adapter = new ReverbAdapter(userId);
          break;
        default:
          logger.warn({ userId, marketplace: account.marketplace }, 'Unsupported marketplace — skipping order sync');
          continue;
      }

      try {
        const marketplaceOrders = await adapter.getOrders(since);

        for (const mOrder of marketplaceOrders) {
          const [existing] = await db.select({ id: orders.id, soldAt: orders.soldAt, marketplaceFees: orders.marketplaceFees, status: orders.status })
            .from(orders)
            .where(and(
              eq(orders.userId, userId),
              eq(orders.marketplaceOrderId, mOrder.marketplaceOrderId),
            ))
            .limit(1);

          if (existing) {
            // Heal rows imported by older sync code in place on re-sync:
            // - soldAt was stamped with the sync time before the
            //   creationDate→soldAt mapping existed
            // - marketplaceFees held eBay's fee BASIS (item+shipping) before
            //   the adapter stopped mis-mapping totalFeeBasisAmount
            // - status stayed payment_received forever before the
            //   orderFulfillmentStatus mapping existed — the marketplace knows
            //   the seller shipped; never the other direction (a local
            //   shipped/delivered state is not downgraded).
            const heal: Record<string, unknown> = {};
            if (mOrder.soldAt && Math.abs(new Date(existing.soldAt).getTime() - mOrder.soldAt.getTime()) > 1000) {
              heal.soldAt = mOrder.soldAt;
            }
            if (existing.marketplaceFees !== mOrder.marketplaceFees) {
              heal.marketplaceFees = mOrder.marketplaceFees;
            }
            if (mOrder.fulfillmentStatus === 'shipped' && existing.status === 'payment_received') {
              heal.status = 'shipped';
            }
            if (Object.keys(heal).length > 0) {
              await db.update(orders)
                .set(heal)
                .where(eq(orders.id, existing.id));
            }
            continue;
          }

          if (!mOrder.marketplaceListingId) {
            logger.warn({
              userId,
              marketplace: account.marketplace,
              marketplaceOrderId: mOrder.marketplaceOrderId,
            }, 'Order skipped — no marketplace listing ID in response');
            continue;
          }

          const [matchedListing] = await db.select()
            .from(listings)
            .where(and(
              eq(listings.userId, userId),
              eq(listings.marketplace, account.marketplace),
              eq(listings.marketplaceListingId, mOrder.marketplaceListingId),
              isNotNull(listings.marketplaceListingId),
            ))
            .limit(1);

          let target: { id: string; itemId: string } | undefined = matchedListing
            ? { id: matchedListing.id, itemId: matchedListing.itemId }
            : undefined;

          const cacheKey = `${account.marketplace}:${mOrder.marketplaceListingId}`;
          if (!target) target = backfilledListings.get(cacheKey);

          if (!target) {
            // The order is for a listing Portage never stored (listed directly on
            // the marketplace, or predating the local DB). Reconstruct a local
            // item+listing from the live listing so the sale still imports.
            const detail = typeof (adapter as { getItemDetail?: unknown }).getItemDetail === 'function'
              ? await (adapter as { getItemDetail: (id: string) => Promise<{ found: boolean; title: string | null; photos: string[]; price: number | null; brand: string | null; aspects: Record<string, string[]> }> }).getItemDetail(mOrder.marketplaceListingId)
              : { found: false, title: null, photos: [], price: null, brand: null, aspects: {} };

            const title = detail.title ?? mOrder.title ?? `eBay item ${mOrder.marketplaceListingId}`;
            const price = detail.price ?? mOrder.salePrice;
            const photos = detail.photos.map((url, i) => ({ url, isPrimary: i === 0 }));

            const [newItem] = await db.insert(items).values({
              userId,
              title,
              photos,
              price,
              brand: detail.brand ?? '',
              aspects: detail.aspects,
            }).returning({ id: items.id });

            const [newListing] = await db.insert(listings).values({
              itemId: newItem.id,
              userId,
              marketplace: account.marketplace,
              marketplaceListingId: mOrder.marketplaceListingId,
              status: 'sold',
              price,
              currency: mOrder.currency,
              soldAt: mOrder.soldAt ?? new Date(),
              publishedAt: new Date(),
            }).returning({ id: listings.id });

            target = { id: newListing.id, itemId: newItem.id };
            backfilledListings.set(cacheKey, target);
          }

          const [newOrder] = await db.insert(orders).values({
            listingId: target.id,
            itemId: target.itemId,
            userId,
            marketplace: account.marketplace,
            marketplaceOrderId: mOrder.marketplaceOrderId,
            buyerUsername: mOrder.buyerUsername,
            salePrice: mOrder.salePrice,
            shippingCost: mOrder.shippingCost,
            marketplaceFees: mOrder.marketplaceFees,
            currency: mOrder.currency,
            shippingAddress: mOrder.shippingAddress,
            soldAt: mOrder.soldAt ?? new Date(),
            // The marketplace knows whether the seller already shipped —
            // importing a FULFILLED order as "needs shipping" tells the seller
            // to ship something that's already in the mail.
            status: mOrder.fulfillmentStatus === 'shipped' ? 'shipped' : 'payment_received',
          }).returning();

          if (matchedListing) {
            await db.update(listings)
              .set({ status: 'sold', soldAt: mOrder.soldAt ?? new Date(), updatedAt: new Date() })
              .where(eq(listings.id, matchedListing.id));
          }

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
        const message = err instanceof Error ? err.message : 'Unknown error';
        errors.push({ marketplace: account.marketplace, message });
        logger.error({
          userId,
          marketplace: account.marketplace,
          err,
        }, 'Failed to sync orders from marketplace');
      }
    }

    res.json({ synced: totalSynced, newOrders: newOrderIds, errors });
  } catch (err) {
    next(err);
  }
});
