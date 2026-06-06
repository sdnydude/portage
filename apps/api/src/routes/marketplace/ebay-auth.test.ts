import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
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

  it('forces re-login with prompt=login so users can switch eBay accounts on reconnect', async () => {
    const res = await request(app)
      .get('/marketplace/ebay/connect')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.authUrl).toContain('prompt=login');
  });
});

describe('POST /marketplace/ebay/callback identity capture', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function getValidState(): Promise<string> {
    const connectRes = await request(app)
      .get('/marketplace/ebay/connect')
      .set('Authorization', `Bearer ${token}`);
    return new URL(connectRes.body.authUrl).searchParams.get('state')!;
  }

  it('stores the eBay userId from the Identity API on a successful callback', async () => {
    const setMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    vi.mocked(db.update).mockReturnValue({ set: setMock } as any);

    const state = await getValidState();

    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'at', refresh_token: 'rt', expires_in: 7200 }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ userId: 'ebay-user-123', username: 'cooluser' }) }),
    );

    const res = await request(app)
      .post('/marketplace/ebay/callback')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'auth-code', state });

    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(true);
    expect(setMock).toHaveBeenCalledWith(expect.objectContaining({ marketplaceUserId: 'ebay-user-123' }));
  });

  it('exchanges the auth code using the production credentials when EBAY_SANDBOX is false', async () => {
    vi.mocked(db.update).mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) } as any);

    const state = await getValidState();

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'at', refresh_token: 'rt', expires_in: 7200 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ userId: 'u' }) });
    vi.stubGlobal('fetch', fetchMock);

    await request(app)
      .post('/marketplace/ebay/callback')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'auth-code', state });

    const expectedAuth = `Basic ${Buffer.from('prod-client-id:prod-secret').toString('base64')}`;
    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(tokenUrl).toContain('https://api.ebay.com/identity/v1/oauth2/token');
    expect(tokenInit.headers).toMatchObject({ Authorization: expectedAuth });
  });

  it('still connects when the Identity API fails, leaving marketplaceUserId null', async () => {
    const setMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    vi.mocked(db.update).mockReturnValue({ set: setMock } as any);

    const state = await getValidState();

    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'at', refresh_token: 'rt', expires_in: 7200 }) })
        .mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'identity error' }),
    );

    const res = await request(app)
      .post('/marketplace/ebay/callback')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'auth-code', state });

    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(true);
    expect(setMock).toHaveBeenCalledWith(expect.objectContaining({ marketplaceUserId: null }));
  });
});
