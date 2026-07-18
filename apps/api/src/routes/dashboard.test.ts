import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';
import { createTestToken } from '../test/helpers.js';

vi.mock('../db/index.js', () => ({
  db: { select: vi.fn() },
}));

/** Universal thenable query-builder mock: every chain method returns itself,
 *  and awaiting it resolves to the configured rows. */
function chain(rows: unknown[]) {
  const c: Record<string, unknown> = {};
  for (const m of ['from', 'innerJoin', 'where', 'orderBy', 'limit', 'groupBy']) {
    c[m] = vi.fn(() => c);
  }
  (c as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(rows).then(resolve);
  return c;
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

describe('GET /dashboard', () => {
  it('surfaces the item AI confidence on recent listings', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(chain([{ totalItems: 1, totalValueLow: 0, totalValueHigh: 0, totalValueRecommended: 100 }]) as never) // itemStats
      .mockReturnValueOnce(chain([{
        id: 'l1', itemId: 'i1', marketplace: 'ebay', status: 'active', price: 42,
        currency: 'USD', createdAt: new Date(), publishedAt: null, itemTitle: 'Widget',
        itemPhoto: [{ url: 'a.jpg', isPrimary: true }], aiConfidence: 0.87,
      }]) as never) // recentListings
      .mockReturnValueOnce(chain([]) as never) // pendingShipments
      .mockReturnValueOnce(chain([{ displayName: 'Demo', email: 'demo@x.co' }]) as never) // user
      .mockReturnValueOnce(chain([]) as never) // listingStats
      .mockReturnValueOnce(chain([{ totalOrders: 0, totalRevenue: 0 }]) as never); // orderStats

    const res = await request(app)
      .get('/dashboard')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.recentListings[0].confidence).toBe(0.87);
  });
});
