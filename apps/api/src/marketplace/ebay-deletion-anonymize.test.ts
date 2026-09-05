import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { hashEbayUsername, anonymizeEbayIdentity, findDeletedEbayIdentities, sweepDeletedBuyerRows } from './ebay-deletion-anonymize.js';
import { db } from '../db/index.js';
import { ebayDeletedIdentities, adminAuditLog, marketplaceAccounts, orders, ebayMessages, notifications } from '../db/schema.js';

const ENCRYPTION_KEY = 'k'.repeat(64);

vi.mock('../lib/env.js', () => ({
  env: () => ({ ENCRYPTION_KEY }),
}));

vi.mock('../db/index.js', () => ({
  db: { transaction: vi.fn(), select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

// --- transaction mock -------------------------------------------------------
// Each call to makeTx() builds a fresh Drizzle-shaped tx whose chains resolve
// to the rows you hand it. Every write records its `.set()` / `.values()`.
type Rows = Record<string, unknown>[];
function makeTx(opts: {
  existingIdentity?: Rows;
  deletedAccounts?: Rows;
  updatedOrders?: Rows;
  updatedMessages?: Rows;
  updatedNotifications?: Rows;
} = {}) {
  const inserts: { table: unknown; values: unknown }[] = [];
  const updates: { table: unknown; set: unknown }[] = [];
  const deletes: { table: unknown }[] = [];
  const tx = {
    delete: vi.fn((table: unknown) => {
      deletes.push({ table });
      return { where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue(opts.deletedAccounts ?? []) }) };
    }),
    update: vi.fn((table: unknown) => ({
      set: vi.fn((set: unknown) => {
        updates.push({ table, set });
        const rows = updates.length === 1 ? (opts.updatedOrders ?? [])
          : updates.length === 2 ? (opts.updatedMessages ?? [])
          : (opts.updatedNotifications ?? []);
        return { where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue(rows) }) };
      }),
    })),
    insert: vi.fn((table: unknown) => ({
      values: vi.fn((values: unknown) => {
        inserts.push({ table, values });
        // Identity insert is the idempotency gate: ON CONFLICT DO NOTHING
        // RETURNING yields [] when the identity was already recorded.
        const conflict = (opts.existingIdentity ?? []).length > 0;
        return {
          onConflictDoNothing: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue(conflict ? [] : [{ usernameHash: 'h' }]) }),
          then: undefined,
        };
      }),
    })),
  };
  return { tx, inserts, updates, deletes };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('hashEbayUsername', () => {
  it('is HMAC-SHA256(ENCRYPTION_KEY, username) hex — never the plaintext username eBay asked us to delete', () => {
    const expected = createHmac('sha256', ENCRYPTION_KEY).update('test_user').digest('hex');
    expect(hashEbayUsername('test_user')).toBe(expected);
    expect(hashEbayUsername('test_user')).toHaveLength(64);
    // eBay user IDs are case-insensitive — normalize so a differently-cased
    // buyer_username from the Fulfillment API still matches.
    expect(hashEbayUsername(' Test_User ')).toBe(expected);
  });
});

describe('anonymizeEbayIdentity', () => {
  it("returns 'unknown_user' when nothing matches, still recording the identity hash + an audit row inside one transaction", async () => {
    const { tx, inserts, updates, deletes } = makeTx();
    vi.mocked(db.transaction).mockImplementation(async (fn: any) => fn(tx));

    const result = await anonymizeEbayIdentity({ username: 'ghost_user', userId: 'GHOSTID' }, 'notif-1');

    expect(result).toEqual({ outcome: 'unknown_user', counts: { accounts: 0, orders: 0, messages: 0, notifications: 0 } });
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(deletes).toHaveLength(1); // marketplace_accounts by userId
    expect(updates).toHaveLength(3); // orders, ebay_messages, buyer_message notifications by username
    expect(inserts.map((i) => i.table)).toEqual([ebayDeletedIdentities, adminAuditLog]);
    expect(inserts[0].values).toEqual({ usernameHash: hashEbayUsername('ghost_user'), ebayUserId: 'GHOSTID' });
    expect(inserts[1].values).toMatchObject({
      adminUserId: null,
      action: 'ebay_account_deletion',
      targetType: 'ebay_identity',
      details: { status: 'unknown_user', notificationId: 'notif-1', counts: { accounts: 0, orders: 0, messages: 0, notifications: 0 } },
    });
    // No plaintext PII in the audit row.
    expect(JSON.stringify(inserts[1].values)).not.toContain('ghost_user');
    expect(JSON.stringify(inserts[1].values)).not.toContain('GHOSTID');
  });

  it("returns 'ok' with per-table counts when the identity matches, redacting orders + messages and deleting the seller link", async () => {
    const { tx, updates, deletes } = makeTx({
      deletedAccounts: [{ id: 'acct-1' }],
      updatedOrders: [{ id: 'o1' }, { id: 'o2' }],
      updatedMessages: [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }],
      updatedNotifications: [{ id: 'n1' }],
    });
    vi.mocked(db.transaction).mockImplementation(async (fn: any) => fn(tx));

    const result = await anonymizeEbayIdentity({ username: 'Buyer_One', userId: 'SELLERID' }, 'notif-2');

    expect(result).toEqual({ outcome: 'ok', counts: { accounts: 1, orders: 2, messages: 3, notifications: 1 } });
    // buyer_message notifications ("New message from <username>" + body excerpt) are PII too
    expect(updates[2].table).toBe(notifications);
    expect(updates[2].set).toEqual({ title: 'New message from deleted-ebay-user', body: '[redacted: eBay account deletion]' });
    expect(deletes[0].table).toBe(marketplaceAccounts);
    expect(updates[0].table).toBe(orders);
    expect(updates[0].set).toEqual({ buyerUsername: 'deleted-ebay-user', shippingAddress: { redacted: 'ebay-account-deletion' } });
    expect(updates[1].table).toBe(ebayMessages);
    expect(updates[1].set).toMatchObject({ buyerUsername: 'deleted-ebay-user', subject: '', body: '[redacted: eBay account deletion]' });
    expect((updates[1].set as any).conversationKey).toBeDefined(); // SQL expression, prefix from HMAC — asserted in the next test
  });

  it("returns 'duplicate' when the identity is already recorded (eBay redelivery) but STILL runs the idempotent redaction sweep — catches rows a concurrent sync wrote in the race window", async () => {
    // Redelivery after a sync raced in one live order between guard-check and our commit.
    const { tx, inserts, updates, deletes } = makeTx({ existingIdentity: [{ usernameHash: 'x' }], updatedOrders: [{ id: 'late-1' }] });
    vi.mocked(db.transaction).mockImplementation(async (fn: any) => fn(tx));

    const result = await anonymizeEbayIdentity({ username: 'buyer_one', userId: 'SELLERID' }, 'notif-3');

    expect(result).toEqual({ outcome: 'duplicate', counts: { accounts: 0, orders: 1, messages: 0, notifications: 0 } });
    expect(deletes).toHaveLength(1);
    expect(updates).toHaveLength(3);
    // insert-first gate: the identity insert (conflict → no row) then the audit row
    expect(inserts.map((i) => i.table)).toEqual([ebayDeletedIdentities, adminAuditLog]);
    expect(inserts[1].values).toMatchObject({ details: { status: 'duplicate', notificationId: 'notif-3', counts: { orders: 1 } } });
  });

  it("keys the identity on userId when eBay withholds the username, and returns 'no_identity' (audit only, no transaction) when both are absent", async () => {
    const { tx, inserts, updates } = makeTx({ deletedAccounts: [{ id: 'acct-1' }] });
    vi.mocked(db.transaction).mockImplementation(async (fn: any) => fn(tx));

    const noName = await anonymizeEbayIdentity({ userId: 'ONLYID' }, 'notif-4');
    // 'partial': the seller link is handled, but buyer rows (orders/messages)
    // key on username only — eBay's Fulfillment/Trading APIs never give us a
    // buyer userId, so a username-less notice cannot reach them. Surfaced
    // as its own outcome (counter + audit) rather than reading as 'ok'.
    expect(noName).toEqual({ outcome: 'partial', counts: { accounts: 1, orders: 0, messages: 0, notifications: 0 } });
    expect(updates).toHaveLength(0); // no username ⇒ no order/message updates
    expect(inserts[0].values).toEqual({ usernameHash: hashEbayUsername('userid:ONLYID'), ebayUserId: 'ONLYID' });
    expect(inserts[1].values).toMatchObject({ details: { status: 'partial', buyerRowsUnreachable: true } });

    const auditValues = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.insert).mockReturnValue({ values: auditValues } as any);
    vi.mocked(db.transaction).mockClear();
    const nothing = await anonymizeEbayIdentity({ eiasToken: 'only-eias' }, 'notif-5');
    expect(nothing).toEqual({ outcome: 'no_identity', counts: { accounts: 0, orders: 0, messages: 0, notifications: 0 } });
    expect(db.transaction).not.toHaveBeenCalled();
    expect(auditValues).toHaveBeenCalledWith(expect.objectContaining({ details: expect.objectContaining({ status: 'no_identity', notificationId: 'notif-5' }) }));
  });
});

describe('anonymizeEbayIdentity — failure', () => {
  it('rethrows a transaction failure (so the endpoint 500s and eBay redelivers) after writing a best-effort durable audit row with status failed', async () => {
    vi.mocked(db.transaction).mockRejectedValue(new Error('connection reset'));
    const auditValues = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.insert).mockReturnValue({ values: auditValues } as any);

    await expect(anonymizeEbayIdentity({ username: 'buyer_x', userId: 'UX' }, 'notif-6')).rejects.toThrow('connection reset');
    expect(auditValues).toHaveBeenCalledWith(expect.objectContaining({
      adminUserId: null,
      action: 'ebay_account_deletion',
      details: expect.objectContaining({ status: 'failed', notificationId: 'notif-6', error: 'connection reset' }),
    }));
    expect(JSON.stringify(auditValues.mock.calls[0][0])).not.toContain('buyer_x');
  });
});

describe('findDeletedEbayIdentities', () => {
  it('returns lowercased-username → hash for the usernames whose HMAC is in ebay_deleted_identities (sync-time guard), skipping the query when given nothing', async () => {
    const deletedHash = hashEbayUsername('gone_buyer');
    const where = vi.fn().mockResolvedValue([{ usernameHash: deletedHash }]);
    vi.mocked(db.select).mockReturnValue({ from: vi.fn().mockReturnValue({ where }) } as any);

    const hits = await findDeletedEbayIdentities(['Gone_Buyer', 'active_buyer', ' gone_buyer ']);
    expect(hits).toEqual(new Map([['gone_buyer', deletedHash]]));
    expect(db.select).toHaveBeenCalledTimes(1);

    vi.mocked(db.select).mockClear();
    await expect(findDeletedEbayIdentities([])).resolves.toEqual(new Map());
    expect(db.select).not.toHaveBeenCalled();
  });
});

describe('sweepDeletedBuyerRows', () => {
  it('re-checks a just-synced batch and redacts orders/messages for any username that turns out to be a deleted identity (closes the guard-check → commit race)', async () => {
    const deletedHash = hashEbayUsername('late_buyer');
    const where = vi.fn().mockResolvedValue([{ usernameHash: deletedHash }]);
    vi.mocked(db.select).mockReturnValue({ from: vi.fn().mockReturnValue({ where }) } as any);
    const updates: { table: unknown; set: unknown }[] = [];
    vi.mocked(db.update).mockImplementation(((table: unknown) => ({
      set: vi.fn((set: unknown) => {
        updates.push({ table, set });
        return { where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'r' }]) }) };
      }),
    })) as any);

    const swept = await sweepDeletedBuyerRows(['Late_Buyer', 'fine_buyer']);

    expect(swept).toEqual({ orders: 1, messages: 1, notifications: 1 });
    expect(updates.map((u) => u.table)).toEqual([orders, ebayMessages, notifications]);
    expect(updates[0].set).toEqual({ buyerUsername: 'deleted-ebay-user', shippingAddress: { redacted: 'ebay-account-deletion' } });

    vi.mocked(db.update).mockClear();
    where.mockResolvedValue([]);
    await expect(sweepDeletedBuyerRows(['fine_buyer'])).resolves.toEqual({ orders: 0, messages: 0, notifications: 0 });
    expect(db.update).not.toHaveBeenCalled();
  });
});
