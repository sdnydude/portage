// One-shot read-only probe (not wired anywhere): fetch GET /listings/:id/images
// with the owner's per-user token to pin the real response shape before
// building the per-image DELETE support. Usage:
//   npx tsx apps/api/src/scripts/probe-reverb-images.ts <email> <listingId>
import { loadEnv } from '../lib/env.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { getReverbAccessToken } from '../marketplace/token-manager.js';

const EMAIL = process.argv[2];
const LISTING_ID = process.argv[3];

async function main() {
  loadEnv();
  if (!EMAIL || !LISTING_ID) {
    console.error('usage: probe-reverb-images.ts <email> <listingId>');
    process.exit(1);
  }
  const [user] = await db.select().from(users).where(eq(users.email, EMAIL)).limit(1);
  if (!user) { console.error(`No user ${EMAIL}`); process.exit(1); }
  const token = await getReverbAccessToken(user.id);
  const res = await fetch(`https://api.reverb.com/api/listings/${LISTING_ID}/images`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/hal+json',
      'Content-Type': 'application/hal+json',
      'Accept-Version': '3.0',
    },
  });
  console.log('status:', res.status);
  const body = await res.text();
  try {
    const json = JSON.parse(body) as Record<string, unknown>;
    console.log('top-level keys:', Object.keys(json));
    for (const [k, v] of Object.entries(json)) {
      if (Array.isArray(v) && v.length && typeof v[0] === 'object') {
        console.log(`${k}[0] keys:`, Object.keys(v[0] as object));
        console.log(`${k}[0]:`, JSON.stringify(v[0]).slice(0, 400));
      }
    }
  } catch {
    console.log(body.slice(0, 400));
  }
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
