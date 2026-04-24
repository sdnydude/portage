import { Router } from 'express';
import { pino } from 'pino';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { AppError } from '../../middleware/error.js';
import { env } from '../../lib/env.js';
import { encrypt } from '../../lib/crypto.js';
import { db } from '../../db/index.js';
import { marketplaceAccounts } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';

const logger = pino({ name: 'ebay-auth' });

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

ebayAuthRouter.get('/connect', (req, res) => {
  const config = env();
  if (!config.EBAY_CLIENT_ID || !config.EBAY_REDIRECT_URI) {
    throw new AppError(503, 'EBAY_NOT_CONFIGURED', 'eBay integration is not configured');
  }

  const scopes = [
    'https://api.ebay.com/oauth/api_scope/sell.inventory',
    'https://api.ebay.com/oauth/api_scope/sell.marketing',
    'https://api.ebay.com/oauth/api_scope/sell.account',
    'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
    'https://api.ebay.com/oauth/api_scope/commerce.identity.readonly',
  ].join(' ');

  const authUrl = new URL(`${ebayAuthUrl()}/oauth2/authorize`);
  authUrl.searchParams.set('client_id', config.EBAY_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', config.EBAY_REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('state', req.user!.sub);

  res.json({ authUrl: authUrl.toString() });
});

const callbackSchema = z.object({
  code: z.string().min(1),
});

ebayAuthRouter.post('/callback', async (req, res, next) => {
  try {
    const config = env();
    if (!config.EBAY_CLIENT_ID || !config.EBAY_CLIENT_SECRET || !config.EBAY_REDIRECT_URI) {
      throw new AppError(503, 'EBAY_NOT_CONFIGURED', 'eBay integration is not configured');
    }

    const { code } = callbackSchema.parse(req.body);
    const userId = req.user!.sub;

    const credentials = Buffer.from(`${config.EBAY_CLIENT_ID}:${config.EBAY_CLIENT_SECRET}`).toString('base64');

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
        })
        .where(eq(marketplaceAccounts.id, existing[0].id));
    } else {
      await db.insert(marketplaceAccounts).values({
        userId,
        marketplace: 'ebay',
        accessTokenEncrypted: encrypt(tokenData.access_token),
        refreshTokenEncrypted: encrypt(tokenData.refresh_token),
        tokenExpiresAt: expiresAt,
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
