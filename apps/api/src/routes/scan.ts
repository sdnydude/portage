import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { createLogger } from '../lib/logger.js';
import { requireAuth } from '../middleware/auth.js';
import { identifyItem, identifyItemDetailed, identifyItemsMulti, fetchPhotosAsBase64 } from '../lib/vision.js';
import { prefillCandidateAspects } from '../lib/aspect-prefill.js';
import { processImage } from '../lib/image.js';
import { uploadImage } from '../lib/storage.js';
import { traceRequest } from '../lib/tracing.js';
import { AppError } from '../middleware/error.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { computeEffectiveTier, effectiveLimits } from '../lib/billing-utils.js';
import { limitsForTier } from '@portage/shared';

const logger = createLogger('scan');

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(400, 'INVALID_FILE_TYPE', `Unsupported: ${file.mimetype}`));
    }
  },
});

export const scanRouter = Router();

scanRouter.use(requireAuth);

async function checkScanLimit(userId: string): Promise<void> {
  const [user] = await db.select({
    subscriptionTier: users.subscriptionTier,
    trialEndsAt: users.trialEndsAt,
    aiScansThisMonth: users.aiScansThisMonth,
    scanCountResetAt: users.scanCountResetAt,
    limitOverrides: users.limitOverrides,
  })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new AppError(401, 'USER_NOT_FOUND', 'Your account could not be verified. Please sign in again.');
  }

  const resetDate = new Date(user.scanCountResetAt);
  const now = new Date();
  if (resetDate.getUTCMonth() !== now.getUTCMonth() || resetDate.getUTCFullYear() !== now.getUTCFullYear()) {
    await db.update(users)
      .set({ aiScansThisMonth: 0, scanCountResetAt: now })
      .where(eq(users.id, userId));
    user.aiScansThisMonth = 0;
  }

  // Server-side enforcement: every scan/refine is a paid vision call. Pro and
  // beta-tester are unlimited (null); free is capped per month.
  const tier = computeEffectiveTier(user.subscriptionTier, user.trialEndsAt);
  const limit = effectiveLimits(tier, user.limitOverrides).aiScansPerMonth;
  if (limit !== null && user.aiScansThisMonth >= limit) {
    throw new AppError(429, 'LIMIT_REACHED',
      `Monthly AI scan limit reached (${limit}). Upgrade to Pro for unlimited scans.`);
  }
}


async function incrementScanCount(userId: string): Promise<void> {
  await db.update(users)
    .set({ aiScansThisMonth: sql`${users.aiScansThisMonth} + 1` })
    .where(eq(users.id, userId));
}

scanRouter.post('/', upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError(400, 'NO_FILE', 'No image file provided');
    }

    const userId = req.user!.sub;

    await checkScanLimit(userId);

    logger.info({ userId, size: req.file.size }, 'Scan started');

    const processed = await processImage(req.file.buffer);

    const imageBase64 = processed.buffer.toString('base64');

    const detail = req.query.detail as string | undefined;

    let detailedResult: Awaited<ReturnType<typeof identifyItemDetailed>> | undefined;

    // Trace input is the scan request shape, not the photo — the base64 payload
    // is masked out on export anyway (see tracing-config.ts).
    const identification = await traceRequest(
      'scan-item',
      {
        userId,
        tags: ['scan', detail === 'full' ? 'detailed' : 'quick'],
        metadata: { imageBytes: String(processed.buffer.length) },
        input: { detail: detail === 'full' ? 'full' : 'quick' },
      },
      async () => {
        if (detail === 'full') {
          detailedResult = await identifyItemDetailed(imageBase64, 'image/jpeg');
          // Best-effort: pre-fill required eBay specifics on the top candidate so the
          // scan review screen already shows them. Never throws; non-fatal on failure.
          const prefill = await prefillCandidateAspects(detailedResult.candidates, imageBase64);
          detailedResult.candidates = prefill.candidates;
          if (prefill.provenance) {
            detailedResult.provenance = { ...detailedResult.provenance, aspects: prefill.provenance };
          }
          return detailedResult.candidates[0];
        }
        return identifyItem(imageBase64, 'image/jpeg');
      },
    );

    let mainImage: { key: string; url: string } | null = null;
    let thumbnailResult: { key: string; url: string } | null = null;

    try {
      const { generateThumbnail } = await import('../lib/image.js');
      const thumbBuf = await generateThumbnail(req.file.buffer);

      [mainImage, thumbnailResult] = await Promise.all([
        uploadImage(userId, processed.buffer, 'image/jpeg', '.jpg'),
        uploadImage(userId, thumbBuf, 'image/jpeg', '_thumb.jpg'),
      ]);
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'R2 upload failed — returning identification without storage');
    }

    await incrementScanCount(userId);

    logger.info({ userId, name: identification.name, provenance: detailedResult?.provenance }, 'Scan complete');

    res.status(201).json({
      identification,
      ...(detailedResult && { detailed: detailedResult }),
      image: mainImage ? {
        key: mainImage.key,
        url: mainImage.url,
        width: processed.width,
        height: processed.height,
      } : null,
      thumbnail: thumbnailResult ? {
        key: thumbnailResult.key,
        url: thumbnailResult.url,
      } : null,
    });
  } catch (err) {
    next(err);
  }
});

function buildRefineSchema() {
  const r2Prefix = process.env.R2_PUBLIC_URL;
  if (!r2Prefix) {
    logger.error('R2_PUBLIC_URL is not set — /scan/refine will reject all image URLs');
    return z.object({
      imageUrls: z.array(
        z.url().refine(
          () => false,
          { error: 'Image storage is not configured. Contact support.' },
        ),
      ).min(1).max(3),
    });
  }
  return z.object({
    imageUrls: z.array(
      z.url().refine(
        (url) => url.startsWith(r2Prefix),
        { error: 'Image URLs must reference the application storage origin' },
      ),
    ).min(1).max(3),
  });
}

scanRouter.post('/refine', async (req, res, next) => {
  try {
    const parsed = buildRefineSchema().safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'INVALID_INPUT', parsed.error.issues.map(i => i.message).join('; '));
    }

    const userId = req.user!.sub;
    await checkScanLimit(userId);

    const { imageUrls } = parsed.data;
    logger.info({ userId, imageCount: imageUrls.length }, 'Refine scan started');

    const images = await fetchPhotosAsBase64(imageUrls, 3);
    if (images.length === 0) {
      throw new AppError(502, 'PHOTO_FETCH_FAILED', 'Could not fetch any of the provided images');
    }

    let detailedResult!: Awaited<ReturnType<typeof identifyItemsMulti>>;

    const identification = await traceRequest(
      'scan-refine',
      {
        userId,
        tags: ['scan', 'refine'],
        metadata: { imageCount: String(images.length) },
        input: { imageCount: images.length },
      },
      async () => {
        detailedResult = await identifyItemsMulti(images);
        // Same Phase-A prefill as POST /scan?detail=full — the refine (multi-photo)
        // path must also fill the top candidate's required eBay specifics, or the
        // scan review shows an empty aspect list. Best-effort, never throws; threads
        // the first image so generateListingFields takes the vision (JSON) path.
        const prefill = await prefillCandidateAspects(detailedResult.candidates, images[0]?.base64);
        detailedResult.candidates = prefill.candidates;
        if (prefill.provenance) {
          detailedResult.provenance = { ...detailedResult.provenance, aspects: prefill.provenance };
        }
        return detailedResult.candidates[0];
      },
    );

    await incrementScanCount(userId);

    // provenance on the completion line: one Loki query answers "which model
    // did this scan" without re-pairing the two per-call vision lines.
    logger.info(
      { userId, name: identification.name, imageCount: images.length, provenance: detailedResult.provenance },
      'Refine scan complete',
    );

    res.status(201).json({
      identification,
      detailed: detailedResult,
    });
  } catch (err) {
    next(err);
  }
});
