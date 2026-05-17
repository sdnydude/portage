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
| Free | Limited scans, enhance, and BG-removal per month. 1 marketplace connection. |
| Pro | Unlimited AI tools, unlimited marketplace connections, priority support. |
| Credits | Purchasable packs that extend free-tier limits without upgrading. |

## Endpoints

### Get Billing Status

```
GET /billing/status
```

**Auth:** Required

Returns the user's current subscription tier, usage counts, and limits.

**Response** `200`:

```json
{
  "tier": "free",
  "trialEndsAt": "2026-06-01T00:00:00Z",
  "usage": {
    "scans": { "used": 12, "limit": 25 },
    "enhance": { "used": 3, "limit": 10 },
    "bgRemoval": { "used": 5, "limit": 10 }
  },
  "credits": 0
}
```

### Create Checkout Session

```
POST /billing/checkout
```

**Auth:** Required

Creates a Stripe Checkout session for upgrading to Pro or purchasing credits.

**Body:**

```json
{
  "priceId": "price_monthly_pro",
  "successUrl": "https://app.portage.app/settings/billing?success=true",
  "cancelUrl": "https://app.portage.app/settings/billing"
}
```

**Response** `200`:

```json
{
  "url": "https://checkout.stripe.com/c/pay_..."
}
```

### Customer Portal

```
POST /billing/portal
```

**Auth:** Required

Creates a Stripe Customer Portal session for managing subscriptions and payment methods.

**Response** `200`:

```json
{
  "url": "https://billing.stripe.com/p/session/..."
}
```

### Get Usage

```
GET /billing/usage
```

**Auth:** Required

Returns detailed usage breakdown for the current billing period.

### Stripe Webhook

```
POST /billing/webhook
```

**Auth:** Stripe signature verification (no JWT)

Handles Stripe events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.

Events are stored in the `stripe_events` table for idempotent processing.

## Enforcement Gates

AI tools (enhance, BG-removal, scan) check usage against tier limits before processing. When a limit is reached:

- Returns `403` with `code: "BILLING_LIMIT_REACHED"`
- Response includes `usage` object showing current counts and limits
- Frontend shows upgrade prompt with checkout link

Usage counters reset monthly (idempotent reset on first request of new billing cycle).

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | Webhook endpoint signing secret |
| `STRIPE_PRICE_MONTHLY` | Pro monthly price ID |
| `STRIPE_PRICE_ANNUAL` | Pro annual price ID |
| `STRIPE_PRICE_CREDITS` | Credit pack price ID |
