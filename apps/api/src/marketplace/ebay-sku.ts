import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';

/**
 * Format a sequence number as a serialized eBay SKU: `PRT-000123`.
 * Pure helper, kept unit-testable without a database; the same `PRT-` + 6-digit
 * shape is produced atomically in SQL by {@link ensureItemEbaySku}.
 */
export function formatEbaySku(seq: number): string {
  return `PRT-${String(seq).padStart(6, '0')}`;
}

/**
 * Resolve the stable eBay SKU for an item, minting + persisting one on first
 * use. Called BEFORE the eBay create/publish call so the SKU survives a publish
 * that throws — the next attempt reuses it instead of churning a new one. An
 * item that already has a SKU returns it untouched (no mint, no write).
 *
 * The mint is a single atomic `UPDATE ... SET ebay_sku = COALESCE(ebay_sku, ...)`:
 * a read-then-write would let two concurrent publishes (double-click, retry,
 * second device) each mint a distinct SKU, creating a second eBay inventory_item
 * and orphaning one — the very "rapid listing frequency" ATO signal the stable
 * SKU exists to suppress. Per-row UPDATE serialization makes both callers
 * converge on the same returned SKU.
 */
export async function ensureItemEbaySku(item: { id: string; ebaySku: string | null }): Promise<string> {
  if (item.ebaySku) return item.ebaySku;
  const rows = (await db.execute(sql`
    UPDATE items
       SET ebay_sku = COALESCE(ebay_sku, 'PRT-' || lpad(nextval('portage_ebay_sku_seq')::text, 6, '0')),
           updated_at = now()
     WHERE id = ${item.id}
    RETURNING ebay_sku AS sku
  `)) as unknown as Array<{ sku: string }>;
  return rows[0].sku;
}
