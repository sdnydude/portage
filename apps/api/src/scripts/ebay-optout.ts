/**
 * eBay Business Policies opt-out (Account API) — Trade-First refactor prereq.
 *
 * Read-only by default: lists eBay-connected users and their opted-in programs.
 * Pass an email to target one account; add --opt-out to actually opt that
 * account OUT of SELLING_POLICY_MANAGEMENT (eBay deletes its Business Policies).
 *
 *   npx tsx apps/api/src/scripts/ebay-optout.ts                 # list accounts
 *   npx tsx apps/api/src/scripts/ebay-optout.ts <email>         # show programs
 *   npx tsx apps/api/src/scripts/ebay-optout.ts <email> --opt-out
 */
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, marketplaceAccounts } from '../db/schema.js';
import { getEbayAccessToken } from '../marketplace/token-manager.js';
import { EBAY_USER_AGENT } from '../marketplace/ebay-constants.js';
import { loadEnv, env } from '../lib/env.js';

loadEnv();
const BASE = env().EBAY_SANDBOX ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';

async function accountApi(token: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}/sell/account/v1${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': EBAY_USER_AGENT,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  // opt_in/opt_out return 200 with an EMPTY body.
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(`eBay ${path} → ${res.status} ${text}`);
  }
  return json;
}

async function getPrograms(token: string): Promise<string[]> {
  const data = await accountApi(token, '/program/get_opted_in_programs') as
    { programs?: Array<{ programType?: string }> } | null;
  return (data?.programs ?? []).map(p => p.programType).filter(Boolean) as string[];
}

async function main() {
  const args = process.argv.slice(2);
  const optOut = args.includes('--opt-out');
  const email = args.find(a => !a.startsWith('--'));

  if (!email) {
    const rows = await db.select({
      email: users.email,
      mpUser: marketplaceAccounts.marketplaceUserId,
      expires: marketplaceAccounts.tokenExpiresAt,
    })
      .from(marketplaceAccounts)
      .innerJoin(users, eq(users.id, marketplaceAccounts.userId))
      .where(eq(marketplaceAccounts.marketplace, 'ebay'));
    console.log('eBay-connected accounts:');
    for (const r of rows) {
      console.log(`  ${r.email}  (eBay user: ${r.mpUser ?? '?'}, token expires ${new Date(r.expires).toISOString()})`);
    }
    console.log('\nRe-run with an email to see opted-in programs.');
    process.exit(0);
  }

  const [user] = await db.select({ id: users.id })
    .from(users).where(eq(users.email, email)).limit(1);
  if (!user) throw new Error(`No user with email ${email}`);

  const [acct] = await db.select({ id: marketplaceAccounts.id })
    .from(marketplaceAccounts)
    .where(and(eq(marketplaceAccounts.userId, user.id), eq(marketplaceAccounts.marketplace, 'ebay')))
    .limit(1);
  if (!acct) throw new Error(`${email} has no connected eBay account`);

  console.log(`Refreshing eBay token for ${email}...`);
  const token = await getEbayAccessToken(user.id);
  console.log('  token OK (refresh path works)');

  const before = await getPrograms(token);
  console.log(`\nBEFORE opted-in programs: ${before.length ? before.join(', ') : '(none)'}`);
  const isOptedIn = before.includes('SELLING_POLICY_MANAGEMENT');
  console.log(`  SELLING_POLICY_MANAGEMENT (Business Policies): ${isOptedIn ? 'OPTED IN' : 'opted out'}`);

  if (!optOut) {
    console.log('\nRead-only run. Add --opt-out to opt this account OUT of Business Policies.');
    process.exit(0);
  }

  if (!isOptedIn) {
    console.log('\nAlready opted out — nothing to do.');
    process.exit(0);
  }

  console.log('\nOpting OUT of SELLING_POLICY_MANAGEMENT...');
  await accountApi(token, '/program/opt_out', { programType: 'SELLING_POLICY_MANAGEMENT' });

  const after = await getPrograms(token);
  console.log(`AFTER opted-in programs: ${after.length ? after.join(', ') : '(none)'}`);
  console.log(after.includes('SELLING_POLICY_MANAGEMENT')
    ? '  WARNING: still shows opted in (eBay may lag — re-check).'
    : '  ✓ Opted OUT of Business Policies.');
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('FAILED:', err instanceof Error ? err.message : err);
    if (err && typeof err === 'object' && 'cause' in err) console.error('CAUSE:', (err as { cause?: unknown }).cause);
    process.exit(1);
  });
