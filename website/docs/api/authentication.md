---
id: authentication
title: Authentication
sidebar_position: 2
---

import ThemedImage from '@theme/ThemedImage';

# Authentication

Portage uses **Cloudflare Access** as its identity provider — there are no passwords, no registration endpoint, and no refresh tokens. Cloudflare authenticates the user at the edge (against an admin-managed allowlist), and the API exchanges the resulting identity assertion for a short-lived internal JWT. Three auth levels exist: public, authenticated, and admin.

<ThemedImage
  alt="Cloudflare Access authentication flow"
  sources={{light: '/portage/img/auth-cf-access-flow.svg', dark: '/portage/img/auth-cf-access-flow-dark.svg'}}
/>

## Endpoints

### Session Exchange

```
GET /auth/session
```

**Auth:** Cloudflare Access (via `Cf-Access-Jwt-Assertion` header)

Verifies the `Cf-Access-Jwt-Assertion` header injected by Cloudflare Access against the team JWKS, then mints a **15-minute internal JWT** the rest of the API consumes. On a user's first login the account is auto-provisioned (the Access allowlist is the signup gate) with a 7-day Pro trial.

**Response** `200`:

```json
{
  "token": "eyJ...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "displayName": "John",
    "subscriptionTier": "free",
    "role": "user",
    "onboardingCompleted": true,
    "trialEndsAt": "2026-07-16T00:00:00Z",
    "aiScansThisMonth": 3,
    "aiListingsThisMonth": 1,
    "aiListingCredits": 0,
    "bgRemovalsThisMonth": 0,
    "createdAt": "2026-05-01T..."
  }
}
```

**Errors:** `401 CF_REQUIRED` (no assertion header), `401 CF_INVALID` (assertion failed JWKS verification), `403 ACCOUNT_DISABLED` (account archived by an admin).

### Get Current User

```
GET /users/me
```

**Auth:** Required

**Response** `200`:

```json
{
  "email": "user@example.com",
  "displayName": "John",
  "subscriptionTier": "free",
  "address": { "street1": "123 Main St", "city": "Portland", "state": "OR", "zip": "97201", "country": "US" },
  "notificationPreferences": { "sale": true, "buyer_message": true },
  "createdAt": "2026-05-01T..."
}
```

### Update Profile

```
PATCH /users/me
```

**Auth:** Required

**Body:**

```json
{
  "displayName": "John Doe",
  "address": {
    "street1": "123 Main St",
    "city": "Portland",
    "state": "OR",
    "zip": "97201",
    "country": "US"
  }
}
```

Accepts `displayName`, `address`, and `notificationPreferences` (at least one field required).

### Complete Onboarding

```
PATCH /users/me/onboarding
```

**Auth:** Required

**Body:** `{ "completed": true }`

### List Marketplace Accounts

```
GET /users/me/marketplace-accounts
```

**Auth:** Required

Returns the user's connected marketplace accounts wrapped in an `accounts` key — `{ "accounts": [ { id, marketplace, marketplaceUserId, tokenExpiresAt, createdAt } ] }`.

### Get Preferences

```
GET /users/me/preferences
```

**Auth:** Required

**Response** `200`:

```json
{
  "listingInterface": "hybrid",
  "listingForkPref": "ask",
  "listingForkCount": 2,
  "listingCompactMode": false,
  "disclaimerSuppressed": false
}
```

`disclaimerSuppressed` is computed — `true` only while the publish-terms suppression window is open and its stored version matches the current disclaimer version.

### Update Preferences

```
PATCH /users/me/preferences
```

**Auth:** Required

**Body** (at least one field required):

```json
{
  "listingInterface": "hybrid",
  "listingForkPref": "ask",
  "listingCompactMode": false
}
```

`listingInterface` is one of `conversational` | `swipe` | `hybrid`; `listingForkPref` is one of `ask` | `list` | `inventory`. Returns the updated preference fields (including the read-only `listingForkCount`).

## Token Lifecycle

1. Cloudflare Access authenticates the user at the edge and forwards `Cf-Access-Jwt-Assertion`
2. The client calls `GET /auth/session` on mount; the API verifies the assertion and mints a **15-minute** internal access token
3. All subsequent API calls send `Authorization: Bearer <token>`
4. On **401 response**, the client re-exchanges via `GET /auth/session` (deduplicated via a promise singleton to prevent parallel exchange storms) and retries the original request
5. There is no refresh token — Cloudflare Access is re-consulted each time the internal JWT expires

## Roles and Tiers

- **Roles:** `user` | `admin`
- **Tiers:** `free` | `pro` | `beta-tester` (beta testers get unlimited AI and Porter limits)

## Auth Middleware

Three middleware functions protect routes:

| Middleware | Requirement |
|-----------|-------------|
| `requireAuth` | Valid internal JWT in Authorization header |
| `requirePro` | Valid JWT + `tier === 'pro'` |
| `requireAdmin` | Valid JWT + `role === 'admin'` |

All middleware uses `next(err)` for error propagation (not synchronous `throw`), ensuring Express error handlers catch auth failures gracefully.

## Admin Promotion

Promote a user to admin via CLI:

```bash
npx tsx apps/api/src/scripts/promote-admin.ts user@example.com
```
