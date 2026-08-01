/**
 * Live dry-run of the Trading AddFixedPriceItem payload via VerifyAddFixedPriceItem.
 * eBay validates the EXACT payload our builder produces and returns Ack + any Errors,
 * WITHOUT creating a listing. Pre-live de-risk for the schema-corrected builder
 * (Trade-First, live-only proof). Uses the stored demo account token. Manual ops tool;
 * core (buildVerifyAddFixedPriceItemXml) is unit-tested.
 *
 *   npx tsx apps/api/src/scripts/ebay-verify-dryrun.ts [email] [flags]
 *
 * Shipping-matrix flags (per-listing shipping controls, beta 17be7322 — the
 * VERIFY-FIRST protocol: run this matrix and record Ack outputs BEFORE the
 * builder learns flat/free, so tests freeze on eBay-verified shapes, not
 * guesses):
 *
 *   --method calculated|flat|free   shipping shape to validate (default calculated)
 *   --cost <n>                      flat-rate buyer cost (default 5.00; method=flat)
 *   --service <name>                eBay ShippingService enum (from the
 *                                   ebay-shipping-services-probe output ONLY)
 *   --handling <days>               DispatchTimeMax (builder default 1)
 *   --no-weight                     drop ShippingPackageDetails entirely
 *                                   (hypothesis: legal for flat/free)
 *   --omit-cost                     free variant WITHOUT the explicit 0.00 cost tag
 *
 * calculated/--service/--handling ride the production builder (those inputs
 * already exist on TradingListingInput). flat/free and --no-weight are
 * HYPOTHESIS shapes swapped into the builder's output here, in the script —
 * production builders stay untouched until this matrix returns Ack=Success.
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

const args = process.argv.slice(2);
const VALUE_FLAGS = ['--method', '--cost', '--service', '--handling'];
function flagValue(name: string): string | undefined {
  const eq = args.find(a => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}
// Positional email = any arg that is neither a flag nor a value consumed by a
// space-separated value flag (--method flat).
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && VALUE_FLAGS.includes(args[i - 1])));
const method = (flagValue('--method') ?? 'calculated') as 'calculated' | 'flat' | 'free';
if (!['calculated', 'flat', 'free'].includes(method)) throw new Error(`Unknown --method ${method}`);
const flatCost = Number(flagValue('--cost') ?? '5.00');
const service = flagValue('--service');
const handling = flagValue('--handling');
const noWeight = args.includes('--no-weight');
const omitCost = args.includes('--omit-cost');

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
  // Connectivity + Color became required for 112529 (live Ack=Failure 2026-08-01
  // without them) — keep the sample listable so matrix failures mean SHIPPING.
  aspects: { Brand: ['Sennheiser'], Model: ['HD 600'], MPN: ['Does Not Apply'], Type: ['Over-Ear'], Connectivity: ['Wired'], Color: ['Black'] },
  // service rides the production builder (TradingListingInput.shipping.service
  // already exists); flat/free below are script-local hypothesis swaps.
  shipping: { originPostalCode: '10001', weightMajor, weightMinor, dimensions: { length: 12, width: 9, height: 6 }, ...(service ? { service } : {}) },
  ...(handling ? { dispatchTimeMax: Number(handling) } : {}),
};

/** HYPOTHESIS ShippingDetails for flat/free — the shapes under live test. Flat:
 * ShippingType Flat + ShippingServiceCost, no CalculatedShippingRate. Free:
 * same + FreeShipping true and (unless --omit-cost) an explicit 0.00 cost.
 * Promoted into ebay-trading-builders.ts ONLY after Ack=Success here. */
function hypothesisShippingDetails(): string {
  const svc = service ?? 'USPSPriority';
  const cost = method === 'free' ? '0.00' : flatCost.toFixed(2);
  return (
    '<ShippingDetails>' +
    '<ShippingType>Flat</ShippingType>' +
    '<ShippingServiceOptions>' +
    '<ShippingServicePriority>1</ShippingServicePriority>' +
    `<ShippingService>${svc}</ShippingService>` +
    (method === 'free' && omitCost ? '' : `<ShippingServiceCost currencyID="USD">${cost}</ShippingServiceCost>`) +
    (method === 'free' ? '<FreeShipping>true</FreeShipping>' : '') +
    '</ShippingServiceOptions>' +
    '</ShippingDetails>'
  );
}

/** Swap the builder's Calculated ShippingDetails (and optionally the
 * ShippingPackageDetails block) for the hypothesis shapes. Segment surgery on
 * known builder output — both blocks are flat (no nesting), so the lazy match
 * is safe. */
function applyHypotheses(xml: string): string {
  let out = xml;
  if (method !== 'calculated') {
    out = out.replace(/<ShippingDetails>[\s\S]*?<\/ShippingDetails>/, hypothesisShippingDetails());
  }
  if (noWeight) {
    out = out.replace(/<ShippingPackageDetails>[\s\S]*?<\/ShippingPackageDetails>/, '');
  }
  return out;
}

async function main() {
  const email = positional[0] ?? 'demo@portage.app';
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (!user) throw new Error(`No user with email ${email}`);
  const [acct] = await db.select({ id: marketplaceAccounts.id })
    .from(marketplaceAccounts)
    .where(and(eq(marketplaceAccounts.userId, user.id), eq(marketplaceAccounts.marketplace, 'ebay')))
    .limit(1);
  if (!acct) throw new Error(`${email} has no connected eBay account`);

  console.log(`Refreshing eBay token for ${email}...`);
  const token = await getEbayAccessToken(user.id);
  const xml = applyHypotheses(buildVerifyAddFixedPriceItemXml(sample, token));

  // Echo the exact shipping segments under test so each Ack artifact is
  // self-describing (which hypothesis produced this verdict).
  console.log(`Matrix case: method=${method}${method === 'flat' ? ` cost=${flatCost.toFixed(2)}` : ''}${service ? ` service=${service}` : ''}${handling ? ` handling=${handling}` : ''}${noWeight ? ' no-weight' : ''}${omitCost ? ' omit-cost' : ''}`);
  console.log(xml.match(/<ShippingDetails>[\s\S]*?<\/ShippingDetails>/)?.[0].replace(/></g, '>\n<') ?? '(no ShippingDetails)');
  console.log(noWeight ? '(ShippingPackageDetails dropped)\n' : '');
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
