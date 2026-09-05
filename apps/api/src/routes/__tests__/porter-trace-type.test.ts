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

vi.mock('../../lib/tracing.js', async () => {
  const actual = await vi.importActual<typeof import('../../lib/tracing.js')>('../../lib/tracing.js');
  return { ...actual, traceRequest: vi.fn(actual.traceRequest) };
});

import { db } from '../../db/index.js';
import { chat } from '../../lib/ai-client.js';
import { traceRequest } from '../../lib/tracing.js';

let app: ReturnType<typeof createApp>;
let token: string;

beforeAll(() => {
  app = createApp();
  token = createTestToken();
});

beforeEach(() => {
  vi.resetAllMocks();
});

function mockUserSelect() {
  vi.mocked(db.select).mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ subscriptionTier: 'pro', trialEndsAt: null, porterMessagesToday: 0 }]),
      }),
    }),
  } as never);
}

const TEST_CONV_ID = '00000000-0000-0000-0000-000000000001';

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

// Best-practices audit 2026-07-28: a Porter turn is a tool-calling agent loop —
// its root observation must be typed 'agent' (drives Langfuse's Agent Graph),
// not a generic span.
describe('porter trace observation type', () => {
  it("types the non-streaming turn's root observation as 'agent'", async () => {
    mockUserSelect();
    mockConversationFlow(TEST_CONV_ID);
    vi.mocked(chat).mockResolvedValue({ text: 'hi' } as never);

    const res = await request(app)
      .post('/porter/message')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'hello', conversationId: TEST_CONV_ID });

    expect(res.status).toBe(200);
    expect(vi.mocked(traceRequest)).toHaveBeenCalledWith(
      'porter-chat-turn',
      expect.objectContaining({ userId: expect.any(String) }),
      expect.any(Function),
      expect.objectContaining({ asType: 'agent' }),
    );
  });
});
