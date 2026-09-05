/**
 * eBay Marketplace Account Deletion — anonymize everything we hold about an
 * eBay identity (seller who linked their account, or buyer we transacted /
 * messaged with), and remember the identity by HMAC so later syncs cannot
 * re-populate it.
 */
import { createHmac } from 'node:crypto';
import { env } from '../lib/env.js';
import { db } from '../db/index.js';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { adminAuditLog, ebayDeletedIdentities, ebayMessages, marketplaceAccounts, notifications, orders } from '../db/schema.js';
import { createLogger } from '../lib/logger.js';

const logger = createLogger('ebay-deletion-anonymize');

/** Redaction marker. No brackets: conversation keys must match /^[a-zA-Z0-9._-]+:[0-9]*$/. */
export const EBAY_DELETED_MARKER = 'deleted-ebay-user';
export const EBAY_REDACTED_ADDRESS = { redacted: 'ebay-account-deletion' } as const;
export const EBAY_REDACTED_BODY = '[redacted: eBay account deletion]';

/**
 * HMAC-SHA256(ENCRYPTION_KEY, username) hex. Keyed (not bare sha256) so short
 * usernames cannot be reversed from a rainbow table; lowercased+trimmed because
 * eBay user IDs are case-insensitive.
 */
export function hashEbayUsername(username: string): string {
  return createHmac('sha256', env().ENCRYPTION_KEY)
    .update(username.trim().toLowerCase())
    .digest('hex');
}

export interface EbayDeletionData {
  username?: string;
  userId?: string;
  eiasToken?: string;
}

export type AnonymizeOutcome = 'ok' | 'partial' | 'unknown_user' | 'duplicate' | 'no_identity';
export interface AnonymizeCounts { accounts: number; orders: number; messages: number; notifications: number }
export interface AnonymizeResult { outcome: AnonymizeOutcome; counts: AnonymizeCounts }

type DbExecutor = Pick<typeof db, 'update'>;

/**
 * Redact every order + message row keyed by this buyer username. Idempotent
 * (second run matches zero rows). Shared by the notification transaction and
 * the post-sync sweep.
 */
/** Title format used by messages.ts when it creates a buyer_message notification. */
export function buyerMessageNotificationTitle(username: string): string {
  return `New message from ${username}`;
}

async function redactBuyerRows(exec: DbExecutor, username: string, identityHash: string): Promise<{ orders: number; messages: number; notifications: number }> {
  const lowered = username.trim().toLowerCase();
  const updatedOrders = await exec.update(orders)
    .set({ buyerUsername: EBAY_DELETED_MARKER, shippingAddress: EBAY_REDACTED_ADDRESS })
    .where(and(eq(orders.marketplace, 'ebay'), sql`lower(${orders.buyerUsername}) = ${lowered}`))
    .returning({ id: orders.id });

  // Conversation key keeps threads distinct per deleted buyer via a short
  // HMAC prefix (no plaintext, not reversible), preserving item grouping.
  const keyPrefix = redactedConversationKey(identityHash, '');
  const updatedMessages = await exec.update(ebayMessages)
    .set({
      buyerUsername: EBAY_DELETED_MARKER,
      conversationKey: sql`${keyPrefix} || ${ebayMessages.itemId}`,
      subject: '',
      body: EBAY_REDACTED_BODY,
      updatedAt: new Date(),
    })
    .where(sql`lower(${ebayMessages.buyerUsername}) = ${lowered}`)
    .returning({ id: ebayMessages.id });

  // buyer_message notifications carry the username in the title and a body
  // excerpt; they have no reference id, so match our own deterministic title.
  const updatedNotifications = await exec.update(notifications)
    .set({ title: buyerMessageNotificationTitle(EBAY_DELETED_MARKER), body: EBAY_REDACTED_BODY })
    .where(and(eq(notifications.type, 'buyer_message'), sql`lower(${notifications.title}) = ${buyerMessageNotificationTitle(lowered).toLowerCase()}`))
    .returning({ id: notifications.id });
  return { orders: updatedOrders.length, messages: updatedMessages.length, notifications: updatedNotifications.length };
}

/**
 * Post-sync sweep: order/message sync checks the deleted-identity table BEFORE
 * writing, but a deletion notification can commit between that check and the
 * insert. Re-check the batch AFTER writing and redact anything that slipped in.
 */
export async function sweepDeletedBuyerRows(usernames: string[]): Promise<{ orders: number; messages: number; notifications: number }> {
  const hits = await findDeletedEbayIdentities(usernames);
  const totals = { orders: 0, messages: 0, notifications: 0 };
  for (const [username, hash] of hits) {
    const r = await redactBuyerRows(db, username, hash);
    totals.orders += r.orders;
    totals.messages += r.messages;
    totals.notifications += r.notifications;
  }
  if (totals.orders + totals.messages + totals.notifications > 0) {
    logger.warn({ ...totals, identities: hits.size }, 'post-sync sweep redacted rows written for already-deleted eBay identities (guard/commit race)');
  }
  return totals;
}

/**
 * Sync-time guard: which of these buyer usernames belong to identities we have
 * already anonymized? Returns lowercased username → identity hash. Order and
 * message imports consult this so a re-sync cannot write a deleted buyer's
 * PII back into the DB.
 */
export async function findDeletedEbayIdentities(usernames: string[]): Promise<Map<string, string>> {
  const lowered = [...new Set(usernames.map((u) => u.trim().toLowerCase()).filter(Boolean))];
  if (lowered.length === 0) return new Map();
  const hashToUser = new Map(lowered.map((u) => [hashEbayUsername(u), u] as const));
  const rows = await db.select({ usernameHash: ebayDeletedIdentities.usernameHash })
    .from(ebayDeletedIdentities)
    .where(inArray(ebayDeletedIdentities.usernameHash, [...hashToUser.keys()]));
  const hits = new Map<string, string>();
  for (const row of rows) {
    const user = hashToUser.get(row.usernameHash);
    if (user) hits.set(user, row.usernameHash);
  }
  return hits;
}

/** Conversation key for a redacted buyer thread — stable per identity, no plaintext. */
export function redactedConversationKey(identityHash: string, itemId: string): string {
  return `${EBAY_DELETED_MARKER}-${identityHash.slice(0, 8)}:${itemId}`;
}

/**
 * Identity key for ebay_deleted_identities: HMAC of the username when eBay
 * sent one, else of the immutable userId (eBay withholds usernames for some
 * U.S. users and returns the userId in its place). Null when neither exists
 * (eiasToken-only — nothing in our schema keys on it).
 */
// Priority is username-first ON PURPOSE (spec text said userId-first): the
// sync-time guard (findDeletedEbayIdentities) can only hash usernames — that
// is all the buyer APIs return — so the stored key must be the username hash
// whenever a username exists, or the guard could never match it.
function identityHash(username: string | undefined, userId: string | undefined): string | null {
  if (username) return hashEbayUsername(username);
  if (userId) return hashEbayUsername(`userid:${userId}`);
  return null;
}

/**
 * Anonymize one eBay identity across marketplace_accounts (seller link +
 * tokens: deleted), orders (buyer username + shipping address: redacted),
 * ebay_messages (buyer username, conversation key, subject, body: redacted).
 * All writes + the identity record + the audit row commit in ONE transaction;
 * any failure rolls back and rethrows so the endpoint answers 500 and eBay
 * redelivers.
 */
export async function anonymizeEbayIdentity(data: EbayDeletionData, notificationId: string): Promise<AnonymizeResult> {
  const username = data.username?.trim() || undefined;
  const userId = data.userId?.trim() || undefined;
  const hash = identityHash(username, userId);

  if (!hash) {
    const counts = { accounts: 0, orders: 0, messages: 0, notifications: 0 };
    await db.insert(adminAuditLog).values({
      adminUserId: null,
      action: 'ebay_account_deletion',
      targetType: 'ebay_identity',
      targetId: null,
      details: { status: 'no_identity', notificationId, identityHash: null, counts },
    });
    return { outcome: 'no_identity', counts };
  }

  try {
    return await runAnonymization(username, userId, hash, notificationId);
  } catch (err) {
    // The transaction rolled back, so nothing durable records that an attempt
    // happened. Write a best-effort 'failed' audit row OUTSIDE the transaction
    // (compliance clock is 30 days; logs may not last that long), then rethrow
    // so the endpoint answers 500 and eBay redelivers.
    logger.error({ notificationId, identityHash: hash, err }, 'eBay deletion anonymization failed — transaction rolled back');
    try {
      await db.insert(adminAuditLog).values({
        adminUserId: null,
        action: 'ebay_account_deletion',
        targetType: 'ebay_identity',
        targetId: null,
        details: { status: 'failed', notificationId, identityHash: hash, error: (err as Error).message },
      });
    } catch (auditErr) {
      logger.error({ notificationId, err: auditErr }, 'eBay deletion: could not write failed-attempt audit row either');
    }
    throw err;
  }
}

async function runAnonymization(
  username: string | undefined,
  userId: string | undefined,
  hash: string,
  notificationId: string,
): Promise<AnonymizeResult> {
  return db.transaction(async (tx) => {
    const counts = { accounts: 0, orders: 0, messages: 0, notifications: 0 };

    // Idempotency gate, insert-first: the identity row's PK is the lock. Under
    // READ COMMITTED a concurrent redelivery blocks on the unique index until
    // this tx commits, then its own insert conflicts → [] → 'duplicate'. (A
    // SELECT-then-INSERT gate would let two redeliveries both pass the read.)
    const claimed = await tx.insert(ebayDeletedIdentities)
      .values({ usernameHash: hash, ebayUserId: userId ?? null })
      .onConflictDoNothing()
      .returning({ usernameHash: ebayDeletedIdentities.usernameHash });
    // Redelivery ⇒ 'duplicate' outcome, but the redaction writes below still
    // run: they are idempotent, and they catch any row a sync wrote for this
    // identity between its guard check and our first commit (TOCTOU window).
    const duplicate = claimed.length === 0;

    if (userId) {
      const deleted = await tx.delete(marketplaceAccounts)
        .where(and(eq(marketplaceAccounts.marketplace, 'ebay'), eq(marketplaceAccounts.marketplaceUserId, userId)))
        .returning({ id: marketplaceAccounts.id });
      counts.accounts = deleted.length;
    }
    if (username) {
      const redacted = await redactBuyerRows(tx, username, hash);
      counts.orders = redacted.orders;
      counts.messages = redacted.messages;
      counts.notifications = redacted.notifications;
    }
    // Buyer rows (orders, ebay_messages) key on username only — eBay's
    // Fulfillment and Trading APIs give us buyer usernames, never a buyer
    // userId — so a username-less notice cannot reach them. Report that as
    // its own outcome instead of letting it read as 'ok'/'unknown_user'.
    const buyerRowsUnreachable = !username;
    const outcome: AnonymizeOutcome = duplicate
      ? 'duplicate'
      : buyerRowsUnreachable
        ? 'partial'
        : counts.accounts + counts.orders + counts.messages + counts.notifications > 0 ? 'ok' : 'unknown_user';
    if (buyerRowsUnreachable) {
      logger.warn({ notificationId, identityHash: hash, counts }, 'eBay deletion notice carried no username — buyer order/message rows cannot be correlated (userId not stored by eBay buyer APIs)');
    }
    await tx.insert(adminAuditLog).values({
      adminUserId: null,
      action: 'ebay_account_deletion',
      targetType: 'ebay_identity',
      targetId: null,
      details: { status: outcome, notificationId, identityHash: hash, counts, ...(buyerRowsUnreachable ? { buyerRowsUnreachable: true } : {}) },
    });
    return { outcome, counts };
  });
}
