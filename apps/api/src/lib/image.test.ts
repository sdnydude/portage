import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { flattenToWhite, evToBrightnessMultiplier, adjustExposure, processImage } from './image.js';
import { AppError } from '../middleware/error.js';

describe('processImage', () => {
  it('throws a 400 AppError instead of an uncaught error for a corrupt/unparseable buffer', async () => {
    const corrupt = Buffer.from('not an image');
    await expect(processImage(corrupt)).rejects.toMatchObject(
      new AppError(400, 'INVALID_IMAGE', 'Could not process image — the file may be corrupt or in an unsupported format.'),
    );
  });
});

async function solidPng(r: number, g: number, b: number, alpha: number, size = 8): Promise<Buffer> {
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r, g, b, alpha } },
  })
    .png()
    .toBuffer();
}

describe('flattenToWhite', () => {
  it('produces an opaque JPEG (no alpha channel)', async () => {
    const transparent = await solidPng(0, 0, 0, 0);
    const out = await flattenToWhite(transparent);
    const meta = await sharp(out.buffer).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.hasAlpha).toBe(false);
  });

  it('turns fully transparent pixels white, not black', async () => {
    const transparent = await solidPng(0, 0, 0, 0);
    const out = await flattenToWhite(transparent);
    const { data } = await sharp(out.buffer).raw().toBuffer({ resolveWithObject: true });
    // First pixel R/G/B should be ~white (JPEG is lossy, so allow a small margin).
    expect(data[0]).toBeGreaterThan(250);
    expect(data[1]).toBeGreaterThan(250);
    expect(data[2]).toBeGreaterThan(250);
  });

  it('preserves opaque foreground pixels', async () => {
    const red = await solidPng(200, 20, 20, 255);
    const out = await flattenToWhite(red);
    const { data } = await sharp(out.buffer).raw().toBuffer({ resolveWithObject: true });
    expect(data[0]).toBeGreaterThan(150); // still red-dominant
    expect(data[1]).toBeLessThan(90);
    expect(data[2]).toBeLessThan(90);
  });
});

describe('evToBrightnessMultiplier', () => {
  it('maps EV stops to a doubling brightness multiplier', () => {
    expect(evToBrightnessMultiplier(0)).toBe(1);
    expect(evToBrightnessMultiplier(1)).toBe(2);
    expect(evToBrightnessMultiplier(-1)).toBe(0.5);
  });

  it('clamps to the supported [-2, +2] EV range', () => {
    expect(evToBrightnessMultiplier(5)).toBe(4); // 2^2
    expect(evToBrightnessMultiplier(-5)).toBe(0.25); // 2^-2
  });
});

async function meanChannel(buffer: Buffer): Promise<number> {
  const { channels } = await sharp(buffer).stats();
  // Average the R/G/B means (ignore alpha if present).
  const rgb = channels.slice(0, 3);
  return rgb.reduce((sum, c) => sum + c.mean, 0) / rgb.length;
}

describe('adjustExposure', () => {
  it('brightens the image for positive EV', async () => {
    const gray = await solidPng(100, 100, 100, 255);
    const before = await meanChannel(gray);
    const out = await adjustExposure(gray, 1);
    const after = await meanChannel(out.buffer);
    expect(after).toBeGreaterThan(before);
  });

  it('darkens the image for negative EV', async () => {
    const gray = await solidPng(150, 150, 150, 255);
    const before = await meanChannel(gray);
    const out = await adjustExposure(gray, -1);
    const after = await meanChannel(out.buffer);
    expect(after).toBeLessThan(before);
  });

  it('returns an opaque JPEG', async () => {
    const gray = await solidPng(120, 120, 120, 255);
    const out = await adjustExposure(gray, 0.5);
    const meta = await sharp(out.buffer).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.hasAlpha).toBe(false);
  });
});
