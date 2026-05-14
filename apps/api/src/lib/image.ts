import sharp from 'sharp';
import { createLogger } from './logger.js';

const logger = createLogger('image');

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
    .jpeg({ quality: QUALITY });

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
    format: 'jpeg',
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
    .jpeg({ quality: 90 });

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
    format: 'jpeg',
    size: buffer.length,
  };
}

export async function generateThumbnail(input: Buffer, size: number = 400): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize(size, size, { fit: 'cover' })
    .jpeg({ quality: 75 })
    .toBuffer();
}

export async function rotateImage(input: Buffer, degrees: 90 | 180 | 270): Promise<ProcessedImage> {
  const image = sharp(input).rotate(degrees).jpeg({ quality: QUALITY });
  const buffer = await image.toBuffer();
  const meta = await sharp(buffer).metadata();

  return {
    buffer,
    width: meta.width!,
    height: meta.height!,
    format: 'jpeg',
    size: buffer.length,
  };
}

export async function cropImage(
  input: Buffer,
  crop: { x: number; y: number; width: number; height: number },
): Promise<ProcessedImage> {
  const image = sharp(input)
    .extract({ left: Math.round(crop.x), top: Math.round(crop.y), width: Math.round(crop.width), height: Math.round(crop.height) })
    .jpeg({ quality: QUALITY });

  const buffer = await image.toBuffer();
  const meta = await sharp(buffer).metadata();

  return {
    buffer,
    width: meta.width!,
    height: meta.height!,
    format: 'jpeg',
    size: buffer.length,
  };
}
