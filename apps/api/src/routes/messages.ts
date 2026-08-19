import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { sql, eq, and, isNull, not, like, count, desc, asc } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { ebayMessages, users, notifications } from '../db/schema.js';
import { AppError } from '../middleware/error.js';
import { createLogger } from '../lib/logger.js';
import { getEbayAccessToken } from '../marketplace/token-manager.js';
import { callTradingApi, parseGetMemberMessages, buildReplyXml } from '../marketplace/ebay-trading-client.js';
import {
  EBAY_DELETED_MARKER,
  EBAY_REDACTED_BODY,
  findDeletedEbayIdentities,
  redactedConversationKey,
  sweepDeletedBuyerRows,
} from '../marketplace/ebay-deletion-anonymize.js';

const logger = createLogger('messages');

export const messagesRouter = Router();

messagesRouter.use(requireAuth);

messagesRouter.get('/', async (req, res, next) => {
  try {
    const userId = req.user!.sub;

    const conversations = await db.execute(sql`
      SELECT
        conversation_key,
        buyer_username,
        item_id,
        MAX(item_title) AS item_title,
        (SELECT body FROM ebay_messages m2
         WHERE m2.conversation_key = m1.conversation_key AND m2.user_id = ${userId}
         ORDER BY ebay_created_at DESC LIMIT 1) AS last_message_body,
        MAX(ebay_created_at) AS last_message_at,
        COUNT(*) FILTER (WHERE direction = 'inbound' AND read_at IS NULL) AS unread_count,
        COUNT(*) AS message_count
      FROM ebay_messages m1
      WHERE user_id = ${userId}
      GROUP BY conversation_key, buyer_username, item_id
      ORDER BY MAX(ebay_created_at) DESC
    `);

    res.json({
      conversations: (conversations as Record<string, unknown>[]).map(c => ({
        conversationKey: c.conversation_key,
        buyerUsername: c.buyer_username,
        itemId: c.item_id,
        itemTitle: c.item_title,
        lastMessageBody: c.last_message_body,
        lastMessageAt: c.last_message_at,
        unreadCount: Number(c.unread_count),
        messageCount: Number(c.message_count),
      })),
    });
  } catch (err) {
    next(err);
  }
});

messagesRouter.get('/unread-count', async (req, res, next) => {
  try {
    const userId = req.user!.sub;

    const [result] = await db.select({ count: count() })
      .from(ebayMessages)
      .where(and(
        eq(ebayMessages.userId, userId),
        eq(ebayMessages.direction, 'inbound'),
        isNull(ebayMessages.readAt),
      ));

    res.json({ count: result?.count ?? 0 });
  } catch (err) {
    next(err);
  }
});

messagesRouter.get('/:conversationKey', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const { conversationKey } = req.params;
    const keyResult = conversationKeySchema.safeParse(conversationKey);
    if (!keyResult.success) {
      throw new AppError(400, 'INVALID_INPUT', 'Invalid conversation key format');
    }

    const messages = await db.select()
      .from(ebayMessages)
      .where(and(
        eq(ebayMessages.userId, userId),
        eq(ebayMessages.conversationKey, conversationKey),
      ))
      .orderBy(asc(ebayMessages.ebayCreatedAt));

    await db.update(ebayMessages)
      .set({ readAt: new Date() })
      .where(and(
        eq(ebayMessages.userId, userId),
        eq(ebayMessages.conversationKey, conversationKey),
        eq(ebayMessages.direction, 'inbound'),
        isNull(ebayMessages.readAt),
      ));

    res.json({ messages });
  } catch (err) {
    next(err);
  }
});

// itemId may be empty: general (non-item) buyer messages sync with
// `itemId: ''` (ebay-trading-client parseMemberMessages), producing keys
// like "buyer:" — a digits-required regex 400s every such thread.
const conversationKeySchema = z.string().regex(/^[a-zA-Z0-9._-]+:[0-9]*$/, 'Invalid conversation key format');

const replySchema = z.object({
  body: z.string().min(1).max(2000),
});

messagesRouter.post('/sync', async (req, res, next) => {
  try {
    const userId = req.user!.sub;

    let accessToken: string;
    try {
      accessToken = await getEbayAccessToken(userId);
    } catch (err) {
      logger.error({ err, userId }, 'Failed to get eBay access token for sync');
      throw new AppError(400, 'EBAY_TOKEN_ERROR', 'Could not authenticate with eBay. Try reconnecting your account in Settings > Marketplace.');
    }

    const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<GetMemberMessagesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <MailMessageType>All</MailMessageType>
  <Pagination>
    <EntriesPerPage>100</EntriesPerPage>
    <PageNumber>1</PageNumber>
  </Pagination>
</GetMemberMessagesRequest>`;

    const response = await callTradingApi('GetMemberMessages', xmlBody, accessToken);
    const parsed = parseGetMemberMessages(response);

    if (parsed.length === 100) {
      logger.warn({ userId, count: parsed.length }, 'Sync hit page limit — older messages may not be synced');
    }

    const [user] = await db.select({ notificationPreferences: users.notificationPreferences })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const prefs = user?.notificationPreferences as Record<string, boolean> | null;

    let synced = 0;

    // eBay Marketplace Account Deletion: buyers we already anonymized must
    // not be re-imported with live PII from GetMemberMessages.
    // Fail-closed: if the guard itself cannot be evaluated, do not import
    // anything (a bypass could re-write deleted PII); the distinct log line
    // separates "guard broken" from ordinary eBay/API sync failures.
    let deletedBuyers: Map<string, string>;
    try {
      deletedBuyers = await findDeletedEbayIdentities(parsed.map((m) => m.buyerUsername));
    } catch (err) {
      logger.error({ userId, err }, 'ebay_deleted_identities guard failed — message sync aborted (fail-closed, compliance)');
      throw err;
    }

    for (const msg of parsed) {
      try {
        const deletedHash = deletedBuyers.get(msg.buyerUsername.trim().toLowerCase());
        const convKey = deletedHash
          ? redactedConversationKey(deletedHash, msg.itemId)
          : `${msg.buyerUsername}:${msg.itemId}`;
        const [inserted] = await db.insert(ebayMessages).values({
          userId,
          ebayMessageId: msg.ebayMessageId,
          conversationKey: convKey,
          buyerUsername: deletedHash ? EBAY_DELETED_MARKER : msg.buyerUsername,
          itemId: msg.itemId,
          itemTitle: msg.itemTitle,
          subject: deletedHash ? '' : msg.subject,
          body: deletedHash ? EBAY_REDACTED_BODY : msg.body,
          direction: msg.direction,
          messageType: msg.messageType,
          ebayCreatedAt: new Date(msg.ebayCreatedAt),
        }).onConflictDoNothing({ target: ebayMessages.ebayMessageId }).returning();

        if (inserted && msg.direction === 'inbound') {
          synced++;

          // No notification for a deleted buyer — its title/body would carry
          // the PII the deletion notice told us to drop.
          if (prefs?.buyer_message !== false && !deletedHash) {
            try {
              await db.insert(notifications).values({
                userId,
                type: 'buyer_message',
                title: `New message from ${msg.buyerUsername}`,
                body: (msg.body ?? '').substring(0, 200),
              });
            } catch (notifErr) {
              logger.error({ err: notifErr, messageId: msg.ebayMessageId }, 'Failed to insert notification — message still synced');
            }
          }
        }
      } catch (msgErr) {
        logger.error({ err: msgErr, messageId: msg.ebayMessageId }, 'Failed to sync message — skipping');
      }
    }

    // Post-write sweep: a deletion notice can commit between the guard check
    // above and our inserts; re-check the batch and redact anything that slipped.
    await sweepDeletedBuyerRows(parsed.map((m) => m.buyerUsername));

    logger.info({ userId, synced, total: parsed.length }, 'Message sync complete');
    res.json({ synced, total: parsed.length });
  } catch (err) {
    next(err);
  }
});

messagesRouter.post('/:conversationKey/reply', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const { conversationKey } = req.params;
    const keyResult = conversationKeySchema.safeParse(conversationKey);
    if (!keyResult.success) {
      throw new AppError(400, 'INVALID_INPUT', 'Invalid conversation key format');
    }
    const parsed = replySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'INVALID_INPUT', parsed.error.issues.map(i => i.message).join('; '));
    }

    const refFields = {
      ebayMessageId: ebayMessages.ebayMessageId,
      itemId: ebayMessages.itemId,
      buyerUsername: ebayMessages.buyerUsername,
      itemTitle: ebayMessages.itemTitle,
      conversationKey: ebayMessages.conversationKey,
      subject: ebayMessages.subject,
    };

    let [ref] = await db.select(refFields)
      .from(ebayMessages)
      .where(and(
        eq(ebayMessages.userId, userId),
        eq(ebayMessages.conversationKey, conversationKey),
        eq(ebayMessages.direction, 'inbound'),
      ))
      .orderBy(desc(ebayMessages.ebayCreatedAt))
      .limit(1);

    if (!ref) {
      [ref] = await db.select(refFields)
        .from(ebayMessages)
        .where(and(
          eq(ebayMessages.userId, userId),
          eq(ebayMessages.conversationKey, conversationKey),
          not(like(ebayMessages.ebayMessageId, 'reply-%')),
        ))
        .orderBy(desc(ebayMessages.ebayCreatedAt))
        .limit(1);
    }

    if (!ref) {
      throw new AppError(404, 'NOT_FOUND', 'Conversation not found');
    }

    let accessToken: string;
    try {
      accessToken = await getEbayAccessToken(userId);
    } catch (err) {
      logger.error({ err, userId }, 'Failed to get eBay access token for reply');
      throw new AppError(400, 'EBAY_TOKEN_ERROR', 'Could not authenticate with eBay. Try reconnecting your account in Settings > Marketplace.');
    }

    const xmlBody = buildReplyXml(ref.itemId, ref.ebayMessageId, parsed.data.body, ref.buyerUsername);
    await callTradingApi('AddMemberMessageRTQ', xmlBody, accessToken, { throwOnPartialFailure: true });

    const replyId = `reply-${randomUUID()}`;
    const [saved] = await db.insert(ebayMessages).values({
      userId,
      ebayMessageId: replyId,
      conversationKey,
      buyerUsername: ref.buyerUsername,
      itemId: ref.itemId,
      itemTitle: ref.itemTitle,
      subject: ref.subject ? `Re: ${ref.subject.replace(/^(Re:\s*)+/i, '')}` : '',
      body: parsed.data.body,
      direction: 'outbound',
      messageType: 'rtq',
      ebayCreatedAt: new Date(),
    }).returning();

    res.status(201).json({ message: saved });
  } catch (err) {
    next(err);
  }
});
