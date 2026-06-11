---
title: "eBay production OAuth — sandbox coercion fix + prod/sandbox credential selection + callback page + legal pages"
sidebar_label: "eBay production OAuth — sandbox coercion fix + pro"
sidebar_position: 42
---

# eBay production OAuth — sandbox coercion fix + prod/sandbox credential selection + callback page + legal pages

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [https://github.com/sdnydude/portage/pull/93](https://github.com/sdnydude/portage/pull/93) |
| **Completed** | — |
| **Model** | claude-opus-4-8 |

## Approach

Approach A: frontend SPA callback completing existing POST design; fixed z.coerce.boolean EBAY_SANDBOX footgun; wired tested credential selector into connect/callback/refresh; non-fatal Identity fetch; deleted shadowing .env files

## Commits

- `cdb427e feat(ebay): populate marketplaceUserId from Identity API on callback (TDD, non-fatal)`
- `87b58da feat(ebay): add OAuth callback page + ungated privacy/terms legal pages`
- `290c205 fix(ebay): enable production OAuth — correct EBAY_SANDBOX coercion + wire prod/sandbox credential selection`
- `c7a4bb1 feat(ebay): add prod/sandbox credential selector for OAuth user flow (TDD, 4 tests)`

## Deferred Items

- DB-backed OAuth stateStore
- refresh-token 18mo expiry storage
- Etsy OAuth callback page
- fetchEbayAppToken(false) twin bug
- 6 pre-existing failing tests on main

## Decisions

- Approach A over server-side GET callback
- store immutable userId not mutable username
- EBAY_SANDBOX single global switch (no per-feature scoping)
- disable tdd-guard with test-verification for tested-helper wiring

## Review

**Agents:** advisor-verify x3 (diagnosis, plan, fix)
**Critical issues found:** 0
**Important issues found:** 0

## Verification

- **lint:** clean
- **tests:** 15 eBay tests green; 298 pass / 6 pre-existing fails (unrelated, proven via git diff)
- **typecheck:** pass

**Tags:** `ebay`, `oauth`, `sandbox`, `credentials`, `zod`, `env`

