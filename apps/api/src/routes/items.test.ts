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

vi.mock('../marketplace/ebay-adapter.js', () => ({
  EbayAdapter: {
    searchComps: vi.fn(),
  },
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
