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

  it('re-syncs the eBay listing when a listed item field is edited (title -> updateListing)', async () => {
    mockSelectReturnOnce([{ id: 'item-1' }]); // existence
    mockUpdateReturns([{ ...MOCK_ITEM, title: 'New Title', quantity: 1, weightOz: 24, lengthIn: 8, widthIn: 6, heightIn: 3 }]);
    mockSelectReturnOnce([{ marketplace: 'ebay', status: 'active', marketplaceListingId: '307000000001', ebayOfferId: '193000000001', ebaySku: 'PRT-X', marketplaceSpecificFields: { categoryId: '175669' }, currency: 'USD' }]); // listings for the item
    mockUpdateListing.mockResolvedValue({ marketplaceListingId: '307000000001', status: 'active' });

    const res = await request(app)
      .patch('/items/item-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'New Title' });

    expect(res.status).toBe(200);
    expect(mockUpdateListing).toHaveBeenCalledTimes(1);
    const [idArg, input] = mockUpdateListing.mock.calls[0] as [string, { title?: string }];
    expect(input.title).toBe('New Title');
    expect(idArg).toBe('307000000001'); // the Trading ItemID (marketplaceListingId), not an offer id
  });

  it('syncs the full eBay payload (price/condition/quantity/weight/aspects) so a live update is not rejected', async () => {
    mockSelectReturnOnce([{ id: 'item-1' }]); // existence
    mockUpdateReturns([{ ...MOCK_ITEM, title: 'T', condition: 'good', quantity: 2, price: 50, weightOz: 24, lengthIn: 8, widthIn: 6, heightIn: 3, aspects: { Brand: ['Sony'] } }]);
    mockSelectReturnOnce([{ marketplace: 'ebay', status: 'active', marketplaceListingId: '307000000001', ebayOfferId: '193000000001', ebaySku: 'PRT-X', marketplaceSpecificFields: { categoryId: '175669' }, currency: 'USD' }]);
    mockUpdateListing.mockResolvedValue({ marketplaceListingId: '307000000001', status: 'active' });

    const res = await request(app)
      .patch('/items/item-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ price: 50 });

    expect(res.status).toBe(200);
    const [, input] = mockUpdateListing.mock.calls[0] as [string, {
      price?: number; condition?: string; quantity?: number; marketplaceSpecific?: Record<string, unknown>;
    }];
    expect(input.price).toBe(50);
    expect(input.condition).toBe('good');
    expect(input.quantity).toBe(2);
    expect(input.marketplaceSpecific?.weight).toBeDefined();           // avoids eBay 25020
    expect(input.marketplaceSpecific?.categoryId).toBe('175669');       // preserves listing specifics
    expect((input.marketplaceSpecific?.aspects as Record<string, string[]>)?.Brand).toEqual(['Sony']);
  });

  it('re-syncs an active Reverb listing on item edit (title/price/brand reach the adapter)', async () => {
    mockSelectReturnOnce([{ id: 'item-1' }]); // existence
    mockUpdateReturns([{ ...MOCK_ITEM, title: 'New Title', brand: 'Fender', model: 'Strat', price: 1200, condition: 'good', quantity: 1 }]);
    mockSelectReturnOnce([{ marketplace: 'reverb', status: 'active', marketplaceListingId: '87654321', ebaySku: null, marketplaceSpecificFields: { conditionUuid: 'cu-1', categoryUuid: 'cat-1' }, currency: 'USD' }]);
    mockReverbUpdateListing.mockResolvedValue({ marketplaceListingId: '87654321', status: 'active' });

    const res = await request(app)
      .patch('/items/item-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'New Title' });

    expect(res.status).toBe(200);
    expect(mockReverbUpdateListing).toHaveBeenCalledTimes(1);
    const [idArg, input] = mockReverbUpdateListing.mock.calls[0] as [string, {
      title?: string; price?: number; brand?: string; model?: string; marketplaceSpecific?: Record<string, unknown>;
    }];
    expect(idArg).toBe('87654321');
    expect(input.title).toBe('New Title');
    expect(input.price).toBe(1200);
    expect(input.brand).toBe('Fender');
    // Stored publish-time specifics ride along untouched (conditionUuid etc.);
    // the eBay-only aspect/shipping merges must NOT be applied to Reverb.
    expect(input.marketplaceSpecific?.conditionUuid).toBe('cu-1');
    expect(input.marketplaceSpecific?.aspects).toBeUndefined();
  });

  it('syncs a Reverb row that is draft-with-listingId (remote Reverb drafts are revisable)', async () => {
    mockSelectReturnOnce([{ id: 'item-1' }]);
    mockUpdateReturns([{ ...MOCK_ITEM, title: 'T2' }]);
    // Publish can return a remote DRAFT that still carries a listing id
    // (shop setup pending) — the eBay "draft = nothing to sync" rule must
    // not apply to Reverb.
    mockSelectReturnOnce([{ marketplace: 'reverb', status: 'draft', marketplaceListingId: '87654321', ebaySku: null, marketplaceSpecificFields: {}, currency: 'USD' }]);
    mockReverbUpdateListing.mockResolvedValue({ marketplaceListingId: '87654321', status: 'draft' });

    const res = await request(app)
      .patch('/items/item-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'T2' });

    expect(res.status).toBe(200);
    expect(mockReverbUpdateListing).toHaveBeenCalledTimes(1);
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

  it('a failed Reverb sync neither blocks the eBay row nor fails the request', async () => {
    mockSelectReturnOnce([{ id: 'item-1' }]);
    mockUpdateReturns([{ ...MOCK_ITEM, title: 'T3', weightOz: 24, lengthIn: 8, widthIn: 6, heightIn: 3 }]);
    mockSelectReturnOnce([
      { marketplace: 'reverb', status: 'active', marketplaceListingId: '87654321', ebaySku: null, marketplaceSpecificFields: {}, currency: 'USD' },
      { marketplace: 'ebay', status: 'active', marketplaceListingId: '307000000001', ebaySku: 'PRT-X', marketplaceSpecificFields: { categoryId: '175669' }, currency: 'USD' },
    ]);
    mockReverbUpdateListing.mockRejectedValue(new Error('Reverb 500'));
    mockUpdateListing.mockResolvedValue({ marketplaceListingId: '307000000001', status: 'active' });

    const res = await request(app)
      .patch('/items/item-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'T3' });

    expect(res.status).toBe(200);
    expect(mockReverbUpdateListing).toHaveBeenCalledTimes(1);
    expect(mockUpdateListing).toHaveBeenCalledTimes(1); // eBay row still synced
  });

  it('self-heals a missing categoryId on eBay edit-sync (GetItem-imported rows have empty specifics)', async () => {
    mockSelectReturnOnce([{ id: 'item-1' }]); // existence
    // Imported item: category cached on the item, listing specifics EMPTY —
    // without the heal, ReviseFixedPriceItem rejects "valid leaf category required".
    mockUpdateReturns([{ ...MOCK_ITEM, title: 'Healed', marketplaceData: { ebay: { categoryId: '123445', categoryName: 'Audio' } }, weightOz: 24, lengthIn: 8, widthIn: 6, heightIn: 3 }]);
    mockSelectReturnOnce([{ marketplace: 'ebay', status: 'active', marketplaceListingId: '307038681268', ebaySku: null, marketplaceSpecificFields: {}, currency: 'USD' }]);
    mockUpdateListing.mockResolvedValue({ marketplaceListingId: '307038681268', status: 'active' });

    const res = await request(app)
      .patch('/items/item-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Healed' });

    expect(res.status).toBe(200);
    const [, input] = mockUpdateListing.mock.calls[0] as [string, { marketplaceSpecific?: Record<string, unknown> }];
    expect(input.marketplaceSpecific?.categoryId).toBe('123445');
  });

  it('injects the seller-profile ship-from ZIP on eBay edit-sync (calculated shipping parity with publish)', async () => {
    mockSelectReturnOnce([{ id: 'item-1' }]); // existence
    mockUpdateReturns([{ ...MOCK_ITEM, title: 'Zip', marketplaceData: { ebay: { categoryId: '123445' } }, weightOz: 24, lengthIn: 8, widthIn: 6, heightIn: 3 }]);
    mockSelectReturnOnce([{ marketplace: 'ebay', status: 'active', marketplaceListingId: '307038681268', ebaySku: null, marketplaceSpecificFields: {}, currency: 'USD' }]);
    mockSelectReturnOnce([{ userId: 'test-user-id', shipFromAddress: { zip: '12561' } }]); // seller profile
    mockUpdateListing.mockResolvedValue({ marketplaceListingId: '307038681268', status: 'active' });

    const res = await request(app)
      .patch('/items/item-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Zip' });

    expect(res.status).toBe(200);
    const [, input] = mockUpdateListing.mock.calls[0] as [string, { marketplaceSpecific?: Record<string, unknown> }];
    expect(input.marketplaceSpecific?.originPostalCode).toBe('12561');
  });

  it('still saves the item edit when the eBay sync fails (best-effort)', async () => {
    mockSelectReturnOnce([{ id: 'item-1' }]); // existence
    mockUpdateReturns([{ ...MOCK_ITEM, title: 'Saved Locally' }]);
    mockSelectReturnOnce([{ marketplace: 'ebay', status: 'active', marketplaceListingId: '307000000001', ebayOfferId: '193000000001', ebaySku: 'PRT-X', marketplaceSpecificFields: {}, currency: 'USD' }]);
    mockUpdateListing.mockRejectedValue(new Error('eBay 25021'));

    const res = await request(app)
      .patch('/items/item-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Saved Locally' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Saved Locally');
  });

  it('syncs only published eBay listings (active + Trading ItemID) and skips DB-only drafts', async () => {
    mockSelectReturnOnce([{ id: 'item-1' }]); // existence
    mockUpdateReturns([{ ...MOCK_ITEM, title: 'Edited' }]);
    mockSelectReturnOnce([
      { marketplace: 'ebay', status: 'active', marketplaceListingId: '307000000001', ebaySku: 'PRT-A', marketplaceSpecificFields: {}, currency: 'USD' },
      // Trade-First: a DB-only draft has no live listing to sync — must be skipped.
      { marketplace: 'ebay', status: 'draft', marketplaceListingId: null, ebaySku: 'PRT-D', marketplaceSpecificFields: {}, currency: 'USD' },
    ]);
    mockUpdateListing.mockResolvedValue({ status: 'active' });

    const res = await request(app)
      .patch('/items/item-1')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Edited' });

    expect(res.status).toBe(200);
    expect(mockUpdateListing).toHaveBeenCalledTimes(1);
    expect(mockUpdateListing.mock.calls.map((c) => c[0])).toEqual(['307000000001']);
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
