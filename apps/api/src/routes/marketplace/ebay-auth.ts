import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { createLogger } from '../../lib/logger.js';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { AppError } from '../../middleware/error.js';
import { env } from '../../lib/env.js';
import { encrypt } from '../../lib/crypto.js';
import { db } from '../../db/index.js';
import { marketplaceAccounts } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { checkMarketplaceLimit } from '../../lib/billing-utils.js';
import { getEbayUserFlowCredentials } from '../../marketplace/ebay-credentials.js';

const logger = createLogger('ebay-auth');

const stateStore = new Map<string, { userId: string; expiresAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of stateStore) {
    if (val.expiresAt < now) stateStore.delete(key);
  }
}, 60_000).unref();

export const ebayAuthRouter = Router();

ebayAuthRouter.use(requireAuth);

function ebayBaseUrl(): string {
  return env().EBAY_SANDBOX
    ? 'https://api.sandbox.ebay.com'
    : 'https://api.ebay.com';
}

function ebayAuthUrl(): string {
  return env().EBAY_SANDBOX
    ? 'https://auth.sandbox.ebay.com'
    : 'https://auth.ebay.com';
}

ebayAuthRouter.get('/connect', async (req, res, next) => {
  try {
  const config = env();
  const { clientId } = getEbayUserFlowCredentials(config);
  if (!clientId || !config.EBAY_REDIRECT_URI) {
    throw new AppError(503, 'EBAY_NOT_CONFIGURED', 'eBay integration is not configured');
  }

  const userId = req.user!.sub;
  const existing = await db.select({ id: marketplaceAccounts.id })
    .from(marketplaceAccounts)
    .where(and(eq(marketplaceAccounts.userId, userId), eq(marketplaceAccounts.marketplace, 'ebay')))
    .limit(1);
  if (existing.length === 0) {
    await checkMarketplaceLimit(userId);
  }

  const scopes = [
    'https://api.ebay.com/oauth/api_scope/sell.inventory',
    'https://api.ebay.com/oauth/api_scope/sell.marketing',
    'https://api.ebay.com/oauth/api_scope/sell.account',
    'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
    'https://api.ebay.com/oauth/api_scope/commerce.identity.readonly',
  ].join(' ');

  const authUrl = new URL(`${ebayAuthUrl()}/oauth2/authorize`);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', config.EBAY_REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scopes);
  // Force the eBay sign-in screen even when an eBay session cookie exists, so a
  // user who disconnects can reconnect under a DIFFERENT eBay account.
  authUrl.searchParams.set('prompt', 'login');
  const state = randomBytes(16).toString('hex');
  stateStore.set(state, { userId: req.user!.sub, expiresAt: Date.now() + 10 * 60_000 });

  authUrl.searchParams.set('state', state);

  res.json({ authUrl: authUrl.toString() });
  } catch (err) {
    next(err);
  }
});

const callbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

ebayAuthRouter.post('/callback', async (req, res, next) => {
  try {
    const config = env();
    const { clientId, clientSecret } = getEbayUserFlowCredentials(config);
    if (!clientId || !clientSecret || !config.EBAY_REDIRECT_URI) {
      throw new AppError(503, 'EBAY_NOT_CONFIGURED', 'eBay integration is not configured');
    }

    const { code, state } = callbackSchema.parse(req.body);
    const userId = req.user!.sub;

    const stored = stateStore.get(state);
    stateStore.delete(state);
    if (!stored || stored.userId !== userId || stored.expiresAt < Date.now()) {
      throw new AppError(400, 'CSRF_MISMATCH', 'Invalid or expired OAuth state parameter');
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const tokenResponse = await fetch(`${ebayBaseUrl()}/identity/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.EBAY_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      logger.error({ status: tokenResponse.status, body: errorBody }, 'eBay token exchange failed');
      throw new AppError(502, 'EBAY_TOKEN_EXCHANGE_FAILED', 'Failed to exchange eBay authorization code');
    }

    const tokenData = await tokenResponse.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    // Fetch the eBay user's immutable userId for display. Non-fatal: the
    // connection still succeeds if the Identity API is unavailable.
    const identityHost = config.EBAY_SANDBOX
      ? 'https://apiz.sandbox.ebay.com'
      : 'https://apiz.ebay.com';
    let marketplaceUserId: string | null = null;
    try {
      const identityResponse = await fetch(`${identityHost}/commerce/identity/v1/user/`, {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
      });
      if (identityResponse.ok) {
        const identity = await identityResponse.json() as { userId?: string };
        marketplaceUserId = identity.userId ?? null;
      } else {
        logger.warn({ status: identityResponse.status }, 'eBay Identity API non-OK; marketplaceUserId left null');
      }
    } catch (identityErr) {
      logger.warn({ err: identityErr }, 'eBay Identity fetch failed; marketplaceUserId left null');
    }

    const existing = await db.select({ id: marketplaceAccounts.id })
      .from(marketplaceAccounts)
      .where(and(
        eq(marketplaceAccounts.userId, userId),
        eq(marketplaceAccounts.marketplace, 'ebay'),
      ))
      .limit(1);

    if (existing.length > 0) {
      await db.update(marketplaceAccounts)
        .set({
          accessTokenEncrypted: encrypt(tokenData.access_token),
          refreshTokenEncrypted: encrypt(tokenData.refresh_token),
          tokenExpiresAt: expiresAt,
          marketplaceUserId,
          updatedAt: new Date(),
        })
        .where(eq(marketplaceAccounts.id, existing[0].id));
    } else {
      await checkMarketplaceLimit(userId);
      await db.insert(marketplaceAccounts).values({
        userId,
        marketplace: 'ebay',
        accessTokenEncrypted: encrypt(tokenData.access_token),
        refreshTokenEncrypted: encrypt(tokenData.refresh_token),
        tokenExpiresAt: expiresAt,
        marketplaceUserId,
      });
    }

    logger.info({ userId, expiresAt: expiresAt.toISOString() }, 'eBay account connected');

    res.json({ connected: true, expiresAt: expiresAt.toISOString() });
  } catch (err) {
    next(err);
  }
});

ebayAuthRouter.get('/status', async (req, res, next) => {
  try {
    const userId = req.user!.sub;

    const [account] = await db.select({
      id: marketplaceAccounts.id,
      tokenExpiresAt: marketplaceAccounts.tokenExpiresAt,
      marketplaceUserId: marketplaceAccounts.marketplaceUserId,
      createdAt: marketplaceAccounts.createdAt,
    })
      .from(marketplaceAccounts)
      .where(and(
        eq(marketplaceAccounts.userId, userId),
        eq(marketplaceAccounts.marketplace, 'ebay'),
      ))
      .limit(1);

    if (!account) {
      res.json({ connected: false });
      return;
    }

    const isExpired = new Date(account.tokenExpiresAt) < new Date();

    res.json({
      connected: true,
      expired: isExpired,
      expiresAt: account.tokenExpiresAt,
      marketplaceUserId: account.marketplaceUserId,
      connectedAt: account.createdAt,
    });
  } catch (err) {
    next(err);
  }
});

ebayAuthRouter.delete('/disconnect', async (req, res, next) => {
  try {
    const userId = req.user!.sub;

    await db.delete(marketplaceAccounts)
      .where(and(
        eq(marketplaceAccounts.userId, userId),
        eq(marketplaceAccounts.marketplace, 'ebay'),
      ));

    logger.info({ userId }, 'eBay account disconnected');
    res.json({ disconnected: true });
  } catch (err) {
    next(err);
  }
});
