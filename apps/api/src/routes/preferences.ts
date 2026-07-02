import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { CURRENT_DISCLAIMER_VERSION } from '@portage/shared';

const updatePrefsSchema = z.object({
  listingInterface: z.enum(['conversational', 'swipe', 'hybrid']).optional(),
  listingForkPref: z.enum(['ask', 'list', 'inventory']).optional(),
  listingCompactMode: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field required' });

export const preferencesRouter = Router();

preferencesRouter.use(requireAuth);

preferencesRouter.get('/', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const [user] = await db.select({
      listingInterface: users.listingInterface,
      listingForkPref: users.listingForkPref,
      listingForkCount: users.listingForkCount,
      listingCompactMode: users.listingCompactMode,
      disclaimerSuppressUntil: users.disclaimerSuppressUntil,
      disclaimerSuppressVersion: users.disclaimerSuppressVersion,
    }).from(users).where(eq(users.id, userId)).limit(1);

    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

    // F3b: the terms sheet is suppressed only while the window is open AND the
    // stored version matches current (a disclaimer bump voids suppression).
    const { disclaimerSuppressUntil, disclaimerSuppressVersion, ...prefs } = user;
    const disclaimerSuppressed =
      disclaimerSuppressUntil != null &&
      disclaimerSuppressUntil.getTime() > Date.now() &&
      disclaimerSuppressVersion === CURRENT_DISCLAIMER_VERSION;

    res.json({ ...prefs, disclaimerSuppressed });
  } catch (err) {
    next(err);
  }
});

preferencesRouter.patch('/', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const body = updatePrefsSchema.parse(req.body);

    const updates: Record<string, unknown> = {};
    if (body.listingInterface !== undefined) updates.listingInterface = body.listingInterface;
    if (body.listingForkPref !== undefined) updates.listingForkPref = body.listingForkPref;
    if (body.listingCompactMode !== undefined) updates.listingCompactMode = body.listingCompactMode;

    const [updated] = await db.update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning({
        listingInterface: users.listingInterface,
        listingForkPref: users.listingForkPref,
        listingForkCount: users.listingForkCount,
        listingCompactMode: users.listingCompactMode,
      });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});
