import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';
import { createTestToken } from '../test/helpers.js';

vi.mock('../db/index.js', () => {
  const db: Record<string, unknown> = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  // Default: run the callback with db itself as tx, so per-test
  // delete/insert mocks keep working inside enqueue's transaction.
  db.transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(db));
  return { db };
});

const { mockUpdateListing, mockGetTrafficReport, mockReverbUpdateListing } = vi.hoisted(() => ({
  mockUpdateListing: vi.fn(), mockGetTrafficReport: vi.fn(), mockReverbUpdateListing: vi.fn(),
}));
vi.mock('../marketplace/ebay-adapter.js', () => {
  const EbayAdapter = vi.fn(() => ({ updateListing: mockUpdateListing, getTrafficReport: mockGetTrafficReport }));
  const statics = EbayAdapter as unknown as Record<string, ReturnType<typeof vi.fn>>;
  statics.searchComps = vi.fn();
  statics.getCategorySuggestion = vi.fn();
  statics.getRequiredAspects = vi.fn();
  // Contract double of the real resolver (explicit → item cache → suggestion)
  // wired to the mocked static so tests control the suggestion path. The REAL
  // implementation is covered directly in ebay-adapter.test.ts ("self-healing
  // leaf category") — if its contract changes, those tests break first.
  const resolveEbayCategoryId = async (
    specific: Record<string, unknown> | undefined,
    item: { title: string; marketplaceData?: unknown },
  ) => {
    const explicit = specific?.categoryId as string | undefined;
    if (explicit && explicit !== '99') return { categoryId: explicit, categoryName: null, newlyResolved: false };
    const cached = (item.marketplaceData as { ebay?: { categoryId?: string; categoryName?: string } } | null | undefined)?.ebay;
    if (cached?.categoryId && cached.categoryId !== '99') return { categoryId: cached.categoryId, categoryName: cached.categoryName ?? null, newlyResolved: false };
    const s = await statics.getCategorySuggestion(item.title);
    return { categoryId: s?.categoryId ?? null, categoryName: s?.categoryName ?? null, newlyResolved: !!s?.categoryId };
  };
  return { EbayAdapter, resolveEbayCategoryId };
});
vi.mock('../marketplace/reverb-adapter.js', () => ({
  ReverbAdapter: vi.fn(() => ({ updateListing: mockReverbUpdateListing })),
}));

import { EbayAdapter } from '../marketplace/ebay-adapter.js';

const MOCK_ITEM = {
  id: 'item-1',
  userId: 'test-user-id',
  title: 'Sony WH-1000XM4',
  description: 'Noise-cancelling headphones',
  category: 'electronics',
  condition: 'good',
  conditionNotes: '',
  brand: 'Sony',
  model: 'WH-1000XM4',
  features: [],
  estimatedValueMin: 150,
  estimatedValueMax: 220,
  estimatedValueRecommended: 185,
  aiConfidenceScore: 0.9,
  photos: [],
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

// ─── Helper chain builders ────────────────────────────────────

function mockSelectReturnOnce(rows: unknown[]) {
  vi.mocked(db.select).mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            offset: vi.fn().mockResolvedValue(rows),
          }),
        }),
        // Awaiting the where-result directly (no .limit()) resolves to all rows,
        // so a handler can iterate every matching row.
        then: (resolve: (v: unknown) => unknown) => resolve(rows),
      }),
    }),
  } as any);
}

function mockSelectForList(items: unknown[], countRows: unknown[]) {
  // First call: the items query (with orderBy + limit + offset)
  vi.mocked(db.select).mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            offset: vi.fn().mockResolvedValue(items),
          }),
        }),
      }),
    }),
  } as any);

  // Second call: the count query (with where only)
  vi.mocked(db.select).mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(countRows),
    }),
  } as any);
}

function mockSelectReturns(rows: unknown[]) {
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  } as any);
}

function mockInsertReturns(rows: unknown[]) {
  vi.mocked(db.insert).mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue(rows),
    }),
  } as any);
}

function mockUpdateReturns(rows: unknown[]) {
  vi.mocked(db.update).mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(rows),
      }),
    }),
  } as any);
}

function mockDeleteReturns() {
  vi.mocked(db.delete).mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  } as any);
}

// Resolves directly at .where() — for queries with no limit/orderBy
function mockSelectWhere(rows: unknown[]) {
  vi.mocked(db.select).mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  } as any);
}

function mockInsertNoReturn() {
  vi.mocked(db.insert).mockReturnValueOnce({
    values: vi.fn().mockResolvedValue(undefined),
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

describe('GET /items', () => {
  it('returns items array with pagination metadata', async () => {
    mockSelectForList([MOCK_ITEM], [{ count: '1' }]);

    const res = await request(app)
      .get('/items')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].id).toBe('item-1');
    expect(res.body.total).toBe(1);
    expect(res.body.limit).toBe(50);
    expect(res.body.offset).toBe(0);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/items');
    expect(res.status).toBe(401);
  });

  it('selects a listed flag alongside the item columns (Unlisted chip data)', async () => {
    mockSelectForList([{ ...MOCK_ITEM, listed: false }], [{ count: '1' }]);

    const res = await request(app)
      .get('/items')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    // The list query must project an explicit column map including `listed`
    // (an EXISTS subquery) — a bare select() cannot produce it.
    const firstSelectArg = vi.mocked(db.select).mock.calls[0][0] as Record<string, unknown> | undefined;
    expect(firstSelectArg).toBeDefined();
    expect(firstSelectArg).toHaveProperty('listed');
    expect(res.body.items[0].listed).toBe(false);
  });

  it('projects displayStatus on the list and detail selects, and filters the list by ?status= (Housekeeping-1 T5)', async () => {
    mockSelectForList([{ ...MOCK_ITEM, listed: false, displayStatus: 'asset' }], [{ count: '1' }]);

    const res = await request(app)
      .get('/items?status=asset')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    const listSelectArg = vi.mocked(db.select).mock.calls[0][0] as Record<string, unknown>;
    expect(listSelectArg).toHaveProperty('displayStatus');
    expect(res.body.items[0].displayStatus).toBe('asset');

    vi.clearAllMocks();
    mockSelectReturns([{ ...MOCK_ITEM, displayStatus: 'unlisted' }]);
    const one = await request(app)
      .get('/items/item-1')
      .set('Authorization', `Bearer ${authToken}`);
    expect(one.status).toBe(200);
    const detailSelectArg = vi.mocked(db.select).mock.calls[0][0] as Record<string, unknown>;
    expect(detailSelectArg).toHaveProperty('displayStatus');

    const bad = await request(app)
      .get('/items?status=bogus')
      .set('Authorization', `Bearer ${authToken}`);
    expect(bad.status).toBe(400);
  });

  it('matches the category filter case-insensitively and normalizes category writes to lowercase-trim (Housekeeping-1 T8)', async () => {
    const { categoryFilterExpr } = await import('./items.js');
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const { items } = await import('../db/schema.js');
    const mockDb = drizzle.mock();
    const { sql: text, params } = mockDb.select({ id: items.id }).from(items).where(categoryFilterExpr('Electronics')).toSQL();
    expect(text.toLowerCase()).toContain('ilike');
    expect(params).toEqual(['electronics']);
    // wildcards in the value are literal, not pattern chars
    expect(mockDb.select({ id: items.id }).from(items).where(categoryFilterExpr('50%_off')).toSQL().params).toEqual(['50\\%\\_off']);

    mockSelectReturnOnce([{ id: 'item-1' }]);
    const setSpy = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ ...MOCK_ITEM, category: 'electronics' }]) }),
    });
    vi.mocked(db.update).mockReturnValue({ set: setSpy } as any);
    mockSelectReturnOnce([]);
    const res = await request(app)
      .patch('/items/item-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ category: '  Electronics ' });
    expect(res.status).toBe(200);
    expect(setSpy.mock.calls[0][0]).toMatchObject({ category: 'electronics' });
  });

  it('projects liveMarketplaces (distinct marketplaces with an active listing) for the inventory card chips (Housekeeping-1 T7)', async () => {
    mockSelectForList([{ ...MOCK_ITEM, listed: true, displayStatus: 'active', liveMarketplaces: ['ebay'] }], [{ count: '1' }]);
    const res = await request(app).get('/items').set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    const listSelectArg = vi.mocked(db.select).mock.calls[0][0] as Record<string, unknown>;
    expect(listSelectArg).toHaveProperty('liveMarketplaces');

    const { itemLiveMarketplacesExpr } = await import('./items.js');
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const { items } = await import('../db/schema.js');
    const { sql: text } = drizzle.mock().select({ m: itemLiveMarketplacesExpr }).from(items).toSQL();
    expect(text).toContain('"item_id" = "items"."id"');
    expect(text.toLowerCase()).toContain("'active'");
  });

  it('composes the ?status= CASE comparison with the category filter inside one and() — a single bound status param, enum cast to text (review gap 4)', async () => {
    const { itemDisplayStatusExpr, categoryFilterExpr } = await import('./items.js');
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const { and, sql } = await import('drizzle-orm');
    const { items } = await import('../db/schema.js');
    const { sql: text, params } = drizzle.mock().select({ id: items.id }).from(items)
      .where(and(categoryFilterExpr('Electronics'), sql`${itemDisplayStatusExpr} = ${'asset'}`))
      .toSQL();
    const norm = text.toLowerCase().replace(/\s+/g, ' ');
    expect(norm).toContain('ilike');
    expect(norm).toContain('"items"."status"::text end = $');
    expect(params).toEqual(['electronics', 'asset']);
  });

  it('renders the listed EXISTS subquery with a qualified outer items.id correlation', async () => {
    // Regression: drizzle strips table qualifiers on single-table selects, so an
    // interpolated ${items.id} inside the subquery rendered as bare "id", which
    // Postgres resolved to listings.id — correlation always false, every item
    // badged Unlisted despite active listings.
    const { itemListedExpr } = await import('./items.js');
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const { items } = await import('../db/schema.js');

    const mockDb = drizzle.mock();
    const { sql: text } = mockDb.select({ listed: itemListedExpr }).from(items).toSQL();

    expect(text).toContain('"item_id" = "items"."id"');
  });

  it('renders displayStatus as a CASE: a live active listing wins, then a draft listing, else items.status (Housekeeping-1 T5)', async () => {
    const { itemDisplayStatusExpr } = await import('./items.js');
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const { items } = await import('../db/schema.js');

    const mockDb = drizzle.mock();
    const { sql: text } = mockDb.select({ displayStatus: itemDisplayStatusExpr }).from(items).toSQL();

    const norm = text.toLowerCase().replace(/\s+/g, ' ');
    const activeAt = norm.indexOf("'active'");
    const draftAt = norm.indexOf("'draft'");
    const statusAt = norm.indexOf('"items"."status"');
    const soldAt = norm.indexOf("'sold'");
    expect(norm).toContain('case when exists');
    expect(activeAt).toBeGreaterThan(-1);
    expect(draftAt).toBeGreaterThan(activeAt);
    // A sold listing is marketplace truth too (set by the status sweep, never
    // by hand) — it must derive before the manual items.status fallback.
    expect(soldAt).toBeGreaterThan(draftAt);
    expect(statusAt).toBeGreaterThan(soldAt);
  });
});

describe('GET /items/:id', () => {
  it('returns a single item when found', async () => {
    mockSelectReturns([MOCK_ITEM]);

    const res = await request(app)
      .get('/items/item-1')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('item-1');
    expect(res.body.title).toBe('Sony WH-1000XM4');
  });

  it('returns 404 when item not found', async () => {
    mockSelectReturns([]);

    const res = await request(app)
      .get('/items/nonexistent')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});

describe('POST /items', () => {
  it('creates and returns a new item with 201', async () => {
    mockInsertReturns([MOCK_ITEM]);

    const res = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Sony WH-1000XM4', category: 'electronics', condition: 'good' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('item-1');
    expect(res.body.title).toBe('Sony WH-1000XM4');
  });

  it('accepts conditionNotes longer than the old 500-char cap', async () => {
    // Multi-photo refine scans produce verbose condition notes; a 500-char cap
    // 400'd the save with an opaque "Validation failed" in the UI.
    mockInsertReturns([MOCK_ITEM]);

    const res = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Sony WH-1000XM4', conditionNotes: 'A'.repeat(1800) });

    expect(res.status).toBe(201);
  });

  it('accepts quantity and passes it to the insert', async () => {
    const valuesSpy = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ ...MOCK_ITEM, quantity: 5 }]),
    });
    vi.mocked(db.insert).mockReturnValue({ values: valuesSpy } as any);

    const res = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Sony WH-1000XM4', quantity: 5 });

    expect(res.status).toBe(201);
    expect(valuesSpy).toHaveBeenCalledWith(expect.objectContaining({ quantity: 5 }));
    expect(res.body.quantity).toBe(5);
  });

  it('accepts a seller-set price and passes it to the insert', async () => {
    const valuesSpy = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ ...MOCK_ITEM, price: 129.99 }]),
    });
    vi.mocked(db.insert).mockReturnValue({ values: valuesSpy } as any);

    const res = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Sony WH-1000XM4', price: 129.99 });

    expect(res.status).toBe(201);
    expect(valuesSpy).toHaveBeenCalledWith(expect.objectContaining({ price: 129.99 }));
    expect(res.body.price).toBe(129.99);
  });

  it('rejects a price of 0 (eBay disallows $0 listings; null/omitted is the unset sentinel)', async () => {
    mockInsertReturns([MOCK_ITEM]);
    const res = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Freebie', price: 0 });

    expect(res.status).toBe(400);
  });

  it('accepts weight/dimension fields and passes them to the insert', async () => {
    const valuesSpy = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ ...MOCK_ITEM }]),
    });
    vi.mocked(db.insert).mockReturnValue({ values: valuesSpy } as any);

    const res = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Vintage Guitar',
        weightOz: 56,
        lengthIn: 45,
        widthIn: 18,
        heightIn: 6,
        ebayPackageType: 'MAILING_BOX',
        weightEstimated: true,
      });

    expect(res.status).toBe(201);
    expect(valuesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        weightOz: 56,
        lengthIn: 45,
        widthIn: 18,
        heightIn: 6,
        ebayPackageType: 'MAILING_BOX',
        weightEstimated: true,
      }),
    );
  });

  it('accepts aspects and passes them to the insert', async () => {
    const valuesSpy = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ ...MOCK_ITEM, aspects: { Brand: ['Sony'] } }]),
    });
    vi.mocked(db.insert).mockReturnValue({ values: valuesSpy } as any);

    const res = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Sony WH-1000XM4', aspects: { Brand: ['Sony'] } });

    expect(res.status).toBe(201);
    expect(valuesSpy).toHaveBeenCalledWith(expect.objectContaining({ aspects: { Brand: ['Sony'] } }));
  });

  it('defaults aspects to {} when omitted', async () => {
    const valuesSpy = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ ...MOCK_ITEM }]),
    });
    vi.mocked(db.insert).mockReturnValue({ values: valuesSpy } as any);

    await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'No aspects item' });

    expect(valuesSpy).toHaveBeenCalledWith(expect.objectContaining({ aspects: {} }));
  });

  it('rejects quantity 0 — eBay requires at least 1', async () => {
    const res = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Test Item', quantity: 0 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when title is missing', async () => {
    const res = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ category: 'electronics' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/items')
      .send({ title: 'Test Item' });

    expect(res.status).toBe(401);
  });
});

describe('PATCH /items/:id', () => {
  it('updates and returns the item', async () => {
    // First select: existence check (returns existing item)
    mockSelectReturnOnce([{ id: 'item-1' }]);
    // Update returning updated item
    const updatedItem = { ...MOCK_ITEM, title: 'Updated Title' };
    mockUpdateReturns([updatedItem]);

    const res = await request(app)
      .patch('/items/item-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Updated Title' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated Title');
  });

  it('returns 404 when item belongs to different user or not found', async () => {
    mockSelectReturnOnce([]);

    const res = await request(app)
      .patch('/items/item-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Updated Title' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  // The inline adapter-payload behavior (eBay heal/merges, Reverb enrichment,
  // photo diff) moved to lib/marketplace-sync.ts with the P2 outbox flip —
  // its contract is pinned in marketplace-sync.test.ts. Route tests below pin
  // WHAT gets enqueued, not what the worker later sends.

  it('still enqueues a Reverb draft-with-listingId row (remote Reverb drafts are revisable)', async () => {
    mockSelectReturnOnce([{ id: 'item-1' }]);
    mockUpdateReturns([{ ...MOCK_ITEM, title: 'T2' }]);
    // Publish can return a remote DRAFT that still carries a listing id
    // (shop setup pending) — the eBay "draft = nothing to sync" rule must
    // not apply to Reverb.
    mockSelectReturnOnce([{ id: 'row-rd1', marketplace: 'reverb', status: 'draft', marketplaceListingId: '87654321', ebaySku: null, marketplaceSpecificFields: {}, currency: 'USD' }]);
    const valuesSpy = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.insert).mockReturnValue({ values: valuesSpy } as any);
    vi.mocked(db.delete).mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }) } as any);

    const res = await request(app)
      .patch('/items/item-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'T2' });

    expect(res.status).toBe(200);
    expect(valuesSpy).toHaveBeenCalledWith(expect.objectContaining({ listingId: 'row-rd1' }));
    expect(res.body.syncQueued).toEqual(['row-rd1']);
  });

  it('skips a Reverb row with no marketplaceListingId (nothing remote to revise)', async () => {
    mockSelectReturnOnce([{ id: 'item-1' }]);
    mockUpdateReturns([{ ...MOCK_ITEM, title: 'T4' }]);
    mockSelectReturnOnce([{ marketplace: 'reverb', status: 'draft', marketplaceListingId: null, ebaySku: null, marketplaceSpecificFields: {}, currency: 'USD' }]);

    const res = await request(app)
      .patch('/items/item-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'T4' });

    expect(res.status).toBe(200);
    expect(mockReverbUpdateListing).not.toHaveBeenCalled();
  });

  it('still saves the item edit when the sync enqueue fails (best-effort, warning surfaced)', async () => {
    mockSelectReturnOnce([{ id: 'item-1' }]); // existence
    mockUpdateReturns([{ ...MOCK_ITEM, title: 'Saved Locally' }]);
    mockSelectReturnOnce([{ id: 'row-e1', marketplace: 'ebay', status: 'active', marketplaceListingId: '307000000001', ebaySku: 'PRT-X', marketplaceSpecificFields: {}, currency: 'USD' }]);
    // enqueueItemSync's delete throws — even the local outbox write failing
    // must not fail the saved edit.
    vi.mocked(db.delete).mockReturnValue({ where: vi.fn().mockRejectedValue(new Error('db down')) } as any);

    const res = await request(app)
      .patch('/items/item-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Saved Locally' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Saved Locally');
    expect(res.body.syncWarnings?.some((w: string) => /could not be queued/.test(w))).toBe(true);
  });

  it('warns with the numbers when a new item price conflicts with a listing\'s Best Offer thresholds — 200, item saved, job still queued (BO-3)', async () => {
    mockSelectReturnOnce([{ id: 'item-1' }]); // existence
    mockUpdateReturns([{ ...MOCK_ITEM, price: 199 }]);
    mockSelectReturnOnce([{
      id: 'row-e1', marketplace: 'ebay', status: 'active', marketplaceListingId: '307100136291', ebaySku: 'PRT-X', currency: 'USD',
      marketplaceSpecificFields: { bestOfferEnabled: true, bestOfferAutoAcceptPrice: 209 },
    }]);
    const valuesSpy = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.insert).mockReturnValue({ values: valuesSpy } as any);
    vi.mocked(db.delete).mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }) } as any);

    const res = await request(app)
      .patch('/items/item-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ price: 199 });

    expect(res.status).toBe(200); // the item is a local fact across marketplaces — never blocked
    expect(res.body.syncWarnings?.join(' ')).toMatch(/209/);
    expect(valuesSpy).toHaveBeenCalled(); // job still enqueued — worker terminal-fails with the durable record
  });

  it('does not leak raw database error text into syncWarnings on enqueue failure (audit m2)', async () => {
    mockSelectReturnOnce([{ id: 'item-1' }]); // existence
    mockUpdateReturns([{ ...MOCK_ITEM, title: 'Saved' }]);
    mockSelectReturnOnce([{ id: 'row-e1', marketplace: 'ebay', status: 'active', marketplaceListingId: '307000000001', ebaySku: 'PRT-X', marketplaceSpecificFields: {}, currency: 'USD' }]);
    // First transaction = the item write (passes through); second = enqueue (fails).
    vi.mocked(db.transaction)
      .mockImplementationOnce((async (fn: (tx: unknown) => unknown) => fn(db)) as any)
      .mockRejectedValueOnce(
        new Error('insert or update on table "sync_jobs" violates foreign key constraint "sync_jobs_listing_id_fkey"'),
      );

    const res = await request(app)
      .patch('/items/item-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Saved' });

    expect(res.status).toBe(200);
    expect(res.body.syncWarnings?.length).toBeGreaterThan(0);
    expect(res.body.syncWarnings.join(' ')).not.toMatch(/foreign key|sync_jobs|constraint/i);
  });

  it('enqueues only published eBay listings (active + Trading ItemID) and skips DB-only drafts', async () => {
    mockSelectReturnOnce([{ id: 'item-1' }]); // existence
    mockUpdateReturns([{ ...MOCK_ITEM, title: 'Edited' }]);
    mockSelectReturnOnce([
      { id: 'row-a', marketplace: 'ebay', status: 'active', marketplaceListingId: '307000000001', ebaySku: 'PRT-A', marketplaceSpecificFields: {}, currency: 'USD' },
      // Trade-First: a DB-only draft has no live listing to sync — must be skipped.
      { id: 'row-d', marketplace: 'ebay', status: 'draft', marketplaceListingId: null, ebaySku: 'PRT-D', marketplaceSpecificFields: {}, currency: 'USD' },
    ]);
    const valuesSpy = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.insert).mockReturnValue({ values: valuesSpy } as any);
    vi.mocked(db.delete).mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }) } as any);

    const res = await request(app)
      .patch('/items/item-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Edited' });

    expect(res.status).toBe(200);
    expect(res.body.syncQueued).toEqual(['row-a']);
    expect(valuesSpy).toHaveBeenCalledTimes(1);
  });

  it('updates aspects via PATCH', async () => {
    mockSelectReturnOnce([{ id: 'item-1' }]);
    const setSpy = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ ...MOCK_ITEM, aspects: { Color: ['Red'] } }]),
      }),
    });
    vi.mocked(db.update).mockReturnValue({ set: setSpy } as any);

    const res = await request(app)
      .patch('/items/item-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ aspects: { Color: ['Red'] } });

    expect(res.status).toBe(200);
    expect(setSpy).toHaveBeenCalledWith(expect.objectContaining({ aspects: { Color: ['Red'] } }));
  });

  it('merges aspects on PATCH — a partial aspect update preserves existing keys', async () => {
    // Existing item already carries scan-captured Brand/Model specifics. A partial
    // aspect edit (adding Color) must not wipe them — aspects is JSONB like
    // marketplaceData, so the partial PATCH must read-merge, not wholesale-replace.
    mockSelectReturnOnce([{ id: 'item-1', aspects: { Brand: ['Sony'], Model: ['WH-1000XM4'] } }]);
    const setSpy = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ ...MOCK_ITEM, aspects: { Brand: ['Sony'], Model: ['WH-1000XM4'], Color: ['Red'] } }]),
      }),
    });
    vi.mocked(db.update).mockReturnValue({ set: setSpy } as any);

    const res = await request(app)
      .patch('/items/item-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ aspects: { Color: ['Red'] } });

    expect(res.status).toBe(200);
    const written = setSpy.mock.calls[0][0].aspects;
    expect(written).toEqual({ Brand: ['Sony'], Model: ['WH-1000XM4'], Color: ['Red'] });
  });

  it('deletes an aspect key when the PATCH sends it as null (Housekeeping-1 T3 aspect removal)', async () => {
    mockSelectReturnOnce([{ id: 'item-1', aspects: { Brand: ['Sony'], Color: ['Red'] } }]);
    const setSpy = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ ...MOCK_ITEM, aspects: { Brand: ['Sony'] } }]),
      }),
    });
    vi.mocked(db.update).mockReturnValue({ set: setSpy } as any);

    const res = await request(app)
      .patch('/items/item-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ aspects: { Color: null } });

    expect(res.status).toBe(200);
    expect(setSpy.mock.calls[0][0].aspects).toEqual({ Brand: ['Sony'] });
  });

  it('strips a removed aspect key from the item\'s draft/active listings too — stored listing aspects would otherwise resurrect it on sync (T3)', async () => {
    mockSelectReturnOnce([{ id: 'item-1', aspects: { Brand: ['Sony'], Color: ['Red'] } }]);
    const setSpy = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ ...MOCK_ITEM, aspects: { Brand: ['Sony'] } }]) }),
    });
    vi.mocked(db.update).mockReturnValue({ set: setSpy } as any);
    mockSelectReturnOnce([]); // no syncable listings

    const res = await request(app)
      .patch('/items/item-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ aspects: { Color: null } });

    expect(res.status).toBe(200);
    expect(db.update).toHaveBeenCalledTimes(2);
    expect(setSpy.mock.calls[1][0]).toHaveProperty('marketplaceSpecificFields');
  });

  it('accepts a manual status (asset) on PATCH and rejects derived states like active (Housekeeping-1 T5)', async () => {
    mockSelectReturnOnce([{ id: 'item-1' }]);
    const setSpy = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ ...MOCK_ITEM, status: 'asset' }]) }),
    });
    vi.mocked(db.update).mockReturnValue({ set: setSpy } as any);
    mockSelectReturnOnce([]);

    const ok = await request(app)
      .patch('/items/item-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'asset' });
    expect(ok.status).toBe(200);
    expect(setSpy.mock.calls[0][0]).toMatchObject({ status: 'asset' });

    const bad = await request(app)
      .patch('/items/item-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'active' });
    expect(bad.status).toBe(400);
  });

  it('handles a null aspect AND a price in one PATCH: item write, listing aspect strip, listing price mirror — three writes, all scoped to the user (review gap 1)', async () => {
    mockSelectReturnOnce([{ id: 'item-1', aspects: { Brand: ['Sony'], Color: ['Red'] } }]);
    const setSpy = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ ...MOCK_ITEM, aspects: { Brand: ['Sony'] }, price: 42 }]) }),
    });
    vi.mocked(db.update).mockReturnValue({ set: setSpy } as any);
    mockSelectReturnOnce([]); // no syncable listings

    const res = await request(app)
      .patch('/items/item-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ aspects: { Color: null }, price: 42 });

    expect(res.status).toBe(200);
    expect(db.update).toHaveBeenCalledTimes(3);
    expect(setSpy.mock.calls[0][0]).toMatchObject({ aspects: { Brand: ['Sony'] }, price: 42 });
    expect(setSpy.mock.calls[1][0]).toHaveProperty('marketplaceSpecificFields');
    expect(setSpy.mock.calls[2][0]).toMatchObject({ price: 42 });
  });

  it('refuses a manual status with 409 STATUS_LOCKED while a listing owns it (active/draft/sold) — the UI lock is not the only guard (review)', async () => {
    mockSelectReturnOnce([{ id: 'item-1' }]); // existence
    mockSelectReturnOnce([{ status: 'active' }]); // owning listing
    vi.mocked(db.update).mockReturnValue({ set: vi.fn() } as any);

    const res = await request(app)
      .patch('/items/item-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'asset' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('STATUS_LOCKED');
    expect(db.update).not.toHaveBeenCalled();
  });

  it('persists marketplaceData.ebay.categoryId so publish can resolve the eBay leaf category', async () => {
    mockSelectReturnOnce([{ id: 'item-1' }]);
    const mp = { ebay: { categoryId: '33034', categoryName: 'Electric Guitars' } };
    const setSpy = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ ...MOCK_ITEM, marketplaceData: mp }]),
      }),
    });
    vi.mocked(db.update).mockReturnValue({ set: setSpy } as any);

    const res = await request(app)
      .patch('/items/item-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ marketplaceData: mp });

    expect(res.status).toBe(200);
    // The resolved eBay category must reach the DB write (not be stripped by Zod),
    // so resolveEbayCategoryId finds item.marketplaceData.ebay.categoryId at publish.
    // Server normalizes the entry (title null, cachedAt stamped), so assert the
    // meaningful fields rather than exact equality.
    const written = setSpy.mock.calls[0][0].marketplaceData;
    expect(written.ebay.categoryId).toBe('33034');
    expect(written.ebay.categoryName).toBe('Electric Guitars');
    expect(res.body.marketplaceData.ebay.categoryId).toBe('33034');
  });

  it('persists marketplaceData.scan.visionCategory (Tier-2 mismatch-guard data, not stripped by Zod)', async () => {
    mockSelectReturnOnce([{ id: 'item-1' }]);
    const mp = { scan: { visionCategory: 'electronics' } };
    const setSpy = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ ...MOCK_ITEM, marketplaceData: mp }]),
      }),
    });
    vi.mocked(db.update).mockReturnValue({ set: setSpy } as any);

    const res = await request(app)
      .patch('/items/item-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ marketplaceData: mp });

    expect(res.status).toBe(200);
    const written = setSpy.mock.calls[0][0].marketplaceData;
    expect(written.scan.visionCategory).toBe('electronics');
  });

  it('accepts an over-50-char scan.visionCategory (AI drift) — truncated, never a 400 that kills the save', async () => {
    mockSelectReturnOnce([{ id: 'item-1' }]);
    const mp = { scan: { visionCategory: 'electronics'.padEnd(90, 'y') } };
    const setSpy = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ ...MOCK_ITEM, marketplaceData: mp }]),
      }),
    });
    vi.mocked(db.update).mockReturnValue({ set: setSpy } as any);

    const res = await request(app)
      .patch('/items/item-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ marketplaceData: mp });

    expect(res.status).toBe(200);
    const written = setSpy.mock.calls[0][0].marketplaceData;
    expect(written.scan.visionCategory).toHaveLength(50);
  });

  it('keeps the scan entry title-free — the ebay title-preservation branch must not inject title:null into scan', async () => {
    mockSelectReturnOnce([{ id: 'item-1' }]);
    const mp = { scan: { visionCategory: 'electronics' } };
    const setSpy = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ ...MOCK_ITEM, marketplaceData: mp }]),
      }),
    });
    vi.mocked(db.update).mockReturnValue({ set: setSpy } as any);

    const res = await request(app)
      .patch('/items/item-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ marketplaceData: mp });

    expect(res.status).toBe(200);
    const written = setSpy.mock.calls[0][0].marketplaceData;
    expect(written.scan).toEqual({ visionCategory: 'electronics' });
  });

  it('merges marketplaceData — a category-only edit preserves the AI title and sibling entries', async () => {
    // Existing item already carries an AI-optimized eBay title (csv-export reads it)
    // and a sibling etsy entry. A category-only edit must not wipe either.
    const existingMd = {
      ebay: { categoryId: '33034', categoryName: 'Electric Guitars', title: 'Fender Strat — AI optimized', cachedAt: '2026-01-01T00:00:00.000Z' },
      etsy: { categoryId: 'etsy-7', categoryName: 'Guitars', title: null, cachedAt: '2026-01-01T00:00:00.000Z' },
    };
    mockSelectReturnOnce([{ id: 'item-1', marketplaceData: existingMd }]);
    const setSpy = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ ...MOCK_ITEM, marketplaceData: existingMd }]),
      }),
    });
    vi.mocked(db.update).mockReturnValue({ set: setSpy } as any);

    // Edit flow sends only the resolved eBay category — no title, no etsy.
    const res = await request(app)
      .patch('/items/item-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ marketplaceData: { ebay: { categoryId: '99999', categoryName: 'Acoustic Guitars' } } });

    expect(res.status).toBe(200);
    const written = setSpy.mock.calls[0][0].marketplaceData;
    expect(written.ebay.categoryId).toBe('99999');
    // The AI title survives the category-only write...
    expect(written.ebay.title).toBe('Fender Strat — AI optimized');
    // ...and the etsy sibling is not wiped.
    expect(written.etsy.categoryId).toBe('etsy-7');
  });
});

describe('PATCH /items/:id — photo cap + key optionality (F2)', () => {
  it('rejects more than 24 photos with a validation error', async () => {
    // No db mock: zod rejects before any query runs.
    const photos = Array.from({ length: 25 }, (_, i) => ({ url: `https://r2.example/p${i}.jpg`, key: `k${i}` }));
    const res = await request(app)
      .patch('/items/item-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ photos });
    expect(res.status).toBe(400);
  });

  it('accepts photos without a key (GetItem-imported rows are keyless)', async () => {
    mockSelectReturnOnce([{ id: 'item-1' }]);
    const photos = [{ url: 'https://i.ebayimg.com/images/g/abc/s-l1600.jpg', isPrimary: true }];
    mockUpdateReturns([{ ...MOCK_ITEM, photos }]);
    mockSelectReturnOnce([]); // no listings to sync
    const res = await request(app)
      .patch('/items/item-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ photos });
    expect(res.status).toBe(200);
  });
});

// F1 warning-surfacing, P0 enrichment/photo-diff, and P1 route-level sync-log
// tests moved with the P2 outbox flip: adapter behavior + warnings are pinned
// in lib/marketplace-sync.test.ts, job outcomes + sync-log writes in
// lib/sync-worker.test.ts. The route's own contract (enqueue) is below.

describe('PATCH /items/:id — photo trigger flag (P2)', () => {
  it('enqueues with trigger photo + includePhotos when the PATCH changes photos', async () => {
    mockSelectReturnOnce([{ id: 'item-1' }]); // existence
    mockUpdateReturns([{ ...MOCK_ITEM, photos: [{ url: 'https://r2.example/a.jpg', key: 'ka' }] }]);
    mockSelectReturnOnce([{ id: 'row-r1', marketplace: 'reverb', status: 'active', marketplaceListingId: '87654321', ebaySku: null, marketplaceSpecificFields: {}, currency: 'USD' }]);
    const valuesSpy = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.insert).mockReturnValue({ values: valuesSpy } as any);
    vi.mocked(db.delete).mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }) } as any);

    const res = await request(app)
      .patch('/items/item-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ photos: [{ url: 'https://r2.example/a.jpg', key: 'ka' }] });

    expect(res.status).toBe(200);
    expect(valuesSpy).toHaveBeenCalledWith(expect.objectContaining({
      listingId: 'row-r1',
      trigger: 'photo',
      includePhotos: true,
    }));
  });
});

describe('PATCH /items/:id — outbox enqueue (P2)', () => {
  it('enqueues sync jobs instead of calling marketplace adapters inline, and returns syncQueued listing ids', async () => {
    mockSelectReturnOnce([{ id: 'item-1' }]); // existence
    mockUpdateReturns([{ ...MOCK_ITEM, title: 'T8' }]);
    mockSelectReturnOnce([
      { id: 'row-r1', marketplace: 'reverb', status: 'active', marketplaceListingId: '87654321', ebaySku: null, marketplaceSpecificFields: { categoryUuid: 'cat-1' }, currency: 'USD' },
      { id: 'row-e1', marketplace: 'ebay', status: 'active', marketplaceListingId: '307000000001', ebaySku: 'PRT-X', marketplaceSpecificFields: { categoryId: '175669' }, currency: 'USD' },
    ]);
    const whereSpy = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) });
    vi.mocked(db.delete).mockReturnValue({ where: whereSpy } as any);
    const valuesSpy = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.insert).mockReturnValue({ values: valuesSpy } as any);

    const res = await request(app)
      .patch('/items/item-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'T8' });

    expect(res.status).toBe(200);
    expect(mockReverbUpdateListing).not.toHaveBeenCalled();
    expect(mockUpdateListing).not.toHaveBeenCalled();
    expect(valuesSpy).toHaveBeenCalledWith(expect.objectContaining({ listingId: 'row-r1', trigger: 'item_edit', includePhotos: false }));
    expect(valuesSpy).toHaveBeenCalledWith(expect.objectContaining({ listingId: 'row-e1', trigger: 'item_edit', includePhotos: false }));
    expect(res.body.syncQueued).toEqual(['row-r1', 'row-e1']);
  });
});

describe('PATCH /items/:id — price truth (Housekeeping-1 T1)', () => {
  it('writes the new price onto the item\'s draft/active listings rows before enqueue', async () => {
    mockSelectReturnOnce([{ id: 'item-1' }]); // existence
    const setSpy = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ ...MOCK_ITEM, price: 42 }]) }),
    });
    vi.mocked(db.update).mockReturnValue({ set: setSpy } as any);
    mockSelectReturnOnce([]); // no syncable listings

    const res = await request(app)
      .patch('/items/item-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ price: 42 });

    expect(res.status).toBe(200);
    expect(db.update).toHaveBeenCalledTimes(2);
    expect(setSpy).toHaveBeenNthCalledWith(2, expect.objectContaining({ price: 42 }));
  });
});

describe('PATCH /items/:id — eBay picture URL budget warning (F2)', () => {
  it('warns when total photo URL length exceeds the eBay 3975-char PictureURL budget', async () => {
    mockSelectReturnOnce([{ id: 'item-1' }]);
    const longBase = 'https://r2.example/' + 'x'.repeat(150) + '/';
    const photos = Array.from({ length: 24 }, (_, i) => ({ url: `${longBase}${i}.jpg`, key: `k${i}` }));
    mockUpdateReturns([{ ...MOCK_ITEM, photos }]);
    mockSelectReturnOnce([]); // no listings
    const res = await request(app)
      .patch('/items/item-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ photos });
    expect(res.status).toBe(200);
    expect(res.body.syncWarnings?.some((w: string) => /3975|picture url/i.test(w))).toBe(true);
  });
});

describe('POST /items/bulk/update — category normalization (Housekeeping-1 T8)', () => {
  it('writes the bulk category as lowercase-trim so the chip filter matches it', async () => {
    mockSelectWhere([{ id: '11111111-1111-4111-8111-111111111111' }]); // ownership check
    const setSpy = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: '11111111-1111-4111-8111-111111111111' }]) }),
    });
    vi.mocked(db.update).mockReturnValue({ set: setSpy } as any);

    const res = await request(app)
      .post('/items/bulk/update')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ ids: ['11111111-1111-4111-8111-111111111111'], updates: { category: ' Automotive ' } });

    expect(res.status).toBe(200);
    expect(setSpy.mock.calls[0][0]).toMatchObject({ category: 'automotive' });
  });
});

describe('DELETE /items/:id', () => {
  it('deletes item and returns { deleted: true }', async () => {
    mockSelectReturnOnce([{ id: 'item-1' }]);
    mockDeleteReturns();

    const res = await request(app)
      .delete('/items/item-1')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
  });

  it('returns 404 when item not found', async () => {
    mockSelectReturnOnce([]);

    const res = await request(app)
      .delete('/items/nonexistent')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});

describe('GET /items/:id/comps', () => {
  const MOCK_COMPS = {
    query: 'Sony WH-1000XM4',
    sold: [],
    active: [],
    stats: { sampleSize: 0, soldCount: 0, activeCount: 0, suggestedPrice: 0, priceRange: { low: 0, high: 0 }, currency: 'USD', confidence: 'low', conditionMatch: 'all', basedOn: 0 },
  };

  it('returns comps from eBay adapter', async () => {
    mockSelectReturns([MOCK_ITEM]);
    vi.mocked(EbayAdapter.searchComps).mockResolvedValue(MOCK_COMPS as any);

    const res = await request(app)
      .get('/items/item-1/comps')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.query).toBe('Sony WH-1000XM4');
    expect(vi.mocked(EbayAdapter.searchComps)).toHaveBeenCalledWith('Sony WH-1000XM4', 'electronics');
  });

  it('returns 503 when eBay adapter throws', async () => {
    mockSelectReturns([MOCK_ITEM]);
    vi.mocked(EbayAdapter.searchComps).mockRejectedValue(new Error('eBay API down'));

    const res = await request(app)
      .get('/items/item-1/comps')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('MARKETPLACE_UNAVAILABLE');
  });

  it('returns 404 when item not found for comps', async () => {
    mockSelectReturns([]);

    const res = await request(app)
      .get('/items/nonexistent/comps')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});

const ITEM_UUID_1 = '00000000-0000-0000-0000-000000000001';
const ITEM_UUID_2 = '00000000-0000-0000-0000-000000000002';
const MOCK_PHOTOS = [{ url: 'https://portage-images.digitalharmonyai.com/photo1.jpg', key: 'photo1.jpg' }];

describe('POST /items/photos/export/prepare', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/items/photos/export/prepare')
      .send({ ids: [ITEM_UUID_1] });
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid UUIDs', async () => {
    const res = await request(app)
      .post('/items/photos/export/prepare')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ ids: ['not-a-uuid'] });
    expect(res.status).toBe(400);
  });

  it('returns 403 when item does not belong to the user', async () => {
    mockSelectWhere([{ id: ITEM_UUID_1, photos: MOCK_PHOTOS, title: 'Item 1' }]);

    const res = await request(app)
      .post('/items/photos/export/prepare')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ ids: [ITEM_UUID_1, ITEM_UUID_2] });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('returns 422 when no items have photos', async () => {
    mockSelectWhere([{ id: ITEM_UUID_1, photos: [], title: 'Empty Item' }]);

    const res = await request(app)
      .post('/items/photos/export/prepare')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ ids: [ITEM_UUID_1] });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('NO_PHOTOS');
  });

  it('returns token and counts when items have photos', async () => {
    mockSelectWhere([{ id: ITEM_UUID_1, photos: MOCK_PHOTOS, title: 'Test Item' }]);
    mockInsertNoReturn();

    const res = await request(app)
      .post('/items/photos/export/prepare')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ ids: [ITEM_UUID_1] });

    expect(res.status).toBe(200);
    expect(res.body.token).toMatch(/^[0-9a-f]{64}$/);
    expect(res.body.expiresAt).toBeTruthy();
    expect(res.body.itemCount).toBe(1);
    expect(res.body.photoCount).toBe(1);
    expect(res.body.skippedCount).toBe(0);
  });

  it('deduplicates ids before ownership check', async () => {
    mockSelectWhere([{ id: ITEM_UUID_1, photos: MOCK_PHOTOS, title: 'Test Item' }]);
    mockInsertNoReturn();

    const res = await request(app)
      .post('/items/photos/export/prepare')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ ids: [ITEM_UUID_1, ITEM_UUID_1] });

    expect(res.status).toBe(200);
    expect(res.body.itemCount).toBe(1);
  });

  it('persists the token to the database', async () => {
    mockSelectWhere([{ id: ITEM_UUID_1, photos: MOCK_PHOTOS, title: 'Test Item' }]);
    mockInsertNoReturn();

    await request(app)
      .post('/items/photos/export/prepare')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ ids: [ITEM_UUID_1] });

    expect(vi.mocked(db.insert)).toHaveBeenCalledOnce();
  });

  it('skips items when cumulative photo count exceeds 60', async () => {
    // Item 1 has 60 photos, item 2 has 1 photo — item 2 should be skipped
    const manyPhotos = Array.from({ length: 60 }, (_, i) => ({
      url: `https://portage-images.digitalharmonyai.com/photo${i}.jpg`,
      key: `photo${i}.jpg`,
    }));
    mockSelectWhere([
      { id: ITEM_UUID_1, photos: manyPhotos, title: 'Big Item' },
      { id: ITEM_UUID_2, photos: MOCK_PHOTOS, title: 'Extra Item' },
    ]);
    mockInsertNoReturn();

    const res = await request(app)
      .post('/items/photos/export/prepare')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ ids: [ITEM_UUID_1, ITEM_UUID_2] });

    expect(res.status).toBe(200);
    expect(res.body.itemCount).toBe(1);
    expect(res.body.photoCount).toBe(60);
    expect(res.body.skippedCount).toBe(1);
  });
});

describe('GET /items/:id/research', () => {
  it('returns category, aspect gap (filled vs missing, required-first), and demand', async () => {
    mockSelectReturnOnce([{
      id: 'item-1', title: 'Sony WH-1000XM4', brand: 'Sony', model: 'WH-1000XM4',
      category: 'Headphones', condition: 'good',
      aspects: { Brand: ['Sony'] },
      marketplaceData: { ebay: { categoryId: '112529', categoryName: 'Headphones' } },
    }]);
    (EbayAdapter as unknown as { getRequiredAspects: ReturnType<typeof vi.fn> }).getRequiredAspects.mockResolvedValue({
      Brand: { required: true, values: ['Sony', 'Bose'], cardinality: 'SINGLE' },
      Color: { required: false, values: ['Black', 'Silver'], cardinality: 'SINGLE' },
      Type: { required: true, values: null, cardinality: 'SINGLE' },
    });
    (EbayAdapter as unknown as { searchComps: ReturnType<typeof vi.fn> }).searchComps.mockResolvedValue({
      sold: [{}, {}], active: [{}],
      stats: { soldMedian: 220, soldAvg: 215, activeMedian: 250, activeAvg: 240, sampleSize: 3, sellThrough: 0.67 },
    });

    const res = await request(app)
      .get('/items/item-1/research')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    // Brand is filled (from item.aspects); Color + Type are missing, required-first
    // (Type before Color), each carrying eBay's suggested values for one-tap fill.
    expect(res.body).toEqual({
      category: { categoryId: '112529', categoryName: 'Headphones' },
      aspects: {
        filled: [{ name: 'Brand', required: true, values: ['Sony'] }],
        missing: [
          { name: 'Type', required: true, suggestedValues: null, cardinality: 'SINGLE' },
          { name: 'Color', required: false, suggestedValues: ['Black', 'Silver'], cardinality: 'SINGLE' },
        ],
      },
      demand: { soldMedian: 220, soldAvg: 215, activeMedian: 250, activeAvg: 240, sampleSize: 3, sellThrough: 0.67, soldCount: 2, activeCount: 1 },
      traffic: null,
    });
  });

  it('includes the Analytics traffic report when the item has a published eBay listing', async () => {
    mockSelectReturnOnce([{
      id: 'item-1', title: 'Sony WH-1000XM4', brand: 'Sony', model: 'WH-1000XM4',
      category: 'Headphones', condition: 'good', aspects: {},
      marketplaceData: { ebay: { categoryId: '112529', categoryName: 'Headphones' } },
    }]);
    // listings lookup → a published eBay listing carrying a marketplaceListingId
    mockSelectReturnOnce([{ marketplaceListingId: '307022338248' }]);
    (EbayAdapter as unknown as { getRequiredAspects: ReturnType<typeof vi.fn> }).getRequiredAspects.mockResolvedValue({});
    (EbayAdapter as unknown as { searchComps: ReturnType<typeof vi.fn> }).searchComps.mockResolvedValue({
      sold: [], active: [], stats: { soldMedian: null, soldAvg: null, activeMedian: null, activeAvg: null, sampleSize: 0, sellThrough: null },
    });
    const report = { listingId: '307022338248', impressions: 1500, clickThroughRate: 2.4, views: 36, transactions: 3, salesConversionRate: 8.3, range: { from: '20260526', to: '20260625' } };
    mockGetTrafficReport.mockResolvedValue(report);

    const res = await request(app)
      .get('/items/item-1/research')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.traffic).toEqual(report);
    expect(mockGetTrafficReport).toHaveBeenCalledWith('307022338248');
  });
});
