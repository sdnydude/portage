import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { createTestToken } from '../test/helpers.js';
import { db } from '../db/index.js';

vi.mock('../db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

vi.mock('stripe', () => ({
  default: vi.fn(() => ({
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
    webhooks: { constructEvent: vi.fn() },
  })),
}));

const DRAFT_ID = '00000000-0000-0000-0000-00000000d001';
const ITEM_ID = '00000000-0000-0000-0000-00000000a001';

function mockSelectOnce(rows: unknown[], { withLimit = true } = {}) {
  const tail = withLimit
    ? { limit: vi.fn().mockResolvedValue(rows) }
    : rows;
  vi.mocked(db.select).mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue(tail),
      orderBy: vi.fn().mockResolvedValue(rows),
    }),
  } as any);
}

// GET / chains .where().orderBy() — resolve at orderBy.
function mockListSelectOnce(rows: unknown[]) {
  vi.mocked(db.select).mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue(rows),
      }),
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

describe('GET /drafts', () => {
  it('lists the caller drafts newest-first', async () => {
    mockListSelectOnce([{ id: DRAFT_ID, title: 'Mic Kit', marketplace: 'ebay' }]);

    const res = await request(app)
      .get('/drafts')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.drafts).toHaveLength(1);
    expect(res.body.drafts[0].id).toBe(DRAFT_ID);
  });

  it('requires auth', async () => {
    const res = await request(app).get('/drafts');
    expect(res.status).toBe(401);
  });
});

describe('GET /drafts/:id', () => {
  it('404s for a draft that does not exist (or belongs to someone else)', async () => {
    mockSelectOnce([]);

    const res = await request(app)
      .get(`/drafts/${DRAFT_ID}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});

describe('POST /drafts — upsert', () => {
  it('creates a new draft (201) when neither id nor itemId matches', async () => {
    const insertValues = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: DRAFT_ID, marketplace: 'ebay', title: 'Mic Kit' }]),
    });
    vi.mocked(db.insert).mockReturnValue({ values: insertValues } as any);

    const res = await request(app)
      .post('/drafts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ marketplace: 'ebay', title: 'Mic Kit', flowState: { step: 'photos' } });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(DRAFT_ID);
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
      marketplace: 'ebay',
      title: 'Mic Kit',
      flowState: { step: 'photos' },
    }));
  });

  it('UPDATEs in place when the client supplies an existing draft id (auto-save path)', async () => {
    mockSelectOnce([{ id: DRAFT_ID }]); // id lookup finds the caller-owned draft
    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: DRAFT_ID, title: 'Mic Kit v2' }]),
      }),
    });
    vi.mocked(db.update).mockReturnValue({ set: updateSet } as any);

    const res = await request(app)
      .post('/drafts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ id: DRAFT_ID, marketplace: 'ebay', title: 'Mic Kit v2', flowState: { step: 'price' } });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Mic Kit v2');
    expect(vi.mocked(db.insert)).not.toHaveBeenCalled();
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ flowState: { step: 'price' } }));
  });

  it('dedupes by (itemId, marketplace) — a second save for the same item updates, not duplicates', async () => {
    mockSelectOnce([{ id: DRAFT_ID }]); // itemId+marketplace lookup hits
    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: DRAFT_ID, itemId: ITEM_ID }]),
      }),
    });
    vi.mocked(db.update).mockReturnValue({ set: updateSet } as any);

    const res = await request(app)
      .post('/drafts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ itemId: ITEM_ID, marketplace: 'ebay', flowState: {} });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(DRAFT_ID);
    expect(vi.mocked(db.insert)).not.toHaveBeenCalled();
  });

  it('rejects an unknown marketplace (etsy is parked) with a 400', async () => {
    const res = await request(app)
      .post('/drafts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ marketplace: 'etsy', flowState: {} });

    expect(res.status).toBe(400);
    expect(vi.mocked(db.insert)).not.toHaveBeenCalled();
  });

  it('requires flowState (the whole point of a draft) — 400 without it', async () => {
    const res = await request(app)
      .post('/drafts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ marketplace: 'ebay' });

    expect(res.status).toBe(400);
  });
});

describe('DELETE /drafts/:id', () => {
  it('deletes a caller-owned draft', async () => {
    mockSelectOnce([{ id: DRAFT_ID }]);
    const whereDelete = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.delete).mockReturnValue({ where: whereDelete } as any);

    const res = await request(app)
      .delete(`/drafts/${DRAFT_ID}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: true });
    expect(whereDelete).toHaveBeenCalled();
  });

  it('404s (and does NOT delete) when the draft is not the caller own', async () => {
    mockSelectOnce([]); // ownership scoped lookup misses

    const res = await request(app)
      .delete(`/drafts/${DRAFT_ID}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(404);
    expect(vi.mocked(db.delete)).not.toHaveBeenCalled();
  });
});

describe('DELETE /drafts — stale cleanup', () => {
  it('sweeps drafts older than 30 days for the caller only', async () => {
    const whereDelete = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.delete).mockReturnValue({ where: whereDelete } as any);

    const res = await request(app)
      .delete('/drafts')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ cleaned: true });
    expect(whereDelete).toHaveBeenCalled();
  });
});
