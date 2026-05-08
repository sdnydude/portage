import { Router } from 'express';
import multer from 'multer';
import { pino } from 'pino';
import { requireAuth } from '../middleware/auth.js';
import { processImage, generateThumbnail, enhanceImage, rotateImage, cropImage } from '../lib/image.js';
import { uploadImage, deleteImage, getImage } from '../lib/storage.js';
import { z } from 'zod';
import { AppError } from '../middleware/error.js';
import { env } from '../lib/env.js';

const logger = pino({ name: 'images' });

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FETCH_SIZE = 20 * 1024 * 1024;

function isAllowedImageOrigin(url: string): boolean {
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

    const srcType = imgResponse.headers.get('content-type') || 'image/webp';
    const ext = srcType.includes('png') ? 'image.png' : srcType.includes('jpeg') ? 'image.jpg' : 'image.webp';
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

    const resultBuffer = Buffer.from(await rembgResponse.arrayBuffer());
    const uploaded = await uploadImage(userId, resultBuffer, 'image/png', '_nobg.png');

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
    const uploaded = await uploadImage(userId, rotated.buffer, 'image/webp', '_rotated.webp');

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
    const uploaded = await uploadImage(userId, cropped.buffer, 'image/webp', '_cropped.webp');

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
