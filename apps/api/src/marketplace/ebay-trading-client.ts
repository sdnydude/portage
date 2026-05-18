import { XMLParser } from 'fast-xml-parser';
import sanitizeHtml from 'sanitize-html';
import { env } from '../lib/env.js';
import { createLogger } from '../lib/logger.js';

const logger = createLogger('ebay-trading');

const SANDBOX_URL = 'https://api.sandbox.ebay.com/ws/api.dll';
const PROD_URL = 'https://api.ebay.com/ws/api.dll';

const parser = new XMLParser({ removeNSPrefix: true });

interface ParsedMessage {
  ebayMessageId: string;
  buyerUsername: string;
  itemId: string;
  itemTitle: string | null;
  subject: string;
  body: string;
  direction: 'inbound' | 'outbound';
  messageType: 'asq' | 'rtq' | 'aaq';
  ebayCreatedAt: string;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function stripHtml(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} });
}

function mapMessageType(ebayType: string): 'asq' | 'rtq' | 'aaq' {
  if (ebayType === 'ResponseToASQQuestion') return 'rtq';
  if (ebayType === 'AskSellerQuestion') return 'asq';
  if (ebayType === 'ContactEbayMember' || ebayType === 'ContactTransactionPartner') return 'aaq';
  return 'asq';
}

export async function callTradingApi(
  callName: string,
  xmlBody: string,
  accessToken: string,
): Promise<Record<string, unknown>> {
  const baseUrl = env().EBAY_SANDBOX ? SANDBOX_URL : PROD_URL;

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'X-EBAY-API-IAF-TOKEN': accessToken,
      'X-EBAY-API-CALL-NAME': callName,
      'X-EBAY-API-SITEID': '0',
      'Content-Type': 'text/xml',
    },
    body: xmlBody,
  });

  const text = await response.text();

  if (!response.ok) {
    logger.error({ status: response.status, body: text.slice(0, 500) }, 'Trading API HTTP error');
    throw new Error(`Trading API HTTP ${response.status}`);
  }

  const parsed = parser.parse(text);

  const responseKey = Object.keys(parsed).find(k => k.endsWith('Response'));
  const responseObj = responseKey ? parsed[responseKey] : parsed;

  if (responseObj?.Ack === 'Failure') {
    const errors = responseObj.Errors;
    const shortMsg = errors?.ShortMessage ?? 'Unknown eBay error';
    logger.error({ errors }, 'Trading API returned Failure');
    throw new Error(shortMsg);
  }

  return parsed;
}

function normalizeArray<T>(val: T | T[] | undefined | null): T[] {
  if (val == null) return [];
  return Array.isArray(val) ? val : [val];
}

export function parseGetMemberMessages(parsed: Record<string, unknown>): ParsedMessage[] {
  const resp = (parsed as Record<string, Record<string, unknown>>).GetMemberMessagesResponse;
  if (!resp?.MemberMessage) return [];

  const memberMsg = resp.MemberMessage as Record<string, unknown>;
  const exchanges = normalizeArray(memberMsg.MemberMessageExchange as Record<string, unknown> | Record<string, unknown>[]);

  const results: ParsedMessage[] = [];

  for (const exchange of exchanges) {
    const item = exchange.Item as Record<string, unknown> | undefined;
    const question = exchange.Question as Record<string, unknown> | undefined;
    if (!question) continue;

    const messageId = question.MessageID as string | undefined;
    if (!messageId) continue;

    const ebayType = (question.MessageType as string) ?? 'AskSellerQuestion';
    const isResponse = ebayType === 'ResponseToASQQuestion';

    results.push({
      ebayMessageId: messageId,
      buyerUsername: (question.SenderID as string) ?? '',
      itemId: String(item?.ItemID ?? ''),
      itemTitle: (item?.Title as string) ?? null,
      subject: (question.Subject as string) ?? '',
      body: stripHtml(String(question.Body ?? '')),
      direction: isResponse ? 'inbound' : 'inbound',
      messageType: mapMessageType(ebayType),
      ebayCreatedAt: (question.CreationDate as string) ?? new Date().toISOString(),
    });
  }

  return results;
}

export function parseGetMyMessages(parsed: Record<string, unknown>): ParsedMessage[] {
  const resp = (parsed as Record<string, Record<string, unknown>>).GetMyMessagesResponse;
  if (!resp?.Messages) return [];

  const messagesObj = resp.Messages as Record<string, unknown>;
  const messages = normalizeArray(messagesObj.Message as Record<string, unknown> | Record<string, unknown>[]);

  const results: ParsedMessage[] = [];

  for (const msg of messages) {
    const messageId = msg.MessageID as string | undefined;
    if (!messageId) continue;

    results.push({
      ebayMessageId: messageId,
      buyerUsername: (msg.Sender as string) ?? '',
      itemId: String(msg.ItemID ?? ''),
      itemTitle: null,
      subject: (msg.Subject as string) ?? '',
      body: stripHtml(String(msg.Text ?? msg.Body ?? '')),
      direction: (msg.Folder as string) === 'SentBox' ? 'outbound' : 'inbound',
      messageType: 'aaq',
      ebayCreatedAt: (msg.ReceiveDate as string) ?? new Date().toISOString(),
    });
  }

  return results;
}

export function buildReplyXml(itemId: string, parentMessageId: string, body: string, recipientId: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<AddMemberMessageRTQRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ItemID>${escapeXml(itemId)}</ItemID>
  <MemberMessage>
    <Body>${escapeXml(body)}</Body>
    <ParentMessageID>${escapeXml(parentMessageId)}</ParentMessageID>
    <RecipientID>${escapeXml(recipientId)}</RecipientID>
  </MemberMessage>
</AddMemberMessageRTQRequest>`;
}
