// Ad-bump feature probe (read-only): does the seller's token reach the eBay
// Marketing API (sell.marketing scope) and what campaigns exist? Verifies the
// endpoint shape promoteListing() targets before any live publish uses it.
// Run: DATABASE_URL=... npx tsx apps/api/src/scripts/probe-marketing-campaigns.ts
import { loadEnv } from '../lib/env.js';
import { db } from '../db/index.js';
import { marketplaceAccounts } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { getEbayAccessToken } from '../marketplace/token-manager.js';

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
  const token = await getEbayAccessToken(account.userId);
  const res = await fetch(
    'https://api.ebay.com/sell/marketing/v1/ad_campaign?limit=100',
    { headers: { Authorization: `Bearer ${token}` } },
  );
  console.log('status:', res.status);
  const body = await res.json().catch(() => null) as {
    campaigns?: Array<{ campaignId: string; campaignName: string; campaignStatus: string; fundingStrategy?: { fundingModel?: string } }>;
    total?: number;
  } | null;
  console.log('total campaigns:', body?.total ?? 0);
  for (const c of body?.campaigns ?? []) {
    console.log(`- ${c.campaignId} "${c.campaignName}" ${c.campaignStatus} ${c.fundingStrategy?.fundingModel ?? ''}`);
  }
  process.exit(0);
}

main().catch((err) => { console.error('probe failed:', (err as Error).message); process.exit(1); });
