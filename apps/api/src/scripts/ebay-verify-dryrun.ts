/**
 * Live dry-run of the Trading AddFixedPriceItem payload via VerifyAddFixedPriceItem.
 * eBay validates the EXACT payload our builder produces and returns Ack + any Errors,
 * WITHOUT creating a listing. Pre-live de-risk for the schema-corrected builder
 * (Trade-First, live-only proof). Uses the stored demo account token. Manual ops tool;
 * core (buildVerifyAddFixedPriceItemXml) is unit-tested.
 *
 *   npx tsx apps/api/src/scripts/ebay-verify-dryrun.ts [email]
 */
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, marketplaceAccounts } from '../db/schema.js';
import { getEbayAccessToken } from '../marketplace/token-manager.js';
import { buildVerifyAddFixedPriceItemXml, splitOunces, type TradingListingInput } from '../marketplace/ebay-trading-builders.js';
import { EBAY_USER_AGENT } from '../marketplace/ebay-constants.js';
import { loadEnv, env } from '../lib/env.js';

loadEnv();
const BASE = env().EBAY_SANDBOX ? 'https://api.sandbox.ebay.com/ws/api.dll' : 'https://api.ebay.com/ws/api.dll';

const { weightMajor, weightMinor } = splitOunces(24);
const sample: TradingListingInput = {
  title: 'Sennheiser HD 600 Open-Back Headphones (Trade-First dry-run)',
  description: 'Dry-run validation only - no listing is created.',
  categoryId: '112529',
  price: 149.99,
  currency: 'USD',
  quantity: 1,
  conditionId: '3000',
  conditionDescription: 'Light wear.',
  sku: 'PRT-DRYRUN-1',
  pictureUrls: ['https://i.ebayimg.com/images/g/placeholder/s-l1600.jpg'],
  aspects: { Brand: ['Sennheiser'], Model: ['HD 600'], MPN: ['Does Not Apply'], Type: ['Over-Ear'] },
  shipping: { originPostalCode: '10001', weightMajor, weightMinor, dimensions: { length: 12, width: 9, height: 6 } },
};

async function main() {
  const email = process.argv[2] ?? 'demo@portage.app';
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (!user) throw new Error(`No user with email ${email}`);
  const [acct] = await db.select({ id: marketplaceAccounts.id })
    .from(marketplaceAccounts)
    .where(and(eq(marketplaceAccounts.userId, user.id), eq(marketplaceAccounts.marketplace, 'ebay')))
    .limit(1);
  if (!acct) throw new Error(`${email} has no connected eBay account`);

  console.log(`Refreshing eBay token for ${email}...`);
  const token = await getEbayAccessToken(user.id);
  const xml = buildVerifyAddFixedPriceItemXml(sample, token);

  console.log('POST VerifyAddFixedPriceItem (no listing created)...\n');
  const res = await fetch(BASE, {
    method: 'POST',
    headers: {
      'X-EBAY-API-COMPATIBILITY-LEVEL': '1207',
      'X-EBAY-API-IAF-TOKEN': token,
      'X-EBAY-API-CALL-NAME': 'VerifyAddFixedPriceItem',
      'X-EBAY-API-SITEID': '0',
      'Content-Type': 'text/xml',
      'User-Agent': EBAY_USER_AGENT,
    },
    body: xml,
  });
  const text = await res.text();
  console.log(`HTTP ${res.status}`);
  console.log(text.replace(/></g, '>\n<'));
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
