---
id: environment-variables
title: Environment Variables
sidebar_position: 2
---

# Environment Variables

All secrets are managed through **Doppler** and synced to `.env` automatically. See `.env.example` for the full template.

## Required Variables

### Database

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5436/portage` |

### Authentication

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Secret for signing JWT access/refresh tokens |
| `ENCRYPTION_KEY` | AES-256-GCM key for marketplace token encryption (separate from JWT_SECRET) |

### AI Services

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Claude API key (primary AI provider) |
| `OPENAI_API_KEY` | OpenAI API key (fallback provider) |

### Cloudflare R2 (Image Storage)

| Variable | Description |
|----------|-------------|
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 S3-compatible access key |
| `R2_SECRET_ACCESS_KEY` | R2 S3-compatible secret key |
| `R2_BUCKET_NAME` | R2 bucket name (`portage-images`) |
| `R2_PUBLIC_URL` | Public URL prefix for stored images |

### eBay

| Variable | Description |
|----------|-------------|
| `EBAY_CLIENT_ID` | eBay app client ID |
| `EBAY_CLIENT_SECRET` | eBay app client secret |
| `EBAY_REDIRECT_URI` | OAuth callback URL |
| `EBAY_SANDBOX` | Set to `true` for sandbox selling APIs |

### Etsy

| Variable | Description |
|----------|-------------|
| `ETSY_API_KEY` | Etsy app API key |
| `ETSY_SHARED_SECRET` | Etsy app shared secret |
| `ETSY_REDIRECT_URI` | OAuth callback URL |

### Reverb

| Variable | Description |
|----------|-------------|
| `REVERB_CLIENT_ID` | Reverb app client ID (legacy — unused by token-paste auth) |
| `REVERB_CLIENT_SECRET` | Reverb app client secret (legacy — unused by token-paste auth) |

### Stripe (Billing)

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | Webhook endpoint signing secret |
| `STRIPE_PRICE_MONTHLY` | Pro monthly plan price ID |
| `STRIPE_PRICE_ANNUAL` | Pro annual plan price ID |
| `STRIPE_PRICE_CREDITS` | Credit pack price ID |

## Optional Variables

### Frontend

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | API base URL for the frontend | `https://portage-api.digitalharmonyai.com` |
| `WATCHPACK_POLLING` | Enable polling for HMR over network | `true` |

### Shipping

| Variable | Description |
|----------|-------------|
| `EASYPOST_API_KEY` | EasyPost carrier API key |
| `SHIPPO_API_KEY` | Shippo carrier API key |

## Doppler Setup

Portage uses Doppler for secrets management across environments:

```bash
# Install Doppler CLI
curl -Ls https://cli.doppler.com/install.sh | sh

# Login
doppler login

# Set project
doppler setup --project portage

# Download secrets
doppler secrets download --no-file --format env > .env
```

The `SessionStart` hook runs this automatically at the beginning of each Claude Code session.

## Security Notes

- `ENCRYPTION_KEY` is deliberately separate from `JWT_SECRET` — compromising one doesn't compromise the other
- Never commit `.env` files to git (`.gitignore` includes `.env*`)
- Rotate keys through Doppler, not by editing files directly
- The `R2_PUBLIC_URL` variable is critical for SSRF protection — if unset, the scan endpoint rejects all image URLs
