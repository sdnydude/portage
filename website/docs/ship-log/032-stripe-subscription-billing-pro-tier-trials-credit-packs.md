---
title: "Stripe subscription billing — Pro tier, trials, credit packs"
sidebar_label: "Stripe subscription billing — Pro tier, trials, cr"
sidebar_position: 32
---

# Stripe subscription billing — Pro tier, trials, credit packs

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [https://github.com/sdnydude/portage/pull/73](https://github.com/sdnydude/portage/pull/73) |
| **Completed** | 2026-05-17 |
| **Model** | claude-opus-4-6 |

## Approach

Stripe Checkout + Customer Portal, webhook-driven tier changes, atomic billing gate

## Commits

- `1be355a schema columns, PRO_TIER_LIMITS, computeEffectiveTier`
- `0340d69 Stripe billing routes with webhook idempotency`
- `03c23d9 trialEndsAt to JWT, 7-day trial on registration`
- `9523bb9 billing gate with atomic reserve`
- `46d44ca billing status, usage, Porter limits`
- `8f160c7 frontend billing page`
- `d97e04b Stripe product/price setup script`
- `e9dba44 env schema + .env.example`
- `18068d8 review fixes: credit leak, Porter guard, test gaps`

## Deferred Items

- bg removal billing gate enforcement
- marketplace count enforcement at listing time
- promo codes / coupon support
- team/org billing

## Decisions

- Stripe Checkout over custom payment form
- computeEffectiveTier from DB not JWT for billing enforcement
- atomic conditional UPDATE over read-then-write for TOCTOU safety
- item lookup before billing gate to prevent credit leak on 404

## Review

**Agents:** silent-failure-hunter, code-reviewer, pr-test-analyzer
**Critical issues found:** 6
**Important issues found:** 8

## Verification

- **lint:** clean
- **tests:** 172 passed
- **typecheck:** pass

**Tags:** `billing`, `stripe`, `subscription`, `payments`, `trial`, `credits`

