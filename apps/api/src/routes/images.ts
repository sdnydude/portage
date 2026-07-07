import { Router } from 'express';
import multer from 'multer';
import { createLogger } from '../lib/logger.js';
import { requireAuth } from '../middleware/auth.js';
import { processImage, generateThumbnail, enhanceImage, rotateImage, cropImage, adjustExposure, flattenToWhite } from '../lib/image.js';
import { uploadImage, deleteImage, getImage } from '../lib/storage.js';
import { z } from 'zod';
import { eq, and, sql } from 'drizzle-orm';
import { AppError } from '../middleware/error.js';
import { env } from '../lib/env.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { computeEffectiveTier } from '../lib/billing-utils.js';
import { FREE_TIER_LIMITS } from '@portage/shared';

const logger = createLogger('images');

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FETCH_SIZE = 20 * 1024 * 1024;

export function isAllowedImageOrigin(url: string): boolean {
  const r2Public = env().R2_PUBLIC_URL;
  if (r2Public && url.startsWith(r2Public)) return true;
  if (url.startsWith('https://portage-images.digitalharmonyai.com/')) return true;
  return false;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(400, 'INVALID_FILE_TYPE', `Unsupported file type: ${file.mimetype}. Allowed: ${ALLOWED_TYPES.join(', ')}`));
    }
  },
});

export const imagesRouter = Router();

imagesRouter.use(requireAuth);

imagesRouter.post('/', upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError(400, 'NO_FILE', 'No image file provided');
    }

    const userId = req.user!.sub;
    logger.info({ userId, originalName: req.file.originalname, size: req.file.size }, 'Upload started');

    const processed = await processImage(req.file.buffer);
    const thumbnail = await generateThumbnail(req.file.buffer);

    const [main, thumb] = await Promise.all([
      uploadImage(userId, processed.buffer, 'image/jpeg', '.jpg'),
      uploadImage(userId, thumbnail, 'image/jpeg', '_thumb.jpg'),
    ]);

    logger.info({ userId, mainKey: main.key, thumbKey: thumb.key }, 'Upload complete');

    res.status(201).json({
      image: {
        key: main.key,
        url: main.url,
        width: processed.width,
        height: processed.height,
        size: processed.size,
      },
      thumbnail: {
        key: thumb.key,
        url: thumb.url,
      },
    });
  } catch (err) {
    next(err);
  }
});

const enhanceSchema = z.object({
  imageUrl: z.string().url(),
});

imagesRouter.post('/enhance', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const { imageUrl } = enhanceSchema.parse(req.body);

    if (!isAllowedImageOrigin(imageUrl)) {
      throw new AppError(400, 'INVALID_ORIGIN', 'Image URL must be from Portage storage');
    }

    logger.info({ userId, imageUrl }, 'Enhance started');

    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new AppError(400, 'FETCH_FAILED', 'Could not fetch the image to enhance');
    }

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_FETCH_SIZE) {
      throw new AppError(400, 'FILE_TOO_LARGE', `Image exceeds ${MAX_FETCH_SIZE / 1024 / 1024}MB limit`);
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_FETCH_SIZE) {
      throw new AppError(400, 'FILE_TOO_LARGE', `Image exceeds ${MAX_FETCH_SIZE / 1024 / 1024}MB limit`);
    }
    const inputBuffer = Buffer.from(arrayBuffer);

    const enhanced = await enhanceImage(inputBuffer);

    const uploaded = await uploadImage(userId, enhanced.buffer, 'image/jpeg', '_enhanced.jpg');

    logger.info({ userId, key: uploaded.key }, 'Enhance complete');

    res.json({
      image: {
        key: uploaded.key,
        url: uploaded.url,
        width: enhanced.width,
        height: enhanced.height,
        size: enhanced.size,
      },
    });
  } catch (err) {
    next(err);
  }
});

const batchEnhanceSchema = z.object({
  imageUrls: z.array(z.string().url()).min(1).max(10),
});

type BatchEnhanceResult =
  | {
      status: 'success';
      sourceUrl: string;
      image: { key: string; url: string; width: number; height: number; size: number };
    }
  | { status: 'error'; sourceUrl: string; error: string };

imagesRouter.post('/batch-enhance', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const { imageUrls } = batchEnhanceSchema.parse(req.body);

    // Validate every origin up front — a single foreign URL rejects the whole
    // batch before any fetch/enhance work begins. (Per-photo fetch failures, in
    // contrast, are isolated below and don't fail the batch.)
    for (const url of imageUrls) {
      if (!isAllowedImageOrigin(url)) {
        throw new AppError(400, 'INVALID_ORIGIN', 'Image URL must be from Portage storage');
      }
    }

    logger.info({ userId, count: imageUrls.length }, 'Batch enhance started');

    // Sequential: one bad photo must never abort the batch, and per-photo results
    // stay in request order.
    const results: BatchEnhanceResult[] = [];
    for (const imageUrl of imageUrls) {
      try {
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new AppError(400, 'FETCH_FAILED', 'Could not fetch the image to enhance');
        }

        const contentLength = Number(response.headers.get('content-length') || 0);
        if (contentLength > MAX_FETCH_SIZE) {
          throw new AppError(400, 'FILE_TOO_LARGE', `Image exceeds ${MAX_FETCH_SIZE / 1024 / 1024}MB limit`);
        }

        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer.byteLength > MAX_FETCH_SIZE) {
          throw new AppError(400, 'FILE_TOO_LARGE', `Image exceeds ${MAX_FETCH_SIZE / 1024 / 1024}MB limit`);
        }

        const enhanced = await enhanceImage(Buffer.from(arrayBuffer));
        const uploaded = await uploadImage(userId, enhanced.buffer, 'image/jpeg', '_enhanced.jpg');

        results.push({
          status: 'success',
          sourceUrl: imageUrl,
          image: {
            key: uploaded.key,
            url: uploaded.url,
            width: enhanced.width,
            height: enhanced.height,
            size: enhanced.size,
          },
        });
      } catch (err) {
        logger.warn({ userId, imageUrl, error: (err as Error).message }, 'Batch enhance: photo failed');
        results.push({
          status: 'error',
          sourceUrl: imageUrl,
          error: err instanceof AppError ? err.message : 'Failed to enhance image',
        });
      }
    }

    logger.info({ userId, count: results.length }, 'Batch enhance complete');

    res.json({ results });
  } catch (err) {
    next(err);
  }
});

const removeBgSchema = z.object({
  imageUrl: z.string().url(),
});

imagesRouter.post('/remove-bg', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const { imageUrl } = removeBgSchema.parse(req.body);

    if (!isAllowedImageOrigin(imageUrl)) {
      throw new AppError(400, 'INVALID_ORIGIN', 'Image URL must be from Portage storage');
    }

    // --- Billing gate: check tier and limit before processing ---
    const [billingUser] = await db.select({
      subscriptionTier: users.subscriptionTier,
      trialEndsAt: users.trialEndsAt,
      bgRemovalsThisMonth: users.bgRemovalsThisMonth,
      scanCountResetAt: users.scanCountResetAt,
    }).from(users).where(eq(users.id, userId)).limit(1);

    if (!billingUser) throw new AppError(401, 'UNAUTHORIZED', 'User not found');

    const tier = computeEffectiveTier(billingUser.subscriptionTier, billingUser.trialEndsAt);
    const limit = tier === 'pro' ? null : FREE_TIER_LIMITS.bgRemovalsPerMonth;

    let resetFired = false;
    if (limit !== null) {
      const now = new Date();
      const resetAt = billingUser.scanCountResetAt;
      if (resetAt.getUTCMonth() !== now.getUTCMonth() || resetAt.getUTCFullYear() !== now.getUTCFullYear()) {
        // Idempotent reset — WHERE guard prevents concurrent double-reset
        const resetResult = await db.update(users)
          .set({ bgRemovalsThisMonth: 0, aiScansThisMonth: 0, aiListingsThisMonth: 0, scanCountResetAt: now })
          .where(and(
            eq(users.id, userId),
            sql`date_trunc('month', ${users.scanCountResetAt}) < date_trunc('month', now())`,
          ))
          .returning({ bgRemovalsThisMonth: users.bgRemovalsThisMonth });
        resetFired = resetResult.length > 0;
      }

      // Pre-flight: reject before expensive rembg call if already at limit
      if (!resetFired && billingUser.bgRemovalsThisMonth >= limit) {
        throw new AppError(429, 'BG_REMOVAL_LIMIT_REACHED',
          `Free tier limit: ${limit} background removals per month. Upgrade to Pro for unlimited.`);
      }
    }

    logger.info({ userId, imageUrl }, 'Background removal started');

    const imgResponse = await fetch(imageUrl);
    if (!imgResponse.ok) {
      throw new AppError(400, 'FETCH_FAILED', 'Could not fetch the image');
    }

    const contentLength = Number(imgResponse.headers.get('content-length') || 0);
    if (contentLength > MAX_FETCH_SIZE) {
      throw new AppError(400, 'FILE_TOO_LARGE', `Image exceeds ${MAX_FETCH_SIZE / 1024 / 1024}MB limit`);
    }

    const imgArrayBuffer = await imgResponse.arrayBuffer();
    if (imgArrayBuffer.byteLength > MAX_FETCH_SIZE) {
      throw new AppError(400, 'FILE_TOO_LARGE', `Image exceeds ${MAX_FETCH_SIZE / 1024 / 1024}MB limit`);
    }
    const imgBuffer = Buffer.from(imgArrayBuffer);

    const srcType = imgResponse.headers.get('content-type') || 'image/jpeg';
    const ext = srcType.includes('png') ? 'image.png' : srcType.includes('webp') ? 'image.webp' : 'image.jpg';
    const formData = new FormData();
    formData.append('file', new Blob([imgBuffer]), ext);
    formData.append('model', 'isnet-general-use');

    const rembgResponse = await fetch(`${env().REMBG_URL}/api/remove`, {
      method: 'POST',
      body: formData,
    });

    if (!rembgResponse.ok) {
      const detail = await rembgResponse.text().catch(() => 'unknown');
      logger.error({ userId, status: rembgResponse.status, detail }, 'rembg failed');
      throw new AppError(502, 'BG_REMOVAL_FAILED', 'Background removal service error');
    }

    // rembg returns a transparent PNG; transparency renders/exports as black in
    // JPEG contexts, so flatten onto white (also eBay's preferred background).
    const cutout = Buffer.from(await rembgResponse.arrayBuffer());
    const flattened = await flattenToWhite(cutout);
    const resultBuffer = flattened.buffer;
    const uploaded = await uploadImage(userId, resultBuffer, 'image/jpeg', '_nobg.jpg');

    // --- Billing: deduct AFTER successful removal (no credit loss on service failure) ---
    if (limit !== null) {
      const reserved = await db.update(users)
        .set({ bgRemovalsThisMonth: sql`${users.bgRemovalsThisMonth} + 1` })
        .where(and(
          eq(users.id, userId),
          sql`${users.bgRemovalsThisMonth} < ${limit}`,
        ))
        .returning({ bgRemovalsThisMonth: users.bgRemovalsThisMonth });

      if (reserved.length === 0) {
        throw new AppError(429, 'BG_REMOVAL_LIMIT_REACHED',
          `Free tier limit: ${limit} background removals per month. Upgrade to Pro for unlimited.`);
      }

      logger.info({ userId, used: reserved[0].bgRemovalsThisMonth, limit }, 'Bg removal credit consumed');
    }

    logger.info({ userId, key: uploaded.key, size: resultBuffer.length }, 'Background removal complete');

    res.json({
      image: {
        key: uploaded.key,
        url: uploaded.url,
        size: resultBuffer.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

const exposureSchema = z.object({
  imageUrl: z.string().url(),
  ev: z.number().min(-2).max(2),
});

imagesRouter.post('/exposure', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const { imageUrl, ev } = exposureSchema.parse(req.body);

    if (!isAllowedImageOrigin(imageUrl)) {
      throw new AppError(400, 'INVALID_ORIGIN', 'Image URL must be from Portage storage');
    }

    logger.info({ userId, imageUrl, ev }, 'Exposure adjust started');

    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new AppError(400, 'FETCH_FAILED', 'Could not fetch the image to adjust');
    }

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_FETCH_SIZE) {
      throw new AppError(400, 'FILE_TOO_LARGE', `Image exceeds ${MAX_FETCH_SIZE / 1024 / 1024}MB limit`);
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_FETCH_SIZE) {
      throw new AppError(400, 'FILE_TOO_LARGE', `Image exceeds ${MAX_FETCH_SIZE / 1024 / 1024}MB limit`);
    }

    const adjusted = await adjustExposure(Buffer.from(arrayBuffer), ev);
    const uploaded = await uploadImage(userId, adjusted.buffer, 'image/jpeg', '_exposure.jpg');

    logger.info({ userId, key: uploaded.key, ev }, 'Exposure adjust complete');

    res.json({
      image: {
        key: uploaded.key,
        url: uploaded.url,
        width: adjusted.width,
        height: adjusted.height,
        size: adjusted.size,
      },
    });
  } catch (err) {
    next(err);
  }
});

const rotateSchema = z.object({
  imageUrl: z.string().url(),
  degrees: z.union([z.literal(90), z.literal(180), z.literal(270)]),
});

imagesRouter.post('/rotate', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const { imageUrl, degrees } = rotateSchema.parse(req.body);

    if (!isAllowedImageOrigin(imageUrl)) {
      throw new AppError(400, 'INVALID_ORIGIN', 'Image URL must be from Portage storage');
    }

    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new AppError(400, 'FETCH_FAILED', 'Could not fetch the image');
    }

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_FETCH_SIZE) {
      throw new AppError(400, 'FILE_TOO_LARGE', `Image exceeds ${MAX_FETCH_SIZE / 1024 / 1024}MB limit`);
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_FETCH_SIZE) {
      throw new AppError(400, 'FILE_TOO_LARGE', `Image exceeds ${MAX_FETCH_SIZE / 1024 / 1024}MB limit`);
    }
    const inputBuffer = Buffer.from(arrayBuffer);

    const rotated = await rotateImage(inputBuffer, degrees);
    const uploaded = await uploadImage(userId, rotated.buffer, 'image/jpeg', '_rotated.jpg');

    logger.info({ userId, key: uploaded.key, degrees }, 'Image rotated');

    res.json({
      image: {
        key: uploaded.key,
        url: uploaded.url,
        width: rotated.width,
        height: rotated.height,
        size: rotated.size,
      },
    });
  } catch (err) {
    next(err);
  }
});

const cropSchema = z.object({
  imageUrl: z.string().url(),
  crop: z.object({
    x: z.number().min(0),
    y: z.number().min(0),
    width: z.number().positive(),
    height: z.number().positive(),
  }),
});

imagesRouter.post('/crop', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const { imageUrl, crop } = cropSchema.parse(req.body);

    if (!isAllowedImageOrigin(imageUrl)) {
      throw new AppError(400, 'INVALID_ORIGIN', 'Image URL must be from Portage storage');
    }

    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new AppError(400, 'FETCH_FAILED', 'Could not fetch the image');
    }

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_FETCH_SIZE) {
      throw new AppError(400, 'FILE_TOO_LARGE', `Image exceeds ${MAX_FETCH_SIZE / 1024 / 1024}MB limit`);
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_FETCH_SIZE) {
      throw new AppError(400, 'FILE_TOO_LARGE', `Image exceeds ${MAX_FETCH_SIZE / 1024 / 1024}MB limit`);
    }
    const inputBuffer = Buffer.from(arrayBuffer);

    const cropped = await cropImage(inputBuffer, crop);
    const uploaded = await uploadImage(userId, cropped.buffer, 'image/jpeg', '_cropped.jpg');

    logger.info({ userId, key: uploaded.key }, 'Image cropped');

    res.json({
      image: {
        key: uploaded.key,
        url: uploaded.url,
        width: cropped.width,
        height: cropped.height,
        size: cropped.size,
      },
    });
  } catch (err) {
    next(err);
  }
});

imagesRouter.get('/r2/*path', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const key = Array.isArray(req.params.path) ? req.params.path.join('/') : req.params.path;
    if (!key) throw new AppError(400, 'MISSING_KEY', 'Image key required');

    if (!key.startsWith(`items/${userId}/`)) {
      throw new AppError(403, 'FORBIDDEN', 'Cannot access images belonging to another user');
    }

    const { body, contentType } = await getImage(key);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    body.pipe(res);
  } catch (err) {
    next(err);
  }
});

imagesRouter.delete('/', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const key = req.query.key as string;

    if (!key) {
      throw new AppError(400, 'MISSING_KEY', 'Image key is required as query parameter');
    }

    if (!key.startsWith(`items/${userId}/`)) {
      throw new AppError(403, 'FORBIDDEN', 'Cannot delete images belonging to another user');
    }

    await deleteImage(key);
    logger.info({ userId, key }, 'Image deleted');

    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});
