import { pino } from 'pino';
import { db } from '../db/index.js';
import { marketplaceAccounts } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { encrypt, decrypt } from '../lib/crypto.js';
import { env } from '../lib/env.js';

const logger = pino({ name: 'token-manager' });

const REFRESH_BUFFER_MS = 5 * 60 * 1000;

export async function getEbayAccessToken(userId: string): Promise<string> {
  const [account] = await db.select()
    .from(marketplaceAccounts)
    .where(and(
      eq(marketplaceAccounts.userId, userId),
      eq(marketplaceAccounts.marketplace, 'ebay'),
    ))
    .limit(1);

  if (!account) {
    throw new Error('No eBay account connected');
  }

  const expiresAt = new Date(account.tokenExpiresAt).getTime();
  const now = Date.now();

  if (now < expiresAt - REFRESH_BUFFER_MS) {
    return decrypt(account.accessTokenEncrypted);
  }

  logger.info({ userId }, 'Refreshing eBay access token');

  const config = env();
  if (!config.EBAY_CLIENT_ID || !config.EBAY_CLIENT_SECRET) {
    throw new Error('eBay credentials not configured');
  }

  const credentials = Buffer.from(`${config.EBAY_CLIENT_ID}:${config.EBAY_CLIENT_SECRET}`).toString('base64');
  const refreshToken = decrypt(account.refreshTokenEncrypted);

  const baseUrl = config.EBAY_SANDBOX
    ? 'https://api.sandbox.ebay.com'
    : 'https://api.ebay.com';

  const response = await fetch(`${baseUrl}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error({ status: response.status, body: errorBody }, 'eBay token refresh failed');
    throw new Error('Failed to refresh eBay access token');
  }

  const data = await response.json() as {
    access_token: string;
    expires_in: number;
  };

  const newExpiresAt = new Date(Date.now() + data.expires_in * 1000);

  await db.update(marketplaceAccounts)
    .set({
      accessTokenEncrypted: encrypt(data.access_token),
      tokenExpiresAt: newExpiresAt,
    })
    .where(eq(marketplaceAccounts.id, account.id));

  logger.info({ userId, expiresAt: newExpiresAt.toISOString() }, 'eBay token refreshed');

  return data.access_token;
}
