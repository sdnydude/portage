// Burndown 3.5 probe: does the Portage SKU (eBay "Custom label") land in the
// live eBay record? Reads Trading GetItem for the Trade-First live-proof
// ItemIDs (both ended — GetItem still returns ended listings for the seller)
// and prints SKU / status / title. Run: npx tsx apps/api/src/scripts/probe-sku-getitem.ts [itemId...]
import { loadEnv } from '../lib/env.js';
import { db } from '../db/index.js';
import { marketplaceAccounts } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { EbayAdapter } from '../marketplace/ebay-adapter.js';

const ITEM_IDS = process.argv.slice(2).length > 0
  ? process.argv.slice(2)
  : ['307034606520', '307034773471'];

async function main() {
  loadEnv();
  const [account] = await db
    .select({ userId: marketplaceAccounts.userId })
    .from(marketplaceAccounts)
    .where(eq(marketplaceAccounts.marketplace, 'ebay'))
    .limit(1);
  if (!account) {
    console.error('No eBay-connected account found');
    process.exit(1);
  }

  const adapter = new EbayAdapter(account.userId);
  for (const id of ITEM_IDS) {
    const v = await adapter.getEbayItemVerification(id);
    console.log(`\n=== GetItem ${id} ===`);
    console.log('found:  ', v.found);
    console.log('SKU:    ', v.sku ?? '(none)');
    console.log('status: ', v.status);
    console.log('brand:  ', v.brand, ' MPN:', v.mpn);
    console.log('price:  ', v.price);
  }
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
