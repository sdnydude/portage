import request from 'supertest';
import { createApp } from '../app.js';
import { createTestToken } from '../test/helpers.js';

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
  },
}));

vi.mock('../marketplace/token-manager.js', () => ({
  getEbayAccessToken: vi.fn(),
}));

vi.mock('../marketplace/ebay-trading-client.js', () => ({
  callTradingApi: vi.fn(),
  parseGetMemberMessages: vi.fn(),
  buildReplyXml: vi.fn(),
}));

import { db } from '../db/index.js';
import { getEbayAccessToken } from '../marketplace/token-manager.js';
import { callTradingApi, parseGetMemberMessages, buildReplyXml } from '../marketplace/ebay-trading-client.js';

let app: ReturnType<typeof createApp>;
let token: string;

describe('messages routes', () => {
  beforeAll(() => {
    app = createApp();
    token = createTestToken();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /messages', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/messages');
      expect(res.status).toBe(401);
    });

    it('returns conversations list', async () => {
      vi.mocked(db.execute).mockResolvedValueOnce([
        {
          conversation_key: 'buyer42:123456',
          buyer_username: 'buyer42',
          item_id: '123456',
          item_title: 'Vintage Guitar',
          last_message_body: 'Is this still available?',
          last_message_at: new Date('2026-05-18T10:00:00Z'),
          unread_count: 2,
          message_count: 5,
        },
      ] as never);

      const res = await request(app)
        .get('/messages')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.conversations).toHaveLength(1);
      expect(res.body.conversations[0].conversationKey).toBe('buyer42:123456');
      expect(res.body.conversations[0].unreadCount).toBe(2);
    });

    it('returns empty array when no conversations', async () => {
      vi.mocked(db.execute).mockResolvedValueOnce([] as never);

      const res = await request(app)
        .get('/messages')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.conversations).toEqual([]);
    });
  });

  describe('GET /messages/unread-count', () => {
    it('returns unread count', async () => {
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 3 }]),
        }),
      } as any);

      const res = await request(app)
        .get('/messages/unread-count')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(3);
    });
  });

  describe('GET /messages/:conversationKey', () => {
    it('returns messages for a conversation', async () => {
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([
              {
                id: 'msg-uuid-1',
                ebayMessageId: 'msg-001',
                conversationKey: 'buyer42:123456',
                buyerUsername: 'buyer42',
                itemId: '123456',
                itemTitle: 'Vintage Guitar',
                subject: 'Is this available?',
                body: 'Still for sale?',
                direction: 'inbound',
                messageType: 'asq',
                readAt: null,
                ebayCreatedAt: new Date('2026-05-18T10:00:00Z'),
                createdAt: new Date('2026-05-18T10:00:00Z'),
                updatedAt: new Date('2026-05-18T10:00:00Z'),
              },
            ]),
          }),
        }),
      } as any);

      // Mock the mark-read update
      vi.mocked(db.update).mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const res = await request(app)
        .get('/messages/buyer42:123456')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.messages).toHaveLength(1);
      expect(res.body.messages[0].direction).toBe('inbound');
    });
  });

  describe('POST /messages/:conversationKey/reply', () => {
    it('returns 400 with empty body', async () => {
      const res = await request(app)
        .post('/messages/buyer42:123456/reply')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('sends reply via Trading API and stores locally', async () => {
      // Mock: get first message of conversation to find itemId and parentMessageId
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  ebayMessageId: 'msg-001',
                  itemId: '123456',
                  buyerUsername: 'buyer42',
                  itemTitle: 'Vintage Guitar',
                  conversationKey: 'buyer42:123456',
                },
              ]),
            }),
          }),
        }),
      } as any);

      vi.mocked(getEbayAccessToken).mockResolvedValue('mock-token');
      vi.mocked(buildReplyXml).mockReturnValue('<xml/>');
      vi.mocked(callTradingApi).mockResolvedValue({
        AddMemberMessageRTQResponse: { Ack: 'Success' },
      });

      // Mock: insert the outbound message
      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: 'new-uuid',
            ebayMessageId: 'reply-001',
            direction: 'outbound',
            body: 'Yes it is!',
            createdAt: new Date(),
          }]),
        }),
      } as any);

      const res = await request(app)
        .post('/messages/buyer42:123456/reply')
        .set('Authorization', `Bearer ${token}`)
        .send({ body: 'Yes it is!' });

      expect(res.status).toBe(201);
      expect(vi.mocked(callTradingApi)).toHaveBeenCalledOnce();
      expect(vi.mocked(buildReplyXml)).toHaveBeenCalledWith('123456', 'msg-001', 'Yes it is!', 'buyer42');
    });
  });

  describe('POST /messages/sync', () => {
    it('returns 400 when no eBay account', async () => {
      vi.mocked(getEbayAccessToken).mockRejectedValue(new Error('No eBay account connected'));

      const res = await request(app)
        .post('/messages/sync')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('eBay');
    });

    it('syncs messages from eBay', async () => {
      vi.mocked(getEbayAccessToken).mockResolvedValue('mock-token');
      vi.mocked(callTradingApi).mockResolvedValue({ GetMemberMessagesResponse: { Ack: 'Success' } });
      vi.mocked(parseGetMemberMessages).mockReturnValue([
        {
          ebayMessageId: 'msg-new-1',
          buyerUsername: 'buyer42',
          itemId: '123456',
          itemTitle: 'Guitar',
          subject: 'Question',
          body: 'Hello',
          direction: 'inbound',
          messageType: 'asq',
          ebayCreatedAt: '2026-05-18T10:00:00Z',
        },
      ]);

      // Mock: upsert (insert with onConflictDoNothing)
      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 'uuid-1', ebayMessageId: 'msg-new-1' }]),
          }),
        }),
      } as any);

      // Mock: get user prefs for notification gate
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ notificationPreferences: { buyer_message: true } }]),
          }),
        }),
      } as any);

      // Mock: insert notification
      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockResolvedValue([]),
      } as any);

      const res = await request(app)
        .post('/messages/sync')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.synced).toBe(1);
      expect(vi.mocked(callTradingApi)).toHaveBeenCalled();
    });
  });
});
