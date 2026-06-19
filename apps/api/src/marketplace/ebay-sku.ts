import { db } from '../db/index.js';
import { sql, eq } from 'drizzle-orm';
import { items } from '../db/schema.js';

/**
 * Format a sequence number as a serialized eBay SKU: `PRT-000123`.
 * Pure — split out from {@link mintEbaySku} so the format is unit-testable
 * without a database.
 */
export function formatEbaySku(seq: number): string {
  return `PRT-${String(seq).padStart(6, '0')}`;
}

/**
 * Mint the next serialized eBay SKU from the `portage_ebay_sku_seq` sequence.
 * Minted ONCE per item and persisted on `items.ebaySku`; reusing the same SKU
 * keeps eBay's inventory_item PUT idempotent, so a failed-then-retried publish
 * never creates a second inventory item/offer — the "rapid listing frequency"
 * signal that trips eBay's ATO protection.
 */
export async function mintEbaySku(): Promise<string> {
  const rows = (await db.execute(
    sql`SELECT nextval('portage_ebay_sku_seq') AS seq`,
  )) as unknown as Array<{ seq: string | number }>;
  return formatEbaySku(Number(rows[0].seq));
}

/**
 * Resolve the stable eBay SKU for an item, minting + persisting one on first
 * use. Called BEFORE the eBay create/publish call so the SKU survives a publish
 * that throws — the next attempt reuses it instead of churning a new one. An
 * item that already has a SKU returns it untouched (no mint, no write).
 */
export async function ensureItemEbaySku(item: { id: string; ebaySku: string | null }): Promise<string> {
  if (item.ebaySku) return item.ebaySku;
  const sku = await mintEbaySku();
  await db.update(items).set({ ebaySku: sku, updatedAt: new Date() }).where(eq(items.id, item.id));
  return sku;
}
