---
id: overview
title: API Overview
sidebar_position: 1
---

# API Overview

The Portage API is an **Express 5** REST API running on port 8016. Endpoints return JSON and require HTTPS — the exceptions are the export endpoints, which stream file downloads: `GET /items/export?format=ebay_csv` returns CSV (`text/csv`) and the photo export returns a ZIP archive (`application/zip`).

## Base URL

```
https://10.0.0.251:8016       # Local development (LAN server IP)
https://portage-api.digitalharmonyai.com  # Production
```

The web app itself never calls the production hostname directly: the browser talks same-origin to `/backend/*`, which Next.js rewrites to the API container (so the Cloudflare Access cookie and `Cf-Access-Jwt-Assertion` header ride along with no CORS) — `portage-api.digitalharmonyai.com` is the Cloudflare-tunnel hostname for direct/external API access.

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
| [Health](/docs/api/platform#health) | `/health` | Liveness check only (no auth, no DB check — returns `{ status: "ok", timestamp }` unconditionally) |
| [Usage](/docs/api/platform#usage) | `/usage` | Current-period usage counters |
| [Dashboard](/docs/api/platform#dashboard) | `/dashboard` | Home-screen stats and activity |
| [Users](/docs/api/authentication) | `/users/me` | Profile fields on the current user |
| [Preferences](/docs/api/authentication) | `/users/me/preferences` | Listing-interface UI preferences |
| [Seller Profile](/docs/api/seller-profile) | `/seller-profile` | Shipping/policy defaults for publishing |
| [Messages](/docs/api/messages) | `/messages` | eBay buyer conversations and replies |
| [Disclaimer](/docs/api/platform#disclaimer) | `/disclaimer` | Publish-terms acceptance records |
| [FAQs](/docs/api/platform#faqs) | `/faqs` | In-app FAQ content |
| [Survey](/docs/api/platform#survey) | `/survey` | Design survey responses (public, no auth) |
| [Beta](/docs/api/platform#beta) | `/beta` | Beta feedback reports |
| Metrics | `/metrics` | Prometheus metrics (bearer `METRICS_SECRET`) |

## Rate Limiting

Free-tier users have monthly limits on AI scans, AI listing preparation, and background removals, plus a daily limit on Porter exchanges. Pro removes the scan and background-removal caps but keeps **75 AI listings/month** and **500 Porter exchanges/day**; the beta-tester tier is unlimited across the board. See [Billing](/docs/api/billing) for enforcement details.

## Error Handling

All errors use the `AppError` class with HTTP status codes and machine-readable error codes. See [Error Handling](/docs/api/error-handling) for the full error code reference.
