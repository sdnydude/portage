---
title: "Billing enforcement gaps — marketplace count limit + background removal billing gate"
sidebar_label: "Billing enforcement gaps — marketplace count limit"
sidebar_position: 34
---

# Billing enforcement gaps — marketplace count limit + background removal billing gate

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | simple |
| **TDD** | No |
| **PR** | [https://github.com/sdnydude/portage/pull/74](https://github.com/sdnydude/portage/pull/74) |
| **Completed** | 2026-05-17 |
| **Model** | claude-opus-4-6 |

## Approach

Add billing gates at enforcement points: marketplace count check in OAuth callbacks (eBay + Etsy), atomic bg-removal gate in /images/remove-bg endpoint

## Commits

- `e11255d feat(billing): add bg-removal billing gate to /images/remove-bg`
- `2dbcf72 refactor(billing): convert POST /usage/bg-removal to read-only check`
- `9225a17 test(billing): add enforcement gate tests for marketplace + bg-removal`
- `1eb2ab7 fix(billing): idempotent monthly reset + pre-flight limit check`

## Decisions

- Defense-in-depth: check limit at both /connect GET and callback INSERT
- Post-success deduction: debit counter AFTER rembg succeeds, not before

## Review

**Agents:** advisor
**Critical issues found:** 2
**Important issues found:** 0

## Verification

- **lint:** clean
- **tests:** 6 new + 141 existing pass
- **typecheck:** pass

**Tags:** `billing`, `marketplace`, `bg-removal`, `enforcement`

