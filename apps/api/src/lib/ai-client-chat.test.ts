import { chat } from './ai-client.js';
import { resetEnv, loadEnv } from './env.js';

// Mock the OpenAI SDK so no real network calls happen on the chat path
const mockCreate = vi.fn();
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(function () { return ({
    chat: { completions: { create: mockCreate } },
  }); }),
}));

// Pass-through observeOpenAI that records its config (per-purpose naming, 3a.3)
const observeConfigs: unknown[] = [];
vi.mock('@langfuse/openai', () => ({
  observeOpenAI: vi.fn((sdk: unknown, config?: unknown) => {
    observeConfigs.push(config);
    return sdk;
  }),
}));

// Anthropic mock so chatStream's forceProvider filtering is observable
const mockAnthropicStream = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function () { return ({
    messages: { stream: mockAnthropicStream },
  }); }),
}));

describe('chat: provider chain availability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 'nosuch' resolves to no provider regardless of .env contents → empty chain
    process.env.CHAT_PROVIDERS = 'nosuch';
    resetEnv();
    loadEnv();
  });

  it('throws AppError 503 AI_UNAVAILABLE when no chat providers resolve', async () => {
    await expect(
      chat([{ role: 'user', content: 'hi' }], 'system', [], async () => ''),
    ).rejects.toMatchObject({ statusCode: 503, code: 'AI_UNAVAILABLE' });
  });

  it('chatStream also surfaces 503 AI_UNAVAILABLE on an empty chain', async () => {
    const { chatStream } = await import('./ai-client.js');
    await expect(
      chatStream([{ role: 'user', content: 'hi' }], 'system', [], async () => ({ text: '' }), () => {}),
    ).rejects.toMatchObject({ statusCode: 503, code: 'AI_UNAVAILABLE' });
  });
});

const CHAT_OK = {
  choices: [{ message: { content: 'hello from gemini' }, finish_reason: 'stop' }],
  usage: { prompt_tokens: 10, completion_tokens: 5 },
  model: 'gemini-2.5-flash',
};

describe('chat: gemini non-streaming call params', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.CHAT_PROVIDERS = 'gemini';
    resetEnv();
    loadEnv();
  });

  it('passes reasoning_effort on the non-streaming create call (blank-reply fix)', async () => {
    mockCreate.mockResolvedValue(CHAT_OK);
    await chat([{ role: 'user', content: 'hi' }], 'system', [], async () => '');
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0].reasoning_effort).toBe('none');
  });

  it('sets response_format json_object on the no-tools path and never alongside tools (P7 3b00baeb — Lever A hardening)', async () => {
    mockCreate.mockResolvedValue(CHAT_OK);
    // No-tools path (chatText): structured text-only generation gets JSON mode.
    await chat([{ role: 'user', content: 'return json' }], 'system', [], async () => '');
    expect(mockCreate.mock.calls[0][0].response_format).toEqual({ type: 'json_object' });

    // Tools path: response_format must NOT be combined with tools.
    mockCreate.mockResolvedValue(CHAT_OK);
    await chat(
      [{ role: 'user', content: 'hi' }],
      'system',
      [{ name: 't', description: 'd', parameters: { type: 'object', properties: {} } }],
      async () => '',
    );
    expect(mockCreate.mock.calls[1][0].response_format).toBeUndefined();
  });
});

describe('chat: empty content is a failed call', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.CHAT_PROVIDERS = 'gemini,gemini';
    resetEnv();
    loadEnv();
  });

  it('fails over to the next provider when a provider returns empty content', async () => {
    const EMPTY = {
      choices: [{ message: { content: '' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 0 },
      model: 'gemini-2.5-flash',
    };
    mockCreate.mockResolvedValueOnce(EMPTY).mockResolvedValueOnce(CHAT_OK);

    const result = await chat([{ role: 'user', content: 'hi' }], 'system', [], async () => '');

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(result.text).toBe('hello from gemini');
  });
});

describe('chat: provider:model chain entry (3a.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.CHAT_PROVIDERS = 'gemini:gemini-exp-override';
    resetEnv();
    loadEnv();
  });

  it('uses the per-entry model override for the chat call', async () => {
    mockCreate.mockResolvedValue(CHAT_OK);
    await chat([{ role: 'user', content: 'hi' }], 'system', [], async () => '');
    expect(mockCreate.mock.calls[0][0].model).toBe('gemini-exp-override');
  });
});

const UNGROUNDED = {
  choices: [{ message: { content: 'you own a Gibson Flying V' }, finish_reason: 'stop' }],
  usage: { prompt_tokens: 10, completion_tokens: 5 },
  model: 'gemini-2.5-flash',
};

describe('chat: grounding validate hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.CHAT_PROVIDERS = 'gemini';
    resetEnv();
    loadEnv();
  });

  it('retries the same provider once when validate rejects, accepting the retry result', async () => {
    mockCreate.mockResolvedValueOnce(UNGROUNDED).mockResolvedValueOnce(CHAT_OK);
    const validate = vi.fn((text: string) => {
      if (text.includes('Gibson')) throw new Error('ungrounded item');
    });

    const result = await chat([{ role: 'user', content: 'hi' }], 'system', [], async () => '', { validate });

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(validate).toHaveBeenCalledTimes(2);
    expect(result.text).toBe('hello from gemini');
  });

  it('fails over to the next provider when validate rejects the retry too', async () => {
    process.env.CHAT_PROVIDERS = 'gemini,gemini';
    resetEnv();
    loadEnv();
    mockCreate
      .mockResolvedValueOnce(UNGROUNDED)
      .mockResolvedValueOnce(UNGROUNDED)
      .mockResolvedValueOnce(CHAT_OK);
    const validate = (text: string) => {
      if (text.includes('Gibson')) throw new Error('ungrounded item');
    };

    const result = await chat([{ role: 'user', content: 'hi' }], 'system', [], async () => '', { validate });

    expect(mockCreate).toHaveBeenCalledTimes(3);
    expect(result.text).toBe('hello from gemini');
  });

  it('names the Langfuse generation after options.purpose (3a.3)', async () => {
    mockCreate.mockResolvedValue(CHAT_OK);
    observeConfigs.length = 0;
    await chat([{ role: 'user', content: 'hi' }], 'system', [], async () => '', { purpose: 'porter-chat' });
    expect(observeConfigs).toContainEqual(expect.objectContaining({ generationName: 'porter-chat' }));
  });

  it('chatStreamOpenAI treats an empty streamed reply as a failed call (A1)', async () => {
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.CHAT_PROVIDERS = 'gemini';
    resetEnv();
    loadEnv();
    mockCreate.mockResolvedValue({
      async *[Symbol.asyncIterator]() {
        yield { model: 'gemini-2.5-flash', usage: { prompt_tokens: 5, completion_tokens: 0 }, choices: [{ delta: {}, finish_reason: 'stop' }] };
      },
    });

    const { chatStream } = await import('./ai-client.js');
    await expect(
      chatStream([{ role: 'user', content: 'hi' }], 'system', [], async () => ({ text: '' }), () => {}),
    ).rejects.toThrow(/Empty chat response/);
  });

  it('chatStream honors forceProvider (streaming grounding attempt-3 path)', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.CHAT_PROVIDERS = 'gemini,anthropic';
    resetEnv();
    loadEnv();
    mockAnthropicStream.mockReturnValue({
      on() { return this; },
      async finalMessage() {
        return {
          content: [{ type: 'text', text: 'forced' }],
          stop_reason: 'end_turn',
          model: 'claude-sonnet-4-6',
          usage: { input_tokens: 1, output_tokens: 1 },
        };
      },
    });

    const { chatStream } = await import('./ai-client.js');
    await chatStream([{ role: 'user', content: 'hi' }], 'system', [], async () => ({ text: '' }), () => {}, { forceProvider: 'anthropic' });

    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockAnthropicStream).toHaveBeenCalledTimes(1);
  });

  it('forceProvider naming an unconfigured provider falls back to the full chain (A9)', async () => {
    mockCreate.mockResolvedValue(CHAT_OK);
    const result = await chat([{ role: 'user', content: 'hi' }], 'system', [], async () => '', { forceProvider: 'openrouter' });
    expect(result.text).toBe('hello from gemini');
  });

  it('forceProvider restricts the chain to the named provider', async () => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.OPENAI_CHAT_MODEL = 'gpt-test';
    process.env.GEMINI_CHAT_MODEL = 'gemini-2.5-flash';
    process.env.CHAT_PROVIDERS = 'openai,gemini';
    resetEnv();
    loadEnv();
    mockCreate.mockResolvedValue(CHAT_OK);

    await chat([{ role: 'user', content: 'hi' }], 'system', [], async () => '', { forceProvider: 'gemini' });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0].model).toBe('gemini-2.5-flash');
  });
});
