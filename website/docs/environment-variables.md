---
id: environment-variables
title: Environment Variables
sidebar_position: 4
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
| `JWT_SECRET` | Secret for signing the short-lived (15-minute) internal JWT minted after Cloudflare Access verification |
| `ENCRYPTION_KEY` | AES-256-GCM key for marketplace token encryption (separate from JWT_SECRET) |

### Cloudflare Access (Identity Provider)

Cloudflare Access is the identity layer — there are no local passwords.

| Variable | Description |
|----------|-------------|
| `CF_ACCESS_TEAM_DOMAIN` | Cloudflare Zero Trust team domain (default `digitalharmonyai`) |
| `CF_ACCESS_AUD` | Audience tag of the Access application protecting Portage — **required in production** (startup fails without it) |
| `CF_ACCESS_DEV_EMAIL` | Dev-only identity when no CF edge is in front (read only when `NODE_ENV=development`) |
| `CF_ACCESS_SERVICE_EMAIL` / `CF_ACCESS_SERVICE_COMMON_NAME` | User identity for CF Access service-token requests (e2e) — both must be set together |
| `CF_API_TOKEN` | Cloudflare API token for the admin allowlist manager (needs Access:Edit) |
| `CF_ACCOUNT_ID` | Cloudflare account ID for the allowlist manager |
| `CF_ACCESS_APP_IDS` | Comma-separated Access application IDs carrying the email allow policy |

### AI Services

The vision and chat pipelines use configurable provider chains (comma-separated, tried in order):

| Variable | Description |
|----------|-------------|
| `VISION_PROVIDERS` | Vision provider chain (e.g. `gemini,anthropic`) — providers: `local`, `gemini`, `openai`, `huggingface`, `anthropic` |
| `CHAT_PROVIDERS` | Chat provider chain, same provider names |
| `GEMINI_API_KEY` | Google AI key (Gemini 2.5 is the primary vision provider) |
| `GEMINI_VISION_MODEL` / `GEMINI_CHAT_MODEL` | Model overrides (defaults `gemini-2.5-pro` / `gemini-2.5-flash`) |
| `ANTHROPIC_API_KEY` | Claude API key (fallback vision provider; powers Porter) |
| `OPENAI_API_KEY` | OpenAI API key (optional chain entry) |
| `OPENAI_VISION_MODEL` / `OPENAI_CHAT_MODEL` | Model overrides (defaults `gpt-4.1` / `gpt-4o-mini`) |
| `HUGGINGFACE_API_KEY` / `HUGGINGFACE_BASE_URL` | HuggingFace Inference router (optional chain entry) |
| `HUGGINGFACE_VISION_MODEL` / `HUGGINGFACE_CHAT_MODEL` | Model overrides |
| `LOCAL_LLM_BASE_URL` / `LOCAL_LLM_API_KEY` | Local OpenAI-compatible endpoint (Ollama, vLLM, llama.cpp) |
| `LOCAL_LLM_VISION_MODEL` / `LOCAL_LLM_CHAT_MODEL` | Model overrides (defaults `qwen3-vl` / `qwen3:8b`) |
| `REMBG_URL` | Background-removal service URL (the `portage-rembg` container, default `http://localhost:7000`) |

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
| `EBAY_CLIENT_ID` | eBay app client ID (sandbox keyset, `…-SBX-…`) |
| `EBAY_CLIENT_SECRET` | eBay app client secret (sandbox keyset) |
| `EBAY_PROD_CLIENT_ID` / `EBAY_PROD_CLIENT_SECRET` | Production keyset credentials (`…-PRD-…`) — used when `EBAY_SANDBOX=false`, falling back to the base keys if unset |
| `EBAY_REDIRECT_URI` | **eBay RuName, NOT a URL** (e.g. `Digital_Harmony-DigitalH-click2-cefmyzh`). eBay's OAuth `redirect_uri` parameter takes the RuName registered on the active keyset; a plain callback URL here breaks connect with `invalid_request`. RuNames are keyset-specific — the prod keyset's RuName differs from the sandbox one. See [eBay OAuth environment](reference/ebay-oauth-env.md) |
| `EBAY_RUNAME` | Sandbox keyset RuName. **Not read by any code** — kept as a reference value only |
| `EBAY_SANDBOX` | `false` in production (only the literal string `false` disables sandbox — any other non-empty value enables it). Switches both the auth/API hosts and which keyset + RuName must be in play |
| `EBAY_DELETION_VERIFICATION_TOKEN` | Verification token registered with eBay for [Marketplace Account Deletion notifications](reference/ebay-trade-first.md#marketplace-account-deletion-notifications) — 32–80 chars of `[A-Za-z0-9_-]` (eBay rule). Feeds the challenge-response hash. **Required in production** |
| `EBAY_DELETION_ENDPOINT_URL` | The exact endpoint URL registered in the eBay developer portal (`https://portage-api.digitalharmonyai.com/marketplace/ebay/account-deletion`). Must match byte-for-byte — it is hashed into the challenge response. **Required in production** |

### Reverb

| Variable | Description |
|----------|-------------|
| `REVERB_API_TOKEN` | Legacy global Personal Access Token — per-user tokens pasted in Settings are the shipped auth flow and are stored encrypted in `marketplace_accounts` |

### Stripe (Billing)

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | Webhook endpoint signing secret |
| `STRIPE_PRICE_MONTHLY` | Pro monthly plan price ID |
| `STRIPE_PRICE_ANNUAL` | Pro annual plan price ID |
| `STRIPE_PRICE_CREDITS` | Credit pack price ID |

### Production boot guard

In `NODE_ENV=production` the API refuses to start unless every statically-required key is present and non-empty, naming **every** missing key in one error (`apps/api/src/lib/prod-env-guard.ts`, extends the PR #269 `CF_ACCESS_AUD` pattern). Currently required: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`, eBay client id + secret from **either** keyset (`EBAY_CLIENT_ID|EBAY_PROD_CLIENT_ID`, `EBAY_CLIENT_SECRET|EBAY_PROD_CLIENT_SECRET` — runtime falls back PROD → base), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`, `STRIPE_PRICE_CREDITS`, `EBAY_DELETION_VERIFICATION_TOKEN`, `EBAY_DELETION_ENDPOINT_URL` (plus `CF_ACCESS_AUD` with two audience tags). Provider-chain keys (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, …) are deliberately **not** boot-required — the vision/chat chains fail over at runtime. Land new Doppler values **before** deploying a build that requires them.

## Optional Variables

### Runtime

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | `development`, `production`, or `test` — in production, startup fails unless `CF_ACCESS_AUD` is set | `development` |
| `API_PORT` | Express API listen port | `8016` |
| `WEB_PORT` | Web app port — **informational (.env.example convention only)**: no code reads it; `docker-compose.yml` hard-codes the mapping `3002:3000` and manual dev passes `--port 3002` | `3002` |

### Frontend

These are consumed by Next.js / the dev tooling, **not** by the API's `env.ts` Zod schema:

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | API base URL override for the frontend (`apps/web/src/lib/api.ts`) | `/backend` (same-origin rewrite) |
| `WATCHPACK_POLLING` | Enable polling for HMR over network (dev only, set by the `dev` script) | `true` |

### Notifications & Ops

| Variable | Description |
|----------|-------------|
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_EMAIL` | Web Push (VAPID) credentials |
| `RESEND_API_KEY` / `RESEND_FROM` | Beta invite emails via Resend (`RESEND_FROM` must be on a verified Resend domain) |
| `REGISTRY_URL` | DHG Registry endpoint for in-app beta reports (default `http://10.0.0.251:8011`) — raw `process.env` read in `apps/api/src/routes/beta.ts`, not part of the `env.ts` Zod schema |
| `APP_URL` | Public app URL used in emails and links |
| `METRICS_SECRET` | If set, `GET /metrics` requires `Authorization: Bearer <secret>` |

## Doppler Setup

Quickstart:

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

The `SessionStart` hook runs the download automatically at the beginning of each Claude Code session. Full guide: [Doppler — Secrets Management](http://10.0.0.251:8017/infrastructure/doppler/) on the DHG docs site.

## Security Notes

- `ENCRYPTION_KEY` is deliberately separate from `JWT_SECRET` — compromising one doesn't compromise the other
- Never commit `.env` files to git (`.gitignore` includes `.env*`)
- Rotate keys through Doppler, not by editing files directly
- The `R2_PUBLIC_URL` variable is critical for SSRF protection — if unset, the scan endpoint rejects all image URLs
