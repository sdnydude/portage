import { chatStream, type PorterStreamEvent } from './ai-client.js';
import type Anthropic from '@anthropic-ai/sdk';

process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
// chatStream now routes through CHAT_PROVIDERS; these tests exercise the Anthropic path.
process.env.CHAT_PROVIDERS = 'anthropic';

// ─── Mock helpers ─────────────────────────────────────────

type MockStreamConfig = {
  textDeltas?: string[];
  contentBlocks?: Anthropic.ContentBlock[];
  stopReason?: string;
  model?: string;
};

function createMockStream(config: MockStreamConfig) {
  const handlers = new Map<string, Function[]>();

  return {
    on(event: string, handler: Function) {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
      return this;
    },
    async finalMessage() {
      let snapshot = '';
      for (const delta of config.textDeltas ?? []) {
        snapshot += delta;
        (handlers.get('text') ?? []).forEach(h => h(delta, snapshot));
      }
      for (const block of config.contentBlocks ?? []) {
        (handlers.get('contentBlock') ?? []).forEach(h => h(block));
      }
      const content: Anthropic.ContentBlock[] =
        config.contentBlocks?.length
          ? config.contentBlocks
          : [{ type: 'text', text: snapshot || '', citations: null } as unknown as Anthropic.ContentBlock];
      return {
        content,
        stop_reason: config.stopReason ?? 'end_turn',
        model: config.model ?? 'claude-sonnet-4-20250514',
        usage: { input_tokens: 10, output_tokens: 5 },
      };
    },
  };
}

function toolUse(id: string, name: string, input: Record<string, unknown>): Anthropic.ToolUseBlock {
  return { type: 'tool_use', id, name, input } as unknown as Anthropic.ToolUseBlock;
}

const mockStreamFn = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { stream: mockStreamFn },
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const BASE_MESSAGES: Anthropic.MessageParam[] = [
  { role: 'user', content: 'Hello Porter' },
];

// ─── Tests ────────────────────────────────────────────────

describe('chatStream', () => {
  it('emits text_delta events for each text chunk', async () => {
    mockStreamFn.mockReturnValueOnce(
      createMockStream({ textDeltas: ['Hi', ' there', '!'], stopReason: 'end_turn' }),
    );

    const events: PorterStreamEvent[] = [];
    await chatStream(BASE_MESSAGES, 'system', [], async () => ({ text: '' }), e => events.push(e));

    const textEvents = events.filter(e => e.type === 'text_delta');
    expect(textEvents).toHaveLength(3);
    expect(textEvents[0]).toEqual({ type: 'text_delta', text: 'Hi' });
    expect(textEvents[1]).toEqual({ type: 'text_delta', text: ' there' });
    expect(textEvents[2]).toEqual({ type: 'text_delta', text: '!' });
  });

  it('emits done event with model and token counts', async () => {
    mockStreamFn.mockReturnValueOnce(
      createMockStream({ textDeltas: ['Done'], stopReason: 'end_turn', model: 'claude-opus-4' }),
    );

    const events: PorterStreamEvent[] = [];
    await chatStream(BASE_MESSAGES, 'system', [], async () => ({ text: '' }), e => events.push(e));

    const done = events.find(e => e.type === 'done');
    expect(done).toEqual({ type: 'done', model: 'claude-opus-4', inputTokens: 10, outputTokens: 5 });
  });

  it('emits tool_start and calls executeTool on tool_use block', async () => {
    const toolUseBlock = toolUse('tu_123', 'search_inventory', { query: 'guitar' });
    mockStreamFn
      .mockReturnValueOnce(createMockStream({ contentBlocks: [toolUseBlock], stopReason: 'tool_use' }))
      .mockReturnValueOnce(createMockStream({ textDeltas: ['Found it'], stopReason: 'end_turn' }));

    const events: PorterStreamEvent[] = [];
    const executeTool = vi.fn().mockResolvedValue({ text: '[]', structured: { items: [] } });
    await chatStream(BASE_MESSAGES, 'system', [], executeTool, e => events.push(e));

    expect(events.some(e => e.type === 'tool_start' && (e as Extract<PorterStreamEvent, { type: 'tool_start' }>).toolId === 'tu_123')).toBe(true);
    expect(executeTool).toHaveBeenCalledWith('search_inventory', { query: 'guitar' });
  });

  it('emits tool_result with structured data after execution', async () => {
    mockStreamFn
      .mockReturnValueOnce(createMockStream({ contentBlocks: [toolUse('tu_789', 'search_inventory', { query: 'amp' })], stopReason: 'tool_use' }))
      .mockReturnValueOnce(createMockStream({ textDeltas: ['Here are results'], stopReason: 'end_turn' }));

    const structured = { items: [{ id: '1', title: 'Fender Amp' }] };
    const executeTool = vi.fn().mockResolvedValue({ text: '[]', structured });

    const events: PorterStreamEvent[] = [];
    await chatStream(BASE_MESSAGES, 'system', [], executeTool, e => events.push(e));

    const toolResult = events.find(e => e.type === 'tool_result') as Extract<PorterStreamEvent, { type: 'tool_result' }>;
    expect(toolResult).toBeDefined();
    expect(toolResult.toolId).toBe('tu_789');
    expect(toolResult.structured).toEqual(structured);
  });

  it('starts a second stream with tool results appended to messages', async () => {
    mockStreamFn
      .mockReturnValueOnce(createMockStream({ contentBlocks: [toolUse('tu_abc', 'search_inventory', { query: 'violin' })], stopReason: 'tool_use' }))
      .mockReturnValueOnce(createMockStream({ textDeltas: ['Second response'], stopReason: 'end_turn' }));

    await chatStream(BASE_MESSAGES, 'system', [], async () => ({ text: '[]' }), () => {});

    expect(mockStreamFn).toHaveBeenCalledTimes(2);
    const secondCallMessages = mockStreamFn.mock.calls[1][0].messages as Anthropic.MessageParam[];
    expect(secondCallMessages).toHaveLength(3);
    const lastMsg = secondCallMessages[secondCallMessages.length - 1];
    expect((lastMsg.content as unknown[])[0]).toMatchObject({ type: 'tool_result' });
  });

  it('throws AI_LOOP_CAP when tool iterations exceed the limit', async () => {
    mockStreamFn.mockImplementation(() =>
      createMockStream({ contentBlocks: [toolUse('tu_loop', 'search_inventory', {})], stopReason: 'tool_use' }),
    );

    await expect(
      chatStream(BASE_MESSAGES, 'system', [], async () => ({ text: '[]' }), () => {}),
    ).rejects.toMatchObject({ code: 'AI_LOOP_CAP' });
  });
});
