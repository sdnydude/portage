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
