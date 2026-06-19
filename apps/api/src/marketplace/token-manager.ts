import { createLogger } from '../lib/logger.js';
import { db } from '../db/index.js';
import { marketplaceAccounts } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { encrypt, decrypt } from '../lib/crypto.js';
import { env } from '../lib/env.js';
import { getEbayUserFlowCredentials } from './ebay-credentials.js';

const logger = createLogger('token-manager');

const REFRESH_BUFFER_MS = 5 * 60 * 1000;

// Identifies Portage as a registered eBay application on every API/OAuth call.
// An anonymous Node `fetch` (no User-Agent) reads as a script to eBay's bot/ATO
// layer. Canonical home is here (the lowest-level eBay module) so the adapter can
// import it without a circular dependency.
export const EBAY_USER_AGENT = 'PortageApp/1.0 (+https://portage.digitalharmonyai.com)';

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
  const { clientId, clientSecret } = getEbayUserFlowCredentials(config);
  if (!clientId || !clientSecret) {
    throw new Error('eBay credentials not configured');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const refreshToken = decrypt(account.refreshTokenEncrypted);

  const baseUrl = config.EBAY_SANDBOX
    ? 'https://api.sandbox.ebay.com'
    : 'https://api.ebay.com';

  const response = await fetch(`${baseUrl}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
      'User-Agent': EBAY_USER_AGENT,
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
      updatedAt: new Date(),
    })
    .where(eq(marketplaceAccounts.id, account.id));

  logger.info({ userId, expiresAt: newExpiresAt.toISOString() }, 'eBay token refreshed');

  return data.access_token;
}

export async function getReverbAccessToken(userId: string): Promise<string> {
  const [account] = await db.select()
    .from(marketplaceAccounts)
    .where(and(
      eq(marketplaceAccounts.userId, userId),
      eq(marketplaceAccounts.marketplace, 'reverb'),
    ))
    .limit(1);

  if (!account) {
    throw new Error('No Reverb account connected');
  }

  return decrypt(account.accessTokenEncrypted);
}

let cachedAppToken: { token: string; expiresAt: number } | null = null;
let pendingAppTokenRequest: Promise<string> | null = null;
let cachedProdAppToken: { token: string; expiresAt: number } | null = null;
let pendingProdAppTokenRequest: Promise<string> | null = null;

export function invalidateEbayAppToken(): void {
  cachedAppToken = null;
}

export function invalidateEbayProdAppToken(): void {
  cachedProdAppToken = null;
}

export async function getEbayAppToken(): Promise<string> {
  if (cachedAppToken && Date.now() < cachedAppToken.expiresAt - REFRESH_BUFFER_MS) {
    return cachedAppToken.token;
  }

  if (pendingAppTokenRequest) return pendingAppTokenRequest;

  pendingAppTokenRequest = fetchEbayAppToken(false).finally(() => {
    pendingAppTokenRequest = null;
  });
  return pendingAppTokenRequest;
}

export async function getEbayProdAppToken(): Promise<string> {
  if (cachedProdAppToken && Date.now() < cachedProdAppToken.expiresAt - REFRESH_BUFFER_MS) {
    return cachedProdAppToken.token;
  }

  if (pendingProdAppTokenRequest) return pendingProdAppTokenRequest;

  pendingProdAppTokenRequest = fetchEbayAppToken(true).finally(() => {
    pendingProdAppTokenRequest = null;
  });
  return pendingProdAppTokenRequest;
}

async function fetchEbayAppToken(forceProd: boolean): Promise<string> {
  const config = env();

  const clientId = forceProd
    ? (config.EBAY_PROD_CLIENT_ID || config.EBAY_CLIENT_ID)
    : config.EBAY_CLIENT_ID;
  const clientSecret = forceProd
    ? (config.EBAY_PROD_CLIENT_SECRET || config.EBAY_CLIENT_SECRET)
    : config.EBAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('eBay credentials not configured');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const baseUrl = forceProd
    ? 'https://api.ebay.com'
    : (config.EBAY_SANDBOX ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com');

  const response = await fetch(`${baseUrl}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
      'User-Agent': EBAY_USER_AGENT,
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'https://api.ebay.com/oauth/api_scope',
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error({ status: response.status, body: errorBody, forceProd }, 'eBay app token request failed');
    throw new Error('Failed to get eBay app token');
  }

  const data = await response.json() as {
    access_token: string;
    expires_in: number;
  };

  const cached = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  if (forceProd) {
    cachedProdAppToken = cached;
  } else {
    cachedAppToken = cached;
  }

  logger.info({ prod: forceProd }, 'eBay app token acquired');
  return data.access_token;
}
