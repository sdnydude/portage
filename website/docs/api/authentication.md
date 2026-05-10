---
id: authentication
title: Authentication
sidebar_position: 2
---

# Authentication

Portage uses JWT access/refresh tokens with bcrypt password hashing. Three auth levels exist: public, authenticated, and admin.

## Endpoints

### Register

```
POST /auth/register
```

**Body:**

```json
{
  "email": "user@example.com",
  "password": "minimum8chars"
}
```

**Response** `201`:

```json
{
  "user": { "id": "uuid", "email": "user@example.com", "role": "user" },
  "token": "eyJ...",
  "refreshToken": "eyJ..."
}
```

### Login

```
POST /auth/login
```

**Body:**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response** `200`: Same shape as register.

### Refresh Token

```
POST /auth/refresh
```

**Body:**

```json
{
  "refreshToken": "eyJ..."
}
```

**Response** `200`:

```json
{
  "token": "eyJ...",
  "refreshToken": "eyJ..."
}
```

### Get Current User

```
GET /users/me
```

**Auth:** Required

**Response** `200`:

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "displayName": "John",
    "role": "user",
    "plan": "free",
    "onboardingCompleted": true
  }
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
    "street": "123 Main St",
    "city": "Portland",
    "state": "OR",
    "zip": "97201"
  }
}
```

### Update Preferences

```
PATCH /users/me/preferences
```

**Auth:** Required

**Body:**

```json
{
  "listingFlowPreference": "hybrid",
  "compactMode": false
}
```

## Token Lifecycle

1. **Login/Register** returns an access token and refresh token
2. Access tokens are short-lived; refresh tokens are longer-lived
3. On **401 response**, the client automatically calls `POST /auth/refresh`
4. The refresh call is deduplicated via a promise singleton (prevents parallel refresh storms)
5. On successful refresh, the original request is retried with the new token

## Auth Middleware

Three middleware functions protect routes:

| Middleware | Requirement |
|-----------|-------------|
| `requireAuth` | Valid JWT in Authorization header |
| `requirePro` | Valid JWT + `plan === 'pro'` |
| `requireAdmin` | Valid JWT + `role === 'admin'` |

All middleware uses `next(err)` for error propagation (not synchronous `throw`), ensuring Express error handlers catch auth failures gracefully.

## Admin Promotion

Promote a user to admin via CLI:

```bash
npx tsx apps/api/src/scripts/promote-admin.ts user@example.com
```
