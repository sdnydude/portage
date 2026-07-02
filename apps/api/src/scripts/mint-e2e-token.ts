// Dev helper: mint a short-lived access token for the demo user without
// going through the rate-limited /auth/login (auth limiter blocks rapid
// consecutive e2e/proof runs). Prints the token to stdout.
import { loadEnv } from '../lib/env.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { signAccessToken } from '../lib/jwt.js';

const EMAIL = process.argv[2] ?? 'demo@portage.app';

async function main() {
  loadEnv();
  const [user] = await db.select().from(users).where(eq(users.email, EMAIL)).limit(1);
  if (!user) {
    console.error(`No user ${EMAIL}`);
    process.exit(1);
  }
  console.log(signAccessToken({
    sub: user.id,
    email: user.email,
    tier: user.subscriptionTier as 'free' | 'pro',
    role: user.role as 'user' | 'admin',
  }));
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
