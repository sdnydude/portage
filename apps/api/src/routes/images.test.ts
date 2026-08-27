import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';
import { createTestToken } from '../test/helpers.js';

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

const { mockAdjustExposure, mockFlattenToWhite, mockUploadImage } = vi.hoisted(() => ({
  mockAdjustExposure: vi.fn(),
  mockFlattenToWhite: vi.fn(),
  mockUploadImage: vi.fn(),
}));

vi.mock('../lib/image.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/image.js')>();
  return { ...actual, adjustExposure: mockAdjustExposure, flattenToWhite: mockFlattenToWhite };
});

vi.mock('../lib/storage.js', () => ({
  uploadImage: mockUploadImage,
  deleteImage: vi.fn(),
  getImage: vi.fn(),
}));

const ALLOWED_URL = 'https://portage-images.digitalharmonyai.com/test/photo.jpg';

describe('POST /images/exposure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-length': '1000' }),
      arrayBuffer: async () => new ArrayBuffer(1000),
    } as unknown as Response);
  });

  it('adjusts exposure and returns the uploaded image', async () => {
    mockAdjustExposure.mockResolvedValue({
      buffer: Buffer.from('jpeg-bytes'),
      width: 800,
      height: 600,
      format: 'jpeg',
      size: 1234,
    });
    mockUploadImage.mockResolvedValue({
      key: 'user/abc_exposure.jpg',
      url: 'https://portage-images.digitalharmonyai.com/user/abc_exposure.jpg',
    });

    const res = await request(createApp())
      .post('/images/exposure')
      .set('Authorization', `Bearer ${createTestToken()}`)
      .send({ imageUrl: ALLOWED_URL, ev: 1 });

    expect(res.status).toBe(200);
    expect(res.body.image).toMatchObject({
      key: 'user/abc_exposure.jpg',
      width: 800,
      height: 600,
    });
    expect(mockAdjustExposure).toHaveBeenCalledWith(expect.any(Buffer), 1);
  });

  it('rejects an EV outside the ±2 range with 400', async () => {
    const res = await request(createApp())
      .post('/images/exposure')
      .set('Authorization', `Bearer ${createTestToken()}`)
      .send({ imageUrl: ALLOWED_URL, ev: 3 });

    expect(res.status).toBe(400);
    expect(mockAdjustExposure).not.toHaveBeenCalled();
  });

  it('rejects a non-URL imageUrl with 400 VALIDATION_ERROR (zod 4 z.url())', async () => {
    const res = await request(createApp())
      .post('/images/exposure')
      .set('Authorization', `Bearer ${createTestToken()}`)
      .send({ imageUrl: 'not a url', ev: 1 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(mockAdjustExposure).not.toHaveBeenCalled();
  });
});

describe('POST /images/remove-bg', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Pro user → no billing gate, no counter writes.
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{
            subscriptionTier: 'pro',
            trialEndsAt: null,
            bgRemovalsThisMonth: 0,
            scanCountResetAt: new Date(),
          }]),
        }),
      }),
    } as never);
    // First fetch: the source image. Second fetch: the rembg service.
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-length': '1000', 'content-type': 'image/jpeg' }),
        arrayBuffer: async () => new ArrayBuffer(1000),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(500),
      } as unknown as Response);
  });

  it('flattens the transparent cutout onto white and uploads a JPEG (not a transparent PNG)', async () => {
    mockFlattenToWhite.mockResolvedValue({
      buffer: Buffer.from('white-flattened-jpeg'),
      width: 800,
      height: 600,
      format: 'jpeg',
      size: 999,
    });
    mockUploadImage.mockResolvedValue({
      key: 'user/abc_nobg.jpg',
      url: 'https://portage-images.digitalharmonyai.com/user/abc_nobg.jpg',
    });

    const res = await request(createApp())
      .post('/images/remove-bg')
      .set('Authorization', `Bearer ${createTestToken()}`)
      .send({ imageUrl: ALLOWED_URL });

    expect(res.status).toBe(200);
    expect(mockFlattenToWhite).toHaveBeenCalledWith(expect.any(Buffer));
    expect(mockUploadImage).toHaveBeenCalledWith(
      'test-user-id',
      expect.any(Buffer),
      'image/jpeg',
      '_nobg.jpg',
    );
  });
});
