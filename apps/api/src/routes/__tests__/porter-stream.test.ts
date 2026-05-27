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
  return {
    ...actual,
    chatStream: vi.fn(),
    chat: vi.fn(),
  };
});

import { db } from '../../db/index.js';
import { chatStream } from '../../lib/ai-client.js';

let app: ReturnType<typeof createApp>;
let token: string;

type UserRow = {
  subscriptionTier: 'free' | 'pro';
  trialEndsAt: Date | null;
  porterMessagesToday: number;
};

function mockUserSelect(userRow: UserRow) {
  vi.mocked(db.select).mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([userRow]),
      }),
    }),
  } as never);
}

function mockConversationCreate(id: string) {
  // First select for existing conversation (returns empty)
  vi.mocked(db.select).mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
    }),
  } as never);
  // Insert new conversation
  vi.mocked(db.insert).mockReturnValueOnce({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id, messages: [] }]),
    }),
  } as never);
  // Update conversation at end
  vi.mocked(db.update).mockReturnValueOnce({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  } as never);
}

describe('POST /porter/stream', () => {
  beforeAll(() => {
    app = createApp();
    token = createTestToken();
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('responds with SSE headers', async () => {
    mockUserSelect({ subscriptionTier: 'pro', trialEndsAt: null, porterMessagesToday: 0 });
    mockConversationCreate('conv-1');

    vi.mocked(chatStream).mockImplementationOnce(async (_msgs, _sys, _tools, _exec, onEvent) => {
      onEvent({ type: 'done', model: 'claude-sonnet-4-20250514', inputTokens: 1, outputTokens: 1 });
    });

    const res = await request(app)
      .post('/porter/stream')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Hello' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/event-stream/);
    expect(res.headers['cache-control']).toMatch(/no-cache/);
    expect(res.headers['x-accel-buffering']).toBe('no');
  });

  it('emits text_delta SSE events from chatStream output', async () => {
    mockUserSelect({ subscriptionTier: 'pro', trialEndsAt: null, porterMessagesToday: 0 });
    mockConversationCreate('conv-2');

    vi.mocked(chatStream).mockImplementationOnce(async (_msgs, _sys, _tools, _exec, onEvent) => {
      onEvent({ type: 'text_delta', text: 'Hello' });
      onEvent({ type: 'text_delta', text: ' world' });
      onEvent({ type: 'done', model: 'claude-sonnet-4-20250514', inputTokens: 4, outputTokens: 2 });
    });

    const res = await request(app)
      .post('/porter/stream')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Hi' });

    expect(res.status).toBe(200);
    expect(res.text).toContain('data: {"type":"text_delta","text":"Hello"}');
    expect(res.text).toContain('data: {"type":"text_delta","text":" world"}');
  });

  it('emits done event with conversationId, model, and token counts', async () => {
    mockUserSelect({ subscriptionTier: 'pro', trialEndsAt: null, porterMessagesToday: 0 });
    mockConversationCreate('conv-3');

    vi.mocked(chatStream).mockImplementationOnce(async (_msgs, _sys, _tools, _exec, onEvent) => {
      onEvent({ type: 'text_delta', text: 'Done' });
      onEvent({ type: 'done', model: 'claude-sonnet-4-20250514', inputTokens: 42, outputTokens: 7 });
    });

    const res = await request(app)
      .post('/porter/stream')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Hi' });

    expect(res.status).toBe(200);
    const doneLine = res.text.split('\n').find(l => l.startsWith('data:') && l.includes('"done"'));
    expect(doneLine).toBeDefined();
    const payload = JSON.parse(doneLine!.replace(/^data:\s*/, ''));
    expect(payload).toMatchObject({
      type: 'done',
      conversationId: 'conv-3',
      model: 'claude-sonnet-4-20250514',
      inputTokens: 42,
      outputTokens: 7,
    });
  });

  it('returns 429 when porterMessagesToday exceeds threshold', async () => {
    // Free tier exchange limit is 5 → threshold is 10. 999 well exceeds.
    mockUserSelect({ subscriptionTier: 'free', trialEndsAt: null, porterMessagesToday: 999 });

    const res = await request(app)
      .post('/porter/stream')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Hi' });

    expect(res.status).toBe(429);
    expect(vi.mocked(chatStream)).not.toHaveBeenCalled();
  });

  it('parses <actions> block from text and emits action_pills event', async () => {
    mockUserSelect({ subscriptionTier: 'pro', trialEndsAt: null, porterMessagesToday: 0 });
    mockConversationCreate('conv-5');

    vi.mocked(chatStream).mockImplementationOnce(async (_msgs, _sys, _tools, _exec, onEvent) => {
      onEvent({ type: 'text_delta', text: 'Here are options. ' });
      onEvent({ type: 'text_delta', text: '<actions>[{"label":"Check inventory","message":"show me my inventory"}]</actions>' });
      onEvent({ type: 'done', model: 'm', inputTokens: 1, outputTokens: 1 });
    });

    const res = await request(app)
      .post('/porter/stream')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Hi' });

    expect(res.status).toBe(200);
    const pillLine = res.text.split('\n').find(l => l.startsWith('data:') && l.includes('"action_pills"'));
    expect(pillLine).toBeDefined();
    const payload = JSON.parse(pillLine!.replace(/^data:\s*/, ''));
    expect(payload).toEqual({
      type: 'action_pills',
      pills: [{ label: 'Check inventory', message: 'show me my inventory' }],
    });
  });

  it('silently ignores TTS failures and still emits done', async () => {
    process.env.DHG_TTS_URL = 'http://dhg-tts:8000';
    mockUserSelect({ subscriptionTier: 'pro', trialEndsAt: null, porterMessagesToday: 0 });
    mockConversationCreate('conv-6');

    vi.mocked(chatStream).mockImplementationOnce(async (_msgs, _sys, _tools, _exec, onEvent) => {
      onEvent({ type: 'text_delta', text: 'Spoken reply' });
      onEvent({ type: 'done', model: 'm', inputTokens: 1, outputTokens: 1 });
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      const res = await request(app)
        .post('/porter/stream')
        .set('Authorization', `Bearer ${token}`)
        .send({ message: 'Hi' });

      expect(res.status).toBe(200);
      expect(res.text).toContain('"type":"done"');
      expect(res.text).not.toContain('"type":"audio_url"');
      expect(res.text).not.toContain('"type":"error"');
      expect(fetchMock).toHaveBeenCalled();
      const [, callOpts] = fetchMock.mock.calls[0];
      const body = JSON.parse(callOpts.body as string);
      expect(body.input).toBe('Spoken reply');
      expect(body.model).toBe('turbo');
      expect(body.voice).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
      delete process.env.DHG_TTS_URL;
    }
  });

  it('forwards tool_start and tool_result events as SSE', async () => {
    mockUserSelect({ subscriptionTier: 'pro', trialEndsAt: null, porterMessagesToday: 0 });
    mockConversationCreate('conv-7');

    vi.mocked(chatStream).mockImplementationOnce(async (_msgs, _sys, _tools, _exec, onEvent) => {
      onEvent({ type: 'tool_start', toolId: 'tu_42', toolName: 'search_inventory' });
      onEvent({ type: 'tool_result', toolId: 'tu_42', toolName: 'search_inventory', structured: { items: [{ id: 'a' }] } });
      onEvent({ type: 'done', model: 'm', inputTokens: 1, outputTokens: 1 });
    });

    const res = await request(app)
      .post('/porter/stream')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Hi' });

    expect(res.status).toBe(200);
    expect(res.text).toContain('"type":"tool_start"');
    expect(res.text).toContain('"toolId":"tu_42"');
    expect(res.text).toContain('"type":"tool_result"');
    expect(res.text).toContain('"items"');
  });

  it('persists assistant message to conversation on done', async () => {
    mockUserSelect({ subscriptionTier: 'pro', trialEndsAt: null, porterMessagesToday: 0 });

    const setSpy = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    // select existing conv (empty)
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as never);
    // insert new conv
    vi.mocked(db.insert).mockReturnValueOnce({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'conv-8', messages: [] }]),
      }),
    } as never);
    // update — capture the set() args
    vi.mocked(db.update).mockReturnValueOnce({
      set: setSpy,
    } as never);

    vi.mocked(chatStream).mockImplementationOnce(async (_msgs, _sys, _tools, _exec, onEvent) => {
      onEvent({ type: 'text_delta', text: 'Persisted reply' });
      onEvent({ type: 'done', model: 'm', inputTokens: 1, outputTokens: 1 });
    });

    const res = await request(app)
      .post('/porter/stream')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Save me' });

    expect(res.status).toBe(200);
    expect(setSpy).toHaveBeenCalled();
    const setArg = setSpy.mock.calls[0][0];
    expect(Array.isArray(setArg.messages)).toBe(true);
    // user message + assistant message
    expect(setArg.messages.length).toBe(2);
    expect(setArg.messages[0]).toMatchObject({ role: 'user' });
    expect(setArg.messages[1]).toMatchObject({ role: 'assistant' });
  });

  it('emits error SSE event when chatStream throws', async () => {
    mockUserSelect({ subscriptionTier: 'pro', trialEndsAt: null, porterMessagesToday: 0 });
    mockConversationCreate('conv-9');

    vi.mocked(chatStream).mockRejectedValueOnce(new Error('boom'));

    const res = await request(app)
      .post('/porter/stream')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Hi' });

    expect(res.status).toBe(200);
    expect(res.text).toContain('"type":"error"');
    expect(res.text).toContain('"message":"Internal error"');
  });
});
