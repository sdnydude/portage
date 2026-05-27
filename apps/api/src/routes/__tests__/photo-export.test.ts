import request from 'supertest';
import { createApp } from '../../app.js';
import { db } from '../../db/index.js';
import { createTestToken } from '../../test/helpers.js';

vi.mock('../../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

function mockSelectTokenReturns(rows: unknown[]) {
  vi.mocked(db.select).mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  } as any);
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

const VALID_TOKEN = 'a'.repeat(64);
const MOCK_TOKEN_ROW = {
  token: VALID_TOKEN,
  userId: 'test-user-id',
  itemIds: ['00000000-0000-0000-0000-000000000001'],
  expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  useCount: 0,
};

describe('exportTokens schema', () => {
  it('exports exportTokens table from schema', async () => {
    const schema = await import('../../db/schema.js');
    expect((schema as any).exportTokens).toBeDefined();
  });
});

describe('GET /items/photos/export', () => {
  it('returns 400 when token is missing', async () => {
    const res = await request(app).get('/items/photos/export');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_TOKEN');
  });
});
