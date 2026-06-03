import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestToken } from '../../test/helpers.js';
import { resetEnv, loadEnv } from '../../lib/env.js';
import { db } from '../../db/index.js';

vi.mock('../../db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

vi.mock('../../lib/storage.js', () => ({
  uploadImage: vi.fn(),
  deleteImage: vi.fn(),
  getImage: vi.fn(),
}));

vi.mock('stripe', () => ({
  default: vi.fn(() => ({
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
    webhooks: { constructEvent: vi.fn() },
  })),
}));

let app: ReturnType<typeof createApp>;
let token: string;

beforeAll(() => {
  process.env.EBAY_CLIENT_ID = 'sandbox-client-id';
  process.env.EBAY_CLIENT_SECRET = 'sandbox-secret';
  process.env.EBAY_PROD_CLIENT_ID = 'prod-client-id';
  process.env.EBAY_PROD_CLIENT_SECRET = 'prod-secret';
  process.env.EBAY_REDIRECT_URI = 'Test-RuName-prod';
  process.env.EBAY_SANDBOX = 'false';
  resetEnv();
  loadEnv();
  app = createApp();
  token = createTestToken({ tier: 'pro' });
});

beforeEach(() => {
  vi.clearAllMocks();
  // Existing eBay account → skips the billing limit check, proceeds to build authUrl
  vi.mocked(db.select).mockImplementation(() => ({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ id: 'existing-ebay' }]),
      }),
    }),
  }) as any);
});

describe('GET /marketplace/ebay/connect credential selection', () => {
  it('builds the consent URL with the production client_id when EBAY_SANDBOX is false', async () => {
    const res = await request(app)
      .get('/marketplace/ebay/connect')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.authUrl).toContain('client_id=prod-client-id');
    expect(res.body.authUrl).toContain('auth.ebay.com');
  });
});
