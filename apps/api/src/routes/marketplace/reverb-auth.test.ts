import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestToken } from '../../test/helpers.js';
import { db } from '../../db/index.js';
import { decrypt } from '../../lib/crypto.js';
import { checkMarketplaceLimit } from '../../lib/billing-utils.js';
import { AppError } from '../../middleware/error.js';

vi.mock('../../db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

vi.mock('../../lib/billing-utils.js', () => ({
  checkMarketplaceLimit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('stripe', () => ({
  default: vi.fn(() => ({
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
    webhooks: { constructEvent: vi.fn() },
  })),
}));

// Not a real credential — a fixture shaped like a Reverb PAT (min 20 chars).
const FAKE_PAT = 'reverb-pat-fixture-1234567890';

function mockSelectOnce(rows: unknown[]) {
  vi.mocked(db.select).mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  } as any);
}

function stubReverbAccount(status = 200, body: unknown = { shop: { name: 'Test Shop' }, user_id: 42 }) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(
    JSON.stringify(body),
    { status, headers: { 'Content-Type': 'application/hal+json' } },
  ));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

let app: ReturnType<typeof createApp>;
let authToken: string;

beforeAll(() => {
  app = createApp();
  authToken = createTestToken();
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.mocked(checkMarketplaceLimit).mockResolvedValue(undefined);
});

describe('POST /marketplace/reverb/connect', () => {
  it('validates the PAT against /my/account, stores it ENCRYPTED, and returns the shop name', async () => {
    mockSelectOnce([]); // no existing reverb account
    const insertValues = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.insert).mockReturnValue({ values: insertValues } as any);
    const fetchMock = stubReverbAccount();

    const res = await request(app)
      .post('/marketplace/reverb/connect')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ token: FAKE_PAT });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ connected: true, shopName: 'Test Shop' });
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.reverb.com/api/my/account');

    // The PAT must never be persisted in plaintext — and must round-trip.
    const values = insertValues.mock.calls[0][0];
    expect(values.accessTokenEncrypted).not.toContain(FAKE_PAT);
    expect(decrypt(values.accessTokenEncrypted)).toBe(FAKE_PAT);
    expect(values.marketplaceUserId).toBe('42');
  });

  it('maps a Reverb 401 to 400 INVALID_TOKEN (bad PAT, not a server fault)', async () => {
    mockSelectOnce([]);
    stubReverbAccount(401, { message: 'nope' });

    const res = await request(app)
      .post('/marketplace/reverb/connect')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ token: FAKE_PAT });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_TOKEN');
    expect(vi.mocked(db.insert)).not.toHaveBeenCalled();
  });

  it('maps a Reverb 5xx to 502 REVERB_VALIDATION_FAILED (their outage, not the seller)', async () => {
    mockSelectOnce([]);
    stubReverbAccount(503, { message: 'down' });

    const res = await request(app)
      .post('/marketplace/reverb/connect')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ token: FAKE_PAT });

    expect(res.status).toBe(502);
    expect(res.body.code).toBe('REVERB_VALIDATION_FAILED');
  });

  it('rejects a too-short token at validation (400, no Reverb call)', async () => {
    const fetchMock = stubReverbAccount();

    const res = await request(app)
      .post('/marketplace/reverb/connect')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ token: 'short' });

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('UPDATEs the existing account row on reconnect instead of inserting a duplicate', async () => {
    mockSelectOnce([{ id: 'acct-1' }]); // existing reverb account
    const updateSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    vi.mocked(db.update).mockReturnValue({ set: updateSet } as any);
    stubReverbAccount();

    const res = await request(app)
      .post('/marketplace/reverb/connect')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ token: FAKE_PAT });

    expect(res.status).toBe(200);
    expect(vi.mocked(db.insert)).not.toHaveBeenCalled();
    expect(updateSet).toHaveBeenCalled();
    // Reconnect must not re-consume a marketplace billing slot.
    expect(vi.mocked(checkMarketplaceLimit)).not.toHaveBeenCalled();
  });

  it('enforces the billing marketplace limit for a FIRST connection, before any Reverb call', async () => {
    mockSelectOnce([]); // no existing account → limit check applies
    vi.mocked(checkMarketplaceLimit).mockRejectedValue(
      new AppError(403, 'MARKETPLACE_LIMIT', 'Upgrade to connect more marketplaces'),
    );
    const fetchMock = stubReverbAccount();

    const res = await request(app)
      .post('/marketplace/reverb/connect')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ token: FAKE_PAT });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('MARKETPLACE_LIMIT');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires auth', async () => {
    const res = await request(app)
      .post('/marketplace/reverb/connect')
      .send({ token: FAKE_PAT });
    expect(res.status).toBe(401);
  });
});

describe('GET /marketplace/reverb/status', () => {
  it('reports connected:false when no account row exists', async () => {
    mockSelectOnce([]);

    const res = await request(app)
      .get('/marketplace/reverb/status')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ connected: false });
  });

  it('reports connected + not-expired for a stored PAT (far-future expiry)', async () => {
    mockSelectOnce([{
      id: 'acct-1',
      tokenExpiresAt: new Date('2099-12-31T23:59:59Z'),
      marketplaceUserId: '42',
      createdAt: new Date('2026-07-08T00:00:00Z'),
    }]);

    const res = await request(app)
      .get('/marketplace/reverb/status')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(true);
    expect(res.body.expired).toBe(false);
    expect(res.body.marketplaceUserId).toBe('42');
  });
});

describe('DELETE /marketplace/reverb/disconnect', () => {
  it('deletes the account row and confirms', async () => {
    const whereDelete = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.delete).mockReturnValue({ where: whereDelete } as any);

    const res = await request(app)
      .delete('/marketplace/reverb/disconnect')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ disconnected: true });
    expect(whereDelete).toHaveBeenCalled();
  });
});
