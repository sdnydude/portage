import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, marketplaceAccounts } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { createLogger } from '../lib/logger.js';

const logger = createLogger('users');

const addressSchema = z.object({
  street1: z.string().max(255),
  street2: z.string().max(255).optional(),
  city: z.string().max(100),
  state: z.string().max(50),
  zip: z.string().max(20),
  country: z.string().max(2).default('US'),
}).optional();

const notificationPrefsSchema = z.object({
  sale: z.boolean().optional(),
  buyer_message: z.boolean().optional(),
  listing_expiry: z.boolean().optional(),
  price_alert: z.boolean().optional(),
  shipping_reminder: z.boolean().optional(),
}).optional();

const updateUserSchema = z.object({
  displayName: z.string().max(255).optional(),
  address: addressSchema,
  notificationPreferences: notificationPrefsSchema,
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field required' });

export const usersRouter = Router();

usersRouter.use(requireAuth);

usersRouter.get('/', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const [user] = await db.select({
      email: users.email,
      displayName: users.displayName,
      subscriptionTier: users.subscriptionTier,
      address: users.address,
      notificationPreferences: users.notificationPreferences,
      createdAt: users.createdAt,
    }).from(users).where(eq(users.id, userId)).limit(1);

    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');

    res.json(user);
  } catch (err) {
    next(err);
  }
});

usersRouter.patch('/', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const body = updateUserSchema.parse(req.body);

    const updates: Record<string, unknown> = {};
    if (body.displayName !== undefined) updates.displayName = body.displayName;
    if (body.address !== undefined) updates.address = body.address;
    if (body.notificationPreferences !== undefined) updates.notificationPreferences = body.notificationPreferences;

    const [updated] = await db.update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning({
        email: users.email,
        displayName: users.displayName,
        subscriptionTier: users.subscriptionTier,
        address: users.address,
        notificationPreferences: users.notificationPreferences,
        createdAt: users.createdAt,
      });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

const onboardingSchema = z.object({
  completed: z.literal(true),
});

usersRouter.patch('/onboarding', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    onboardingSchema.parse(req.body);

    await db.update(users)
      .set({ onboardingCompleted: true })
      .where(eq(users.id, userId));

    logger.info({ userId }, 'Onboarding completed');

    res.json({ onboardingCompleted: true });
  } catch (err) {
    next(err);
  }
});

usersRouter.get('/marketplace-accounts', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const accounts = await db.select({
      id: marketplaceAccounts.id,
      marketplace: marketplaceAccounts.marketplace,
      marketplaceUserId: marketplaceAccounts.marketplaceUserId,
      tokenExpiresAt: marketplaceAccounts.tokenExpiresAt,
      createdAt: marketplaceAccounts.createdAt,
    }).from(marketplaceAccounts).where(eq(marketplaceAccounts.userId, userId));

    res.json({ accounts });
  } catch (err) {
    next(err);
  }
});
