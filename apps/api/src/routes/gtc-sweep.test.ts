import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';
import { createTestToken } from '../test/helpers.js';

const { mockDeleteListing } = vi.hoisted(() => ({
  mockDeleteListing: vi.fn(),
}));

vi.mock('../db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn(), transaction: vi.fn() },
}));

vi.mock('../marketplace/ebay-adapter.js', () => ({
  EbayAdapter: vi.fn(() => ({
    deleteListing: mockDeleteListing,
  })),
  resolveEbayCategoryId: vi.fn(),
}));

function mockProfileOnce(rows: unknown[]) {
  vi.mocked(db.select).mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  } as any);
}

function mockListingsOnce(rows: unknown[]) {
  vi.mocked(db.select).mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  } as any);
}

function mockUpdateCapture() {
  const where = vi.fn().mockResolvedValue(undefined);
  vi.mocked(db.update).mockReturnValue({
    set: vi.fn().mockReturnValue({ where }),
  } as any);
  return where;
}

function mockInsertCapture() {
  const values = vi.fn().mockResolvedValue(undefined);
  vi.mocked(db.insert).mockReturnValue({ values } as any);
  return values;
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

describe('POST /listings/gtc-sweep', () => {
  it('returns enabled:false and touches nothing when the profile toggle is off', async () => {
    mockProfileOnce([{ id: 'sp-1', gtcAutoEnd: false }]);

    const res = await request(app)
      .post('/listings/gtc-sweep')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ enabled: false, checked: 0, ended: 0, errors: [] });
    expect(mockDeleteListing).not.toHaveBeenCalled();
  });

  it('ends an active eBay listing inside the renewal window, archives it, and notifies', async () => {
    const now = Date.now();
    const twentyNineDaysAgo = new Date(now - 29 * 24 * 60 * 60 * 1000);
    mockProfileOnce([{ id: 'sp-1', gtcAutoEnd: true }]);
    mockListingsOnce([{
      id: 'listing-1',
      userId: 'test-user-id',
      marketplace: 'ebay',
      status: 'active',
      marketplaceListingId: '307000000001',
      publishedAt: twentyNineDaysAgo,
    }]);
    mockDeleteListing.mockResolvedValue(undefined);
    const updateWhere = mockUpdateCapture();
    const insertValues = mockInsertCapture();

    const res = await request(app)
      .post('/listings/gtc-sweep')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ enabled: true, checked: 1, ended: 1, errors: [] });
    expect(mockDeleteListing).toHaveBeenCalledWith('307000000001');
    expect(updateWhere).toHaveBeenCalled();
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'test-user-id',
      type: 'listing_expiry',
      referenceType: 'listing',
      referenceId: 'listing-1',
    }));
  });

  it('leaves listings outside the renewal window untouched', async () => {
    const now = Date.now();
    const tenDaysAgo = new Date(now - 10 * 24 * 60 * 60 * 1000);
    mockProfileOnce([{ id: 'sp-1', gtcAutoEnd: true }]);
    mockListingsOnce([{
      id: 'listing-2',
      userId: 'test-user-id',
      marketplace: 'ebay',
      status: 'active',
      marketplaceListingId: '307000000002',
      publishedAt: tenDaysAgo,
    }]);

    const res = await request(app)
      .post('/listings/gtc-sweep')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ enabled: true, checked: 1, ended: 0, errors: [] });
    expect(mockDeleteListing).not.toHaveBeenCalled();
  });

  it('collects per-listing errors without archiving when EndFixedPriceItem fails', async () => {
    const now = Date.now();
    const twentyNineDaysAgo = new Date(now - 29 * 24 * 60 * 60 * 1000);
    mockProfileOnce([{ id: 'sp-1', gtcAutoEnd: true }]);
    mockListingsOnce([{
      id: 'listing-3',
      userId: 'test-user-id',
      marketplace: 'ebay',
      status: 'active',
      marketplaceListingId: '307000000003',
      publishedAt: twentyNineDaysAgo,
    }]);
    mockDeleteListing.mockRejectedValue(new Error('eBay API error: 17'));
    const updateWhere = mockUpdateCapture();
    const insertValues = mockInsertCapture();

    const res = await request(app)
      .post('/listings/gtc-sweep')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      enabled: true,
      checked: 1,
      ended: 0,
      errors: [{ listingId: 'listing-3', error: 'eBay API error: 17' }],
    });
    expect(updateWhere).not.toHaveBeenCalled();
    expect(insertValues).not.toHaveBeenCalled();
  });
});
