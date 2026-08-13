import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestToken } from '../../test/helpers.js';

vi.mock('../../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
  },
}));

vi.mock('../../lib/ai-client.js', async () => {
  const actual = await vi.importActual<typeof import('../../lib/ai-client.js')>('../../lib/ai-client.js');
  return { ...actual, chatStream: vi.fn(), chat: vi.fn() };
});

import { db } from '../../db/index.js';
import { chat } from '../../lib/ai-client.js';

let app: ReturnType<typeof createApp>;
let token: string;

beforeAll(() => {
  app = createApp();
  token = createTestToken();
});

beforeEach(() => {
  vi.resetAllMocks();
});

const TEST_CONV_ID = '00000000-0000-0000-0000-000000000001';

function mockUserSelect() {
  vi.mocked(db.select).mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ subscriptionTier: 'pro', trialEndsAt: null, porterMessagesToday: 0 }]),
      }),
    }),
  } as never);
}

function mockConversationFlow(id: string) {
  vi.mocked(db.select).mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id, messages: [] }]) }),
    }),
  } as never);
  vi.mocked(db.update).mockReturnValueOnce({
    set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
  } as never);
}

function mockSearchInventorySelect(rows: unknown[]) {
  vi.mocked(db.select).mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(rows) }),
      }),
    }),
  } as never);
}

describe('POST /porter/message grounding', () => {
  it('passes a validate hook that rejects item names missing from tool results', async () => {
    mockUserSelect();
    mockConversationFlow(TEST_CONV_ID);
    mockSearchInventorySelect([{ id: '1', title: 'Hosa DTP-805 Snake', category: 'cables', condition: 'good' }]);

    let validateError: Error | null = null;
    vi.mocked(chat).mockImplementation(async (_msgs, _sys, _tools, executeTool, options) => {
      await executeTool('search_inventory', {});
      try {
        options?.validate?.('- Gibson Flying V — excellent, $1200');
      } catch (err) {
        validateError = err as Error;
      }
      return { text: '- Hosa DTP-805 Snake — good, $99', provider: 'gemini', model: 'gemini-2.5-flash' };
    });

    const res = await request(app)
      .post('/porter/message')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'what do I own?', conversationId: TEST_CONV_ID });

    expect(res.status).toBe(200);
    expect(validateError).not.toBeNull();
    expect(validateError!.message).toMatch(/Gibson Flying V/);
  });

  it('validates each retry against its own tool results, not the union of attempts (A3)', async () => {
    mockUserSelect();
    mockConversationFlow(TEST_CONV_ID);
    mockSearchInventorySelect([{ id: '1', title: 'Impeto Fiber Cable', category: 'cables', condition: 'good' }]);
    mockSearchInventorySelect([{ id: '2', title: 'Hosa DTP-805 Snake', category: 'cables', condition: 'good' }]);

    let secondCallError: Error | null = null;
    vi.mocked(chat).mockImplementation(async (_msgs, _sys, _tools, executeTool, options) => {
      // Simulated top-level call 1: tools return Impeto; reply names Impeto — grounded.
      await executeTool('search_inventory', { query: 'impeto' });
      options?.validate?.('- Impeto Fiber Cable — good, $5');
      // Simulated retry call 2: tools return only Hosa; a reply naming Impeto
      // must now FAIL (union semantics would let it pass).
      await executeTool('search_inventory', { query: 'hosa' });
      try {
        options?.validate?.('- Impeto Fiber Cable — good, $5');
      } catch (err) {
        secondCallError = err as Error;
      }
      return { text: '- Hosa DTP-805 Snake — good, $99', provider: 'gemini', model: 'gemini-2.5-flash' };
    });

    const res = await request(app)
      .post('/porter/message')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'what do I own?', conversationId: TEST_CONV_ID });

    expect(res.status).toBe(200);
    expect(secondCallError).not.toBeNull();
    expect(secondCallError!.message).toMatch(/Impeto/);
  });

  it('validate stops throwing once the turn time budget is exhausted (A6)', async () => {
    mockUserSelect();
    mockConversationFlow(TEST_CONV_ID);
    mockSearchInventorySelect([{ id: '1', title: 'Hosa DTP-805 Snake', category: 'cables', condition: 'good' }]);

    let t = 0;
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => (t += 60_000));

    let threw = false;
    vi.mocked(chat).mockImplementation(async (_msgs, _sys, _tools, executeTool, options) => {
      await executeTool('search_inventory', {});
      try {
        options?.validate?.('- Gibson Flying V — excellent, $1200');
      } catch {
        threw = true;
      }
      return { text: '- Gibson Flying V — excellent, $1200', provider: 'gemini', model: 'gemini-2.5-flash' };
    });

    const res = await request(app)
      .post('/porter/message')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'what do I own?', conversationId: TEST_CONV_ID });

    nowSpy.mockRestore();
    expect(res.status).toBe(200);
    expect(threw).toBe(false);
  });

  it('validate degrades to a no-op after 3 failures so exhaustion never 500s', async () => {
    mockUserSelect();
    mockConversationFlow(TEST_CONV_ID);
    mockSearchInventorySelect([{ id: '1', title: 'Hosa DTP-805 Snake', category: 'cables', condition: 'good' }]);

    const throwCount = { n: 0 };
    vi.mocked(chat).mockImplementation(async (_msgs, _sys, _tools, executeTool, options) => {
      await executeTool('search_inventory', {});
      const ungrounded = '- Gibson Flying V — excellent, $1200';
      for (let i = 0; i < 4; i++) {
        try {
          options?.validate?.(ungrounded);
        } catch {
          throwCount.n++;
        }
      }
      return { text: ungrounded, provider: 'gemini', model: 'gemini-2.5-flash' };
    });

    const res = await request(app)
      .post('/porter/message')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'what do I own?', conversationId: TEST_CONV_ID });

    expect(res.status).toBe(200);
    expect(throwCount.n).toBe(3);
  });
});
