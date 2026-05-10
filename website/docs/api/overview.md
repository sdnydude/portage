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

Most endpoints require a JWT bearer token:

```
Authorization: Bearer <access_token>
```

See [Authentication](/docs/api/authentication) for login, registration, and token refresh flows.

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
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Title is required",
    "details": ["title: Required"]
  }
}
```

## Endpoint Groups

| Group | Prefix | Description |
|-------|--------|-------------|
| [Authentication](/docs/api/authentication) | `/auth` | Login, register, refresh, profile |
| [Items](/docs/api/items) | `/items` | Inventory CRUD, comps, export |
| [Images](/docs/api/images) | `/images` | Upload, enhance, background removal |
| [Scan](/docs/api/scan) | `/scan` | AI item identification |
| [Listings](/docs/api/listings) | `/listings` | Marketplace listing management |
| [Orders](/docs/api/orders) | `/orders` | Order tracking and shipping |
| [Drafts](/docs/api/drafts) | `/drafts` | Listing draft persistence |
| [Shipping](/docs/api/shipping) | `/shipping` | Presets, rates, labels, providers |
| [Marketplace](/docs/api/marketplace) | `/marketplace` | OAuth and account management |
| [Porter](/docs/api/porter) | `/porter` | AI assistant chat |
| [Admin](/docs/api/admin) | `/admin` | System administration |

## Rate Limiting

Free-tier users have daily limits on AI scan requests. See the scan endpoint documentation for details.

## Error Handling

All errors use the `AppError` class with HTTP status codes and machine-readable error codes. See [Error Handling](/docs/api/error-handling) for the full error code reference.
