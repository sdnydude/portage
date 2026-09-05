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
    vi.mocked(prefillCandidateAspects).mockImplementation(async (cands: any) => ({
      candidates: cands.map((c: any, i: number) => (i === 0 ? { ...c, aspects: { Brand: ['Sony'] } } : c)),
    }));

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

  it('prefills aspects on the top candidate (multi-image refine path)', async () => {
    mockUserSelect();
    mockUpdateReturns();

    vi.mocked(fetchPhotosAsBase64).mockResolvedValue([
      { base64: 'imgA', mediaType: 'image/jpeg' },
      { base64: 'imgB', mediaType: 'image/jpeg' },
    ]);
    vi.mocked(identifyItemsMulti).mockResolvedValue({
      candidates: [{
        name: 'Nextorage SSD', description: 'External SSD', category: 'electronics',
        condition: 'good' as const, conditionNotes: '', brand: 'Nextorage', model: 'AtomX',
        features: [], estimatedValueLow: 50, estimatedValueHigh: 90, confidence: 0.9,
      }],
      reasoning: [],
    });
    vi.mocked(prefillCandidateAspects).mockImplementation(async (cands: any) => ({
      candidates: cands.map((c: any, i: number) => (i === 0 ? { ...c, aspects: { Type: ['Portable External SSD'] } } : c)),
    }));

    const res = await request(app)
      .post('/scan/refine')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(prefillCandidateAspects).toHaveBeenCalledTimes(1);
    // the first fetched image's base64 is threaded through for the vision prefill path
    expect(prefillCandidateAspects).toHaveBeenCalledWith(expect.anything(), 'imgA');
    expect(res.body.identification.aspects).toEqual({ Type: ['Portable External SSD'] });
    expect(res.body.detailed.candidates[0].aspects).toEqual({ Type: ['Portable External SSD'] });
  });

  it('returns detailed.provenance with the identification and aspect-prefill calls', async () => {
    mockUserSelect();
    mockUpdateReturns();

    vi.mocked(fetchPhotosAsBase64).mockResolvedValue([{ base64: 'imgA', mediaType: 'image/jpeg' }]);
    vi.mocked(identifyItemsMulti).mockResolvedValue({
      candidates: [{
        name: 'Nextorage SSD', description: 'External SSD', category: 'electronics',
        condition: 'good' as const, conditionNotes: '', brand: 'Nextorage', model: 'AtomX',
        features: [], estimatedValueLow: 50, estimatedValueHigh: 90, confidence: 0.9,
      }],
      reasoning: [],
      provenance: { identification: { provider: 'local', model: 'qwen3-vl:8b-instruct', fallbacks: 0 } },
    });
    vi.mocked(prefillCandidateAspects).mockImplementation(async (cands: any) => ({
      candidates: cands,
      provenance: { provider: 'gemini', model: 'gemini-2.5-flash', fallbacks: 1 },
    }));

    const res = await request(app)
      .post('/scan/refine')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.detailed.provenance).toEqual({
      identification: { provider: 'local', model: 'qwen3-vl:8b-instruct', fallbacks: 0 },
      aspects: { provider: 'gemini', model: 'gemini-2.5-flash', fallbacks: 1 },
    });
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

  it('honors an admin-set scan-limit override — 30 scans pass when the override is 100', async () => {
    mockUserSelect({
      subscriptionTier: 'free',
      trialEndsAt: null,
      aiScansThisMonth: 30, // over the free-tier 25, under the override
      limitOverrides: { aiScansPerMonth: 100 },
    });
    mockUpdateReturns();

    const res = await request(app)
      .post('/scan/refine')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody);

    // The gate must read the override, not the raw tier limit.
    expect(res.status).not.toBe(429);
  });

  it('returns 429 LIMIT_REACHED when a free-tier user is at the monthly scan limit', async () => {
    mockUserSelect({
      subscriptionTier: 'free',
      trialEndsAt: null,
      aiScansThisMonth: 25,
    });
    mockUpdateReturns();

    const res = await request(app)
      .post('/scan/refine')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody);

    expect(res.status).toBe(429);
    expect(res.body.code).toBe('LIMIT_REACHED');
  });

  // Pro and beta-tester scan limits are null (unlimited) — only free is capped.
  it('allows scan regardless of count for unlimited tiers', async () => {
    mockUserSelect({
      subscriptionTier: 'pro',
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
