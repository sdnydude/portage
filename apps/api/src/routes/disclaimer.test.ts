import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { CURRENT_DISCLAIMER_VERSION } from '@portage/shared';
import { createApp } from '../app.js';
import { db } from '../db/index.js';
import { createTestToken } from '../test/helpers.js';

vi.mock('../db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn() },
}));

let app: ReturnType<typeof createApp>;
let authToken: string;

beforeAll(() => {
  app = createApp();
  authToken = createTestToken();
});

beforeEach(() => vi.clearAllMocks());

describe('GET /disclaimer/version', () => {
  it('returns the current disclaimer version', async () => {
    const res = await request(app)
      .get('/disclaimer/version')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.version).toBe(CURRENT_DISCLAIMER_VERSION);
    expect(res.body.effectiveDate).toBeTruthy();
  });

  it('requires auth', async () => {
    const res = await request(app).get('/disclaimer/version');
    expect(res.status).toBe(401);
  });
});

describe('POST /disclaimer/listings/:id/accept-terms', () => {
  it('records acceptance for an owned listing', async () => {
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'listing-1' }]) }),
      }),
    } as any);
    vi.mocked(db.insert).mockReturnValueOnce({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{
          id: 'acc-1', userId: 'user-1', listingId: 'listing-1',
          disclaimerVersion: CURRENT_DISCLAIMER_VERSION, acceptedAt: new Date(), ipAddress: null,
        }]),
      }),
    } as any);

    const res = await request(app)
      .post('/disclaimer/listings/listing-1/accept-terms')
      .set('Authorization', `Bearer ${authToken}`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.listingId).toBe('listing-1');
    expect(res.body.disclaimerVersion).toBe(CURRENT_DISCLAIMER_VERSION);
  });

  it('404s when the listing is not owned by the caller', async () => {
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
      }),
    } as any);

    const res = await request(app)
      .post('/disclaimer/listings/other-users-listing/accept-terms')
      .set('Authorization', `Bearer ${authToken}`)
      .send({});

    expect(res.status).toBe(404);
  });
});
