import { Router } from 'express';
import { eq, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { faqs } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';

export const faqsRouter = Router();

faqsRouter.use(requireAuth);

faqsRouter.get('/', async (_req, res, next) => {
  try {
    const rows = await db.select()
      .from(faqs)
      .where(eq(faqs.published, true))
      .orderBy(asc(faqs.sortOrder));
    res.json({ faqs: rows });
  } catch (err) {
    next(err);
  }
});
