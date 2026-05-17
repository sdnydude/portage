---
id: marketplace
title: Marketplace
sidebar_position: 8
---

# Marketplace

OAuth connection management for eBay, Etsy, and Reverb marketplace accounts.

## Endpoints

### List Connected Accounts

```
GET /marketplace/accounts
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
      "status": "connected",
      "connectedAt": "2026-05-01T..."
    }
  ]
}
```

### Get OAuth URL

```
GET /marketplace/:marketplace/auth-url
```

**Auth:** Required

Returns the OAuth authorization URL for the specified marketplace. Redirect the user to this URL to begin the connection flow.

**Response** `200`:

```json
{
  "authUrl": "https://auth.ebay.com/oauth2/authorize?..."
}
```

### OAuth Callback

```
GET /marketplace/:marketplace/callback?code=<auth_code>
```

**Auth:** Required

Exchanges the authorization code for access/refresh tokens. Tokens are encrypted with AES-256-GCM before storage.

### Disconnect Account

```
DELETE /marketplace/:marketplace
```

**Auth:** Required

Removes the marketplace connection and deletes stored tokens.

### Refresh Token

```
POST /marketplace/:marketplace/refresh
```

**Auth:** Required

Manually refreshes an expired marketplace token.

## OAuth Flows

### eBay

Standard OAuth2 authorization code grant:

1. Frontend redirects to eBay auth URL
2. User authorizes on eBay
3. eBay redirects back with auth code
4. API exchanges code for tokens
5. Tokens stored encrypted

### Etsy

PKCE OAuth2 flow:

1. Frontend generates code verifier and challenge
2. Redirect to Etsy with challenge
3. Etsy redirects back with auth code
4. API exchanges code + verifier for tokens

### Reverb

Token-paste authentication using Personal Access Tokens (PATs). Users generate a token in their Reverb account settings and paste it into Portage. The token is validated against the live Reverb API (`GET /my/account`) before being stored.

Endpoints: `POST /marketplace/reverb/connect`, `GET /marketplace/reverb/status`, `DELETE /marketplace/reverb/disconnect`.

## Token Storage

All marketplace tokens are encrypted at rest:

- **Algorithm:** AES-256-GCM
- **Key:** `ENCRYPTION_KEY` environment variable (separate from `JWT_SECRET`)
- **Storage:** `marketplace_accounts` table, encrypted columns for `accessToken` and `refreshToken`

Token refresh is handled automatically by the token manager when tokens expire during API calls.
