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
import { chatStream } from '../../lib/ai-client.js';

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
        limit: vi.fn().mockResolvedValue([{ subscriptionTier: 'pro', trialEndsAt: null, limitOverrides: null, porterMessagesToday: 0 }]),
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

const HOSA_ROW = { id: '1', title: 'Hosa DTP-805 Snake', category: 'cables', condition: 'good' };

type ChatStreamArgs = Parameters<typeof chatStream>;

function streamAttempt(replyText: string) {
  return async (...args: ChatStreamArgs) => {
    const [, , , execTool, onEvent] = args;
    const result = await execTool('search_inventory', {});
    onEvent({ type: 'tool_start', toolId: 't1', toolName: 'search_inventory' });
    onEvent({ type: 'tool_result', toolId: 't1', toolName: 'search_inventory', structured: result.structured });
    onEvent({ type: 'text_delta', text: replyText });
    onEvent({ type: 'done', model: 'qwen3:14b', inputTokens: 10, outputTokens: 5 });
  };
}

// Used by the A7 test below (added first): attempt that emits a live pre-tool
// preamble before its tool call.
function attemptWithPreambleFactory(replyText: string) {
  return async (...args: ChatStreamArgs) => {
    const [, , , execTool, onEvent] = args;
    onEvent({ type: 'text_delta', text: 'Checking your inventory…\n' });
    const result = await execTool('search_inventory', {});
    onEvent({ type: 'tool_start', toolId: 't1', toolName: 'search_inventory' });
    onEvent({ type: 'tool_result', toolId: 't1', toolName: 'search_inventory', structured: result.structured });
    onEvent({ type: 'text_delta', text: replyText });
    onEvent({ type: 'done', model: 'qwen3:14b', inputTokens: 10, outputTokens: 5 });
  };
}

describe('POST /porter/stream grounding', () => {
  it('discards an ungrounded buffered reply and streams the grounded retry instead', async () => {
    mockUserSelect();
    mockConversationFlow(TEST_CONV_ID);
    mockSearchInventorySelect([HOSA_ROW]); // attempt 1 tool run
    mockSearchInventorySelect([HOSA_ROW]); // attempt 2 tool run

    vi.mocked(chatStream)
      .mockImplementationOnce(streamAttempt('- Gibson Flying V — excellent, $1200'))
      .mockImplementationOnce(streamAttempt('- Hosa DTP-805 Snake — good, $99'));

    const res = await request(app)
      .post('/porter/stream')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'what do I own?', conversationId: TEST_CONV_ID });

    expect(res.status).toBe(200);
    expect(vi.mocked(chatStream)).toHaveBeenCalledTimes(2);
    expect(res.text).toContain('Hosa DTP-805 Snake');
    expect(res.text).not.toContain('Gibson Flying V');
  });

  it('forces gemini on the third attempt and degrades (flushes) when grounding never passes', async () => {
    mockUserSelect();
    mockConversationFlow(TEST_CONV_ID);
    mockSearchInventorySelect([HOSA_ROW]);
    mockSearchInventorySelect([HOSA_ROW]);
    mockSearchInventorySelect([HOSA_ROW]);

    vi.mocked(chatStream)
      .mockImplementationOnce(streamAttempt('- Gibson Flying V — excellent, $1200'))
      .mockImplementationOnce(streamAttempt('- Gibson Flying V — excellent, $1200'))
      .mockImplementationOnce(streamAttempt('- Gibson Flying V — excellent, $1200'));

    const res = await request(app)
      .post('/porter/stream')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'what do I own?', conversationId: TEST_CONV_ID });

    expect(res.status).toBe(200);
    expect(vi.mocked(chatStream)).toHaveBeenCalledTimes(3);
    const thirdCallOptions = vi.mocked(chatStream).mock.calls[2][5];
    expect(thirdCallOptions).toMatchObject({ forceProvider: 'gemini' });
    // Degrade: after exhausting attempts the reply still reaches the user
    expect(res.text).toContain('Gibson Flying V');
  });

  it('suppresses duplicate tool frames and pre-tool text on retry attempts', async () => {
    mockUserSelect();
    mockConversationFlow(TEST_CONV_ID);
    mockSearchInventorySelect([HOSA_ROW]);
    mockSearchInventorySelect([HOSA_ROW]);

    const attemptWithPreamble = (replyText: string) => async (...args: ChatStreamArgs) => {
      const [, , , execTool, onEvent] = args;
      onEvent({ type: 'text_delta', text: 'Checking your inventory…\n' });
      const result = await execTool('search_inventory', {});
      onEvent({ type: 'tool_start', toolId: 't1', toolName: 'search_inventory' });
      onEvent({ type: 'tool_result', toolId: 't1', toolName: 'search_inventory', structured: result.structured });
      onEvent({ type: 'text_delta', text: replyText });
      onEvent({ type: 'done', model: 'qwen3:14b', inputTokens: 10, outputTokens: 5 });
    };

    vi.mocked(chatStream)
      .mockImplementationOnce(attemptWithPreamble('- Gibson Flying V — excellent, $1200'))
      .mockImplementationOnce(attemptWithPreamble('- Hosa DTP-805 Snake — good, $99'));

    const res = await request(app)
      .post('/porter/stream')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'what do I own?', conversationId: TEST_CONV_ID });

    expect(res.status).toBe(200);
    expect((res.text.match(/tool_start/g) ?? []).length).toBe(1);
    expect(res.text).toContain('Hosa DTP-805 Snake');
    expect(res.text).not.toContain('Gibson Flying V');
    // A4: attempt 1's live preamble must not be repeated by the retry's flush
    expect((res.text.match(/Checking your inventory/g) ?? []).length).toBe(1);
  });

  it('validates a no-tool retry against the previous attempt\'s titles (A2)', async () => {
    mockUserSelect();
    mockConversationFlow(TEST_CONV_ID);
    mockSearchInventorySelect([HOSA_ROW]); // attempt 1 only — attempt 2 skips tools
    mockSearchInventorySelect([HOSA_ROW]); // attempt 3 tool run

    const noToolAttempt = (replyText: string) => async (...args: ChatStreamArgs) => {
      const [, , , , onEvent] = args;
      onEvent({ type: 'text_delta', text: replyText });
      onEvent({ type: 'done', model: 'qwen3:14b', inputTokens: 10, outputTokens: 5 });
    };

    vi.mocked(chatStream)
      .mockImplementationOnce(streamAttempt('- Gibson Flying V — excellent, $1200'))
      .mockImplementationOnce(noToolAttempt('- Martin D-28 — mint, $2500'))
      .mockImplementationOnce(streamAttempt('- Hosa DTP-805 Snake — good, $99'));

    const res = await request(app)
      .post('/porter/stream')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'what do I own?', conversationId: TEST_CONV_ID });

    expect(res.status).toBe(200);
    expect(vi.mocked(chatStream)).toHaveBeenCalledTimes(3);
    expect(res.text).toContain('Hosa DTP-805 Snake');
    expect(res.text).not.toContain('Martin D-28');
  });

  it('persists live-streamed text when a retry attempt hard-fails (A7)', async () => {
    mockUserSelect();
    mockConversationFlow(TEST_CONV_ID);
    mockSearchInventorySelect([HOSA_ROW]);

    vi.mocked(chatStream)
      .mockImplementationOnce(attemptWithPreambleFactory('- Gibson Flying V — excellent, $1200'))
      .mockRejectedValueOnce(new Error('provider network drop'));

    const res = await request(app)
      .post('/porter/stream')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'what do I own?', conversationId: TEST_CONV_ID });

    expect(res.status).toBe(200);
    // Degrade, not error: the user already saw text — keep the turn
    expect(res.text).not.toContain('Internal error');
    expect(res.text).toContain('"type":"done"');
    expect(vi.mocked(db.update)).toHaveBeenCalled();
  });

  it('stops retrying and degrades when the turn time budget is exhausted (A6)', async () => {
    mockUserSelect();
    mockConversationFlow(TEST_CONV_ID);
    mockSearchInventorySelect([HOSA_ROW]);

    let t = 0;
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => (t += 60_000));

    vi.mocked(chatStream)
      .mockImplementationOnce(streamAttempt('- Gibson Flying V — excellent, $1200'));

    const res = await request(app)
      .post('/porter/stream')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'what do I own?', conversationId: TEST_CONV_ID });

    nowSpy.mockRestore();
    expect(res.status).toBe(200);
    expect(vi.mocked(chatStream)).toHaveBeenCalledTimes(1);
    // Degrade: budget-exhausted turn still delivers the (ungrounded) reply
    expect(res.text).toContain('Gibson Flying V');
  });

  it('accumulates token usage across grounding attempts in the done event', async () => {
    mockUserSelect();
    mockConversationFlow(TEST_CONV_ID);
    mockSearchInventorySelect([HOSA_ROW]);
    mockSearchInventorySelect([HOSA_ROW]);

    vi.mocked(chatStream)
      .mockImplementationOnce(streamAttempt('- Gibson Flying V — excellent, $1200'))
      .mockImplementationOnce(streamAttempt('- Hosa DTP-805 Snake — good, $99'));

    const res = await request(app)
      .post('/porter/stream')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'what do I own?', conversationId: TEST_CONV_ID });

    const doneFrame = res.text.split('\n').filter(l => l.includes('"type":"done"')).pop()!;
    expect(JSON.parse(doneFrame.replace('data: ', ''))).toMatchObject({ inputTokens: 20, outputTokens: 10 });
  });
});
