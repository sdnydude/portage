---
id: platform
title: Platform Endpoints
sidebar_position: 15
---

# Platform Endpoints

Small route groups that don't warrant their own page: health, dashboard, usage counters, disclaimer acceptance, design surveys, beta reports, and FAQs.

User preference endpoints (`GET`/`PATCH /users/me/preferences`) are documented on [Authentication](/docs/api/authentication), alongside the other `/users/me` routes.

## Health

### Health Check

```
GET /health
```

**Auth:** None

Liveness probe. Returns statically — it does **not** check the database or any downstream service; a `200` means only that the Express process is up and serving requests.

**Response** `200`:

```json
{
  "status": "ok",
  "timestamp": "2026-07-17T12:00:00.000Z"
}
```

## Dashboard

### Get Dashboard

```
GET /dashboard
```

**Auth:** Required

Home-screen aggregate. Runs six queries in parallel over the caller's data: portfolio value sums over items, the 10 most recent listings (joined to items for title/photo/AI confidence), up to 5 pending shipments (orders in `payment_received` status, joined to items), the user's display name, listing counts grouped by status, and order totals.

**Response** `200`:

```json
{
  "displayName": "John",
  "portfolio": {
    "totalItems": 42,
    "totalValueLow": 3100,
    "totalValueHigh": 4800,
    "totalValueRecommended": 3900
  },
  "recentListings": [
    {
      "id": "uuid",
      "itemId": "uuid",
      "marketplace": "ebay",
      "status": "active",
      "price": 1400,
      "currency": "USD",
      "createdAt": "2026-07-10T...",
      "publishedAt": "2026-07-10T...",
      "itemTitle": "Fender Stratocaster",
      "itemPhotoUrl": "https://...",
      "confidence": 0.87
    }
  ],
  "pendingShipments": [
    {
      "id": "uuid",
      "marketplace": "ebay",
      "buyerUsername": "buyer123",
      "salePrice": 1400,
      "currency": "USD",
      "status": "payment_received",
      "soldAt": "2026-07-12T...",
      "itemTitle": "Fender Stratocaster"
    }
  ],
  "stats": {
    "activeListings": 5,
    "draftListings": 2,
    "soldListings": 8,
    "totalOrders": 8,
    "totalRevenue": 6200
  }
}
```

`itemPhotoUrl` is the item's primary photo (falling back to the first photo, or `null` when the item has none). `confidence` is the item's `aiConfidenceScore` with `null` coerced to `0`. `displayName` falls back to the local part of the user's email, then `"there"`. Portfolio sums are over `estimatedValueMin`/`Max`/`Recommended` and are `0` when the user has no items.

## Usage

### Get Usage Counters

```
GET /usage
```

**Auth:** Required

Current-period AI usage counters against the caller's effective limits. Three meters: AI scans, AI listing preparations (which also carry purchased credits), and background removals.

The **effective tier** is computed per request: a `beta-tester` or `pro` subscription is taken as-is, and a `free` user with an unexpired trial counts as `pro` for the trial's duration. Limits come from the tier's defaults with any admin-set per-user overrides applied on top; a `null` limit means unlimited. See [Billing](/docs/api/billing) for the tier limit values and enforcement.

**Response** `200`:

```json
{
  "aiScans": { "used": 3, "limit": 5 },
  "aiListings": { "used": 1, "limit": 3, "credits": 0 },
  "bgRemovals": { "used": 0, "limit": 3 },
  "tier": "free"
}
```

`tier` is the effective tier (`free` | `pro` | `beta-tester`). Each `limit` is a number or `null` (unlimited).

**Errors:** `404 NOT_FOUND` when the user row is missing.

### Check Background-Removal Allowance

```
POST /usage/bg-removal
```

**Auth:** Required

**Body:** None.

Pre-flight allowance check for the background-removal meter. It **reads** the counter and reports whether another removal is allowed — it does not increment anything (the actual removal endpoint consumes the meter).

**Response** `200`:

```json
{
  "allowed": true,
  "remaining": 3,
  "limit": 3,
  "used": 0
}
```

`allowed` is `true` when the limit is `null` (unlimited) or `used < limit`. `remaining` is `null` for unlimited tiers, otherwise `max(0, limit - used)`.

**Errors:** `404 NOT_FOUND` when the user row is missing.

## Disclaimer

Publish-terms acceptance records for listings. The current version constant lives in `@portage/shared` so the suppression check and acceptance recording always agree on it.

### Get Disclaimer Version

```
GET /disclaimer/version
```

**Auth:** Required

**Response** `200`:

```json
{
  "version": 1,
  "effectiveDate": "2026-04-25"
}
```

### Record Terms Acceptance

```
POST /disclaimer/listings/:id/accept-terms
```

**Auth:** Required (listing owner only)

Records that the user accepted the publish terms for a specific listing, capturing the client IP (first `X-Forwarded-For` hop when proxied, truncated to 45 chars).

**Body:**

```json
{
  "disclaimerVersion": 1
}
```

`disclaimerVersion` is an optional positive integer; when omitted, the current version from `@portage/shared` is recorded.

**Response** `201` — the acceptance record:

```json
{
  "id": "uuid",
  "userId": "uuid",
  "listingId": "uuid",
  "disclaimerVersion": 1,
  "acceptedAt": "2026-07-17T...",
  "ipAddress": "203.0.113.7"
}
```

**Errors:** `404 NOT_FOUND` when the listing doesn't exist or belongs to another user.

## Survey

Design-review survey endpoints. These are **public — no authentication is required** (the router is mounted without `requireAuth`). Instead, the whole group is **rate-limited to 10 requests per minute per IP** (`express-rate-limit`, 60-second window, standard `draft-8` rate-limit headers); exceeding the limit returns `{ "error": "Too many requests, please try again later" }`.

Validation failures on these routes return a bespoke `400` shape — `{ "error": "...", "details": { ... } }` with a Zod-flattened `details` object — rather than the shared `AppError` format.

### Submit Survey Response

```
POST /survey/design-review
```

**Auth:** None (rate-limited)

**Body:**

```json
{
  "preferredDirection": "A",
  "ratingsEaseA": 4,
  "ratingsEaseB": 3,
  "ratingsEaseC": 5,
  "ratingsAppealA": 4,
  "ratingsAppealB": 3,
  "ratingsAppealC": 5,
  "likedMost": "...",
  "concerns": "...",
  "additionalFeedback": "...",
  "detailedResponses": { "question-key": "answer" },
  "respondentName": "Jane",
  "respondentRole": "designer"
}
```

Only `preferredDirection` (one of `A` | `B` | `C`) is required. Ratings are 1–5; the three free-text fields are capped at 2000 chars; `respondentName` max 255, `respondentRole` max 100; `detailedResponses` is a string→string map.

**Response** `201`: `{ "id": "uuid", "message": "Survey response saved" }`

### Submit Review Comment

```
POST /survey/comments
```

**Auth:** None (rate-limited)

**Body:**

```json
{
  "direction": "A",
  "stepNumber": 3,
  "comment": "The pricing step feels cramped on mobile.",
  "reviewerName": "Jane"
}
```

`direction` (max 30 chars) and `comment` (1–5000 chars) are required; `stepNumber` is an optional integer 0–20; `reviewerName` max 255.

**Response** `201`: the created comment row.

### List Comments for a Direction

```
GET /survey/comments/:direction
```

**Auth:** None (rate-limited)

**Response** `200`: array of comment rows for the given direction, newest first.

## Beta

### Submit Beta Report

```
POST /beta/report
```

**Auth:** Required — **and** tier-gated: the caller must have the `beta-tester` tier or the `admin` role (`403 FORBIDDEN` otherwise). The UI hides the form for everyone else, but the gate is enforced server-side.

Proxies the report to the LAN-internal **DHG Registry** (`POST {REGISTRY_URL}/api/beta-reports`, default `http://10.0.0.251:8011`) — the browser can't reach the Registry directly, so the API forwards the report and stamps the reporter's email and user ID server-side. The upstream call has a 10-second timeout. Reports are stored in the Registry, not in the app database.

**Body:**

```json
{
  "page": "/inventory",
  "area": "photo grid",
  "severity": "medium",
  "description": "Reordering photos drops the last one on iOS Safari.",
  "screenshotUrl": "https://..."
}
```

`page` (1–500 chars), `severity` (`low` | `medium` | `high` | `critical`), and `description` (1–10000 chars) are required; `area` (max 100) and `screenshotUrl` (valid URL, max 2000) are optional.

**Response** `201`: the record created by the Registry.

**Errors:** `403 FORBIDDEN` (not a beta tester or admin), `502 REGISTRY_UNAVAILABLE` (Registry unreachable or rejected the report).

## FAQs

### List FAQs

```
GET /faqs
```

**Auth:** Required

Returns published FAQ entries ordered by `sortOrder` ascending. Unpublished entries are excluded.

**Response** `200`:

```json
{
  "faqs": [
    {
      "id": "uuid",
      "question": "How do I connect my eBay account?",
      "answer": "...",
      "sortOrder": 0,
      "published": true,
      "createdAt": "2026-05-01T...",
      "updatedAt": "2026-05-01T..."
    }
  ]
}
```
