import request from 'supertest';
import { createApp } from '../app.js';
import { createTestToken } from '../test/helpers.js';
import { db } from '../db/index.js';
import { sendBetaInvite } from '../lib/email.js';

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

vi.mock('../lib/email.js', () => ({
  sendBetaInvite: vi.fn(),
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

  it('PATCH /admin/users/:id sets and clears limit overrides, trial, credits, and name', async () => {
    const { db } = await import('../db/index.js');
    const targetId = '00000000-0000-0000-0000-000000000003';
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
      .send({
        limitOverrides: { aiScansPerMonth: 100, bgRemovalsPerMonth: null },
        trialEndsAt: '2026-08-01T00:00:00.000Z',
        aiListingCredits: 5,
        displayName: 'Tess Ter',
      });

    expect(res.status).toBe(200);
    expect(setFn).toHaveBeenCalledWith(expect.objectContaining({
      limitOverrides: { aiScansPerMonth: 100, bgRemovalsPerMonth: null },
      aiListingCredits: 5,
      displayName: 'Tess Ter',
    }));
    const setArg = setFn.mock.calls[0][0] as Record<string, unknown>;
    expect(new Date(setArg.trialEndsAt as string).toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });

  it('POST /admin/users creates the row, adds the CF allowlist entry, and invites', async () => {
    const { db } = await import('../db/index.js');
    const { addEmail } = await import('../lib/cf-allowlist.js');
    const { sendBetaInvite } = await import('../lib/email.js');
    vi.mocked(addEmail).mockResolvedValue(['new@x.com']);
    vi.mocked(sendBetaInvite).mockResolvedValue(undefined);
    // No existing user with that email.
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any);
    const insertValues = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: 'user-new', email: 'new@x.com', role: 'user', subscriptionTier: 'beta-tester' }]),
    });
    vi.mocked(db.insert).mockReturnValue({ values: insertValues } as any);

    const res = await request(app)
      .post('/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'New@X.com ', displayName: 'New Tester', subscriptionTier: 'beta-tester', invite: true });

    expect(res.status).toBe(201);
    expect(res.body.user.id).toBe('user-new');
    expect(res.body.invited).toBe(true);
    // Without the allowlist entry the account cannot log in (CF is the IdP).
    expect(vi.mocked(addEmail)).toHaveBeenCalledWith('new@x.com');
    expect(vi.mocked(sendBetaInvite)).toHaveBeenCalledWith('new@x.com');
    // Email normalized on the row itself.
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ email: 'new@x.com' }));
  });

  it('archiving (disabled=true) also removes the email from the CF allowlist; enable re-adds it', async () => {
    const { db } = await import('../db/index.js');
    const { addEmail, removeEmail } = await import('../lib/cf-allowlist.js');
    vi.mocked(removeEmail).mockResolvedValue([]);
    vi.mocked(addEmail).mockResolvedValue(['t@example.com']);
    const targetId = '00000000-0000-0000-0000-000000000004';
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

    // Archive: the DB flag alone leaves the edge door open — CF is the IdP.
    const archive = await request(app)
      .patch(`/admin/users/${targetId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ disabled: true, disabledReason: 'beta wrap-up' });
    expect(archive.status).toBe(200);
    expect(vi.mocked(removeEmail)).toHaveBeenCalledWith('t@example.com');

    const enable = await request(app)
      .patch(`/admin/users/${targetId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ disabled: false });
    expect(enable.status).toBe(200);
    expect(vi.mocked(addEmail)).toHaveBeenCalledWith('t@example.com');
  });

  it('DELETE blocks a user with a live Stripe subscription (409) and cleans the allowlist on success', async () => {
    const { db } = await import('../db/index.js');
    const { removeEmail } = await import('../lib/cf-allowlist.js');
    vi.mocked(removeEmail).mockResolvedValue([]);
    const targetId = '00000000-0000-0000-0000-000000000005';

    // Case 1: live Stripe subscription → block; billing truth lives in Stripe.
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: targetId, email: 't@example.com', stripeSubscriptionId: 'sub_123' }]),
        }),
      }),
    } as any);
    const blocked = await request(app)
      .delete(`/admin/users/${targetId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe('STRIPE_SUBSCRIPTION_ACTIVE');
    expect(vi.mocked(db.delete)).not.toHaveBeenCalled();

    // Case 2: clean account → delete + allowlist removal (otherwise the email
    // can re-provision a fresh row on next CF login).
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: targetId, email: 't@example.com', stripeSubscriptionId: null }]),
        }),
      }),
    } as any);
    vi.mocked(db.insert).mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) } as any);
    vi.mocked(db.delete).mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) } as any);
    const ok = await request(app)
      .delete(`/admin/users/${targetId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(ok.status).toBe(200);
    expect(vi.mocked(removeEmail)).toHaveBeenCalledWith('t@example.com');
  });

  it('DELETE maps the audit-history FK (23503, ex-admin) to a typed 409 instead of a 500', async () => {
    const { db } = await import('../db/index.js');
    const targetId = '00000000-0000-0000-0000-000000000006';
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: targetId, email: 'exadmin@x.com', stripeSubscriptionId: null }]),
        }),
      }),
    } as any);
    // adminAuditLog.adminUserId is RESTRICT — drizzle wraps the PG error, code on .cause.
    vi.mocked(db.delete).mockReturnValue({
      where: vi.fn().mockRejectedValue(Object.assign(new Error('update or delete violates foreign key'), {
        cause: Object.assign(new Error('fk'), { code: '23503' }),
      })),
    } as any);

    const res = await request(app)
      .delete(`/admin/users/${targetId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('HAS_AUDIT_HISTORY');
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
    expect(res.body.invited).toBe(true);
    expect(vi.mocked(sendBetaInvite)).toHaveBeenCalledWith('new@t.com');
  });

  it('POST /admin/allowlist still succeeds with invited:false when the email send fails', async () => {
    const { addEmail } = await import('../lib/cf-allowlist.js');
    vi.mocked(addEmail).mockResolvedValue(['a@x.com', 'flaky@t.com']);
    vi.mocked(sendBetaInvite).mockRejectedValue(new Error('Resend down'));
    vi.mocked(db.insert).mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) } as any);

    const res = await request(app)
      .post('/admin/allowlist')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'flaky@t.com' });

    expect(res.status).toBe(200);
    expect(res.body.emails).toEqual(['a@x.com', 'flaky@t.com']);
    expect(res.body.invited).toBe(false);
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
