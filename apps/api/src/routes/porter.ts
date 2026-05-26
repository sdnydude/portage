import { Router } from 'express';
import { z } from 'zod';
import { eq, desc, and, ilike, sql } from 'drizzle-orm';
import multer from 'multer';
import { createLogger } from '../lib/logger.js';
import { db } from '../db/index.js';
import { conversations, items, listings, users } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { chat, chatStream, type ToolDef, type StreamToolResult } from '../lib/ai-client.js';
import { FREE_TIER_LIMITS, PRO_TIER_LIMITS } from '@portage/shared';
import { computeEffectiveTier } from '../lib/billing-utils.js';

const logger = createLogger('porter');

const PORTER_SYSTEM = `You are Porter, an AI assistant for the Portage app — a personal effects inventory and marketplace seller tool.

You help users:
- Understand and manage their inventory
- Get value estimates and pricing suggestions
- Create marketplace listings on eBay and Etsy
- Track orders and sales
- Optimize their selling strategy

Personality: Friendly, knowledgeable about reselling and collectibles, concise. You speak like a helpful friend who knows their way around eBay and Etsy.

When users ask about items, use the search_inventory tool. When they ask about values, use the get_value_estimate tool. When they want to list something, use the suggest_listing tool.

Always be direct and actionable. If you don't know something, say so.`;

const tools: ToolDef[] = [
  {
    name: 'search_inventory',
    description: 'Search the user\'s inventory items by keyword, category, or condition.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query to match against item titles' },
        category: { type: 'string', description: 'Filter by category' },
        condition: { type: 'string', enum: ['new', 'like_new', 'good', 'fair', 'poor'], description: 'Filter by condition' },
      },
      required: [],
    },
  },
  {
    name: 'get_inventory_stats',
    description: 'Get summary statistics about the user\'s inventory: total items, total estimated value, breakdown by category.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'suggest_listing',
    description: 'Generate a marketplace listing suggestion for an inventory item including title, description, and price.',
    parameters: {
      type: 'object',
      properties: {
        itemId: { type: 'string', description: 'The inventory item ID to create a listing for' },
        marketplace: { type: 'string', enum: ['ebay', 'etsy'], description: 'Which marketplace to optimize the listing for' },
      },
      required: ['itemId', 'marketplace'],
    },
  },
];

async function executeToolCall(userId: string, name: string, input: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'search_inventory': {
      const conditions = [eq(items.userId, userId)];
      if (input.query) {
        const escaped = String(input.query).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
        conditions.push(ilike(items.title, `%${escaped}%`));
      }
      if (input.category) conditions.push(eq(items.category, input.category as string));
      if (input.condition) conditions.push(eq(items.condition, input.condition as 'new' | 'like_new' | 'good' | 'fair' | 'poor'));

      const results = await db.select({
        id: items.id,
        title: items.title,
        category: items.category,
        condition: items.condition,
        brand: items.brand,
        model: items.model,
        estimatedValueMin: items.estimatedValueMin,
        estimatedValueMax: items.estimatedValueMax,
        estimatedValueRecommended: items.estimatedValueRecommended,
        photos: items.photos,
      })
        .from(items)
        .where(and(...conditions))
        .orderBy(desc(items.createdAt))
        .limit(10);

      if (results.length === 0) return 'No items found matching your criteria.';
      return JSON.stringify(results);
    }

    case 'get_inventory_stats': {
      const [totalResult] = await db.select({ count: sql<number>`count(*)` })
        .from(items)
        .where(eq(items.userId, userId));

      const [valueResult] = await db.select({
        totalMin: sql<number>`coalesce(sum(estimated_value_min), 0)`,
        totalMax: sql<number>`coalesce(sum(estimated_value_max), 0)`,
        totalRecommended: sql<number>`coalesce(sum(estimated_value_recommended), 0)`,
      })
        .from(items)
        .where(eq(items.userId, userId));

      const categoryBreakdown = await db.select({
        category: items.category,
        count: sql<number>`count(*)`,
      })
        .from(items)
        .where(eq(items.userId, userId))
        .groupBy(items.category)
        .orderBy(desc(sql`count(*)`));

      const activeListings = await db.select({ count: sql<number>`count(*)` })
        .from(listings)
        .where(and(eq(listings.userId, userId), eq(listings.status, 'active')));

      return JSON.stringify({
        totalItems: Number(totalResult.count),
        estimatedValueRange: {
          low: Number(valueResult.totalMin),
          high: Number(valueResult.totalMax),
          recommended: Number(valueResult.totalRecommended),
        },
        categories: categoryBreakdown.map(c => ({ name: c.category || 'Uncategorized', count: Number(c.count) })),
        activeListings: Number(activeListings[0].count),
      });
    }

    case 'suggest_listing': {
      const [item] = await db.select()
        .from(items)
        .where(and(eq(items.id, input.itemId as string), eq(items.userId, userId)))
        .limit(1);

      if (!item) return 'Item not found.';

      const marketplace = input.marketplace as string;
      const price = item.estimatedValueRecommended ?? item.estimatedValueMax ?? 0;

      return JSON.stringify({
        itemId: item.id,
        marketplace,
        suggestedTitle: item.title,
        suggestedDescription: item.description,
        suggestedPrice: price,
        condition: item.condition,
        brand: item.brand,
        model: item.model,
        category: item.category,
      });
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

const messageSchema = z.object({
  message: z.string().min(1).max(4000),
  conversationId: z.string().uuid().nullish(),
});

export const porterRouter = Router();

porterRouter.use(requireAuth);

porterRouter.get('/conversations', async (req, res, next) => {
  try {
    const userId = req.user!.sub;

    const results = await db.select({
      id: conversations.id,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
    })
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.updatedAt))
      .limit(20);

    res.json({ conversations: results });
  } catch (err) {
    next(err);
  }
});

porterRouter.get('/conversations/:id', async (req, res, next) => {
  try {
    const userId = req.user!.sub;

    const [conv] = await db.select()
      .from(conversations)
      .where(and(eq(conversations.id, req.params.id), eq(conversations.userId, userId)))
      .limit(1);

    if (!conv) throw new AppError(404, 'NOT_FOUND', 'Conversation not found');

    res.json(conv);
  } catch (err) {
    next(err);
  }
});

async function executeToolCallStructured(
  userId: string,
  name: string,
  input: Record<string, unknown>,
): Promise<StreamToolResult> {
  const text = await executeToolCall(userId, name, input);
  let structured: unknown;
  try { structured = JSON.parse(text); } catch { structured = undefined; }
  return { text, structured };
}

porterRouter.post('/stream', async (req, res) => {
  const userId = req.user!.sub;
  const { message, conversationId } = messageSchema.parse(req.body);

  // Load user + rate-limit count
  const [porterUser] = await db.select({
    subscriptionTier: users.subscriptionTier,
    trialEndsAt: users.trialEndsAt,
    porterMessagesToday: sql<number>`
      (select coalesce(sum(jsonb_array_length(messages)), 0) from ${conversations}
       where user_id = ${userId}
       and updated_at > now() - interval '1 day'
       and jsonb_typeof(messages) = 'array')
    `,
  }).from(users).where(eq(users.id, userId)).limit(1);

  if (!porterUser) {
    res.status(401).json({ error: 'User not found', code: 'UNAUTHORIZED' });
    return;
  }

  const tier = computeEffectiveTier(porterUser.subscriptionTier, porterUser.trialEndsAt);
  const exchangeLimit = tier === 'pro'
    ? PRO_TIER_LIMITS.porterExchangesPerDay
    : FREE_TIER_LIMITS.porterExchangesPerDay;
  const messageThreshold = exchangeLimit * 2;

  if (Number(porterUser.porterMessagesToday) >= messageThreshold) {
    res.status(429).json({
      error: `Daily limit: ${exchangeLimit} Porter exchanges per day.${tier === 'free' ? ' Upgrade to Pro for more.' : ''}`,
      code: 'PORTER_LIMIT_REACHED',
    });
    return;
  }

  // Load or create conversation
  let conv: { id: string; messages: Array<{ role: string; content: string }> } | undefined;
  if (conversationId) {
    const [existing] = await db.select()
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
      .limit(1);
    if (existing) {
      conv = { id: existing.id, messages: (existing.messages as Array<{ role: string; content: string }>) ?? [] };
    }
  }
  if (!conv) {
    const [newConv] = await db.insert(conversations).values({ userId, messages: [] }).returning();
    conv = { id: newConv.id, messages: [] };
  }

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const writeSSE = (event: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  const chatMessages = [
    ...conv.messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: message },
  ];

  let finalModel = '';
  let inputTokens = 0;
  let outputTokens = 0;
  let accumulatedText = '';

  try {
  await chatStream(
    chatMessages,
    PORTER_SYSTEM,
    tools,
    (name, input) => executeToolCallStructured(userId, name, input),
    (event) => {
      if (event.type === 'text_delta') {
        accumulatedText += event.text;
        writeSSE(event);
      } else if (event.type === 'tool_start' || event.type === 'tool_result') {
        writeSSE(event);
      } else if (event.type === 'done') {
        finalModel = event.model;
        inputTokens = event.inputTokens;
        outputTokens = event.outputTokens;
      }
    },
  );

  // Parse <actions> block from accumulated text and emit pills
  const actionsMatch = accumulatedText.match(/<actions>([\s\S]*?)<\/actions>/i);
  let spokenText = accumulatedText;
  if (actionsMatch) {
    spokenText = accumulatedText.replace(/<actions>[\s\S]*?<\/actions>/i, '').trim();
    try {
      const pills = JSON.parse(actionsMatch[1]);
      if (Array.isArray(pills)) {
        writeSSE({ type: 'action_pills', pills });
      }
    } catch { /* ignore */ }
  }

  // Fire-and-forget TTS: emit audio_url on success, silently ignore on failure
  const ttsBase = process.env.DHG_TTS_URL;
  if (ttsBase && spokenText.trim()) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const ttsRes = await fetch(`${ttsBase}/audio/speech`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: spokenText, model: 'tts-1', voice: 'alloy' }),
          signal: controller.signal,
        });
        if (ttsRes.ok) {
          const data = (await ttsRes.json()) as { url?: string };
          if (typeof data.url === 'string') {
            writeSSE({ type: 'audio_url', url: data.url });
          }
        }
      } finally {
        clearTimeout(timeout);
      }
    } catch { /* silently ignore TTS failures */ }
  }

  // Persist conversation (user message + assistant reply)
  const newMessages = [
    ...conv.messages,
    { role: 'user', content: message },
    { role: 'assistant', content: spokenText },
  ];
  await db.update(conversations)
    .set({ messages: newMessages, updatedAt: new Date() })
    .where(eq(conversations.id, conv.id));

  writeSSE({
    type: 'done',
    conversationId: conv.id,
    model: finalModel,
    inputTokens,
    outputTokens,
  });

  res.end();
  } catch (err) {
    logger.error({ err, userId, conversationId: conv.id }, 'Porter stream failed');
    writeSSE({ type: 'error', message: 'Internal error' });
    res.end();
  }
});

porterRouter.post('/message', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const { message, conversationId } = messageSchema.parse(req.body);

    const [porterUser] = await db.select({
      subscriptionTier: users.subscriptionTier,
      trialEndsAt: users.trialEndsAt,
      porterMessagesToday: sql<number>`
        (select coalesce(sum(jsonb_array_length(messages)), 0) from ${conversations}
         where user_id = ${userId}
         and updated_at > now() - interval '1 day'
         and jsonb_typeof(messages) = 'array')
      `,
    }).from(users).where(eq(users.id, userId)).limit(1);

    if (!porterUser) throw new AppError(401, 'UNAUTHORIZED', 'User not found');

    const tier = computeEffectiveTier(porterUser.subscriptionTier, porterUser.trialEndsAt);
    const exchangeLimit = tier === 'pro'
      ? PRO_TIER_LIMITS.porterExchangesPerDay
      : FREE_TIER_LIMITS.porterExchangesPerDay;
    const messageThreshold = exchangeLimit * 2;

    if (Number(porterUser.porterMessagesToday) >= messageThreshold) {
      throw new AppError(429, 'PORTER_LIMIT_REACHED', `Daily limit: ${exchangeLimit} Porter exchanges per day. ${tier === 'free' ? 'Upgrade to Pro for more.' : ''}`);
    }

    let conv: { id: string; messages: unknown[] } | undefined;

    if (conversationId) {
      const [existing] = await db.select()
        .from(conversations)
        .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
        .limit(1);

      if (existing) {
        conv = { id: existing.id, messages: existing.messages as unknown[] };
      }
    }

    if (!conv) {
      const [newConv] = await db.insert(conversations).values({
        userId,
        messages: [],
      }).returning();
      conv = { id: newConv.id, messages: [] };
    }

    const history = conv.messages as Array<{ role: string; content: string }>;
    history.push({ role: 'user', content: message });

    const chatMessages = history.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const { text: assistantMessage } = await chat(
      chatMessages,
      PORTER_SYSTEM,
      tools,
      (name, input) => executeToolCall(userId, name, input),
    );

    history.push({ role: 'assistant', content: assistantMessage });

    await db.update(conversations)
      .set({ messages: history, updatedAt: new Date() })
      .where(eq(conversations.id, conv.id));

    logger.info({ userId, conversationId: conv.id }, 'Porter message processed');

    res.json({
      conversationId: conv.id,
      message: assistantMessage,
    });
  } catch (err) {
    next(err);
  }
});

const upload = multer({ storage: multer.memoryStorage() });

porterRouter.post('/transcribe', upload.single('audio'), async (req, res, next) => {
  try {
    const sttBase = process.env.DHG_STT_URL ?? 'http://dhg-stt:8000';
    const form = new FormData();
    form.append('file', new Blob([req.file?.buffer ?? Buffer.alloc(0)], { type: req.file?.mimetype ?? 'audio/webm' }), req.file?.originalname ?? 'audio.webm');
    form.append('model', 'whisper-1');
    const response = await fetch(`${sttBase}/v1/audio/transcriptions`, { method: 'POST', body: form });
    const data = await response.json() as { text: string; duration?: number };
    res.json({ text: data.text, duration: data.duration });
  } catch (err) {
    next(err);
  }
});

porterRouter.post('/speak', requireAuth, async (req, res) => {
  const ttsBase = process.env.DHG_TTS_URL ?? 'http://dhg-tts:8000';
  let ttsRes: Response;
  try {
    ttsRes = await fetch(`${ttsBase}/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: (req.body as { text: string }).text, voice: 'alloy', model: 'tts-1' }),
    });
  } catch {
    res.status(503).json({ error: 'TTS unavailable' });
    return;
  }
  if (!ttsRes.ok) { res.status(503).json({ error: 'TTS unavailable' }); return; }
  res.setHeader('Content-Type', ttsRes.headers.get('content-type') ?? 'audio/mpeg');
  res.status(200).end();
});
