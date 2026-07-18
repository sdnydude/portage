import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';
import { createTestToken } from '../test/helpers.js';

vi.mock('../db/index.js', () => ({
  db: { select: vi.fn(), update: vi.fn() },
}));

function mockSelectOnce(rows: unknown[]) {
  vi.mocked(db.select).mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(rows) }),
    }),
  } as any);
}

let app: ReturnType<typeof createApp>;
let authToken: string;

beforeAll(() => {
  app = createApp();
  authToken = createTestToken();
});

beforeEach(() => vi.clearAllMocks());

describe('GET /users/me/preferences — disclaimer suppression (F3b)', () => {
  it('reports disclaimerSuppressed true when suppressUntil is in the future and the version is current', async () => {
    mockSelectOnce([{
      listingInterface: 'hybrid', listingForkPref: 'ask', listingForkCount: 0, listingCompactMode: false,
      disclaimerSuppressUntil: new Date(Date.now() + 86_400_000), disclaimerSuppressVersion: 1,
    }]);

    const res = await request(app)
      .get('/users/me/preferences')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.disclaimerSuppressed).toBe(true);
  });
});
