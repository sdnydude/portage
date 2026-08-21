# Deferral P1 — compliance/security ship (eBay account deletion, fork-PR gating, boot guard)

**Span:** 2026-08-19 00:35 ET → 2026-08-21 06:10 ET · **PRs:** #309 (feature, merged `5f8ff7a`), #311 (docs, merged `fd7ac40`) · **Branch:** feat/deferral-p1-compliance

## Story

First execution ship of the deferral program (docs/deferral-plan-2026-08-15.md). /ship resumed the paused P1 state; spec approved at iteration 2 with two amendments (pin the eBay signature scheme from primary sources; drop provider-chain keys from the boot guard). Explore pinned the signature scheme from eBay's official event-notification-nodejs-sdk — its test vectors were verified locally with node crypto and then reused as unit-test fixtures.

Two operator-requested advisor rounds on the PLAN produced 21 approved amendments before any build: synchronous anonymization over an outbox (eBay resends until acked), an HMAC-keyed `ebay_deleted_identities` table instead of plaintext retention, two-tier rate limiting keyed on CF-Connecting-IP, fail-not-skip fork gating (a skipped required check counts as passing), and a two-commit split of the boot guard for single-revert rollback.

Build ran the tdd-guard one-test rhythm (two over-implementation rejections corrected mid-flight). Commit-gate reviews found and fixed: a BLOCKER (buyer_message notifications carried deleted buyers' PII and were untouched by the anonymizer), TOCTOU between the sync guard-check and a deletion commit (closed with a duplicate-path sweep + post-sync sweep), an endpoint-URL validator that prefix-matched hostnames (fdx.example.com would have bricked prod boot), a limiter spoof via LAN-reachable :8016, and a boot-guard/runtime keyset mismatch (any-of eBay credential groups). A final adversarial pre-merge round added sweep isolation (a sweep failure no longer fails a committed sync).

Proof of done was delivered at every layer: rebuilt image in production mode against a seeded DB with eBay's signed vector verified against eBay's LIVE public key (204 + rows redacted + control rows untouched + redelivery duplicate), boot-guard refusal against the real env naming exactly the missing keys, an admin-audit screenshot (which itself surfaced and fixed an [object Object] render), live cutover through the tunnel with an independently recomputed challenge hash and a path-confusion sweep, and finally the eBay developer portal driven via Claude-in-Chrome: the "I do not persist eBay data" exemption (no longer true) was lifted, the endpoint registered (challenge passed first try), and eBay's live test notification landed — signature verified, unknown_user outcome, system audit row, counter.

Cutover unblocked two adjacent gaps: Doppler had no STRIPE_WEBHOOK_SECRET because **no Stripe webhook endpoint had ever been created** — one was created via API (test-mode, matching the test-mode secret key) with the four events billing.ts handles; and the CF Access bypass for the exact path was created via API following the existing Stripe-webhook-bypass app pattern.

## Learnings

- eBay's SDK verifies JSON.stringify(parsedBody), not raw bytes — verify raw first, canonical fallback.
- A skipped required check passes branch protection; fork gating on self-hosted runners must FAIL the job before checkout, not skip it.
- docker --env-file keeps quotes that compose strips — quoted values break URL parsing inside containers.
- Registry PATCH /deferred-items accepts only {status}; resolution narrative must live elsewhere.
- Direct pushes to main are blocked by required checks — even docs-only changes go via PR.

## Insights

- Insert-first ON CONFLICT DO NOTHING RETURNING doubles as a race-safe idempotency lock under READ COMMITTED — the unique index serializes concurrent redeliveries without SELECT-FOR-UPDATE.
- Identity hashing must key on whatever the SYNC path can hash (usernames), not what the spec ranks primary (userId) — a guard that stores hashes it can never recompute is inert.
- The eBay account had been marked "I do not persist eBay data" since before orders/messages sync shipped — the exemption itself was the compliance violation; the deferral audit caught it.

## Deferred

None. All findings fixed in-branch (rules 00/01). Program remainder P2–P8 unchanged in docs/deferral-plan-2026-08-15.md.
