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
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description",
    "details": ["field1: Required", "field2: Must be positive"]
  }
}
```

## Error Codes

### Authentication (4xx)

| Status | Code | Description |
|--------|------|-------------|
| 401 | `UNAUTHORIZED` | Missing or invalid JWT token |
| 401 | `TOKEN_EXPIRED` | JWT token has expired |
| 401 | `USER_NOT_FOUND` | Authenticated user not in database |
| 403 | `FORBIDDEN` | User lacks required role/plan |
| 403 | `ADMIN_REQUIRED` | Endpoint requires admin role |
| 403 | `PRO_REQUIRED` | Endpoint requires pro plan |

### Validation (4xx)

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | Request body failed Zod validation |
| 400 | `INVALID_ID` | UUID format invalid |
| 404 | `NOT_FOUND` | Requested resource doesn't exist |
| 409 | `CONFLICT` | Resource already exists (e.g., duplicate email) |

### Rate Limiting (4xx)

| Status | Code | Description |
|--------|------|-------------|
| 429 | `SCAN_LIMIT_EXCEEDED` | Daily AI scan limit reached |

### External Services (5xx)

| Status | Code | Description |
|--------|------|-------------|
| 502 | `AI_RESPONSE_INVALID` | Claude returned unparseable response |
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

On 401 responses, the client automatically attempts a token refresh:

1. Deduplicates refresh calls via a promise singleton
2. Retries the original request with the new token
3. If refresh also fails, redirects to login

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
