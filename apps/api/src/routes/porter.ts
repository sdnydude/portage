import { Router } from 'express';
import { z } from 'zod';
import { eq, desc, and, ilike, sql } from 'drizzle-orm';
import { pino } from 'pino';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db/index.js';
import { conversations, items, listings, users } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { env } from '../lib/env.js';
import { FREE_TIER_LIMITS } from '@portage/shared';

const logger = pino({ name: 'porter' });

function getClient(): Anthropic {
  const config = env();
  if (!config.ANTHROPIC_API_KEY) {
    throw new AppError(503, 'AI_NOT_CONFIGURED', 'AI assistant is not configured');
  }
  return new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
}

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

const tools: Anthropic.Tool[] = [
  {
    name: 'search_inventory',
    description: 'Search the user\'s inventory items by keyword, category, or condition.',
    input_schema: {
      type: 'object' as const,
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
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'suggest_listing',
    description: 'Generate a marketplace listing suggestion for an inventory item including title, description, and price.',
    input_schema: {
      type: 'object' as const,
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
      if (input.query) conditions.push(ilike(items.title, `%${input.query}%`));
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
  conversationId: z.string().uuid().optional(),
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

porterRouter.post('/message', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const tier = req.user!.tier;
    const { message, conversationId } = messageSchema.parse(req.body);

    if (tier === 'free') {
      const [user] = await db.select({
        porterMessagesToday: sql<number>`
          (select count(*) from ${conversations}
           where user_id = ${userId}
           and updated_at > now() - interval '1 day')
        `,
      }).from(users).where(eq(users.id, userId)).limit(1);

      if (user && Number(user.porterMessagesToday) >= FREE_TIER_LIMITS.porterMessagesPerDay) {
        throw new AppError(429, 'PORTER_LIMIT_REACHED', `Free tier limit: ${FREE_TIER_LIMITS.porterMessagesPerDay} Porter messages per day.`);
      }
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

    const anthropicMessages = history.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const client = getClient();

    let response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: PORTER_SYSTEM,
      tools,
      messages: anthropicMessages,
    });

    while (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
      );

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const toolUse of toolUseBlocks) {
        const result = await executeToolCall(userId, toolUse.name, toolUse.input as Record<string, unknown>);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: result,
        });
      }

      anthropicMessages.push({ role: 'assistant', content: response.content as unknown as string });
      anthropicMessages.push({ role: 'user', content: toolResults as unknown as string });

      response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: PORTER_SYSTEM,
        tools,
        messages: anthropicMessages,
      });
    }

    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === 'text',
    );
    const assistantMessage = textBlocks.map(b => b.text).join('\n');

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
