---
title: "Auth hardening: exchange breaker + per-identity rate limiting"
sidebar_label: "Auth hardening: exchange breaker + per-identity ra"
sidebar_position: 121
slug: ship-180b2379
registry_id: 180b2379-a5f4-4d09-a9ef-4905fefbe5c4
generated: true
---

# Auth hardening: exchange breaker + per-identity rate limiting

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [#263](https://github.com/sdnydude/portage/pull/263) |
| **Completed** | 2026-07-27 |
| **Model** | claude-fable-5 |

## Approach

Advisor-reviewed plan (adversarial subagent, GO-WITH-CHANGES): two-tier /auth/session limiter (coarse 600/15min per-IP + 120/15min per-identity sha256(CF assertion)/dev-email/ip fallback) and client requestExchange() funnel (10s success throttle, 5-60s transient backoff, SessionLostError excluded, dedup, AuthProvider mount routed through, /home reload-loop guard). e2e specs retrofitted with installSessionStub.

## Commits

- 9438ef9 fix(auth): session-exchange breaker + per-identity rate-limit keying

## Decisions

- limiter keyed by unverified assertion hash is safe only behind a coarse per-IP tier — forged assertions get own buckets but bounded
- definitive 401/403 exchange rejections excluded from breaker cooldown — wipe+SESSION_LOST terminates that path

## Review

- Agents: adversarial-plan-review
- Critical found: 0 · Important found: 4

## Verification

- **lint:** clean
- **tests:** 740 api + 565 web + 3 e2e green; storm rerun 5 hits (was 120+), 0 429s
- **typecheck:** pass

**Tags:** `auth`, `rate-limit`, `circuit-breaker`, `incident-fix`
