import { Router } from 'express';
import { z } from 'zod';
import { eq, desc, and, ilike, sql } from 'drizzle-orm';
import { createLogger } from '../lib/logger.js';
import { db } from '../db/index.js';
import { conversations, items, listings, users } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { chat, chatStream, type ToolDef, type StreamToolResult } from '../lib/ai-client.js';
import { traceRequest, traceTool } from '../lib/tracing.js';
import { collectToolTitles, validateGrounding } from '../lib/porter-grounding.js';
import { limitsForTier } from '@portage/shared';
import { computeEffectiveTier, effectiveLimits } from '../lib/billing-utils.js';

const logger = createLogger('porter');

export const PORTER_SYSTEM = `You are Porter, an AI assistant for the Portage app — a personal effects inventory and marketplace seller tool.

You help users:
- Understand and manage their inventory
- Get value estimates and pricing suggestions
- Create marketplace listings on eBay and Reverb
- Track orders and sales
- Optimize their selling strategy

Personality: Friendly, knowledgeable about reselling and collectibles, concise. You speak like a helpful friend who knows their way around eBay and Reverb.

When users ask about items, use the search_inventory tool. When they ask about inventory totals or stats, use the get_inventory_stats tool. When they want to list something, use the suggest_listing tool.

Always be direct and actionable. If you don't know something, say so.

Never begin a response with "Thank you", "Thanks for", "Great question", or similar acknowledgments. Start with the answer.

## Answering inventory searches

The tool result is the ONLY source of truth about what the user owns. List exactly the items it returned — never add an item that is not in the result, never invent a name, and never copy one item's values onto another. If the result has 2 items, your answer has 2 items.

When search_inventory returns items, LIST them — one line per item: name, condition, estimated value. Nothing else. Do not analyze the results, do not comment on price spreads or discrepancies, do not group them into sections with headers, and do not add observations or recommendations the user did not ask for. If more than 8 items match, list the first 8 and say how many more there are. If nothing matches, say so in one sentence.

## Action Pills

At the end of your response, when there are 2-4 natural follow-up actions the user might want, append an <actions> block with a JSON array of pills. Each pill has a "label" (short button text) and a "message" (what to send when tapped).

Examples:
- After showing inventory: <actions>[{"label":"List an item","message":"help me list my Gibson Les Paul"},{"label":"Check values","message":"what are my most valuable items?"}]</actions>
- After a sale: <actions>[{"label":"Print label","message":"print shipping label for order 1234"},{"label":"Mark shipped","message":"mark order 1234 as shipped"}]</actions>
- When no clear next action, omit the <actions> block entirely.`;

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
        marketplace: { type: 'string', enum: ['ebay', 'reverb'], description: 'Which marketplace to optimize the listing for' },
      },
      required: ['itemId', 'marketplace'],
    },
  },
];

async function executeToolCall(userId: string, name: string, input: Record<string, unknown>): Promise<string> {
  // Both the streaming and non-streaming routes funnel through here, so one
  // wrapper gives every Porter tool call its own `tool` observation.
  return traceTool(name, input, () => runToolCall(userId, name, input));
}

async function runToolCall(userId: string, name: string, input: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'search_inventory': {
      const runSearch = async (query: string | undefined) => {
        const conditions = [eq(items.userId, userId)];
        if (query) {
          const escaped = query.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
          conditions.push(ilike(items.title, `%${escaped}%`));
        }
        if (input.category) conditions.push(eq(items.category, input.category as string));
        if (input.condition) conditions.push(eq(items.condition, input.condition as 'new' | 'like_new' | 'good' | 'fair' | 'poor'));

        return db.select({
          id: items.id,
          title: items.title,
          category: items.category,
          condition: items.condition,
          brand: items.brand,
          model: items.model,
          estimatedValueMin: items.estimatedValueMin,
          estimatedValueMax: items.estimatedValueMax,
          estimatedValueRecommended: items.estimatedValueRecommended,
        })
          .from(items)
          .where(and(...conditions))
          .orderBy(desc(items.createdAt))
          .limit(10);
      };

      const query = input.query ? String(input.query) : undefined;
      let results = await runSearch(query);
      // Recall fix (2026-08-11): ILIKE '%cables%' misses "…Cable 3.3ft" — a
      // plural query also runs as singular and the result sets merge unique
      // (live incident: "cables" matched 1 of the user's 10 cable items).
      if (query && /s$/i.test(query.trim())) {
        const singular = await runSearch(query.trim().replace(/s$/i, ''));
        const seen = new Set(results.map(r => r.id));
        results = [...results, ...singular.filter(r => !seen.has(r.id))].slice(0, 10);
      }

      if (results.length === 0) return 'No items found matching your criteria.';
      // Photo URLs are model-facing noise (live 08-12: granite4.1 misread photo
      // arrays as duplicate listings); the web client never renders tool results.
      return JSON.stringify(
        results.map(({ photos: _photos, ...rest }: (typeof results)[number] & { photos?: unknown }) => rest),
      );
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
      const itemId = input.itemId as string;
      let item: typeof items.$inferSelect | undefined;

      try {
        const [found] = await db.select().from(items)
          .where(and(eq(items.id, itemId), eq(items.userId, userId)))
          .limit(1);
        item = found;
      } catch {
        // UUID type error (Claude passed a slug) — fall through to title search
      }

      if (!item) {
        const [found] = await db.select().from(items)
          .where(and(ilike(items.title, `%${itemId.replace(/[-_]/g, ' ')}%`), eq(items.userId, userId)))
          .limit(1);
        item = found;
      }

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

type StoredMessage = { role: string; content?: string; blocks?: Array<{ type: string; text?: string }> };

export function normalizeConversationMessages(
  messages: unknown[]
): Array<{ role: string; blocks: Array<{ type: string; text: string }> }> {
  return (messages as StoredMessage[]).map((m) => {
    if (m.blocks) return { role: m.role, blocks: m.blocks as Array<{ type: string; text: string }> };
    return { role: m.role, blocks: [{ type: 'text', text: m.content ?? '' }] };
  });
}

// First user message text, truncated — a scannable preview for the Porter
// conversation-history list (Phase R3). Reuses the normalizer so it handles
// both persisted message shapes ({role,content} and {role,blocks}).
export function conversationPreview(messages: unknown[], maxLen = 80): string {
  const normalized = normalizeConversationMessages(messages);
  const firstUser = normalized.find((m) => m.role === 'user');
  const text = (firstUser?.blocks ?? [])
    .map((b) => b.text)
    .join(' ')
    .trim();
  return text.length > maxLen ? `${text.slice(0, maxLen).trimEnd()}…` : text;
}

export function parseActionPills(text: string): { pills: Array<{ label: string; message: string }>; cleanText: string } {
  const match = text.match(/<actions>([\s\S]*?)<\/actions>/i);
  if (!match) return { pills: [], cleanText: text };
  try {
    const raw = JSON.parse(match[1]) as unknown[];
    const pills = (Array.isArray(raw) ? raw : []).filter(
      (p): p is { label: string; message: string } =>
        typeof p === 'object' && p !== null &&
        typeof (p as Record<string, unknown>).label === 'string' &&
        typeof (p as Record<string, unknown>).message === 'string' &&
        ((p as { label: string }).label).length <= 50 &&
        ((p as { message: string }).message).length <= 500,
    );
    const cleanText = text.replace(/<actions>[\s\S]*?<\/actions>/i, '');
    return { pills, cleanText };
  } catch {
    return { pills: [], cleanText: text };
  }
}

export const porterRouter = Router();

porterRouter.use(requireAuth);

porterRouter.get('/conversations', async (req, res, next) => {
  try {
    const userId = req.user!.sub;

    const results = await db.select({
      id: conversations.id,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
      messages: conversations.messages,
    })
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.updatedAt))
      .limit(20);

    // Derive a scannable preview; don't ship the full message payload in the list.
    res.json({
      conversations: results.map((c) => ({
        id: c.id,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        preview: conversationPreview((c.messages as unknown[]) ?? []),
      })),
    });
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

porterRouter.post('/stream', async (req, res, next) => {
  const userId = req.user!.sub;
  let sseStarted = false;
  const writeSSE = (event: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
    const { message, conversationId } = messageSchema.parse(req.body);

    // Load user + rate-limit count
    const [porterUser] = await db.select({
      subscriptionTier: users.subscriptionTier,
      trialEndsAt: users.trialEndsAt,
      limitOverrides: users.limitOverrides,
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
    const exchangeLimit = effectiveLimits(tier, porterUser.limitOverrides).porterExchangesPerDay;
    // null = unlimited (beta testers)
    const messageThreshold = exchangeLimit === null ? null : exchangeLimit * 2;

    if (messageThreshold !== null && Number(porterUser.porterMessagesToday) >= messageThreshold) {
      res.status(429).json({
        error: `Daily limit: ${exchangeLimit} Porter exchanges per day.${tier === 'free' ? ' Upgrade to Pro for more.' : ''}`,
        code: 'PORTER_LIMIT_REACHED',
      });
      return;
    }

    type NormalizedMessage = { role: string; blocks: Array<{ type: string; text: string }> };
    // Load or create conversation
    let conv: { id: string; messages: NormalizedMessage[] } | undefined;
    if (conversationId) {
      const [existing] = await db.select()
        .from(conversations)
        .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
        .limit(1);
      if (existing) {
        const normalized = normalizeConversationMessages((existing.messages as unknown[]) ?? []);
        conv = { id: existing.id, messages: normalized };
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
    sseStarted = true;

    // Text-only rebuild is intentional: tool blocks are not persisted (only cleanText is saved).
    // If tool blocks are ever persisted, update this to build a proper multi-block content array.
    const chatMessages = [
      ...conv.messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.blocks.filter(b => b.type === 'text').map(b => b.text).join(''),
      })),
      { role: 'user' as const, content: message },
    ];

    let finalModel = '';
    let inputTokens = 0;
    let outputTokens = 0;
    let accumulatedText = '';
    let pills: ReturnType<typeof parseActionPills>['pills'] = [];

    // One trace per turn, grouped into a session by conversation id — the
    // Sessions view then replays the whole conversation in order.
    const finalText = await traceRequest(
      'porter-chat-turn',
      {
        userId,
        sessionId: conv.id,
        tags: ['porter', 'stream'],
        metadata: { tier, turn: String(conv.messages.length / 2 + 1) },
        input: message,
      },
      async () => {
        // Grounding (Phase 3a, buffer-after-first-tool): text streams live
        // until any tool runs; after that, deltas buffer server-side so an
        // ungrounded reply can be discarded and retried (attempt 2 = same
        // chain, attempt 3 = force gemini). chatStream cannot fail over
        // mid-stream, so retries are orchestrated here. After 3 failed
        // attempts the last reply is flushed anyway (degrade, logged).
        const MAX_ATTEMPTS = 3;
        // Cost cap (advisor A6): retries multiply LLM + tool-loop calls, so a
        // turn stops retrying once this much wall-clock has elapsed and serves
        // the best reply it has (degrade, logged).
        const RETRY_TIME_BUDGET_MS = 45_000;
        const turnStart = Date.now();
        // Titles from the last attempt that ran tools — a retry that skips the
        // tool call is validated against these instead of escaping grounding
        // (per-attempt replace, not union: an accepted reply must ground
        // against its own tool truth, or the freshest one available).
        let turnTitles: string[] = [];
        // Text actually written to the client so far (attempt 1's live frames)
        // — preserved if a later retry hard-fails (advisor A7).
        let sentLiveText = '';
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          let attemptText = '';
          let toolsRan = false;
          const bufferedPre: string[] = [];
          const bufferedPost: string[] = [];
          const toolTitles: string[] = [];

          try {
          await chatStream(
            chatMessages,
            PORTER_SYSTEM,
            tools,
            async (name, input) => {
              const result = await executeToolCallStructured(userId, name, input);
              collectToolTitles(name, result.text, toolTitles);
              return result;
            },
            (event) => {
              // Attempt 1 streams live until the first tool; retries stay fully
              // silent (text buffered, tool frames suppressed) so the client
              // never sees duplicate preamble or tool chips. Attempt 1's live
              // pre-tool text can't be retracted — a retry's accepted text may
              // repeat it; the persisted conversation keeps only the accepted
              // attempt's text.
              if (event.type === 'text_delta') {
                attemptText += event.text;
                if (attempt === 1 && !toolsRan) {
                  sentLiveText += event.text;
                  writeSSE(event);
                } else {
                  (toolsRan ? bufferedPost : bufferedPre).push(event.text);
                }
              } else if (event.type === 'tool_start') {
                toolsRan = true;
                if (attempt === 1) writeSSE(event);
              } else if (event.type === 'tool_result') {
                if (attempt === 1) writeSSE(event);
              } else if (event.type === 'done') {
                finalModel = event.model;
                // Accumulate across grounding attempts — discarded attempts
                // still consumed tokens and belong in the turn's usage.
                inputTokens += event.inputTokens;
                outputTokens += event.outputTokens;
              }
            },
            { purpose: 'porter-chat', ...(attempt === MAX_ATTEMPTS ? { forceProvider: 'gemini' } : {}) },
          );
          } catch (streamErr) {
            const isEmptyReply = (streamErr as Error).message?.startsWith('Empty chat response');
            if (isEmptyReply && attempt < MAX_ATTEMPTS && Date.now() - turnStart < RETRY_TIME_BUDGET_MS) {
              // Blank streamed reply (3a.1 class): retry like a grounding miss.
              logger.warn({ userId, attempt }, 'Porter stream got an empty reply, retrying');
              continue;
            }
            if (sentLiveText) {
              // The user already saw attempt 1's live text — keep the turn and
              // persist what was shown instead of erroring the whole stream.
              logger.error({ userId, attempt, error: (streamErr as Error).message }, 'Porter stream retry hard-failed after live text — degrading to shown text');
              accumulatedText = sentLiveText;
              break;
            }
            throw streamErr;
          }

          if (toolsRan) turnTitles = toolTitles;
          try {
            validateGrounding(attemptText, toolsRan ? toolTitles : turnTitles);
          } catch (vErr) {
            const withinBudget = Date.now() - turnStart < RETRY_TIME_BUDGET_MS;
            if (attempt < MAX_ATTEMPTS && withinBudget) {
              // Log the discarded draft — a thrown-away reply is otherwise
              // unrecoverable for forensics (2026-08-11 false-positive incident).
              logger.warn({ userId, attempt, error: (vErr as Error).message, discardedDraft: attemptText.slice(0, 500) }, 'Porter stream reply failed grounding, retrying');
              continue;
            }
            logger.error({ userId, attempt, withinBudget, error: (vErr as Error).message }, 'Porter stream grounding exhausted — flushing ungrounded reply');
          }

          // Retry attempts drop their pre-tool preamble from the flush —
          // attempt 1 already streamed its own live (A4 dedupe). A no-tool
          // retry has only "pre-tool" text, which IS the answer: flush it all.
          const toFlush = toolsRan ? bufferedPost : [...bufferedPre, ...bufferedPost];
          for (const text of toFlush) writeSSE({ type: 'text_delta', text });
          accumulatedText = attemptText;
          break;
        }

        const parsed = parseActionPills(accumulatedText);
        pills = parsed.pills;
        return parsed.cleanText.trim();
      },
      // Tool-calling loop → 'agent' observation (Agent Graph + agent analytics).
      { asType: 'agent' },
    );

    if (pills.length > 0) writeSSE({ type: 'action_pills', pills });

    // Persist conversation using new blocks format
    const newMessages: NormalizedMessage[] = [
      ...conv.messages,
      { role: 'user', blocks: [{ type: 'text', text: message }] },
      { role: 'assistant', blocks: [{ type: 'text', text: finalText }] },
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
    if (!sseStarted) {
      next(err);
    } else {
      logger.error({ err, userId }, 'Porter stream failed');
      writeSSE({ type: 'error', message: 'Internal error' });
      res.end();
    }
  }
});

porterRouter.post('/message', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const { message, conversationId } = messageSchema.parse(req.body);

    const [porterUser] = await db.select({
      subscriptionTier: users.subscriptionTier,
      trialEndsAt: users.trialEndsAt,
      limitOverrides: users.limitOverrides,
      porterMessagesToday: sql<number>`
        (select coalesce(sum(jsonb_array_length(messages)), 0) from ${conversations}
         where user_id = ${userId}
         and updated_at > now() - interval '1 day'
         and jsonb_typeof(messages) = 'array')
      `,
    }).from(users).where(eq(users.id, userId)).limit(1);

    if (!porterUser) throw new AppError(401, 'UNAUTHORIZED', 'User not found');

    const tier = computeEffectiveTier(porterUser.subscriptionTier, porterUser.trialEndsAt);
    const exchangeLimit = effectiveLimits(tier, porterUser.limitOverrides).porterExchangesPerDay;
    // null = unlimited (beta testers)
    const messageThreshold = exchangeLimit === null ? null : exchangeLimit * 2;

    if (messageThreshold !== null && Number(porterUser.porterMessagesToday) >= messageThreshold) {
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

    const assistantMessage = await traceRequest(
      'porter-chat-turn',
      {
        userId,
        sessionId: conv.id,
        tags: ['porter', 'non-streaming'],
        metadata: { tier },
        input: message,
      },
      async () => {
        // Grounding (Phase 3a): collect item titles from tool results; the
        // validate hook rejects replies naming items outside them, which makes
        // ai-client retry the provider once, then fail over down the chain.
        // After 3 rejections the hook degrades to a no-op so exhaustion serves
        // the last reply (logged) instead of a 500 — mirrors the stream path.
        const toolTitles: string[] = [];
        let lastToolTitles: string[] = [];
        let groundingFailures = 0;
        // Cost cap (advisor A6): same wall-clock budget as the stream path.
        const RETRY_TIME_BUDGET_MS = 45_000;
        const turnStart = Date.now();
        const { text } = await chat(
          chatMessages,
          PORTER_SYSTEM,
          tools,
          async (name, input) => {
            const result = await executeToolCall(userId, name, input);
            collectToolTitles(name, result, toolTitles);
            return result;
          },
          {
            validate: (reply) => {
              // Per-call scoping: titles gathered since the previous validate
              // belong to the call under validation; a retry that skipped
              // tools falls back to the freshest tool truth instead of
              // escaping grounding. Never a union across attempts.
              if (toolTitles.length > 0) lastToolTitles = toolTitles.splice(0);
              if (groundingFailures >= 3) return;
              if (Date.now() - turnStart >= RETRY_TIME_BUDGET_MS) {
                logger.error({ userId }, 'Porter message grounding budget exhausted — accepting reply');
                return;
              }
              try {
                validateGrounding(reply, lastToolTitles);
              } catch (err) {
                groundingFailures++;
                logger.warn({ userId, groundingFailures, error: (err as Error).message, discardedDraft: reply.slice(0, 500) }, 'Porter message reply failed grounding');
                if (groundingFailures >= 3) {
                  logger.error({ userId, error: (err as Error).message }, 'Porter message grounding exhausted — accepting next reply');
                }
                throw err;
              }
            },
            purpose: 'porter-chat',
          },
        );
        return text;
      },
      // Tool-calling loop → 'agent' observation (Agent Graph + agent analytics).
      { asType: 'agent' },
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
