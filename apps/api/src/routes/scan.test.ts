import request from 'supertest';
import { createApp } from '../app.js';
import { createTestToken } from '../test/helpers.js';
import { db } from '../db/index.js';

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../lib/vision.js', () => ({
  identifyItem: vi.fn(),
  identifyItemDetailed: vi.fn(),
  identifyItemsMulti: vi.fn(),
  fetchPhotosAsBase64: vi.fn(),
}));

vi.mock('../lib/aspect-prefill.js', () => ({
  prefillCandidateAspects: vi.fn(),
}));

vi.mock('../lib/image.js', () => ({
  processImage: vi.fn(),
  generateThumbnail: vi.fn(),
}));

vi.mock('../lib/storage.js', () => ({
  uploadImage: vi.fn(),
}));

import { identifyItemsMulti, fetchPhotosAsBase64, identifyItemDetailed } from '../lib/vision.js';
import { prefillCandidateAspects } from '../lib/aspect-prefill.js';
import { processImage, generateThumbnail } from '../lib/image.js';
import { uploadImage } from '../lib/storage.js';

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Sony WH-1000XM4', description: 'd', category: 'electronics',
    condition: 'good' as const, conditionNotes: '', brand: 'Sony', model: 'WH-1000XM4',
    features: [], estimatedValueLow: 150, estimatedValueHigh: 200, confidence: 0.9,
    ...overrides,
  };
}

const R2_PUBLIC_URL = 'https://images.portage.test';
process.env.R2_PUBLIC_URL = R2_PUBLIC_URL;

function mockUserSelect(overrides: Record<string, unknown> = {}) {
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([{
          subscriptionTier: 'pro',
          aiScansThisMonth: 0,
          scanCountResetAt: new Date(),
          ...overrides,
        }]),
      }),
    }),
  } as any);
}

function mockUpdateReturns() {
  vi.mocked(db.update).mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  } as any);
}

let app: ReturnType<typeof createApp>;
let token: string;

beforeAll(() => {
  app = createApp();
  token = createTestToken();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /scan?detail=full', () => {
  it('prefills aspects on the top candidate and returns them in identification', async () => {
    mockUserSelect();
    mockUpdateReturns();

    vi.mocked(processImage).mockResolvedValue({ buffer: Buffer.from('img'), width: 800, height: 600 } as any);
    vi.mocked(generateThumbnail).mockResolvedValue(Buffer.from('thumb'));
    vi.mocked(uploadImage).mockResolvedValue({ key: 'k', url: 'https://images.portage.test/k.jpg' });

    vi.mocked(identifyItemDetailed).mockResolvedValue({
      candidates: [candidate({ aspects: {} })],
      reasoning: [],
    } as any);
    vi.mocked(prefillCandidateAspects).mockImplementation(async (cands: any) =>
      cands.map((c: any, i: number) => (i === 0 ? { ...c, aspects: { Brand: ['Sony'] } } : c)),
    );

    const res = await request(app)
      .post('/scan?detail=full')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', Buffer.from('fake-image-bytes'), 'photo.jpg');

    expect(res.status).toBe(201);
    expect(prefillCandidateAspects).toHaveBeenCalledTimes(1);
    // base64 of the processImage mock buffer Buffer.from('img') === 'aW1n'
    expect(prefillCandidateAspects).toHaveBeenCalledWith(expect.anything(), 'aW1n');
    expect(res.body.identification.aspects).toEqual({ Brand: ['Sony'] });
    expect(res.body.detailed.candidates[0].aspects).toEqual({ Brand: ['Sony'] });
  });
});

describe('POST /scan/refine', () => {
  const validBody = {
    imageUrls: [
      `${R2_PUBLIC_URL}/user-1/photo1.jpg`,
      `${R2_PUBLIC_URL}/user-1/photo2.jpg`,
    ],
  };

  it('returns 201 with identification from multi-image scan', async () => {
    mockUserSelect();
    mockUpdateReturns();

    vi.mocked(fetchPhotosAsBase64).mockResolvedValue([
      { base64: 'img1', mediaType: 'image/jpeg' },
      { base64: 'img2', mediaType: 'image/jpeg' },
    ]);

    const mockResult = {
      candidates: [{
        name: 'Fender Stratocaster',
        description: 'Electric guitar',
        category: 'music',
        condition: 'good' as const,
        conditionNotes: '',
        brand: 'Fender',
        model: 'Stratocaster',
        features: ['electric', '6-string'],
        estimatedValueLow: 500,
        estimatedValueHigh: 800,
        confidence: 0.9,
      }],
      reasoning: ['Headstock shape matches Fender'],
    };

    vi.mocked(identifyItemsMulti).mockResolvedValue(mockResult);

    const res = await request(app)
      .post('/scan/refine')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.identification.name).toBe('Fender Stratocaster');
    expect(res.body.detailed.candidates).toHaveLength(1);
    expect(res.body.detailed.reasoning).toEqual(['Headstock shape matches Fender']);
  });

  it('rejects URLs not starting with R2_PUBLIC_URL (SSRF protection)', async () => {
    const res = await request(app)
      .post('/scan/refine')
      .set('Authorization', `Bearer ${token}`)
      .send({
        imageUrls: ['https://evil.com/internal-network-scan'],
      });

    expect(res.status).toBe(400);
  });

  it('rejects empty imageUrls array', async () => {
    const res = await request(app)
      .post('/scan/refine')
      .set('Authorization', `Bearer ${token}`)
      .send({ imageUrls: [] });

    expect(res.status).toBe(400);
  });

  it('rejects more than 3 imageUrls', async () => {
    const res = await request(app)
      .post('/scan/refine')
      .set('Authorization', `Bearer ${token}`)
      .send({
        imageUrls: [
          `${R2_PUBLIC_URL}/a.jpg`,
          `${R2_PUBLIC_URL}/b.jpg`,
          `${R2_PUBLIC_URL}/c.jpg`,
          `${R2_PUBLIC_URL}/d.jpg`,
        ],
      });

    expect(res.status).toBe(400);
  });

  it('allows scan regardless of count (billing gate moved to prepare-listing)', async () => {
    mockUserSelect({
      subscriptionTier: 'free',
      aiScansThisMonth: 999,
    });
    mockUpdateReturns();

    vi.mocked(fetchPhotosAsBase64).mockResolvedValue([
      { base64: 'img1', mediaType: 'image/jpeg' },
    ]);
    vi.mocked(identifyItemsMulti).mockResolvedValue({
      candidates: [{ name: 'Test', description: '', category: 'other', condition: 'good' as const, conditionNotes: '', brand: '', model: '', features: [], estimatedValueLow: 0, estimatedValueHigh: 0, confidence: 0.5 }],
      reasoning: [],
    });

    const res = await request(app)
      .post('/scan/refine')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody);

    expect(res.status).toBe(201);
  });

  it('requires auth', async () => {
    const res = await request(app)
      .post('/scan/refine')
      .send(validBody);

    expect(res.status).toBe(401);
  });
});
