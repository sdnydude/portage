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
    transaction: vi.fn(),
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

// Real UUIDs — /status rejects non-UUID listingIds (audit m4).
const L1 = '11111111-1111-4111-8111-111111111111';
const L_PENDING = '22222222-2222-4222-8222-222222222222';
const L_FAILED = '33333333-3333-4333-8333-333333333333';
const L_SYNCED = '44444444-4444-4444-8444-444444444444';

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
            { listingId: L_PENDING, status: 'pending', updatedAt: new Date('2026-08-03T09:00:00Z'), lastError: null },
            { listingId: L_FAILED, status: 'failed', updatedAt: new Date('2026-08-03T09:00:00Z'), lastError: 'Reverb 422: shipping required' },
            { listingId: L_SYNCED, status: 'success', updatedAt: new Date('2026-08-03T09:00:00Z'), lastError: null },
          ]),
        }),
      }),
    } as any);
    // Second select: marketplace_sync_log rows (none for these listings)
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any);

    const res = await request(app)
      .get(`/sync-log/status?listingIds=${L_PENDING},${L_FAILED},${L_SYNCED}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.statuses).toEqual(expect.arrayContaining([
      expect.objectContaining({ listingId: L_PENDING, state: 'pending' }),
      expect.objectContaining({ listingId: L_FAILED, state: 'failed', message: 'Reverb 422: shipping required' }),
      expect.objectContaining({ listingId: L_SYNCED, state: 'synced' }),
    ]));
  });
});

describe('GET /sync-log/status — input validation (audit m4)', () => {
  it('rejects non-UUID listingIds with 400 instead of letting Postgres 500', async () => {
    const res = await request(app)
      .get('/sync-log/status?listingIds=not-a-uuid,also-bad')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(400);
  });
});

describe('GET /sync-log/status — ordering (audit m5)', () => {
  it('orders both source queries with a secondary id tiebreaker so equal timestamps resolve stably', async () => {
    const jobsOrderBy = vi.fn().mockResolvedValue([]);
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ orderBy: jobsOrderBy }) }),
    } as any);
    const logOrderBy = vi.fn().mockResolvedValue([]);
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ orderBy: logOrderBy }) }),
    } as any);

    const res = await request(app)
      .get(`/sync-log/status?listingIds=${L1}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(jobsOrderBy).toHaveBeenCalledWith(expect.anything(), expect.anything());
    expect(logOrderBy).toHaveBeenCalledWith(expect.anything(), expect.anything());
  });
});

describe('GET /sync-log/status — inline-sync visibility (audit C1)', () => {
  it('reports failed from a newer marketplace_sync_log row even when the last sync_jobs row says success', async () => {
    // sync_jobs: old success from an item-edit job
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([
            { listingId: L1, status: 'success', updatedAt: new Date('2026-08-03T09:00:00Z'), lastError: null },
          ]),
        }),
      }),
    } as any);
    // marketplace_sync_log: NEWER failure from a listings.ts inline price-edit sync
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([
            { listingId: L1, status: 'failure', message: 'Invalid AutoAccept price.', createdAt: new Date('2026-08-03T10:00:00Z') },
          ]),
        }),
      }),
    } as any);

    const res = await request(app)
      .get(`/sync-log/status?listingIds=${L1}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.statuses).toEqual([
      expect.objectContaining({ listingId: L1, state: 'failed', message: 'Invalid AutoAccept price.' }),
    ]);
  });
});

describe('GET /sync-log/status — unresolved failure visibility (audit C2)', () => {
  it('reports failed when a terminally failed photo job is followed by a newer photo-less success', async () => {
    // sync_jobs: photo job failed terminally, then a price-only edit succeeded
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([
            { listingId: L1, status: 'success', includePhotos: false, updatedAt: new Date('2026-08-03T11:00:00Z'), lastError: null },
            { listingId: L1, status: 'failed', includePhotos: true, updatedAt: new Date('2026-08-03T10:00:00Z'), lastError: 'Reverb 422: image upload rejected' },
          ]),
        }),
      }),
    } as any);
    // marketplace_sync_log: empty
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any);

    const res = await request(app)
      .get(`/sync-log/status?listingIds=${L1}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.statuses).toEqual([
      expect.objectContaining({ listingId: L1, state: 'failed', message: 'Reverb 422: image upload rejected' }),
    ]);
  });
});

describe('POST /sync-log/retry', () => {
  it('rejects retry on a sold listing — mirrors the items.ts status guard (audit M5)', async () => {
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{
            id: 'listing-1', userId: 'test-user-id', itemId: 'item-1',
            marketplace: 'reverb', status: 'sold', marketplaceListingId: '87654321',
          }]),
        }),
      }),
    } as any);
    const valuesSpy = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.insert).mockReturnValue({ values: valuesSpy } as any);

    const res = await request(app)
      .post('/sync-log/retry')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ listingId: 'listing-1' });

    expect(res.status).toBe(404);
    expect(valuesSpy).not.toHaveBeenCalled();
  });

  it('rate-limits retry per user — unlimited retries would drive unbounded real marketplace calls (audit M8)', async () => {
    // Distinct user = distinct limiter bucket (the limiter store is
    // module-level and shared across apps), isolating the other retry tests.
    const freshApp = createApp();
    const limiterToken = createTestToken({ sub: 'rate-limit-user' });
    // Every request short-circuits at the ownership lookup with 404 — the
    // limiter sits in front of the handler, so 404s still count against it.
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any);

    let last = 0;
    for (let i = 0; i < 6; i++) {
      const res = await request(freshApp)
        .post('/sync-log/retry')
        .set('Authorization', `Bearer ${limiterToken}`)
        .send({ listingId: 'listing-1' });
      last = res.status;
    }
    expect(last).toBe(429);
  });

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
    const whereSpy = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) });
    const valuesSpy = vi.fn().mockResolvedValue(undefined);
    const tx = {
      delete: vi.fn().mockReturnValue({ where: whereSpy }),
      insert: vi.fn().mockReturnValue({ values: valuesSpy }),
    };
    vi.mocked(db.transaction).mockImplementation(async (fn: any) => fn(tx));

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
