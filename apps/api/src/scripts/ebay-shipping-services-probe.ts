/**
 * Read-only probe of eBay's authoritative shipping-service catalog via
 * GeteBayDetails DetailName=ShippingServiceDetails (Trading API). Kills guessed
 * service-enum lists for the per-listing shipping controls (beta 17be7322):
 * the sheet's service <select> and the dryrun matrix must be fed from this
 * output, never from memory (e.g. USPSFirstClass is expected to be deprecated
 * → MappedTo USPSGroundAdvantage — verify here, don't assume).
 *
 * No writes of any kind: GeteBayDetails is a metadata read. Manual ops tool.
 *
 *   npx tsx apps/api/src/scripts/ebay-shipping-services-probe.ts [email] [--all] [--json]
 *
 *   --all   include international + not-valid-for-selling-flow services
 *   --json  raw JSON array (proof-artifact friendly) instead of the table
 */
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, marketplaceAccounts } from '../db/schema.js';
import { getEbayAccessToken } from '../marketplace/token-manager.js';
import { callTradingApi, escapeXml } from '../marketplace/ebay-trading-client.js';
import { loadEnv } from '../lib/env.js';

loadEnv();

interface ShippingServiceDetail {
  ShippingService: string;
  Description?: string;
  ServiceType?: string | string[];
  ShippingCategory?: string;
  ValidForSellingFlow?: boolean;
  InternationalService?: boolean;
  ExpeditedService?: boolean;
  ShippingTimeMin?: number;
  ShippingTimeMax?: number;
  DimensionsRequired?: boolean;
  WeightRequired?: boolean;
  DeprecationDetails?: {
    DeprecationReason?: string;
    MappedTo?: string;
    EventTime?: string;
  };
}

function normalizeArray<T>(val: T | T[] | undefined | null): T[] {
  if (val == null) return [];
  return Array.isArray(val) ? val : [val];
}

async function main() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter(a => a.startsWith('--')));
  const email = args.find(a => !a.startsWith('--')) ?? 'demo@portage.app';

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (!user) throw new Error(`No user with email ${email}`);
  const [acct] = await db.select({ id: marketplaceAccounts.id })
    .from(marketplaceAccounts)
    .where(and(eq(marketplaceAccounts.userId, user.id), eq(marketplaceAccounts.marketplace, 'ebay')))
    .limit(1);
  if (!acct) throw new Error(`${email} has no connected eBay account`);

  console.error(`Refreshing eBay token for ${email}...`);
  const token = await getEbayAccessToken(user.id);

  const xml =
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<GeteBayDetailsRequest xmlns="urn:ebay:apis:eBLBaseComponents">' +
    `<RequesterCredentials><eBayAuthToken>${escapeXml(token)}</eBayAuthToken></RequesterCredentials>` +
    '<DetailName>ShippingServiceDetails</DetailName>' +
    '</GeteBayDetailsRequest>';

  console.error('POST GeteBayDetails DetailName=ShippingServiceDetails (read-only)...\n');
  const parsed = await callTradingApi('GeteBayDetails', xml, token);
  const resp = (parsed as Record<string, Record<string, unknown>>).GeteBayDetailsResponse;
  const services = normalizeArray(resp?.ShippingServiceDetails as ShippingServiceDetail | ShippingServiceDetail[]);
  if (services.length === 0) throw new Error('Response carried no ShippingServiceDetails — dump the raw XML and inspect.');

  const rows = services
    .filter(s => flags.has('--all') || (s.ValidForSellingFlow === true && s.InternationalService !== true))
    .map(s => ({
      service: s.ShippingService,
      description: s.Description ?? '',
      category: s.ShippingCategory ?? '',
      types: normalizeArray(s.ServiceType).join('|'),
      days: s.ShippingTimeMin != null ? `${s.ShippingTimeMin}-${s.ShippingTimeMax}` : '',
      weightRequired: s.WeightRequired === true,
      dimsRequired: s.DimensionsRequired === true,
      deprecated: s.DeprecationDetails ? (s.DeprecationDetails.MappedTo ? `→ ${s.DeprecationDetails.MappedTo}` : 'yes') : '',
    }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.service.localeCompare(b.service));

  if (flags.has('--json')) {
    console.log(JSON.stringify(rows, null, 2));
  } else {
    console.log(`${services.length} services total, ${rows.length} shown${flags.has('--all') ? '' : ' (domestic + ValidForSellingFlow; --all for everything)'}\n`);
    console.table(rows);
    const deprecated = rows.filter(r => r.deprecated);
    if (deprecated.length > 0) {
      console.log('\nDEPRECATED (never offer these in the sheet):');
      for (const d of deprecated) console.log(`  ${d.service} ${d.deprecated}`);
    }
  }
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
