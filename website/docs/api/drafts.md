---
id: drafts
title: Drafts
sidebar_position: 6
---

# Drafts

Auto-saved listing drafts that persist across sessions. The listing flow auto-saves every 2 seconds.

## Endpoints

### List Drafts

```
GET /drafts
```

**Auth:** Required

**Response** `200`:

```json
{
  "drafts": [
    {
      "id": "uuid",
      "itemId": "uuid",
      "marketplace": "ebay",
      "data": {
        "title": "Fender Stratocaster...",
        "description": "...",
        "price": 1400,
        "step": "pricing"
      },
      "updatedAt": "2026-05-10T..."
    }
  ]
}
```

### Get Draft

```
GET /drafts/:id
```

**Auth:** Required

### Save Draft

```
POST /drafts
```

**Auth:** Required

Creates or updates a draft. If a draft already exists for the same item + marketplace combination, it updates rather than creating a duplicate.

**Body:**

```json
{
  "itemId": "uuid",
  "marketplace": "ebay",
  "data": {
    "title": "...",
    "description": "...",
    "price": 1400,
    "step": "pricing"
  }
}
```

### Delete Draft

```
DELETE /drafts/:id
```

**Auth:** Required

## Auto-Save Behavior

The `useDrafts` hook on the frontend provides a `debouncedSave` function that delays saves by 2 seconds, preventing excessive API calls during active editing. Drafts capture the current listing flow state including which step the user is on, so they can resume exactly where they left off.
