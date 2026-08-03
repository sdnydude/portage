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

let app: ReturnType<typeof createApp>;
let authToken: string;

beforeAll(() => {
  app = createApp();
  authToken = createTestToken();
});

beforeEach(() => {
  vi.clearAllMocks();
});

const LOG_ROW = {
  id: 'log-1',
  userId: 'test-user-id',
  itemId: 'item-1',
  listingId: 'listing-1',
  marketplace: 'reverb',
  trigger: 'item_edit',
  status: 'failure',
  message: 'Reverb 422: shipping required',
  errors: [{ field: 'shipping' }],
  durationMs: 812,
  createdAt: new Date('2026-08-02T12:00:00Z'),
};

describe('GET /sync-log', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/sync-log');
    expect(res.status).toBe(401);
  });

  it('returns the caller-scoped log page date-desc with a total count', async () => {
    // First select: page query (where → orderBy → limit → offset)
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue([LOG_ROW]),
            }),
          }),
        }),
      }),
    } as any);
    // Second select: count query
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 1 }]),
      }),
    } as any);

    const res = await request(app)
      .get('/sync-log')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.entries).toHaveLength(1);
    expect(res.body.entries[0]).toMatchObject({ id: 'log-1', status: 'failure', marketplace: 'reverb' });
    expect(res.body.total).toBe(1);
  });

  it('rejects an invalid status filter with 400 (zod validation)', async () => {
    const res = await request(app)
      .get('/sync-log?status=banana')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(400);
  });
});

describe('GET /sync-log/status', () => {
  it('derives per-listing state: pending job wins, then failed job, then synced from the log', async () => {
    // First select: sync_jobs rows for the requested listings
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([
            { listingId: 'l-pending', status: 'pending', updatedAt: new Date('2026-08-03T09:00:00Z'), lastError: null },
            { listingId: 'l-failed', status: 'failed', updatedAt: new Date('2026-08-03T09:00:00Z'), lastError: 'Reverb 422: shipping required' },
            { listingId: 'l-synced', status: 'success', updatedAt: new Date('2026-08-03T09:00:00Z'), lastError: null },
          ]),
        }),
      }),
    } as any);

    const res = await request(app)
      .get('/sync-log/status?listingIds=l-pending,l-failed,l-synced')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.statuses).toEqual(expect.arrayContaining([
      expect.objectContaining({ listingId: 'l-pending', state: 'pending' }),
      expect.objectContaining({ listingId: 'l-failed', state: 'failed', message: 'Reverb 422: shipping required' }),
      expect.objectContaining({ listingId: 'l-synced', state: 'synced' }),
    ]));
  });
});

describe('POST /sync-log/retry', () => {
  it('re-enqueues a full sync for a caller-owned syncable listing and returns 202', async () => {
    // Listing ownership lookup
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{
            id: 'listing-1', userId: 'test-user-id', itemId: 'item-1',
            marketplace: 'reverb', status: 'active', marketplaceListingId: '87654321',
          }]),
        }),
      }),
    } as any);
    const whereSpy = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.delete).mockReturnValue({ where: whereSpy } as any);
    const valuesSpy = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.insert).mockReturnValue({ values: valuesSpy } as any);

    const res = await request(app)
      .post('/sync-log/retry')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ listingId: 'listing-1' });

    expect(res.status).toBe(202);
    expect(valuesSpy).toHaveBeenCalledWith(expect.objectContaining({
      listingId: 'listing-1',
      itemId: 'item-1',
      marketplace: 'reverb',
      includePhotos: true, // retry pushes the full state, photos included
    }));
  });
});
