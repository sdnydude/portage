---
id: error-handling
title: Error Handling
sidebar_position: 11
---

# Error Handling

All API errors use the `AppError` class with consistent HTTP status codes and machine-readable error codes.

## Error Response Format

```json
{
  "error": "Human-readable description",
  "code": "VALIDATION_ERROR",
  "details": ["field1: Required", "field2: Must be positive"]
}
```

`details` is only present when the error carries them (e.g., Zod validation failures).

## Error Codes

### Authentication (4xx)

| Status | Code | Description |
|--------|------|-------------|
| 401 | `UNAUTHORIZED` | Missing, invalid, or expired internal JWT |
| 401 | `CF_REQUIRED` | No Cloudflare Access assertion on `/auth/session` |
| 401 | `CF_INVALID` | Cloudflare Access assertion failed JWKS verification |
| 401 | `USER_NOT_FOUND` | Authenticated user not in database |
| 403 | `FORBIDDEN` | User lacks required role/plan |
| 403 | `ADMIN_REQUIRED` | Endpoint requires admin role |
| 403 | `PRO_REQUIRED` | Endpoint requires pro plan |
| 403 | `ACCOUNT_DISABLED` | Account archived by an admin |

### Validation (4xx)

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | Request body failed Zod validation |
| 404 | `NOT_FOUND` | Requested resource doesn't exist |
| 409 | `EMAIL_EXISTS` | Admin user-create hit an existing email |

### Rate Limiting (4xx)

| Status | Code | Description |
|--------|------|-------------|
| 429 | `LIMIT_REACHED` | Monthly AI limit (scans, AI listings) or daily Porter limit reached |
| 429 | `BG_REMOVAL_LIMIT_REACHED` | Monthly background-removal limit reached |
| 429 | `RATE_LIMITED` | Too many requests to a rate-limited endpoint |

### External Services (5xx)

| Status | Code | Description |
|--------|------|-------------|
| 502 | `AI_RESPONSE_INVALID` | AI returned unparseable response |
| 502 | `MARKETPLACE_ERROR` | Marketplace API returned an error |
| 503 | `SERVICE_UNAVAILABLE` | External service is down |

## Frontend Error Handling

The `api()` client in `apps/web/src/lib/api.ts` throws `ApiError` objects:

```typescript
class ApiError extends Error {
  status: number;
  code: string;
  message: string;
  details?: string[];
}
```

### 401 Auto-Refresh

On 401 responses, the client automatically re-exchanges via Cloudflare Access:

1. Calls `GET /auth/session` for a fresh 15-minute internal JWT (deduplicated via a promise singleton)
2. Retries the original request with the new token
3. If the exchange also fails, the user is sent back through Cloudflare Access

### Hook Error Pattern

All data hooks expose an `error` field:

```typescript
const { items, isLoading, error } = useItems();

if (error) {
  return <div className="text-accent-error">{error}</div>;
}
```

## Express Error Middleware

Auth middleware uses `next(err)` for error propagation (not synchronous `throw`), ensuring the centralized Express error handler catches all errors consistently. The error handler formats `AppError` instances into the standard response shape and logs unexpected errors via pino.
