import request from 'supertest';
import { createApp } from '../app.js';
import { createTestToken } from '../test/helpers.js';
import { db } from '../db/index.js';

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../lib/cf-allowlist.js', () => ({
  getAllowlist: vi.fn(),
  addEmail: vi.fn(),
  removeEmail: vi.fn(),
}));

let app: ReturnType<typeof createApp>;

beforeAll(() => {
  app = createApp();
});

beforeEach(() => {
  vi.clearAllMocks();
});

const adminEndpoints = [
  { method: 'get' as const, path: '/admin/stats' },
  { method: 'get' as const, path: '/admin/activity' },
  { method: 'get' as const, path: '/admin/users' },
  { method: 'get' as const, path: '/admin/users/00000000-0000-0000-0000-000000000001' },
  { method: 'patch' as const, path: '/admin/users/00000000-0000-0000-0000-000000000001' },
  { method: 'delete' as const, path: '/admin/users/00000000-0000-0000-0000-000000000001' },
  { method: 'post' as const, path: '/admin/users/00000000-0000-0000-0000-000000000001/reset-usage' },
  { method: 'get' as const, path: '/admin/items' },
  { method: 'get' as const, path: '/admin/listings' },
  { method: 'get' as const, path: '/admin/orders' },
  { method: 'get' as const, path: '/admin/orders/revenue' },
  { method: 'get' as const, path: '/admin/porter/stats' },
  { method: 'get' as const, path: '/admin/conversations' },
  { method: 'get' as const, path: '/admin/conversations/00000000-0000-0000-0000-000000000001' },
  { method: 'get' as const, path: '/admin/settings' },
  { method: 'patch' as const, path: '/admin/settings/some-key' },
  { method: 'get' as const, path: '/admin/audit' },
  { method: 'get' as const, path: '/admin/marketplace/health' },
];

describe('admin auth boundary', () => {
  let userToken: string;

  beforeAll(() => {
    userToken = createTestToken({ role: 'user' });
  });

  describe('rejects unauthenticated requests', () => {
    for (const { method, path } of adminEndpoints) {
      it(`${method.toUpperCase()} ${path} → 401`, async () => {
        const res = await request(app)[method](path);
        expect(res.status).toBe(401);
      });
    }
  });

  describe('rejects non-admin users', () => {
    for (const { method, path } of adminEndpoints) {
      it(`${method.toUpperCase()} ${path} → 403`, async () => {
        const res = await request(app)[method](path)
          .set('Authorization', `Bearer ${userToken}`);
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('ADMIN_REQUIRED');
      });
    }
  });
});

describe('admin functional guards', () => {
  const adminId = 'admin-user-id';
  let adminToken: string;

  beforeAll(() => {
    adminToken = createTestToken({ sub: adminId, role: 'admin' });
  });

  it('PATCH /admin/users/:id rejects self-modification', async () => {
    const res = await request(app)
      .patch(`/admin/users/${adminId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'user' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('SELF_MODIFY');
  });

  it('PATCH /admin/users/:id accepts the beta-tester tier', async () => {
    const { db } = await import('../db/index.js');
    const targetId = '00000000-0000-0000-0000-000000000002';
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: targetId, email: 't@example.com', role: 'user', subscriptionTier: 'free' }]),
        }),
      }),
    } as any);
    vi.mocked(db.insert).mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) } as any);
    const setFn = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    vi.mocked(db.update).mockReturnValue({ set: setFn } as any);

    const res = await request(app)
      .patch(`/admin/users/${targetId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ subscriptionTier: 'beta-tester' });

    expect(res.status).toBe(200);
    expect(setFn).toHaveBeenCalledWith(expect.objectContaining({ subscriptionTier: 'beta-tester' }));
  });

  it('GET /admin/allowlist returns the CF Access allowlist emails', async () => {
    const { getAllowlist } = await import('../lib/cf-allowlist.js');
    vi.mocked(getAllowlist).mockResolvedValue(['a@x.com', 'b@y.com']);

    const res = await request(app)
      .get('/admin/allowlist')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.emails).toEqual(['a@x.com', 'b@y.com']);
  });

  it('POST /admin/allowlist adds an email and audit-logs it', async () => {
    const { addEmail } = await import('../lib/cf-allowlist.js');
    vi.mocked(addEmail).mockResolvedValue(['a@x.com', 'new@t.com']);
    vi.mocked(db.insert).mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) } as any);

    const res = await request(app)
      .post('/admin/allowlist')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'new@t.com' });

    expect(res.status).toBe(200);
    expect(res.body.emails).toEqual(['a@x.com', 'new@t.com']);
    expect(vi.mocked(addEmail)).toHaveBeenCalledWith('new@t.com');
  });

  it('DELETE /admin/allowlist/:email removes an email but refuses to remove your own', async () => {
    const { removeEmail } = await import('../lib/cf-allowlist.js');
    vi.mocked(removeEmail).mockResolvedValue(['a@x.com']);
    vi.mocked(db.insert).mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) } as any);

    const res = await request(app)
      .delete('/admin/allowlist/gone%40y.com')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.emails).toEqual(['a@x.com']);
    expect(vi.mocked(removeEmail)).toHaveBeenCalledWith('gone@y.com');

    // Self-lockout guard: the admin token's email is test@example.com
    const self = await request(app)
      .delete('/admin/allowlist/test%40example.com')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(self.status).toBe(400);
    expect(self.body.code).toBe('SELF_REMOVE');
  });

  it('PATCH /admin/settings/:key rejects disallowed keys', async () => {
    const res = await request(app)
      .patch('/admin/settings/dangerous_key')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: 'anything' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_KEY');
  });
});
