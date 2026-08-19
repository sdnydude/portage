import { eq, and, isNotNull } from 'drizzle-orm';
import type { MarketplaceAdapter } from '@portage/shared';
import { db } from '../db/index.js';
import { orders, listings, items, marketplaceAccounts } from '../db/schema.js';
import { EbayAdapter } from '../marketplace/ebay-adapter.js';
import { ReverbAdapter } from '../marketplace/reverb-adapter.js';
import { createLogger } from './logger.js';
import { EBAY_DELETED_MARKER, EBAY_REDACTED_ADDRESS, findDeletedEbayIdentities, sweepDeletedBuyerRows } from '../marketplace/ebay-deletion-anonymize.js';

const logger = createLogger('order-sync');

export interface OrderSyncResult {
  synced: number;
  newOrders: string[];
  errors: { marketplace: string; message: string }[];
}

/**
 * Marketplace order import + heal for one user (extracted verbatim from
 * POST /orders/sync so the periodic caller (98f9f383, ship-program Phase 2)
 * and the route share one implementation). Behavior contract is pinned by
 * the orders route tests.
 */
export async function runOrderSync(userId: string): Promise<OrderSyncResult> {
  const accounts = await db.select()
    .from(marketplaceAccounts)
    .where(eq(marketplaceAccounts.userId, userId));

  if (accounts.length === 0) {
    return { synced: 0, newOrders: [], errors: [] };
  }

  // 90 days: the status/soldAt heals can only repair rows the marketplace
  // returns — a 30-day window left older mis-imported orders stuck forever.
  // (Both adapters page through the window, capped at MAX_PAGES=10 chains.)
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  let totalSynced = 0;
  const newOrderIds: string[] = [];
  const errors: { marketplace: string; message: string }[] = [];
  // Within one sync run, reuse a just-backfilled item+listing across every order
  // that shares the same marketplace listing — one local item per eBay ItemID.
  const backfilledListings = new Map<string, { id: string; itemId: string }>();

  for (const account of accounts) {
    let adapter: MarketplaceAdapter;
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

      // eBay Marketplace Account Deletion: buyers we already anonymized must
      // not be re-imported with live PII from the Fulfillment API.
      // Fail-closed: a guard failure aborts THIS account's sync (caught by the
      // per-account handler below → errors[] + durable sync log); the distinct
      // log line separates "guard broken" from ordinary marketplace failures.
      let deletedBuyers = new Map<string, string>();
      if (account.marketplace === 'ebay') {
        try {
          deletedBuyers = await findDeletedEbayIdentities(marketplaceOrders.map((o) => o.buyerUsername));
        } catch (err) {
          logger.error({ userId, err }, 'ebay_deleted_identities guard failed — eBay order sync aborted (fail-closed, compliance)');
          throw err;
        }
      }

      for (const mOrder of marketplaceOrders) {
        const buyerDeleted = deletedBuyers.has(mOrder.buyerUsername.trim().toLowerCase());
        const [existing] = await db.select({ id: orders.id, soldAt: orders.soldAt, marketplaceFees: orders.marketplaceFees, status: orders.status })
          .from(orders)
          .where(and(
            eq(orders.userId, userId),
            // Scoped by marketplace to mirror uq_orders_user_marketplace_order —
            // order numbers are only unique per shop; an unscoped match could
            // heal an unrelated same-numbered order from another marketplace.
            eq(orders.marketplace, account.marketplace),
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
          // Canceled wins over everything — a canceled+refunded order must
          // leave the ship queue no matter what the local state says.
          if (mOrder.fulfillmentStatus === 'canceled' && existing.status !== 'canceled') {
            heal.status = 'canceled';
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

        let freshlyBackfilled = false;
        if (!target) {
          freshlyBackfilled = true;
          // The order is for a listing Portage never stored (listed directly on
          // the marketplace, or predating the local DB). Reconstruct a local
          // item+listing from the live listing so the sale still imports.
          // getItemDetail is an optional MarketplaceAdapter method — adapters
          // without a live-listing read fall back to the order payload.
          const detail = adapter.getItemDetail
            ? await adapter.getItemDetail(mOrder.marketplaceListingId)
            : { found: false, title: null, photos: [], price: null, brand: null, aspects: {} as Record<string, string[]> };

          // Placeholder must name the order's real marketplace — a Reverb
          // backfill titled "eBay item …" was live-possible once Reverb
          // getOrders started returning data (review 2026-08-07).
          const title = detail.title ?? mOrder.title ?? `${account.marketplace} item ${mOrder.marketplaceListingId}`;
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
          buyerUsername: buyerDeleted ? EBAY_DELETED_MARKER : mOrder.buyerUsername,
          salePrice: mOrder.salePrice,
          shippingCost: mOrder.shippingCost,
          marketplaceFees: mOrder.marketplaceFees,
          currency: mOrder.currency,
          shippingAddress: buyerDeleted ? EBAY_REDACTED_ADDRESS : mOrder.shippingAddress,
          soldAt: mOrder.soldAt ?? new Date(),
          // The marketplace knows whether the seller already shipped —
          // importing a FULFILLED order as "needs shipping" tells the seller
          // to ship something that's already in the mail.
          status: mOrder.fulfillmentStatus === 'canceled' ? 'canceled'
            : mOrder.fulfillmentStatus === 'shipped' ? 'shipped' : 'payment_received',
        }).onConflictDoNothing().returning();

        // Empty returning = the unique index swallowed a concurrent duplicate
        // (periodic cycle vs manual sync racing the same order, review
        // 2026-08-07). The winner already imported it — but if THIS run just
        // backfilled item+listing rows for the order, they are orphaned
        // duplicates (items/listings carry no unique constraint) and must be
        // removed. Cache-hit targets are left alone: an earlier order in this
        // run already won an insert against them.
        if (!newOrder) {
          if (freshlyBackfilled) {
            await db.delete(listings).where(eq(listings.id, target.id));
            await db.delete(items).where(eq(items.id, target.itemId));
            backfilledListings.delete(cacheKey);
          }
          continue;
        }

        // A first-seen order that's ALREADY canceled must not consume the
        // listing — the sale never completed, the item is still for sale
        // (review 2026-08-07; the heal path above already had this right).
        if (matchedListing && mOrder.fulfillmentStatus !== 'canceled') {
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

      // Post-write sweep: a deletion notice can commit between the guard check
      // above and our inserts; re-check the batch and redact anything that slipped.
      if (account.marketplace === 'ebay') {
        await sweepDeletedBuyerRows(marketplaceOrders.map((o) => o.buyerUsername));
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

  return { synced: totalSynced, newOrders: newOrderIds, errors };
}
