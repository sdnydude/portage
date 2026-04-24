import { Router } from 'express';
import multer from 'multer';
import { pino } from 'pino';
import { requireAuth } from '../middleware/auth.js';
import { identifyItem } from '../lib/vision.js';
import { processImage } from '../lib/image.js';
import { uploadImage } from '../lib/storage.js';
import { AppError } from '../middleware/error.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { FREE_TIER_LIMITS } from '@portage/shared';

const logger = pino({ name: 'scan' });

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

scanRouter.post('/', upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError(400, 'NO_FILE', 'No image file provided');
    }

    const userId = req.user!.sub;
    const tier = req.user!.tier;

    if (tier === 'free') {
      const [user] = await db.select({ aiScansThisMonth: users.aiScansThisMonth })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (user && user.aiScansThisMonth >= FREE_TIER_LIMITS.aiScansPerMonth) {
        throw new AppError(429, 'SCAN_LIMIT_REACHED', `Free tier limit: ${FREE_TIER_LIMITS.aiScansPerMonth} AI scans per month. Upgrade to Pro for unlimited.`);
      }
    }

    logger.info({ userId, size: req.file.size }, 'Scan started');

    const processed = await processImage(req.file.buffer);

    const imageBase64 = processed.buffer.toString('base64');
    const identification = await identifyItem(imageBase64, 'image/webp');

    let mainImage: { key: string; url: string } | null = null;
    let thumbnailResult: { key: string; url: string } | null = null;

    try {
      const { generateThumbnail } = await import('../lib/image.js');
      const thumbBuf = await generateThumbnail(req.file.buffer);

      [mainImage, thumbnailResult] = await Promise.all([
        uploadImage(userId, processed.buffer, 'image/webp', '.webp'),
        uploadImage(userId, thumbBuf, 'image/webp', '_thumb.webp'),
      ]);
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'R2 upload failed — returning identification without storage');
    }

    await db.update(users)
      .set({ aiScansThisMonth: sql`${users.aiScansThisMonth} + 1` })
      .where(eq(users.id, userId));

    logger.info({ userId, name: identification.name }, 'Scan complete');

    res.status(201).json({
      identification,
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
