import request from 'supertest';
import { createApp } from '../../app.js';
import { db } from '../../db/index.js';
import { createTestToken } from '../../test/helpers.js';

vi.mock('../../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

function mockSelectTokenReturns(rows: unknown[]) {
  vi.mocked(db.select).mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  } as any);
}

let app: ReturnType<typeof createApp>;
let authToken: string;

beforeAll(() => {
  app = createApp();
  authToken = createTestToken();
});

beforeEach(() => {
  vi.clearAllMocks();
});

const VALID_TOKEN = 'a'.repeat(64);
const MOCK_TOKEN_ROW = {
  token: VALID_TOKEN,
  userId: 'test-user-id',
  itemIds: ['00000000-0000-0000-0000-000000000001'],
  expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  useCount: 0,
};

describe('exportTokens schema', () => {
  it('exports exportTokens table from schema', async () => {
    const schema = await import('../../db/schema.js');
    expect((schema as any).exportTokens).toBeDefined();
  });
});

describe('GET /items/photos/export', () => {
  it('returns 400 when token is missing', async () => {
    const res = await request(app).get('/items/photos/export');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_TOKEN');
  });

  it('returns 401 when token not found in DB', async () => {
    mockSelectTokenReturns([]);

    const res = await request(app).get(`/items/photos/export?token=${VALID_TOKEN}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  it('returns 401 when token is expired', async () => {
    mockSelectTokenReturns([{ ...MOCK_TOKEN_ROW, expiresAt: new Date(Date.now() - 1000) }]);

    const res = await request(app).get(`/items/photos/export?token=${VALID_TOKEN}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  it('returns 401 when token use_count is 3 or more', async () => {
    mockSelectTokenReturns([{ ...MOCK_TOKEN_ROW, useCount: 3 }]);

    const res = await request(app).get(`/items/photos/export?token=${VALID_TOKEN}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  it('returns application/zip with correct Content-Disposition', async () => {
    mockSelectTokenReturns([MOCK_TOKEN_ROW]);
    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    } as any);
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    } as any);

    const res = await request(app).get(`/items/photos/export?token=${VALID_TOKEN}`);

    expect(res.headers['content-type']).toMatch(/application\/zip/);
    expect(res.headers['content-disposition']).toMatch(/portage-photos-/);
  });

  it('streams a non-empty ZIP body when items have photos', async () => {
    mockSelectTokenReturns([MOCK_TOKEN_ROW]);
    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    } as any);
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{
          id: MOCK_TOKEN_ROW.itemIds[0],
          title: 'Test Item',
          photos: [{ url: 'https://portage-images.digitalharmonyai.com/photo1.jpg', key: 'photo1.jpg' }],
        }]),
      }),
    } as any);
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    } as any);

    const res = await request(app).get(`/items/photos/export?token=${VALID_TOKEN}`);

    expect(res.status).toBe(200);
    // Must contain more than just the empty-ZIP EOCD record (22 bytes) — i.e. photos are present
    expect(Number(res.headers['content-length'])).toBeGreaterThan(22);
  });

  it('returns 502 when all photo fetches fail', async () => {
    mockSelectTokenReturns([MOCK_TOKEN_ROW]);
    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    } as any);
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{
          id: MOCK_TOKEN_ROW.itemIds[0],
          title: 'Test Item',
          photos: [{ url: 'https://portage-images.digitalharmonyai.com/photo1.jpg', key: 'photo1.jpg' }],
        }]),
      }),
    } as any);
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: false, status: 503 } as any);

    const res = await request(app).get(`/items/photos/export?token=${VALID_TOKEN}`);
    expect(res.status).toBe(502);
    expect(res.body.code).toBe('PHOTO_FETCH_FAILED');
  });

  it('never fetches a photo from a disallowed origin — SSRF guard regression (P7 b9c43cd4)', async () => {
    mockSelectTokenReturns([MOCK_TOKEN_ROW]);
    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    } as any);
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{
          id: MOCK_TOKEN_ROW.itemIds[0],
          title: 'Test Item',
          photos: [{ url: 'https://169.254.169.254/latest/meta-data', key: 'evil' }],
        }]),
      }),
    } as any);
    const fetchSpy = vi.spyOn(global, 'fetch');

    const res = await request(app).get(`/items/photos/export?token=${VALID_TOKEN}`);

    expect(fetchSpy).not.toHaveBeenCalled();
    // The disallowed photo is skipped before totalPhotos++, so the export
    // degrades to an empty ZIP rather than a fetch attempt.
    expect(res.status).toBe(200);
  });

  it('increments use_count before streaming', async () => {
    mockSelectTokenReturns([MOCK_TOKEN_ROW]);
    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    } as any);
    // Mock item lookup returning no items (empty ZIP is fine for this test)
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    } as any);

    await request(app).get(`/items/photos/export?token=${VALID_TOKEN}`);

    expect(vi.mocked(db.update)).toHaveBeenCalledOnce();
  });
});
