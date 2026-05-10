---
id: porter
title: Porter
sidebar_position: 9
---

# Porter

Porter is Portage's AI assistant, accessible from the Porter tab. It uses Claude Sonnet in a tool_use loop to help users manage their inventory and create listings.

## Endpoints

### Send Message

```
POST /porter/message
```

**Auth:** Required

**Body:**

```json
{
  "conversationId": "uuid",
  "message": "What's my most valuable item?"
}
```

`conversationId` is optional — omit it (or send `null`) to start a new conversation.

**Response** `200`:

```json
{
  "conversationId": "uuid",
  "response": "Your most valuable item is the Fender Stratocaster American Professional II, valued at $1,200-$1,600 with a median of $1,400.",
  "toolCalls": [
    {
      "tool": "get_inventory_stats",
      "result": { "totalItems": 42, "totalValueMedian": 15600 }
    }
  ]
}
```

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
| `search_inventory` | Search user's items by keyword | `query: string` |
| `get_inventory_stats` | Get portfolio summary | — |
| `suggest_listing` | Generate listing for an item | `itemId: string` |

The tool_use loop allows Porter to call multiple tools in sequence to answer complex questions like "List my top 5 most valuable items and suggest eBay listings for each."

## Conversation Storage

Conversations persist in the `conversations` table, allowing users to reference past interactions. The Porter tab shows the current conversation with a "New Chat" button to start fresh.

## Suggested Prompts

When the conversation is empty, the UI shows suggested prompts:

- "What's in my inventory?"
- "What should I list next?"
- "How much is my collection worth?"
