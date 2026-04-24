import { Router } from 'express';
import multer from 'multer';
import { pino } from 'pino';
import { requireAuth } from '../middleware/auth.js';
import { processImage, generateThumbnail, enhanceImage } from '../lib/image.js';
import { uploadImage, deleteImage } from '../lib/storage.js';
import { z } from 'zod';
import { AppError } from '../middleware/error.js';

const logger = pino({ name: 'images' });

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

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
      uploadImage(userId, processed.buffer, 'image/webp', '.webp'),
      uploadImage(userId, thumbnail, 'image/webp', '_thumb.webp'),
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

    logger.info({ userId, imageUrl }, 'Enhance started');

    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new AppError(400, 'FETCH_FAILED', 'Could not fetch the image to enhance');
    }

    const arrayBuffer = await response.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    const enhanced = await enhanceImage(inputBuffer);

    const uploaded = await uploadImage(userId, enhanced.buffer, 'image/webp', '_enhanced.webp');

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
