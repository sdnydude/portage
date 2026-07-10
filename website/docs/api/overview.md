---
id: overview
title: API Overview
sidebar_position: 1
---

# API Overview

The Portage API is an **Express 5** REST API running on port 8016. All endpoints return JSON and require HTTPS.

## Base URL

```
https://localhost:8016        # Local development
https://portage-api.digitalharmonyai.com  # Production
```

## Authentication

**Cloudflare Access** is the identity provider — there are no passwords. The client exchanges the CF Access assertion for a short-lived (15-minute) internal JWT via `GET /auth/session`, then sends it as a bearer token:

```
Authorization: Bearer <access_token>
```

See [Authentication](/docs/api/authentication) for the Cloudflare Access session exchange and token lifecycle.

## Request Format

- **Content-Type**: `application/json` for request bodies
- **File uploads**: `multipart/form-data` (image endpoints only)

## Response Format

All responses follow a consistent shape:

```json
// Success
{
  "items": [...],
  "total": 42
}

// Error
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": ["title: Required"]
}
```

## Endpoint Groups

| Group | Prefix | Description |
|-------|--------|-------------|
| [Authentication](/docs/api/authentication) | `/auth` | Cloudflare Access session exchange, profile |
| [Items](/docs/api/items) | `/items` | Inventory CRUD, comps, export |
| [Images](/docs/api/images) | `/images` | Upload, enhance, background removal |
| [Scan](/docs/api/scan) | `/scan` | AI item identification |
| [Listings](/docs/api/listings) | `/listings` | Marketplace listing management |
| [Orders](/docs/api/orders) | `/orders` | Order tracking and fulfillment sync |
| [Drafts](/docs/api/drafts) | `/drafts` | Listing draft persistence |
| [Shipping](/docs/api/shipping) | — | Removed in PR #142 — labels via eBay |
| [Marketplace](/docs/api/marketplace) | `/marketplace` | OAuth and account management |
| [Porter](/docs/api/porter) | `/porter` | AI assistant chat |
| [Billing](/docs/api/billing) | `/billing` | Stripe subscriptions, credits, usage |
| [Admin](/docs/api/admin) | `/admin` | System administration |

## Rate Limiting

Free-tier users have monthly limits on AI scans, AI listing preparation, and background removals, plus a daily limit on Porter exchanges. Pro and beta-tester tiers are unlimited. See [Billing](/docs/api/billing) for enforcement details.

## Error Handling

All errors use the `AppError` class with HTTP status codes and machine-readable error codes. See [Error Handling](/docs/api/error-handling) for the full error code reference.
