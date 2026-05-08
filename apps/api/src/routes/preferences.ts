import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';

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
    }).from(users).where(eq(users.id, userId)).limit(1);

    res.json(user);
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
