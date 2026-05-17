---
title: "Reverb token-paste auth flow"
sidebar_label: "Reverb token-paste auth flow"
sidebar_position: 35
---

# Reverb token-paste auth flow

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | simple |
| **TDD** | No |
| **PR** | [https://github.com/sdnydude/portage/pull/75](https://github.com/sdnydude/portage/pull/75) |
| **Completed** | 2026-05-17 |
| **Model** | claude-opus-4-6 |

## Approach

Token-paste instead of OAuth (Reverb only supports PATs). Validate against /my/account, encrypt, store.

## Commits

- `0e2e80e feat(marketplace): add Reverb token-paste auth flow`
- `08758f0 fix(reverb): extract shop name from correct API response field`
- `f445b64 fix(reverb): compute expired field from tokenExpiresAt`
- `f93ee33 fix(reverb): address advisor findings — rate limit, timeout, stable ID`

## Deferred Items

- Reverb token revocation detection (periodic polling or webhook)
- Frontend UI for token-paste settings page

## Decisions

- Token-paste over OAuth — Reverb does not support third-party OAuth apps
- Use stable numeric user_id as marketplaceUserId, not mutable shop name

## Review

**Agents:** code-reviewer, advisor
**Critical issues found:** 0
**Important issues found:** 5

## Verification

- **lint:** clean
- **tests:** 178/178 pass
- **typecheck:** pass

**Tags:** `reverb`, `marketplace`, `auth`, `token-paste`

