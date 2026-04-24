import sharp from 'sharp';
import { pino } from 'pino';

const logger = pino({ name: 'image' });

const MAX_DIMENSION = 2048;
const QUALITY = 85;

interface ProcessedImage {
  buffer: Buffer;
  width: number;
  height: number;
  format: string;
  size: number;
}

export async function processImage(input: Buffer): Promise<ProcessedImage> {
  const metadata = await sharp(input).metadata();
  logger.debug({ width: metadata.width, height: metadata.height, format: metadata.format }, 'Processing image');

  const image = sharp(input)
    .rotate()
    .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: QUALITY });

  const buffer = await image.toBuffer();
  const outputMeta = await sharp(buffer).metadata();

  logger.info({
    inputSize: input.length,
    outputSize: buffer.length,
    width: outputMeta.width,
    height: outputMeta.height,
  }, 'Image processed');

  return {
    buffer,
    width: outputMeta.width!,
    height: outputMeta.height!,
    format: 'webp',
    size: buffer.length,
  };
}

export async function enhanceImage(input: Buffer): Promise<ProcessedImage> {
  const metadata = await sharp(input).metadata();
  logger.debug({ width: metadata.width, height: metadata.height }, 'Enhancing image');

  const image = sharp(input)
    .rotate()
    .normalize()
    .sharpen({ sigma: 1.2, m1: 1.0, m2: 0.5 })
    .modulate({ brightness: 1.02, saturation: 1.08 })
    .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 90 });

  const buffer = await image.toBuffer();
  const outputMeta = await sharp(buffer).metadata();

  logger.info({
    inputSize: input.length,
    outputSize: buffer.length,
    width: outputMeta.width,
    height: outputMeta.height,
  }, 'Image enhanced');

  return {
    buffer,
    width: outputMeta.width!,
    height: outputMeta.height!,
    format: 'webp',
    size: buffer.length,
  };
}

export async function generateThumbnail(input: Buffer, size: number = 400): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize(size, size, { fit: 'cover' })
    .webp({ quality: 75 })
    .toBuffer();
}
