import { Router } from 'express';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { createLogger } from '../lib/logger.js';
import { db } from '../db/index.js';
import { disclaimerAcceptances, listings } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { CURRENT_DISCLAIMER_VERSION } from '@portage/shared';

// Relocated verbatim from the deleted carrier-shipping router (Phase 1 cleanup):
// the listing-publish disclaimer flow outlived the carrier subsystem.
// CURRENT_DISCLAIMER_VERSION is imported from @portage/shared (single source of
// truth) — the suppression check and acceptance recording must agree on it.

const logger = createLogger('disclaimer');

export const disclaimerRouter = Router();

disclaimerRouter.use(requireAuth);

// GET /disclaimer/version — get current disclaimer version
disclaimerRouter.get('/version', async (_req, res, next) => {
  try {
    res.json({
      version: CURRENT_DISCLAIMER_VERSION,
      effectiveDate: '2026-04-25',
    });
  } catch (err) {
    next(err);
  }
});

const acceptTermsSchema = z.object({
  disclaimerVersion: z.number().int().positive().optional(),
});

// POST /disclaimer/listings/:id/accept-terms — record disclaimer acceptance
disclaimerRouter.post('/listings/:id/accept-terms', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const body = acceptTermsSchema.parse(req.body);
    const version = body.disclaimerVersion ?? CURRENT_DISCLAIMER_VERSION;

    // Verify the listing belongs to this user
    const [listing] = await db.select({ id: listings.id })
      .from(listings)
      .where(and(eq(listings.id, req.params.id), eq(listings.userId, userId)))
      .limit(1);

    if (!listing) throw new AppError(404, 'NOT_FOUND', 'Listing not found');

    // Get client IP (handles proxied requests)
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket.remoteAddress
      || null;

    const [acceptance] = await db.insert(disclaimerAcceptances).values({
      userId,
      listingId: req.params.id,
      disclaimerVersion: version,
      ipAddress: ipAddress?.slice(0, 45) ?? null,
    }).returning();

    logger.info({ userId, listingId: req.params.id, version, ipAddress }, 'Disclaimer accepted');

    res.status(201).json(acceptance);
  } catch (err) {
    next(err);
  }
});
