import { analyzeImage, analyzeImages } from './ai-client.js';
import { resetEnv, loadEnv } from './env.js';

// Mock the OpenAI SDK so we can inspect the params passed to chat.completions.create
const mockCreate = vi.fn();
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}));

const OK_RESPONSE = {
  choices: [{ message: { content: '{"candidates":[{"name":"X","description":"d","category":"electronics","condition":"good","conditionNotes":"","brand":null,"model":null,"features":[],"estimatedValueLow":1,"estimatedValueHigh":2,"confidence":0.9}],"reasoning":[]}' } }],
  usage: { prompt_tokens: 10, completion_tokens: 20 },
  model: 'gemini-3.5-flash',
};

const IMG = [{ base64: 'x', mediaType: 'image/jpeg' }];

describe('gemini vision: reasoning disabled', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.VISION_PROVIDERS = 'gemini';
    resetEnv();
    loadEnv();
  });

  it('sends reasoning_effort "none" on the gemini vision call', async () => {
    mockCreate.mockResolvedValue(OK_RESPONSE);
    await analyzeImages(IMG, 'sys', 'user', { maxTokens: 2048 });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0].reasoning_effort).toBe('none');
  });
});

describe('gemini vision: per-entry model override', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.VISION_PROVIDERS = 'gemini:gemini-3.5-flash,gemini:gemini-2.5-flash';
    resetEnv();
    loadEnv();
  });

  it('resolves a provider when VISION_PROVIDERS uses "provider:model" syntax', async () => {
    mockCreate.mockResolvedValue(OK_RESPONSE);
    await analyzeImages(IMG, 'sys', 'user', { maxTokens: 2048 });
    expect(mockCreate).toHaveBeenCalled();
  });

  it('overrides the vision model from the "provider:model" entry', async () => {
    mockCreate.mockResolvedValue(OK_RESPONSE);
    await analyzeImages(IMG, 'sys', 'user', { maxTokens: 2048 });
    expect(mockCreate.mock.calls[0][0].model).toBe('gemini-3.5-flash');
  });

  it('falls back to the next provider when options.validate rejects the first response (schema drift)', async () => {
    const driftResponse = {
      ...OK_RESPONSE,
      choices: [{ message: { content: '{"candidates":[{"weight":14}]}' } }],
    };
    mockCreate
      .mockResolvedValueOnce(driftResponse)
      .mockResolvedValueOnce(OK_RESPONSE);

    const result = await analyzeImages(IMG, 'sys', 'user', {
      maxTokens: 2048,
      validate: (text) => {
        if (text.includes('"weight":14')) throw new Error('schema drift');
      },
    });

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate.mock.calls[1][0].model).toBe('gemini-2.5-flash');
    expect(result.text).toBe(OK_RESPONSE.choices[0].message.content);
  });

  it('analyzeImage (single-image chain) honors options.validate the same way', async () => {
    const driftResponse = {
      ...OK_RESPONSE,
      choices: [{ message: { content: '{"candidates":[{"weight":14}]}' } }],
    };
    mockCreate
      .mockResolvedValueOnce(driftResponse)
      .mockResolvedValueOnce(OK_RESPONSE);

    const result = await analyzeImage('x', 'image/jpeg', 'sys', 'user', {
      maxTokens: 2048,
      validate: (text) => {
        if (text.includes('"weight":14')) throw new Error('schema drift');
      },
    });

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(result.text).toBe(OK_RESPONSE.choices[0].message.content);
  });

  it('falls back to 2.5-flash (reasoning still off) when 3.5-flash fails', async () => {
    mockCreate
      .mockRejectedValueOnce(new Error('503 high demand'))
      .mockResolvedValueOnce(OK_RESPONSE);
    await analyzeImages(IMG, 'sys', 'user', { maxTokens: 2048 });
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate.mock.calls[0][0].model).toBe('gemini-3.5-flash');
    expect(mockCreate.mock.calls[1][0].model).toBe('gemini-2.5-flash');
    expect(mockCreate.mock.calls[1][0].reasoning_effort).toBe('none');
  });
});
