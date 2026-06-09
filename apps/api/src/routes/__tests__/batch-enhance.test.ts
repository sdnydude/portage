import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestToken } from '../../test/helpers.js';

vi.mock('../../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../lib/image.js', () => ({
  processImage: vi.fn(),
  generateThumbnail: vi.fn(),
  enhanceImage: vi.fn(),
  rotateImage: vi.fn(),
  cropImage: vi.fn(),
}));

vi.mock('../../lib/storage.js', () => ({
  uploadImage: vi.fn(),
  deleteImage: vi.fn(),
  getImage: vi.fn(),
}));

import { enhanceImage } from '../../lib/image.js';
import { uploadImage } from '../../lib/storage.js';

let app: ReturnType<typeof createApp>;
let authToken: string;

beforeAll(() => {
  app = createApp();
  authToken = createTestToken();
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const R2_URL = 'https://portage-images.digitalharmonyai.com';

describe('POST /images/batch-enhance', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/images/batch-enhance')
      .send({ imageUrls: [`${R2_URL}/photo1.jpg`] });

    expect(res.status).toBe(401);
  });

  it('enhances multiple images and returns per-photo results', async () => {
    const urls = [`${R2_URL}/p1.jpg`, `${R2_URL}/p2.jpg`];
    const fakeBuffer = Buffer.from('fake-image');

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-length': '100' }),
      arrayBuffer: () => Promise.resolve(fakeBuffer.buffer),
    } as any);

    vi.mocked(enhanceImage).mockResolvedValue({
      buffer: fakeBuffer,
      width: 800,
      height: 600,
      format: 'jpeg',
      size: 100,
    });

    vi.mocked(uploadImage).mockResolvedValueOnce({
      key: 'items/test-user-id/2026/01/01/p1_enhanced.jpg',
      url: `${R2_URL}/p1_enhanced.jpg`,
    }).mockResolvedValueOnce({
      key: 'items/test-user-id/2026/01/01/p2_enhanced.jpg',
      url: `${R2_URL}/p2_enhanced.jpg`,
    });

    const res = await request(app)
      .post('/images/batch-enhance')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ imageUrls: urls });

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(2);
    expect(res.body.results[0].status).toBe('success');
    expect(res.body.results[0].image.url).toBe(`${R2_URL}/p1_enhanced.jpg`);
    expect(res.body.results[1].status).toBe('success');
  });

  it('rejects URLs from non-Portage origins', async () => {
    const res = await request(app)
      .post('/images/batch-enhance')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ imageUrls: ['https://evil.com/photo.jpg'] });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_ORIGIN');
  });

  it('rejects more than 10 URLs', async () => {
    const urls = Array.from({ length: 11 }, (_, i) => `${R2_URL}/p${i}.jpg`);

    const res = await request(app)
      .post('/images/batch-enhance')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ imageUrls: urls });

    expect(res.status).toBe(400);
  });

  it('reports per-photo errors without failing the batch', async () => {
    const urls = [`${R2_URL}/good.jpg`, `${R2_URL}/bad.jpg`];
    const fakeBuffer = Buffer.from('fake-image');

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-length': '100' }),
        arrayBuffer: () => Promise.resolve(fakeBuffer.buffer),
      } as any)
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers(),
      } as any);

    vi.mocked(enhanceImage).mockResolvedValue({
      buffer: fakeBuffer,
      width: 800,
      height: 600,
      format: 'jpeg',
      size: 100,
    });

    vi.mocked(uploadImage).mockResolvedValueOnce({
      key: 'items/test-user-id/2026/01/01/good_enhanced.jpg',
      url: `${R2_URL}/good_enhanced.jpg`,
    });

    const res = await request(app)
      .post('/images/batch-enhance')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ imageUrls: urls });

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(2);
    expect(res.body.results[0].status).toBe('success');
    expect(res.body.results[1].status).toBe('error');
    expect(res.body.results[1].error).toBeDefined();
  });
});
