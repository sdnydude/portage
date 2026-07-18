---
id: marketplace
title: Marketplace
sidebar_position: 8
---

# Marketplace

Connection management for eBay and Reverb marketplace accounts. (Etsy support was parked 2026-07-09 pending API key approval — see below.)

## Endpoints

### List Connected Accounts

```
GET /users/me/marketplace-accounts
```

**Auth:** Required

**Response** `200`:

```json
{
  "accounts": [
    {
      "id": "uuid",
      "marketplace": "ebay",
      "marketplaceUserId": "seller123",
      "tokenExpiresAt": "2026-07-10T...",
      "createdAt": "2026-05-01T..."
    }
  ]
}
```

### eBay

```
GET    /marketplace/ebay/connect      # Returns the OAuth authorization URL
POST   /marketplace/ebay/callback     # Exchange { code, state } for tokens
GET    /marketplace/ebay/status       # Connection status
DELETE /marketplace/ebay/disconnect   # Remove connection + tokens
```

**Auth:** Required

`GET /marketplace/ebay/connect` responds with:

```json
{
  "authUrl": "https://auth.ebay.com/oauth2/authorize?..."
}
```

Redirect the user to `authUrl`; after they authorize, the frontend posts the returned `code` and `state` to `/marketplace/ebay/callback`, which exchanges them for tokens. Tokens are encrypted with AES-256-GCM before storage.

Two Taxonomy-API helper endpoints also live under this prefix:

```
GET /marketplace/ebay/category-suggestion?q=<query>      # Suggest a leaf category
GET /marketplace/ebay/category-aspects/:categoryId       # Required/recommended item aspects
```

### Reverb

Token-paste authentication using Personal Access Tokens (PATs). Users generate a token in their Reverb account settings and paste it into Portage. The token is validated against the live Reverb API (`GET /my/account`) before being stored.

```
POST   /marketplace/reverb/connect      # { token } — validate + store PAT
GET    /marketplace/reverb/status       # Connection status
DELETE /marketplace/reverb/disconnect   # Remove connection + token
```

**Auth:** Required

`POST /marketplace/reverb/connect` is rate-limited to **5 attempts per 15-minute window** (`express-rate-limit`); exceeding it returns `429 RATE_LIMITED`.

## OAuth Flows

### eBay

Standard OAuth2 authorization code grant:

1. Frontend fetches the auth URL from `GET /marketplace/ebay/connect` and redirects to eBay
2. User authorizes on eBay
3. eBay redirects back with auth code + state
4. Frontend posts code + state to `POST /marketplace/ebay/callback`; the API exchanges them for tokens
5. Tokens stored encrypted

### Etsy (parked)

Etsy support was **removed 2026-07-09** pending Etsy API key approval — the adapter, auth routes, and UI no longer exist (pre-removal code is preserved at git tag `etsy-parked-2026-07`). The `etsy` database enum value remains but is inert; attempting to publish to Etsy is rejected at validation, since the request-body `marketplace` enum only accepts `ebay` | `reverb` — you get a `400 VALIDATION_ERROR`. (`400 MARKETPLACE_UNSUPPORTED` exists only on the legacy path for a pre-existing `etsy` listing row, and zero such rows exist.)

## Token Storage

All marketplace tokens are encrypted at rest:

- **Algorithm:** AES-256-GCM
- **Key:** `ENCRYPTION_KEY` environment variable (separate from `JWT_SECRET`)
- **Storage:** `marketplace_accounts` table, in the `accessTokenEncrypted` and `refreshTokenEncrypted` columns

Token refresh is handled automatically by the token manager — access tokens are refreshed 5 minutes before expiry to avoid race conditions. There is no manual refresh endpoint.
