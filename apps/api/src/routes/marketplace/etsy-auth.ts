import { Router } from 'express';
import { pino } from 'pino';
import { z } from 'zod';
import { randomBytes, createHash } from 'node:crypto';
import { requireAuth } from '../../middleware/auth.js';
import { AppError } from '../../middleware/error.js';
import { env } from '../../lib/env.js';
import { encrypt } from '../../lib/crypto.js';
import { db } from '../../db/index.js';
import { marketplaceAccounts } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';

const logger = pino({ name: 'etsy-auth' });

const ETSY_BASE = 'https://api.etsy.com/v3';
const ETSY_AUTH_URL = 'https://www.etsy.com/oauth/connect';

const pkceStore = new Map<string, string>();

export const etsyAuthRouter = Router();

etsyAuthRouter.use(requireAuth);

etsyAuthRouter.get('/connect', (req, res) => {
  const config = env();
  if (!config.ETSY_API_KEY || !config.ETSY_REDIRECT_URI) {
    throw new AppError(503, 'ETSY_NOT_CONFIGURED', 'Etsy integration is not configured');
  }

  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

  const userId = req.user!.sub;
  pkceStore.set(userId, codeVerifier);

  const scopes = [
    'listings_r',
    'listings_w',
    'listings_d',
    'transactions_r',
    'profile_r',
    'shops_r',
  ].join(' ');

  const authUrl = new URL(ETSY_AUTH_URL);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', config.ETSY_API_KEY);
  authUrl.searchParams.set('redirect_uri', config.ETSY_REDIRECT_URI);
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('state', userId);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  res.json({ authUrl: authUrl.toString() });
});

const callbackSchema = z.object({
  code: z.string().min(1),
});

etsyAuthRouter.post('/callback', async (req, res, next) => {
  try {
    const config = env();
    if (!config.ETSY_API_KEY || !config.ETSY_REDIRECT_URI) {
      throw new AppError(503, 'ETSY_NOT_CONFIGURED', 'Etsy integration is not configured');
    }

    const { code } = callbackSchema.parse(req.body);
    const userId = req.user!.sub;

    const codeVerifier = pkceStore.get(userId);
    if (!codeVerifier) {
      throw new AppError(400, 'PKCE_MISSING', 'No PKCE verifier found. Please restart the connection flow.');
    }
    pkceStore.delete(userId);

    const tokenResponse = await fetch(`${ETSY_BASE}/public/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.ETSY_API_KEY,
        redirect_uri: config.ETSY_REDIRECT_URI,
        code,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      logger.error({ status: tokenResponse.status, body: errorBody }, 'Etsy token exchange failed');
      throw new AppError(502, 'ETSY_TOKEN_EXCHANGE_FAILED', 'Failed to exchange Etsy authorization code');
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
        eq(marketplaceAccounts.marketplace, 'etsy'),
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
        marketplace: 'etsy',
        accessTokenEncrypted: encrypt(tokenData.access_token),
        refreshTokenEncrypted: encrypt(tokenData.refresh_token),
        tokenExpiresAt: expiresAt,
      });
    }

    logger.info({ userId, expiresAt: expiresAt.toISOString() }, 'Etsy account connected');

    res.json({ connected: true, expiresAt: expiresAt.toISOString() });
  } catch (err) {
    next(err);
  }
});

etsyAuthRouter.get('/status', async (req, res, next) => {
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
        eq(marketplaceAccounts.marketplace, 'etsy'),
      ))
      .limit(1);

    if (!account) {
      res.json({ connected: false });
      return;
    }

    res.json({
      connected: true,
      expired: new Date(account.tokenExpiresAt) < new Date(),
      expiresAt: account.tokenExpiresAt,
      marketplaceUserId: account.marketplaceUserId,
      connectedAt: account.createdAt,
    });
  } catch (err) {
    next(err);
  }
});

etsyAuthRouter.delete('/disconnect', async (req, res, next) => {
  try {
    const userId = req.user!.sub;

    await db.delete(marketplaceAccounts)
      .where(and(
        eq(marketplaceAccounts.userId, userId),
        eq(marketplaceAccounts.marketplace, 'etsy'),
      ));

    logger.info({ userId }, 'Etsy account disconnected');
    res.json({ disconnected: true });
  } catch (err) {
    next(err);
  }
});
