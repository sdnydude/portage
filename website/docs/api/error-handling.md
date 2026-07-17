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
| 401 | `USER_NOT_FOUND` | Authenticated user not in database (scan routes) — the same code is returned as **404** by billing and preferences routes |
| 401 | `INVALID_TOKEN` | Photo-export token invalid, expired, or use count exhausted — Reverb connect returns this code as **400** when the personal access token is rejected |
| 403 | `FORBIDDEN` | Cross-user ownership rejection — the item, listing, or image key belongs to another user. (Role/plan rejections use `ADMIN_REQUIRED` / `PRO_REQUIRED` below, not this code) |
| 403 | `ADMIN_REQUIRED` | Endpoint requires admin role |
| 403 | `PRO_REQUIRED` | Endpoint requires pro plan |
| 403 | `ACCOUNT_DISABLED` | Account archived by an admin |

### Validation (4xx)

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | Request body failed Zod validation |
| 400 | `MARKETPLACE_UNSUPPORTED` | Marketplace not available in this release (e.g., Etsy) |
| 400 | `INVALID_ORIGIN` | Image URL is not from Portage storage |
| 400 | `FETCH_FAILED` | Image could not be fetched for processing |
| 400 | `FILE_TOO_LARGE` | Image exceeds the processing size limit |
| 400 | `CSRF_MISMATCH` | Invalid or expired OAuth `state` parameter (eBay connect callback) |
| 400 | `INVALID_STATUS` | Listing is not in a publishable state (only drafts can be published) |
| 400 | `NO_CHANGES` | Update request contained no valid fields to change |
| 400 | `SELF_MODIFY` | Admin attempted to modify their own admin account |
| 400 | `SELF_DELETE` | Admin attempted to delete their own account |
| 400 | `SELF_REMOVE` | Admin attempted to remove their own email from the CF allowlist |
| 404 | `NOT_FOUND` | Requested resource doesn't exist |
| 409 | `EMAIL_EXISTS` | Admin user-create hit an existing email |
| 409 | `STRIPE_SUBSCRIPTION_ACTIVE` | User delete blocked — cancel the Stripe subscription first or archive instead |
| 409 | `HAS_AUDIT_HISTORY` | User delete blocked — admin audit history must be preserved; archive instead |
| 422 | `REVERB_CATEGORY_REQUIRED` | No Reverb category could be resolved for the item |
| 422 | `NO_PHOTOS` | No photos available within the export photo limit |

### Rate Limiting (4xx)

| Status | Code | Description |
|--------|------|-------------|
| 403 | `MARKETPLACE_LIMIT_REACHED` | Plan's marketplace-connection limit reached (free tier) |
| 429 | `LIMIT_REACHED` | Monthly AI limit (scans, AI listings) reached |
| 429 | `PORTER_LIMIT_REACHED` | Daily Porter exchange limit reached |
| 429 | `BG_REMOVAL_LIMIT_REACHED` | Monthly background-removal limit reached |
| 429 | `RATE_LIMITED` | Too many requests to a rate-limited endpoint |

### External Services (5xx)

| Status | Code | Description |
|--------|------|-------------|
| 500 | `PROVISION_FAILED` | Auto-provisioning the user account on first login failed |
| 502 | `AI_RESPONSE_INVALID` | AI returned unparseable response |
| 502 | `BG_REMOVAL_FAILED` | Background-removal service error |
| 502 | `CF_ALLOWLIST_FAILED` | Cloudflare allowlist update failed during admin user-create |
| 503 | `EBAY_NOT_CONFIGURED` | eBay integration is not configured on the server |
| 503 | `MARKETPLACE_UNAVAILABLE` | eBay comps lookup is currently unavailable |

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
