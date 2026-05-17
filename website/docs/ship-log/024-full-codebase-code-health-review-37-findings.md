---
title: "Full codebase code health review — 37 findings"
sidebar_label: "Full codebase code health review — 37 findings"
sidebar_position: 24
---

# Full codebase code health review — 37 findings

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | No |
| **PR** | [https://github.com/sdnydude/portage/pull/65](https://github.com/sdnydude/portage/pull/65) |
| **Completed** | 2026-05-15 |
| **Model** | claude-opus-4-6 |

## Approach

Systematic review: 30 Important + 7 Minor findings across security, data integrity, error handling, admin guards, dead code

## Commits

- `762617d fix: rate limiter per-route`
- `59ccb17 fix: review fixes — deleteDraft error, metrics try/catch, TTL dedup`
- `da504ce fix: orders status validation + pagination`
- `66677cd fix: error exposure — listing flow, drafts, seller profile, ship page, vision, preferences`
- `8847ed9 fix: admin guards, marketplace adapter caching, Etsy photo error handling`
- `bc88bef fix: data integrity — money precision, indexes, FK cascades, soldAt, SKU collision`
- `def18c6 fix: security hardening — helmet, metrics auth, password policy, timing oracle`
- `61f68e1 fix: resolve 12 critical findings from full code review`
- `32d50a4 fix: code health week 1 — bugs, tests, dead code, CI config`
- `67e11fa fix: window.location.assign lint fix`

## Deferred Items

- OAuth state store cleanup — no TTL eviction on eBay/Etsy Maps
- Test gaps — password policy, admin self-demote, settings allowlist untested
- Address type duplication — inline buyerAddress vs shared Address
- Hardcoded production URL in review-comments.tsx

## Surprises

- replace_all self-reference bug — global replacement matched inside its own function body
- ESLint window.location.href flagged as immutable value modification
- 3800+ lines of dead mockup code discovered and removed

## Decisions

- Rate limiter per-route not router-level — prevents logout from being throttled
- Password policy: 12-char min + uppercase + lowercase + number via Zod regex
- safeParseJSON wrapper for vision.ts — single error path instead of 4 bare catches
- Admin ALLOWED_SETTINGS_KEYS allowlist — explicit opt-in prevents arbitrary setting mutations

## Review

**Agents:** silent-failure-hunter, code-reviewer, code-simplifier
**Critical issues found:** 3
**Important issues found:** 0

## Verification

- **lint:** pass (0 errors)
- **tests:** 141/141 pass
- **typecheck:** pass

**Tags:** `code-health`, `security`, `testing`, `error-handling`, `data-integrity`, `admin`, `dead-code`

