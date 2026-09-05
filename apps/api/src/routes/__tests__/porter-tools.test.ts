// One test appended 2026-08-11 (search recall): see bottom of file.
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

type StreamToolResult = { text: string; structured?: unknown };

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
  // load (found) — caller must pass conversationId so this SELECT is actually executed
  vi.mocked(db.select).mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id, messages: [] }]) }),
    }),
  } as never);
  // update at end (no insert since conv was found)
  vi.mocked(db.update).mockReturnValueOnce({
    set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
  } as never);
}

describe('suggest_listing tool', () => {
  const ITEM_UUID = '11111111-1111-1111-1111-111111111111';
  const mockItem = {
    id: ITEM_UUID,
    title: 'Marshall JTM45 Stack',
    description: 'Vintage amp',
    condition: 'good',
    brand: 'Marshall',
    model: 'JTM45',
    category: 'Amps',
    estimatedValueRecommended: 2500,
    estimatedValueMax: 3000,
  };

  function mockItemSelect() {
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([mockItem]) }),
      }),
    } as never);
  }

  it('falls back to title search when itemId is a slug (simulating UUID DB error)', async () => {
    mockUserSelect();
    mockConversationFlow(TEST_CONV_ID);

    let toolResult: StreamToolResult | null = null;

    vi.mocked(chatStream).mockImplementationOnce(async (_msgs, _sys, _tools, execTool, onEvent) => {
      // Simulate PostgreSQL throwing "invalid input syntax for type uuid" when passed a slug
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error('invalid input syntax for type uuid: "marshall-jtm45-stack"')),
          }),
        }),
      } as never);
      // Title search fallback returns the item
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([mockItem]) }),
        }),
      } as never);

      toolResult = await execTool('suggest_listing', { itemId: 'marshall-jtm45-stack', marketplace: 'ebay' });
      onEvent({ type: 'done', model: 'm', inputTokens: 1, outputTokens: 1 });
    });

    await request(app)
      .post('/porter/stream')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Suggest listing', conversationId: TEST_CONV_ID });

    const parsed = JSON.parse((toolResult! as StreamToolResult).text);
    expect(parsed.itemId).toBe(ITEM_UUID);
    expect(parsed.suggestedTitle).toBe('Marshall JTM45 Stack');
  });

  it('finds item by UUID', async () => {
    mockUserSelect();
    mockConversationFlow(TEST_CONV_ID);

    let toolResult: StreamToolResult | null = null;

    vi.mocked(chatStream).mockImplementationOnce(async (_msgs, _sys, _tools, execTool, onEvent) => {
      mockItemSelect();
      toolResult = await execTool('suggest_listing', { itemId: ITEM_UUID, marketplace: 'ebay' });
      onEvent({ type: 'done', model: 'm', inputTokens: 1, outputTokens: 1 });
    });

    await request(app)
      .post('/porter/stream')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Suggest listing', conversationId: TEST_CONV_ID });

    const parsed = JSON.parse((toolResult! as StreamToolResult).text);
    expect(parsed.itemId).toBe(ITEM_UUID);
  });
});

describe('search_inventory tool', () => {
  it('excludes photos from the tool result (photo-URL noise made granite4.1 misread items as duplicates, live 08-12; FE never renders tool results)', async () => {
    mockUserSelect();
    mockConversationFlow(TEST_CONV_ID);

    let toolResult: StreamToolResult | null = null;

    vi.mocked(chatStream).mockImplementationOnce(async (_msgs, _sys, _tools, execTool, onEvent) => {
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{
                id: 'item-1',
                title: 'Gibson Les Paul',
                category: 'Music',
                condition: 'good',
                brand: 'Gibson',
                model: 'Les Paul',
                estimatedValueMin: 500,
                estimatedValueMax: 1000,
                estimatedValueRecommended: 750,
                photos: [{ url: 'https://s3.example.com/photo.jpg', key: 'photos/photo.jpg', isPrimary: true }],
              }]),
            }),
          }),
        }),
      } as never);

      toolResult = await execTool('search_inventory', { query: 'guitar' });
      onEvent({ type: 'done', model: 'm', inputTokens: 1, outputTokens: 1 });
    });

    await request(app)
      .post('/porter/stream')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Find my guitar', conversationId: TEST_CONV_ID });

    expect(toolResult).not.toBeNull();
    const items = toolResult!.structured as Array<Record<string, unknown>>;
    expect(Array.isArray(items)).toBe(true);
    expect(items[0].title).toBe('Gibson Les Paul');
    expect(items[0]).not.toHaveProperty('photos');
  });

  it('retries a plural query as singular when it matches nothing ("cables" finds "Cable")', async () => {
    mockUserSelect();
    mockConversationFlow(TEST_CONV_ID);

    const CABLE_ROW = {
      id: 'item-2', title: 'Impeto Fiber Optic Audio Cable 3.3ft', category: 'cables',
      condition: 'good', brand: 'Impeto', model: null,
      estimatedValueMin: 5, estimatedValueMax: 20, estimatedValueRecommended: 10, photos: [],
    };

    function mockSearchSelect(rows: unknown[]) {
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(rows) }),
          }),
        }),
      } as never);
    }

    let toolResult: StreamToolResult | null = null;
    vi.mocked(chatStream).mockImplementationOnce(async (_msgs, _sys, _tools, execTool, onEvent) => {
      mockSearchSelect([]);           // "cables" — no title contains the plural
      mockSearchSelect([CABLE_ROW]);  // singular retry "cable" hits
      toolResult = await execTool('search_inventory', { query: 'cables' });
      onEvent({ type: 'done', model: 'm', inputTokens: 1, outputTokens: 1 });
    });

    await request(app)
      .post('/porter/stream')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'What cables do I have?', conversationId: TEST_CONV_ID });

    const items = toolResult!.structured as Array<{ title: string }>;
    expect(Array.isArray(items)).toBe(true);
    expect(items[0].title).toBe('Impeto Fiber Optic Audio Cable 3.3ft');
  });

  it('merges plural and singular matches instead of stopping at the plural subset (live 08-11: "cables" hid 9 of 10)', async () => {
    mockUserSelect();
    mockConversationFlow(TEST_CONV_ID);

    const DONNER = { id: 'd1', title: 'Donner Verb Square 7-Mode Reverb Pedal with Patch Cables', category: 'pedals', condition: 'good', brand: 'Donner', model: null, estimatedValueMin: 25, estimatedValueMax: 35, estimatedValueRecommended: 30, photos: [] };
    const IMPETO = { id: 'i1', title: 'Impeto Fiber Optic Audio Cable 3.3ft', category: 'cables', condition: 'good', brand: 'Impeto', model: null, estimatedValueMin: 20, estimatedValueMax: 40, estimatedValueRecommended: 30, photos: [] };

    function mockSearchSelect2(rows: unknown[]) {
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(rows) }),
          }),
        }),
      } as never);
    }

    let toolResult: StreamToolResult | null = null;
    vi.mocked(chatStream).mockImplementationOnce(async (_msgs, _sys, _tools, execTool, onEvent) => {
      mockSearchSelect2([DONNER]);           // plural "cables" — 1 hit
      mockSearchSelect2([IMPETO, DONNER]);   // singular "cable" — more hits incl. duplicate
      toolResult = await execTool('search_inventory', { query: 'cables' });
      onEvent({ type: 'done', model: 'm', inputTokens: 1, outputTokens: 1 });
    });

    await request(app)
      .post('/porter/stream')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'What cables do I have?', conversationId: TEST_CONV_ID });

    const items = toolResult!.structured as Array<{ id: string }>;
    const ids = items.map(i => i.id).sort();
    expect(ids).toEqual(['d1', 'i1']); // merged, deduped
  });
});
