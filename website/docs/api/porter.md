---
id: porter
title: Porter
sidebar_position: 9
---

# Porter

Porter is Portage's AI assistant, accessible from the Porter tab. It uses Claude Sonnet in a tool_use loop to help users manage their inventory and create listings. Porter is not a generic chatbot — it has function-calling access to the user's real inventory via three tools (`search_inventory`, `get_inventory_stats`, `suggest_listing`); the client side is documented in [Porter Frontend](/docs/frontend/porter).

## Endpoints

### Stream Message (primary)

```
POST /porter/stream
```

**Auth:** Required

The primary chat endpoint. Streams the response as **Server-Sent Events** (`data: {...}` frames) via Claude Sonnet's `client.messages.stream()`, emitting text deltas, tool-call events, and action pills as they arrive.

**Body:**

```json
{
  "conversationId": "uuid",
  "message": "What's my most valuable item?"
}
```

`conversationId` is optional — omit it (or send `null`) to start a new conversation.

### Send Message (non-streaming fallback)

```
POST /porter/message
```

**Auth:** Required

Same body as `/porter/stream`; returns the complete response in one JSON payload.

**Response** `200`:

```json
{
  "conversationId": "uuid",
  "message": "Your most valuable item is the Fender Stratocaster American Professional II, valued at $1,200-$1,600 with a recommended price of $1,400."
}
```

### List Conversations

```
GET /porter/conversations
```

**Auth:** Required

Returns the user's 20 most recent conversations (id + timestamps).

### Get Conversation History

```
GET /porter/conversations/:id
```

**Auth:** Required

Returns the full message history for a conversation.

## Tools

Porter has access to three tools via Claude's tool_use API:

| Tool | Description | Parameters |
|------|-------------|------------|
| `search_inventory` | Search user's items by keyword, category, or condition | `query?: string`, `category?: string`, `condition?: string` |
| `get_inventory_stats` | Get portfolio summary | — |
| `suggest_listing` | Generate listing for an item | `itemId: string`, `marketplace: "ebay" \| "reverb"` |

The tool_use loop allows Porter to call multiple tools in sequence to answer complex questions like "List my top 5 most valuable items and suggest eBay listings for each."

## Conversation Storage

Conversations persist in the `conversations` table as a JSONB message array. The two write paths use different message formats: `/porter/stream` (the primary endpoint) persists messages in the `blocks: ContentBlock[]` format, while `/porter/message` (the non-streaming fallback) still writes legacy `{ role, content }` messages. Reads normalize both — a legacy message is presented as a single text block — so a conversation can safely contain a mix. The Porter tab shows the current conversation with a "New Chat" button to start fresh.

## Limits

Porter exchanges are billing-gated per day (`porterExchangesPerDay` by effective tier: 5/day free, 500/day Pro, unlimited for beta-tester). Exceeding the limit returns `429 PORTER_LIMIT_REACHED`.

## Suggested Prompts

When the conversation is empty, the UI shows suggested prompts:

- "What's in my inventory?"
- "What should I list next?"
- "How much is my collection worth?"
