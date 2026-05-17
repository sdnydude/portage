import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { createLogger } from '../../lib/logger.js';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { AppError } from '../../middleware/error.js';
import { encrypt } from '../../lib/crypto.js';
import { db } from '../../db/index.js';
import { marketplaceAccounts } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { checkMarketplaceLimit } from '../../lib/billing-utils.js';

const logger = createLogger('reverb-auth');

const REVERB_API_BASE = 'https://api.reverb.com/api';

const connectLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: process.env.NODE_ENV === 'test' ? 100 : 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many connection attempts, please try again later', code: 'RATE_LIMITED' },
});

export const reverbAuthRouter = Router();

reverbAuthRouter.use(requireAuth);

const connectSchema = z.object({
  token: z.string().min(20).max(512),
});

reverbAuthRouter.post('/connect', connectLimiter, async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const { token } = connectSchema.parse(req.body);

    const existing = await db.select({ id: marketplaceAccounts.id })
      .from(marketplaceAccounts)
      .where(and(eq(marketplaceAccounts.userId, userId), eq(marketplaceAccounts.marketplace, 'reverb')))
      .limit(1);

    if (existing.length === 0) {
      await checkMarketplaceLimit(userId);
    }

    const accountResponse = await fetch(`${REVERB_API_BASE}/my/account`, {
      signal: AbortSignal.timeout(8000),
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/hal+json',
        'Accept': 'application/hal+json',
        'Accept-Version': '3.0',
      },
    });

    if (!accountResponse.ok) {
      const status = accountResponse.status;
      if (status === 401 || status === 403) {
        throw new AppError(400, 'INVALID_TOKEN', 'Reverb token is invalid or expired');
      }
      logger.error({ status }, 'Reverb account validation failed');
      throw new AppError(502, 'REVERB_VALIDATION_FAILED', 'Could not validate Reverb token');
    }

    const accountData = await accountResponse.json() as {
      shop?: { name?: string };
      user_id?: number;
      email?: string;
    };

    const reverbUserId = accountData.user_id ? String(accountData.user_id) : null;
    const farFuture = new Date('2099-12-31T23:59:59Z');

    if (existing.length > 0) {
      await db.update(marketplaceAccounts)
        .set({
          accessTokenEncrypted: encrypt(token),
          refreshTokenEncrypted: encrypt('none'),
          tokenExpiresAt: farFuture,
          marketplaceUserId: reverbUserId,
          updatedAt: new Date(),
        })
        .where(eq(marketplaceAccounts.id, existing[0].id));
    } else {
      await db.insert(marketplaceAccounts).values({
        userId,
        marketplace: 'reverb',
        accessTokenEncrypted: encrypt(token),
        refreshTokenEncrypted: encrypt('none'),
        tokenExpiresAt: farFuture,
        marketplaceUserId: reverbUserId,
      });
    }

    logger.info({ userId, shopName: accountData.shop?.name, reverbUserId }, 'Reverb account connected');

    res.json({ connected: true, shopName: accountData.shop?.name || null });
  } catch (err) {
    next(err);
  }
});

reverbAuthRouter.get('/status', async (req, res, next) => {
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
        eq(marketplaceAccounts.marketplace, 'reverb'),
      ))
      .limit(1);

    if (!account) {
      res.json({ connected: false });
      return;
    }

    res.json({
      connected: true,
      expired: new Date(account.tokenExpiresAt) < new Date(),
      marketplaceUserId: account.marketplaceUserId,
      connectedAt: account.createdAt,
    });
  } catch (err) {
    next(err);
  }
});

reverbAuthRouter.delete('/disconnect', async (req, res, next) => {
  try {
    const userId = req.user!.sub;

    await db.delete(marketplaceAccounts)
      .where(and(
        eq(marketplaceAccounts.userId, userId),
        eq(marketplaceAccounts.marketplace, 'reverb'),
      ));

    logger.info({ userId }, 'Reverb account disconnected');
    res.json({ disconnected: true });
  } catch (err) {
    next(err);
  }
});
