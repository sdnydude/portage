import request from 'supertest';
import { createApp } from '../app.js';
import { createTestToken } from '../test/helpers.js';

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
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
