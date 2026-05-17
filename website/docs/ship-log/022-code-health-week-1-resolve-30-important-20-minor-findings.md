---
title: "Code health week 1 — resolve 30 Important + 20 Minor findings"
sidebar_label: "Code health week 1 — resolve 30 Important + 20 Min"
sidebar_position: 22
---

# Code health week 1 — resolve 30 Important + 20 Minor findings

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | No |
| **PR** | [https://github.com/sdnydude/portage/pull/65](https://github.com/sdnydude/portage/pull/65) |
| **Completed** | 2026-05-15 |
| **Model** | claude-opus-4-6 |

## Approach

Severity-layer batching: security → data integrity → silent failures → architecture → minor frontend → minor backend

## Commits

- `32d50a4 fix: code health week 1 — bugs, tests, dead code, CI config`
- `61f68e1 fix: resolve 12 critical findings from full code review`
- `def18c6 fix: security hardening — helmet, metrics auth, password policy, timing oracle`
- `bc88bef fix: data integrity — money precision, indexes, FK cascades, soldAt, SKU collision`
- `8847ed9 fix: admin guards, marketplace adapter caching, and Etsy photo error handling`
- `66677cd fix: error exposure — listing flow, drafts, seller profile, ship page, vision, preferences`
- `da504ce fix: orders status validation + pagination`
- `59ccb17 fix: review fixes — deleteDraft error, metrics try/catch, TTL dedup`
- `762617d fix: rate limiter per-route — exclude /logout from auth throttle`

## Deferred Items

- I1: localStorage tokens to HttpOnly cookie migration
- OAuth state store cleanup (setInterval eviction)
- Test coverage: password policy, timing oracle, admin self-demote, settings allowlist
- Address type dedup in ship page
- Review-comments hardcoded URL (M15)

## Surprises

- 12 of 49 findings already resolved or false positives
- I25 porter memory misfiled — real issue was admin.ts loading all conversations
- I4 SSRF already mitigated by R2 prefix check

## Decisions

- doublePrecision over numeric for money columns (numeric returns strings, breaks consumers)
- Rate limiter per-route instead of router-level (exclude /logout)
- Timing oracle: deliberate bcrypt on disabled accounts for constant-time defense

## Review

**Agents:** silent-failure-hunter, code-reviewer, pr-test-analyzer, code-simplifier
**Critical issues found:** 4
**Important issues found:** 7

## Verification

- **lint:** 1 pre-existing error (marketplace/page.tsx)
- **tests:** 137/137 pass
- **typecheck:** pass

**Tags:** `security`, `data-integrity`, `error-handling`, `performance`, `admin`, `schema`, `marketplace`, `frontend`, `code-health`

