---
title: "Deferred items from code health review"
sidebar_label: "Deferred items from code health review"
sidebar_position: 23
---

# Deferred items from code health review

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | simple |
| **TDD** | No |
| **PR** | [https://github.com/sdnydude/portage/pull/66](https://github.com/sdnydude/portage/pull/66) |
| **Completed** | 2026-05-15 |
| **Model** | claude-opus-4-6 |

## Approach

Single fast sweep of 4 deferred items

## Commits

- `b4b4ab3 fix: add TTL sweep to OAuth state stores`
- `126b8d1 test: add password policy, admin self-demote, and settings allowlist tests`
- `56a0cbe fix: deduplicate Address type — use shared interface in ship page`
- `7c55aa7 fix: replace hardcoded production URL in review-comments with API_BASE`

## Surprises

- Address type not exported from shared barrel — had to add it
- PR #65 not yet merged to main — branched from fix/code-health-week1 instead

## Decisions

- Stack PR on fix/code-health-week1 since admin guard tests depend on code from PR #65

## Review

**Agents:** manual
**Critical issues found:** 0
**Important issues found:** 0

## Verification

- **lint:** n/a
- **tests:** 141/141 pass
- **typecheck:** pass

**Tags:** `oauth`, `testing`, `type-dedup`, `hardcoded-url`, `deferred-items`, `memory-leak`

