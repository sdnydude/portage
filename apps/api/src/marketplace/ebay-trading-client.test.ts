import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('../lib/env.js', () => ({
  env: () => ({
    EBAY_SANDBOX: true,
    EBAY_CLIENT_ID: 'test-client-id',
  }),
}));

import { callTradingApi, parseGetMemberMessages, buildReplyXml } from './ebay-trading-client.js';

function xmlResponse(body: string, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(`<?xml version="1.0" encoding="utf-8"?>${body}`),
  });
}

describe('ebay-trading-client', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('callTradingApi', () => {
    it('sends correct headers for sandbox', async () => {
      mockFetch.mockReturnValue(xmlResponse('<Response><Ack>Success</Ack></Response>'));

      await callTradingApi('GetMemberMessages', '<TestRequest/>', 'test-token-123');

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.sandbox.ebay.com/ws/api.dll');
      expect(options.method).toBe('POST');
      expect(options.headers['X-EBAY-API-IAF-TOKEN']).toBe('test-token-123');
      expect(options.headers['X-EBAY-API-CALL-NAME']).toBe('GetMemberMessages');
      expect(options.headers['X-EBAY-API-SITEID']).toBe('0');
      expect(options.headers['Content-Type']).toBe('text/xml');
    });

    it('returns parsed XML response', async () => {
      mockFetch.mockReturnValue(xmlResponse('<GetMemberMessagesResponse><Ack>Success</Ack><MemberMessage><Subject>Test</Subject></MemberMessage></GetMemberMessagesResponse>'));

      const result = await callTradingApi('GetMemberMessages', '<Req/>', 'token');
      expect((result as Record<string, Record<string, unknown>>).GetMemberMessagesResponse.Ack).toBe('Success');
    });

    it('throws on eBay error response', async () => {
      mockFetch.mockReturnValue(xmlResponse(
        '<GetMemberMessagesResponse><Ack>Failure</Ack><Errors><ShortMessage>Auth token invalid</ShortMessage><LongMessage>The auth token is invalid.</LongMessage><ErrorCode>931</ErrorCode></Errors></GetMemberMessagesResponse>'
      ));

      await expect(callTradingApi('GetMemberMessages', '<Req/>', 'bad-token'))
        .rejects.toThrow('Auth token invalid');
    });

    it('throws on HTTP error', async () => {
      mockFetch.mockReturnValue(xmlResponse('<Error/>', 500));

      await expect(callTradingApi('GetMemberMessages', '<Req/>', 'token'))
        .rejects.toThrow();
    });

    it('throws on non-XML response body', async () => {
      mockFetch.mockReturnValue(Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve('<html><body>Service Unavailable</body></html>'),
      }));

      await expect(callTradingApi('GetMemberMessages', '<Req/>', 'token'))
        .rejects.toThrow('non-XML');
    });

    it('throws on plain text response body', async () => {
      mockFetch.mockReturnValue(Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve('Rate limit exceeded'),
      }));

      await expect(callTradingApi('GetMemberMessages', '<Req/>', 'token'))
        .rejects.toThrow('non-XML');
    });

    it('extracts ShortMessage from Errors array', async () => {
      mockFetch.mockReturnValue(xmlResponse(
        '<GetMemberMessagesResponse><Ack>Failure</Ack><Errors><ShortMessage>First error</ShortMessage></Errors><Errors><ShortMessage>Second error</ShortMessage></Errors></GetMemberMessagesResponse>'
      ));

      await expect(callTradingApi('GetMemberMessages', '<Req/>', 'token'))
        .rejects.toThrow('First error');
    });

    it('throws on PartialFailure when throwOnPartialFailure is true', async () => {
      mockFetch.mockReturnValue(xmlResponse(
        '<AddMemberMessageRTQResponse><Ack>PartialFailure</Ack><Errors><ShortMessage>Partial error</ShortMessage></Errors></AddMemberMessageRTQResponse>'
      ));

      await expect(callTradingApi('AddMemberMessageRTQ', '<Req/>', 'token', { throwOnPartialFailure: true }))
        .rejects.toThrow('Partial error');
    });

    it('does not throw on PartialFailure by default', async () => {
      mockFetch.mockReturnValue(xmlResponse(
        '<GetMemberMessagesResponse><Ack>PartialFailure</Ack><Errors><ShortMessage>Partial error</ShortMessage></Errors><MemberMessage /></GetMemberMessagesResponse>'
      ));

      const result = await callTradingApi('GetMemberMessages', '<Req/>', 'token');
      expect((result as Record<string, Record<string, unknown>>).GetMemberMessagesResponse.Ack).toBe('PartialFailure');
    });
  });

  describe('parseGetMemberMessages', () => {
    it('parses a single member message', () => {
      const xml = {
        GetMemberMessagesResponse: {
          Ack: 'Success',
          MemberMessage: {
            MemberMessageExchange: {
              Item: { ItemID: '123456', Title: 'Vintage Guitar' },
              Question: {
                MessageID: 'msg-001',
                Subject: 'Is this still available?',
                Body: 'Hi, wondering if this guitar is still for sale',
                SenderID: 'buyer42',
                CreationDate: '2026-05-18T10:00:00.000Z',
                MessageType: 'AskSellerQuestion',
              },
            },
          },
        },
      };

      const messages = parseGetMemberMessages(xml);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({
        ebayMessageId: 'msg-001',
        buyerUsername: 'buyer42',
        itemId: '123456',
        itemTitle: 'Vintage Guitar',
        subject: 'Is this still available?',
        body: 'Hi, wondering if this guitar is still for sale',
        direction: 'inbound',
        messageType: 'asq',
      });
    });

    it('parses multiple messages as array', () => {
      const xml = {
        GetMemberMessagesResponse: {
          Ack: 'Success',
          MemberMessage: {
            MemberMessageExchange: [
              {
                Item: { ItemID: '111', Title: 'Item A' },
                Question: {
                  MessageID: 'msg-1',
                  Subject: 'Q1',
                  Body: 'Body 1',
                  SenderID: 'buyerA',
                  CreationDate: '2026-05-18T10:00:00.000Z',
                  MessageType: 'AskSellerQuestion',
                },
              },
              {
                Item: { ItemID: '222', Title: 'Item B' },
                Question: {
                  MessageID: 'msg-2',
                  Subject: 'Q2',
                  Body: 'Body 2',
                  SenderID: 'buyerB',
                  CreationDate: '2026-05-18T11:00:00.000Z',
                  MessageType: 'ResponseToASQQuestion',
                },
              },
            ],
          },
        },
      };

      const messages = parseGetMemberMessages(xml);
      expect(messages).toHaveLength(2);
      expect(messages[0].ebayMessageId).toBe('msg-1');
      expect(messages[0].direction).toBe('inbound');
      expect(messages[1].ebayMessageId).toBe('msg-2');
      expect(messages[1].messageType).toBe('rtq');
      expect(messages[1].direction).toBe('outbound');
    });

    it('returns empty array when no messages', () => {
      const xml = {
        GetMemberMessagesResponse: {
          Ack: 'Success',
        },
      };

      expect(parseGetMemberMessages(xml)).toEqual([]);
    });

    it('skips messages without MessageID', () => {
      const xml = {
        GetMemberMessagesResponse: {
          Ack: 'Success',
          MemberMessage: {
            MemberMessageExchange: {
              Item: { ItemID: '123' },
              Question: {
                Subject: 'No ID',
                Body: 'Missing message ID',
                SenderID: 'buyer',
                CreationDate: '2026-05-18T10:00:00.000Z',
                MessageType: 'AskSellerQuestion',
              },
            },
          },
        },
      };

      expect(parseGetMemberMessages(xml)).toEqual([]);
    });

    it('sanitizes HTML in message body', () => {
      const xml = {
        GetMemberMessagesResponse: {
          Ack: 'Success',
          MemberMessage: {
            MemberMessageExchange: {
              Item: { ItemID: '123', Title: 'Test' },
              Question: {
                MessageID: 'msg-xss',
                Subject: 'Test',
                Body: '<p>Hello</p><script>alert("xss")</script><b>World</b>',
                SenderID: 'buyer',
                CreationDate: '2026-05-18T10:00:00.000Z',
                MessageType: 'AskSellerQuestion',
              },
            },
          },
        },
      };

      const messages = parseGetMemberMessages(xml);
      expect(messages[0].body).toBe('HelloWorld');
      expect(messages[0].body).not.toContain('script');
    });
  });

  describe('buildReplyXml', () => {
    it('builds valid XML for a reply', () => {
      const xml = buildReplyXml('123456', 'msg-001', 'Thanks for asking!', 'buyer42');
      expect(xml).toContain('<ItemID>123456</ItemID>');
      expect(xml).toContain('<Body>Thanks for asking!</Body>');
      expect(xml).toContain('<RecipientID>buyer42</RecipientID>');
      expect(xml).toContain('<ParentMessageID>msg-001</ParentMessageID>');
    });

    it('escapes XML special characters in body', () => {
      const xml = buildReplyXml('123', 'msg-1', 'Price is <$50 & in good shape', 'buyer');
      expect(xml).toContain('&lt;$50');
      expect(xml).toContain('&amp; in good shape');
      expect(xml).not.toContain('<$50');
    });
  });
});
