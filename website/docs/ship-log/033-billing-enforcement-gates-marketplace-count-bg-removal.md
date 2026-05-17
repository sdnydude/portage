---
title: "Billing enforcement gates — marketplace count + bg-removal"
sidebar_label: "Billing enforcement gates — marketplace count + bg"
sidebar_position: 33
---

# Billing enforcement gates — marketplace count + bg-removal

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | simple |
| **TDD** | No |
| **PR** | [https://github.com/sdnydude/portage/pull/74](https://github.com/sdnydude/portage/pull/74) |
| **Completed** | 2026-05-17 |
| **Model** | claude-opus-4-6 |

## Approach

Add billing gates at enforcement points: marketplace count at /connect + callback, atomic bg-removal gate in /images/remove-bg

## Commits

- `de035fb feat(billing): add marketplace count enforcement gate`
- `e11255d feat(billing): add bg-removal billing gate to /images/remove-bg`
- `2dbcf72 refactor(billing): convert POST /usage/bg-removal to read-only check`
- `9225a17 test(billing): add enforcement gate tests for marketplace + bg-removal`

## Decisions

- Gate marketplace at /connect (fail before OAuth redirect) not callback
- Deduct bg-removal credit after rembg success not before
- Accept narrow marketplace count race window — UX makes simultaneous OAuth impossible

## Review

**Agents:** advisor
**Critical issues found:** 0
**Important issues found:** 3

## Verification

- **lint:** clean
- **tests:** 178 passed (6 new)
- **typecheck:** pass

**Tags:** `billing`, `enforcement`, `marketplace`, `bg-removal`

