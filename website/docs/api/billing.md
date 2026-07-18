---
id: billing
title: Billing
sidebar_position: 14
---

# Billing

Stripe-powered subscription management, usage tracking, and credit packs.

## Plan Tiers

| Tier | Features |
|------|----------|
| Free | 25 AI scans, 10 AI listings, and 5 BG-removals per month; 5 Porter exchanges per day. 1 marketplace connection. |
| Pro | Unlimited AI scans and BG-removals, 75 AI listings per month, 500 Porter exchanges per day, unlimited marketplace connections. |
| Beta-tester | Private beta tier — unlimited AI and Porter limits. |
| Credits | Purchasable packs that extend free-tier AI listing limits without upgrading. |

New users get a 7-day Pro trial on first login. The **effective tier** is computed from `subscriptionTier` plus any active trial.

## Endpoints

### Get Billing Status

```
GET /billing/status
```

**Auth:** Required

Returns the user's effective tier, trial state, subscription, usage counts, and limits (`limit: null` means unlimited).

**Response** `200`:

```json
{
  "effectiveTier": "free",
  "trial": { "active": false, "endsAt": "2026-06-01T00:00:00Z" },
  "subscription": null,
  "usage": {
    "aiListings": { "used": 3, "limit": 10, "credits": 0 },
    "bgRemovals": { "used": 2, "limit": 5 },
    "porterExchanges": { "limit": 5 },
    "marketplaces": { "limit": 1 }
  }
}
```

### Create Checkout Session

```
POST /billing/create-checkout
```

**Auth:** Required

Creates a Stripe Checkout session for upgrading to Pro.

**Body:**

```json
{
  "plan": "monthly"
}
```

`plan` must be `"monthly"` or `"annual"`.

**Response** `200`:

```json
{
  "url": "https://checkout.stripe.com/c/pay_..."
}
```

### Buy Credits

```
POST /billing/buy-credits
```

**Auth:** Required

Creates a Stripe Checkout session for purchasing an AI listing credit pack.

### Customer Portal

```
POST /billing/create-portal
```

**Auth:** Required

Creates a Stripe Customer Portal session for managing subscriptions and payment methods.

**Response** `200`:

```json
{
  "url": "https://billing.stripe.com/p/session/..."
}
```

### Stripe Webhook

```
POST /billing/webhook
```

**Auth:** Stripe signature verification (no JWT)

Mounted **before** the JSON body parser so Stripe's signature can be verified against the raw body. Handles Stripe events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.

Events are stored in the `stripe_events` table for idempotent processing.

## Enforcement Gates

AI tools (scan, prepare-listing, BG-removal, Porter) check usage against effective-tier limits before processing. When a limit is reached:

- Returns `429` with `code: "LIMIT_REACHED"` (BG-removal uses `BG_REMOVAL_LIMIT_REACHED`; Porter uses `PORTER_LIMIT_REACHED`)
- Frontend shows upgrade prompt with checkout link

Usage counters reset monthly (idempotent reset on first request of new billing cycle). Prepare-listing reserves usage atomically, falling back to purchased credits when the monthly allocation is exhausted.

The three Stripe-session endpoints (`create-checkout`, `create-portal`, `buy-credits`) share a **10 requests/hour** rate limit keyed on user ID (IP subnet for anonymous callers), returning `429` with `code: "RATE_LIMITED"` when exceeded.

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | Webhook endpoint signing secret |
| `STRIPE_PRICE_MONTHLY` | Pro monthly price ID |
| `STRIPE_PRICE_ANNUAL` | Pro annual price ID |
| `STRIPE_PRICE_CREDITS` | Credit pack price ID |
| `STRIPE_PORTAL_CONFIG` | Optional Customer Portal configuration ID (omitted → Stripe default portal config) |
