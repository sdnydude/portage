import { XMLParser } from 'fast-xml-parser';
import sanitizeHtml from 'sanitize-html';
import type { MessageDirection, EbayMessageType } from '@portage/shared';
import { env } from '../lib/env.js';
import { createLogger } from '../lib/logger.js';
import { EBAY_USER_AGENT } from './ebay-constants.js';

const logger = createLogger('ebay-trading');

const SANDBOX_URL = 'https://api.sandbox.ebay.com/ws/api.dll';
const PROD_URL = 'https://api.ebay.com/ws/api.dll';

// eBay Trading API requires the schema version on every call via this header.
// Omitting it makes eBay reject the call with ErrorCode 10012
// ("Header X-EBAY-API-COMPATIBILITY-LEVEL with value (null) is out of range").
// 1207 is a recent, supported Trading API schema version (eBay's current range is ~1085–1209).
const EBAY_COMPATIBILITY_LEVEL = '1207';

const parser = new XMLParser({ removeNSPrefix: true, ignoreAttributes: false, attributeNamePrefix: '@_' });

interface ParsedMessage {
  ebayMessageId: string;
  buyerUsername: string;
  itemId: string;
  itemTitle: string | null;
  subject: string;
  body: string;
  direction: MessageDirection;
  messageType: EbayMessageType;
  ebayCreatedAt: string;
}

export function escapeXml(str: string): string {
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
  logger.warn({ ebayType }, 'Unknown eBay message type — defaulting to asq');
  return 'asq';
}

/**
 * Trading API Failure with the response's stable ErrorCodes attached (BO-1).
 * Extends Error so every existing message-based catch keeps working.
 */
export class EbayTradingError extends Error {
  constructor(message: string, public readonly errorCodes: number[]) {
    super(message);
    this.name = 'EbayTradingError';
  }
}

export async function callTradingApi(
  callName: string,
  xmlBody: string,
  accessToken: string,
  options?: { throwOnPartialFailure?: boolean },
): Promise<Record<string, unknown>> {
  const baseUrl = env().EBAY_SANDBOX ? SANDBOX_URL : PROD_URL;

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'X-EBAY-API-COMPATIBILITY-LEVEL': EBAY_COMPATIBILITY_LEVEL,
      'X-EBAY-API-IAF-TOKEN': accessToken,
      'X-EBAY-API-CALL-NAME': callName,
      'X-EBAY-API-SITEID': '0',
      'Content-Type': 'text/xml',
      'User-Agent': EBAY_USER_AGENT,
    },
    body: xmlBody,
  });

  const text = await response.text();

  if (!response.ok) {
    logger.error({ status: response.status, body: text.slice(0, 500) }, 'Trading API HTTP error');
    throw new Error(`Trading API HTTP ${response.status}`);
  }

  if (!text.trimStart().startsWith('<')) {
    logger.error({ body: text.slice(0, 500) }, 'Trading API returned non-XML response');
    throw new Error('Trading API returned non-XML response');
  }

  const parsed = parser.parse(text);

  const responseKey = Object.keys(parsed).find(k => k.endsWith('Response'));
  if (!responseKey) {
    logger.error({ body: text.slice(0, 500), keys: Object.keys(parsed) }, 'Trading API returned unexpected XML structure');
    throw new Error('Trading API returned non-XML response');
  }
  const responseObj = parsed[responseKey];

  if (responseObj?.Ack === 'Failure') {
    const errors = responseObj.Errors;
    const errorList = Array.isArray(errors) ? errors : [errors];
    const firstError = errorList[0];
    const shortMsg = firstError?.ShortMessage ?? 'Unknown eBay error';
    logger.error({ errors }, 'Trading API returned Failure');
    // Stable ErrorCodes ride on the thrown error (BO-1) so callers can key
    // typed handling (e.g. Best Offer threshold conflicts) on ids, not prose.
    throw new EbayTradingError(shortMsg, errorList
      .map((e) => Number(e?.ErrorCode))
      .filter((c) => Number.isFinite(c)));
  }

  if (responseObj?.Ack === 'PartialFailure') {
    const errors = responseObj.Errors;
    if (options?.throwOnPartialFailure) {
      const firstError = Array.isArray(errors) ? errors[0] : errors;
      const shortMsg = firstError?.ShortMessage ?? 'Partial failure';
      logger.error({ errors }, 'Trading API returned PartialFailure');
      throw new Error(shortMsg);
    }
    logger.warn({ errors }, 'Trading API returned PartialFailure — continuing with partial data');
  }

  if (responseObj?.Ack === 'Warning') {
    logger.warn({ errors: responseObj.Errors }, 'Trading API returned warning');
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

    let createdAt = question.CreationDate as string | undefined;
    if (!createdAt) {
      logger.warn({ messageId }, 'Missing CreationDate — using current time');
      createdAt = new Date().toISOString();
    }

    results.push({
      ebayMessageId: messageId,
      buyerUsername: (question.SenderID as string) ?? '',
      itemId: String(item?.ItemID ?? ''),
      itemTitle: (item?.Title as string) ?? null,
      subject: (question.Subject as string) ?? '',
      body: stripHtml(String(question.Body ?? '')),
      direction: isResponse ? 'outbound' : 'inbound',
      messageType: mapMessageType(ebayType),
      ebayCreatedAt: createdAt,
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

    let receiveDate = msg.ReceiveDate as string | undefined;
    if (!receiveDate) {
      logger.warn({ messageId }, 'Missing ReceiveDate — using current time');
      receiveDate = new Date().toISOString();
    }

    results.push({
      ebayMessageId: messageId,
      buyerUsername: (msg.Sender as string) ?? '',
      itemId: String(msg.ItemID ?? ''),
      itemTitle: null,
      subject: (msg.Subject as string) ?? '',
      body: stripHtml(String(msg.Text ?? msg.Body ?? '')),
      direction: (msg.Folder as string) === 'SentBox' ? 'outbound' : 'inbound',
      messageType: 'aaq',
      ebayCreatedAt: receiveDate,
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
