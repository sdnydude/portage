---
title: "Pre-Stage-3 fix batch Phase A: per-device auth sessions + stay-logged-in + immediate session-loss redirect"
sidebar_label: "Pre-Stage-3 fix batch Phase A: per-device auth ses"
sidebar_position: 60
slug: ship-911ad540
registry_id: 911ad540-0f6c-4fac-812f-aa88cda906b3
generated: true
---

# Pre-Stage-3 fix batch Phase A: per-device auth sessions + stay-logged-in + immediate session-loss redirect

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [#110](https://github.com/sdnydude/portage/pull/110) |
| **Completed** | 2026-06-11 |
| **Model** | claude-fable-5 |

## Approach

refresh_tokens table replaces users.refreshTokenHash (per-device rows, atomic rotation w/ delete-returning claim, sliding TTL); login stayLoggedIn-\>365d; web SESSION_LOST_EVENT central handler -\> /home; logout revokes server-side via api() w/ refresh-retry; admin disable revokes sessions

## Commits

- 897ebd5 refresh_tokens table
- acbc206 jwt TTL params
- 50a6146 auth routes per-session
- 01a9950 admin disable revocation
- c6b62a3 web auth-loss + logout revocation
- bda7ffc stay-logged-in checkbox
- ad052f8 drop legacy column
- 581fc07 review fixes (2 Critical)

## Deferred Items

- multi-tab rotation race UX (grace window/storage-event)
- defense-in-depth bundle (sub===userId, register stayLoggedIn, bad-json edge, createSession helper)
- scan-flow condition-snap CI flake (waitFor fix)

## Decisions

- ttlMs single-source for JWT exp + DB expires_at (string durations deleted)
- logout falls back to revoke-all on 0-row scoped delete
- session-lost only on refresh 401/403 (5xx/429 never wipe)

## Review

- Agents: silent-failure-hunter, type-design-analyzer, code-reviewer, comment-analyzer, pr-test-analyzer, code-simplifier
- Critical found: 2 · Important found: 4

## Verification

- **lint:** 0 errors
- **tests:** api 472/472, web 156/156; live gate: 2-device refresh 200/200, 30d/365d rows, dead-session-\>/home, logout deletes own row
- **typecheck:** pass x2

**Tags:** `auth`, `sessions`, `refresh-token`, `multi-device`
