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

const mockGetOrders = vi.fn();
const mockGetItemDetail = vi.fn();
vi.mock('../marketplace/ebay-adapter.js', () => ({
  EbayAdapter: vi.fn(() => ({ getOrders: mockGetOrders, getItemDetail: mockGetItemDetail })),
}));

// A db.select() that resolves at .where() (no .limit()) — matches the
// marketplaceAccounts lookup at the top of POST /orders/sync.
function queueAccountsSelect(accounts: unknown[]) {
  vi.mocked(db.select).mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(accounts),
    }),
  } as any);
}

// db.insert(table).values(obj).returning() -> resolves to `rows`.
// Returns the `.values` spies (in order) so tests can assert inserted payloads.
function queueInserts(...rowSets: unknown[][]) {
  const valueSpies: ReturnType<typeof vi.fn>[] = [];
  for (const rows of rowSets) {
    const values = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue(rows) });
    valueSpies.push(values);
    vi.mocked(db.insert).mockReturnValueOnce({ values } as any);
  }
  return valueSpies;
}

function queueSelects(...rowSets: unknown[][]) {
  for (const rows of rowSets) {
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(rows),
        }),
      }),
    } as any);
  }
}

let app: ReturnType<typeof createApp>;
beforeAll(() => {
  app = createApp();
});
beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /orders/:id', () => {
  it('includes the item (title + photos) that the order detail and ship pages render', async () => {
    const token = createTestToken({ sub: 'user-1' });
    queueSelects(
      [{
        id: 'o1', userId: 'user-1', itemId: 'i1', listingId: 'l1', marketplace: 'ebay',
        marketplaceOrderId: '14-1', buyerUsername: 'b', salePrice: 10, shippingCost: 1,
        currency: 'USD', status: 'payment_received', trackingNumber: null, carrier: null,
        shippingLabelUrl: null, soldAt: new Date(), shippedAt: null, deliveredAt: null,
      }],
      [{ id: 'i1', title: 'Mic Kit', photos: [{ url: 'https://x/p.jpg', isPrimary: true }] }],
    );

    const res = await request(app)
      .get('/orders/o1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.item).toBeDefined();
    expect(res.body.item.title).toBe('Mic Kit');
    expect(res.body.item.photos).toHaveLength(1);
  });
});

describe('POST /orders/sync', () => {
  it('surfaces a failing marketplace in errors[] instead of swallowing it', async () => {
    const token = createTestToken({ sub: 'user-1' });
    queueAccountsSelect([{ marketplace: 'ebay', accessTokenEncrypted: 'enc' }]);
    mockGetOrders.mockRejectedValueOnce(new Error('eBay 401: invalid scope'));

    const res = await request(app)
      .post('/orders/sync')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.synced).toBe(0);
    expect(res.body.errors).toEqual([
      { marketplace: 'ebay', message: 'eBay 401: invalid scope' },
    ]);
  });

  it('backfills item+listing from GetItem and imports an order with no matching local listing', async () => {
    const token = createTestToken({ sub: 'user-1' });
    queueAccountsSelect([{ marketplace: 'ebay', accessTokenEncrypted: 'enc' }]);
    mockGetOrders.mockResolvedValueOnce([{
      marketplaceOrderId: '23-14730-30879',
      marketplaceListingId: '306972688941',
      buyerUsername: 'buyer1',
      salePrice: 399,
      shippingCost: 0,
      marketplaceFees: 0,
      currency: 'USD',
      soldAt: new Date(),
      shippingAddress: { name: 'B', street1: '1 St', city: 'X', state: 'CA', zip: '90001', country: 'US' },
    }]);
    // existing-order check -> none; matching-listing check -> none (orphan order)
    queueSelects([], []);
    mockGetItemDetail.mockResolvedValueOnce({
      found: true, title: 'Shure SM7B', photos: ['https://i/a.jpg'], price: 399, brand: 'Shure', aspects: { Brand: ['Shure'] },
    });
    // INSERT item -> id, INSERT listing -> id, INSERT order -> id
    queueInserts([{ id: 'item-new' }], [{ id: 'listing-new' }], [{ id: 'order-new' }]);

    const res = await request(app)
      .post('/orders/sync')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.synced).toBe(1);
    expect(res.body.newOrders).toEqual(['order-new']);
    expect(res.body.errors).toEqual([]);
    expect(mockGetItemDetail).toHaveBeenCalledWith('306972688941');
  });

  it('falls back to the order line-item title (not a placeholder) when GetItem fails', async () => {
    const token = createTestToken({ sub: 'user-1' });
    queueAccountsSelect([{ marketplace: 'ebay', accessTokenEncrypted: 'enc' }]);
    mockGetOrders.mockResolvedValueOnce([{
      marketplaceOrderId: '26-14725-05164',
      marketplaceListingId: '306972826311',
      title: 'Vintage Neumann U87',
      buyerUsername: 'buyer2',
      salePrice: 1200,
      shippingCost: 0,
      marketplaceFees: 0,
      currency: 'USD',
      soldAt: new Date(),
      shippingAddress: { name: 'B', street1: '1 St', city: 'X', state: 'CA', zip: '90001', country: 'US' },
    }]);
    queueSelects([], []);
    mockGetItemDetail.mockResolvedValueOnce({ found: false, title: null, photos: [], price: null, brand: null, aspects: {} });
    const [itemValues] = queueInserts([{ id: 'item-2' }], [{ id: 'listing-2' }], [{ id: 'order-2' }]);

    const res = await request(app)
      .post('/orders/sync')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.synced).toBe(1);
    expect(itemValues).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Vintage Neumann U87',
      price: 1200,
    }));
  });

  it('creates ONE item+listing per eBay ItemID when multiple orders share a listing', async () => {
    const token = createTestToken({ sub: 'user-1' });
    queueAccountsSelect([{ marketplace: 'ebay', accessTokenEncrypted: 'enc' }]);
    const base = {
      marketplaceListingId: '306988686950',
      buyerUsername: 'b',
      salePrice: 50,
      shippingCost: 0,
      marketplaceFees: 0,
      currency: 'USD',
      soldAt: new Date(),
      shippingAddress: { name: 'B', street1: '1 St', city: 'X', state: 'CA', zip: '90001', country: 'US' },
    };
    mockGetOrders.mockResolvedValueOnce([
      { ...base, marketplaceOrderId: '03-14755-18777', title: 'Same Item' },
      { ...base, marketplaceOrderId: '14-14736-49000', title: 'Same Item' },
    ]);
    // both orders: existing-check -> none, matching-listing -> none
    queueSelects([], [], [], []);
    mockGetItemDetail.mockResolvedValue({ found: true, title: 'Same Item', photos: [], price: 50, brand: '', aspects: {} });
    // item, listing (created once), then an order row per sale
    queueInserts([{ id: 'item-3' }], [{ id: 'listing-3' }], [{ id: 'order-3a' }], [{ id: 'order-3b' }]);

    const res = await request(app)
      .post('/orders/sync')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.synced).toBe(2);
    expect(res.body.newOrders).toEqual(['order-3a', 'order-3b']);
    // GetItem + item/listing creation happen exactly once for the shared ItemID.
    expect(mockGetItemDetail).toHaveBeenCalledTimes(1);
    expect(vi.mocked(db.insert)).toHaveBeenCalledTimes(4); // item + listing + 2 orders
  });
});
