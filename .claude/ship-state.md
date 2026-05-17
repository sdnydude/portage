status: in_progress
phase: 5_verified
feature: Stripe subscription integration — Pro tier ($39/mo), annual ($390/yr), 7-day trial, credit packs, pay-per-use
approach: Stripe Checkout + Customer Portal. No custom payment form. Webhooks for tier changes.
complexity: complex
branch: feature/stripe-billing
tdd: true
plan_approved: true
porter_limit_clarification: "5/day" means 5 round-trip exchanges (DB threshold = 10 messages counting both user + assistant turns)
spec:
  pricing:
    pro_monthly: $39/mo
    pro_annual: $390/yr ($32.50/mo effective)
    credit_pack: $5 for 10 AI listings
    trial: 7 days full Pro for new signups
  allocations:
    free:
      ai_listings: 10/mo
      porter: 5 exchanges/day (DB count: 10 messages)
      bg_removal: 5/mo
      marketplaces: 1
    pro:
      ai_listings: 75/mo
      porter: 15 exchanges/day (DB count: 30 messages)
      bg_removal: unlimited
      marketplaces: all
  billing_model:
    - Scan + prepare-listing counted as ONE "AI listing" (unified counter)
    - Credit packs never expire, consumed after monthly allocation exhausted
    - Stripe Smart Retries — only downgrade on customer.subscription.deleted
    - No promo codes in v1
    - No team/org billing
  schema_additions:
    - stripe_customer_id (text, nullable) on users — ALREADY EXISTS
    - stripe_subscription_id (text, nullable) on users
    - stripe_price_id (text, nullable) on users
    - trial_ends_at (timestamp, nullable) on users
    - ai_listing_credits (integer, default 0) on users
    - ai_listings_this_month (integer, default 0) on users
    - stripe_events table (event_id PK, type, processed_at) for idempotency
  api_endpoints:
    - POST /billing/create-checkout — creates Stripe Checkout session (monthly or annual), returns URL
    - POST /billing/create-portal — creates Customer Portal session, returns URL
    - POST /billing/webhook — handles Stripe events (no auth, signature-verified)
    - GET /billing/status — returns tier, trial info, subscription state, usage
    - POST /billing/buy-credits — creates Checkout session for credit pack
  critical_fixes_from_advisor:
    - C1: db:push must run before any route code references new columns
    - C2: Atomic conditional UPDATE for billing gate (no read-then-write TOCTOU)
    - C3: Monthly reset must cover aiListingsThisMonth via shared scanCountResetAt
    - C4: Billing gate queries DB directly for tier (JWT is stale up to 15 min)
    - I2: Reserve-then-execute with rollback on AI failure
    - I5: GET /billing/status endpoint explicitly defined
    - I7: Stripe setup (Task 7) before Doppler (Task 8)
tasks:
  1: Schema additions + constants + PRO_TIER_LIMITS + update consumers
  2: Billing API route (express.raw before json, stripe_events idempotency, server-side price IDs)
  3: Auth/JWT with trial as computed effectiveTier
  4: Billing gate in prepare-listing (atomic reserve, monthly reset, DB tier check)
  5: GET /billing/status + usage route refactor + Porter limits
  6: Frontend billing page (3 visual states)
  7: Stripe product + price setup (test mode)
  8: Doppler environment variables
  9: Integration smoke test (12 steps)
progress: []
deferred: []
