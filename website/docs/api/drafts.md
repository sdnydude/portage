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
      "title": "Fender Stratocaster...",
      "price": 1400,
      "lastStepCompleted": "pricing",
      "flowState": { "...": "full listing flow state" },
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

Creates or updates a draft. Pass `id` to update a known draft; otherwise, if a draft already exists for the same item + marketplace combination, it updates rather than creating a duplicate.

**Body:**

```json
{
  "id": "uuid (optional)",
  "itemId": "uuid",
  "marketplace": "ebay",
  "title": "...",
  "price": 1400,
  "lastStepCompleted": "pricing",
  "flowState": { "...": "full listing flow state" }
}
```

### Delete Draft

```
DELETE /drafts/:id
```

**Auth:** Required

### Clean Up Stale Drafts

```
DELETE /drafts
```

**Auth:** Required

Deletes the user's stale drafts — those not updated in the last 30 days. Recent drafts are untouched.

**Response** `200`:

```json
{ "cleaned": true }
```

## Auto-Save Behavior

The `useDrafts` hook on the frontend provides a `debouncedSave` function that delays saves by 2 seconds, preventing excessive API calls during active editing. Drafts capture the current listing flow state including which step the user is on, so they can resume exactly where they left off.
