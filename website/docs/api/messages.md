---
id: messages
title: Messages
sidebar_position: 12
---

# Messages

eBay buyer messaging: locally synced copies of eBay member messages, grouped into conversations, with reply support via the Trading API. Buyer questions often relate to open [Orders](/docs/api/orders); the conversation list and thread UI pages are described in [App Structure](/docs/frontend/app-structure).

All endpoints require auth.

**Conversation keying:** messages are grouped by a `conversationKey` of the form `buyerUsername:itemId` (eBay item ID). Path parameters are validated against `^[a-zA-Z0-9._-]+:[0-9]+$` — a malformed key returns `400 INVALID_INPUT`.

## Endpoints

### List Conversations

```
GET /messages
```

**Auth:** Required

Returns one row per conversation, newest activity first.

**Response** `200`:

```json
{
  "conversations": [
    {
      "conversationKey": "guitar_fan_88:307034606520",
      "buyerUsername": "guitar_fan_88",
      "itemId": "307034606520",
      "itemTitle": "Fender Stratocaster American Professional II",
      "lastMessageBody": "Is the case included?",
      "lastMessageAt": "2026-07-16T...",
      "unreadCount": 1,
      "messageCount": 4
    }
  ]
}
```

`unreadCount` counts inbound messages that have not been read-marked. `lastMessageBody` is the body of the conversation's most recent message in either direction.

### Unread Count

```
GET /messages/unread-count
```

**Auth:** Required

Total unread inbound messages across all conversations (for the nav badge).

**Response** `200`: `{ "count": 3 }`

### Get Conversation Thread

```
GET /messages/:conversationKey
```

**Auth:** Required (owner only)

Returns every message in the conversation, oldest first (ordered by `ebayCreatedAt`).

**Read-marking side effect:** fetching a thread stamps `readAt` on all of its unread inbound messages, so a thread GET immediately zeroes that conversation's `unreadCount`.

**Response** `200`:

```json
{
  "messages": [
    {
      "id": "uuid",
      "userId": "uuid",
      "ebayMessageId": "123456789",
      "conversationKey": "guitar_fan_88:307034606520",
      "buyerUsername": "guitar_fan_88",
      "itemId": "307034606520",
      "itemTitle": "Fender Stratocaster American Professional II",
      "subject": "Details about item",
      "body": "Is the case included?",
      "direction": "inbound",
      "messageType": "asq",
      "readAt": null,
      "ebayCreatedAt": "2026-07-16T...",
      "createdAt": "2026-07-16T...",
      "updatedAt": "2026-07-16T..."
    }
  ]
}
```

`direction` is `inbound` or `outbound`. `messageType` is `asq` (Ask Seller Question), `rtq` (Response to Question), or `aaq` (member/transaction-partner contact). A well-formed key with no matching messages returns `{ "messages": [] }` — not a 404.

### Sync Messages

```
POST /messages/sync
```

**Auth:** Required

Pulls member messages from eBay via Trading API **`GetMemberMessages`** (`MailMessageType: All`) and stores them locally. Each call fetches a single page of up to 100 messages; hitting the page limit is logged as a warning (older messages may not be synced). No route-level rate limiting is applied.

Behavior per fetched message:

- Deduplicated on `ebayMessageId` (`ON CONFLICT DO NOTHING`) — re-syncing never duplicates.
- Conversation key derived as `buyerUsername:itemId`.
- Each newly inserted **inbound** message creates a `buyer_message` notification, unless the user's notification preferences set `buyer_message: false`. A failed notification insert is logged; the message still syncs.
- A single message failing to insert is logged and skipped; the sync continues.

**Response** `200`:

```json
{ "synced": 2, "total": 47 }
```

`total` is the number of messages eBay returned; `synced` counts newly inserted inbound messages.

Errors: `400 EBAY_TOKEN_ERROR` when the user's eBay account can't be authenticated (reconnect in Settings → Marketplace).

### Reply to Conversation

```
POST /messages/:conversationKey/reply
```

**Auth:** Required (owner only)

Sends a reply to the buyer through eBay and stores the outbound copy locally.

**Body:**

```json
{ "body": "Yes, the original hard case is included." }
```

`body` is required, 1–2000 characters.

Behavior:

- The reply references the conversation's most recent **inbound** message; if none exists, it falls back to the most recent non-reply message. No reference message → `404 NOT_FOUND`.
- Sends via Trading API **`AddMemberMessageRTQ`** (reply-to-question), addressed to the buyer with the referenced message's item and message IDs. An eBay `PartialFailure` is treated as an error — nothing is stored unless eBay accepts the send.
- The outbound copy is stored with a synthetic `ebayMessageId` (`reply-<uuid>`), `direction: "outbound"`, `messageType: "rtq"`, and a `Re:`-prefixed subject (repeated `Re:` prefixes are collapsed).

**Response** `201`:

```json
{ "message": { "id": "uuid", "direction": "outbound", "messageType": "rtq", "body": "Yes, the original hard case is included.", "...": "..." } }
```

Errors: `400 INVALID_INPUT` (malformed key or body), `400 EBAY_TOKEN_ERROR`, `404 NOT_FOUND`. A Trading API send failure surfaces as `500 INTERNAL_ERROR`.

## Error Codes

| Status | Code | When |
|--------|------|------|
| `400` | `INVALID_INPUT` | Malformed conversation key, or reply body missing/too long |
| `400` | `EBAY_TOKEN_ERROR` | eBay access token could not be obtained (sync, reply) |
| `401` | `UNAUTHORIZED` | Missing or invalid JWT |
| `404` | `NOT_FOUND` | Reply target conversation has no reference message |
| `500` | `INTERNAL_ERROR` | eBay Trading API call failed |
