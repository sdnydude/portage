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
