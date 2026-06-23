import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { createLogger } from '../lib/logger.js';
import { requireAuth } from '../middleware/auth.js';
import { identifyItem, identifyItemDetailed, identifyItemsMulti, fetchPhotosAsBase64 } from '../lib/vision.js';
import { prefillCandidateAspects } from '../lib/aspect-prefill.js';
import { processImage } from '../lib/image.js';
import { uploadImage } from '../lib/storage.js';
import { AppError } from '../middleware/error.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';

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
    aiScansThisMonth: users.aiScansThisMonth,
    scanCountResetAt: users.scanCountResetAt,
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

    let identification;
    let detailedResult;

    if (detail === 'full') {
      detailedResult = await identifyItemDetailed(imageBase64, 'image/jpeg');
      // Best-effort: pre-fill required eBay specifics on the top candidate so the
      // scan review screen already shows them. Never throws; non-fatal on failure.
      detailedResult.candidates = await prefillCandidateAspects(detailedResult.candidates, imageBase64);
      identification = detailedResult.candidates[0];
    } else {
      identification = await identifyItem(imageBase64, 'image/jpeg');
    }

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

    logger.info({ userId, name: identification.name }, 'Scan complete');

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
        z.string().url().refine(
          () => false,
          { message: 'Image storage is not configured. Contact support.' },
        ),
      ).min(1).max(3),
    });
  }
  return z.object({
    imageUrls: z.array(
      z.string().url().refine(
        (url) => url.startsWith(r2Prefix),
        { message: 'Image URLs must reference the application storage origin' },
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

    const detailedResult = await identifyItemsMulti(images);
    // Same Phase-A prefill as POST /scan?detail=full — the refine (multi-photo)
    // path must also fill the top candidate's required eBay specifics, or the
    // scan review shows an empty aspect list. Best-effort, never throws; threads
    // the first image so generateListingFields takes the vision (JSON) path.
    detailedResult.candidates = await prefillCandidateAspects(detailedResult.candidates, images[0]?.base64);
    const identification = detailedResult.candidates[0];

    await incrementScanCount(userId);

    logger.info({ userId, name: identification.name, imageCount: images.length }, 'Refine scan complete');

    res.status(201).json({
      identification,
      detailed: detailedResult,
    });
  } catch (err) {
    next(err);
  }
});
