import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';
import { createTestToken } from '../test/helpers.js';

const { mockCreateListing } = vi.hoisted(() => ({ mockCreateListing: vi.fn() }));

vi.mock('../db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

vi.mock('../marketplace/ebay-adapter.js', () => ({
  EbayAdapter: vi.fn(() => ({ createListing: mockCreateListing })),
}));

const ITEM_ID = '00000000-0000-0000-0000-000000000001';
const MOCK_ITEM = {
  id: ITEM_ID,
  userId: 'test-user-id',
  title: 'Sony WH-1000XM4',
  description: 'Noise-cancelling headphones',
  category: 'electronics',
  condition: 'good',
  brand: 'Sony',
  model: 'WH-1000XM4',
  features: [],
  photos: [{ url: 'https://portage-images.digitalharmonyai.com/p.jpg' }],
  quantity: 3,
};

function mockSelectOnce(rows: unknown[]) {
  vi.mocked(db.select).mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  } as any);
}

function mockInsertCapture() {
  const values = vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue([{ id: 'listing-1', status: 'active' }]),
  });
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

describe('POST /listings', () => {
  it('persists ebaySku and ebayOfferId from the publish result', async () => {
    mockSelectOnce([MOCK_ITEM]);
    const insertValues = mockInsertCapture();
    mockCreateListing.mockResolvedValue({
      marketplaceListingId: '110012345678',
      ebaySku: 'portage-sku-1',
      ebayOfferId: 'offer-1',
      status: 'active',
    });

    const res = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ itemId: ITEM_ID, marketplace: 'ebay', price: 199, publishImmediately: true });

    expect(res.status).toBe(201);
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
      ebaySku: 'portage-sku-1',
      ebayOfferId: 'offer-1',
      marketplaceListingId: '110012345678',
    }));
  });

  it('publishMode live publishes (without legacy publishImmediately) and forwards the item quantity', async () => {
    mockSelectOnce([MOCK_ITEM]);
    mockInsertCapture();
    mockCreateListing.mockResolvedValue({ marketplaceListingId: '110', status: 'active' });

    await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ itemId: ITEM_ID, marketplace: 'ebay', price: 199, publishMode: 'live' });

    expect(mockCreateListing).toHaveBeenCalledWith(expect.objectContaining({ quantity: 3 }));
  });
});

describe('POST /listings/:id/publish', () => {
  it('reuses the stored ebaySku and ebayOfferId when re-publishing (no orphan)', async () => {
    mockSelectOnce([{
      id: 'listing-1', userId: 'test-user-id', status: 'draft', marketplace: 'ebay',
      itemId: ITEM_ID, price: 199, currency: 'USD',
      ebaySku: 'portage-sku-1', ebayOfferId: 'offer-1', marketplaceSpecificFields: {},
    }]);
    mockSelectOnce([MOCK_ITEM]);
    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'listing-1', status: 'active' }]) }),
    });
    vi.mocked(db.update).mockReturnValue({ set: updateSet } as any);
    mockCreateListing.mockResolvedValue({
      marketplaceListingId: '110', ebaySku: 'portage-sku-1', ebayOfferId: 'offer-1', status: 'active',
    });

    const res = await request(app)
      .post('/listings/listing-1/publish')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(mockCreateListing).toHaveBeenCalledWith(expect.objectContaining({
      ebaySku: 'portage-sku-1',
      ebayOfferId: 'offer-1',
    }));
  });

  it('persists the result ebaySku and ebayOfferId after publishing a DB-only draft', async () => {
    mockSelectOnce([{
      id: 'listing-1', userId: 'test-user-id', status: 'draft', marketplace: 'ebay',
      itemId: ITEM_ID, price: 199, currency: 'USD',
      ebaySku: null, ebayOfferId: null, marketplaceSpecificFields: {},
    }]);
    mockSelectOnce([MOCK_ITEM]);
    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'listing-1', status: 'active' }]) }),
    });
    vi.mocked(db.update).mockReturnValue({ set: updateSet } as any);
    mockCreateListing.mockResolvedValue({
      marketplaceListingId: '110', ebaySku: 'new-sku', ebayOfferId: 'new-offer', status: 'active',
    });

    await request(app)
      .post('/listings/listing-1/publish')
      .set('Authorization', `Bearer ${authToken}`);

    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({
      ebaySku: 'new-sku',
      ebayOfferId: 'new-offer',
    }));
  });
});
