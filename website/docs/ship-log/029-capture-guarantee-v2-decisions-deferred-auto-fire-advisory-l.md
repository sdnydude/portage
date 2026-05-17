---
title: "Capture-guarantee V2 — decisions + deferred auto-fire, advisory logging"
sidebar_label: "Capture-guarantee V2 — decisions + deferred auto-f"
sidebar_position: 29
---

# Capture-guarantee V2 — decisions + deferred auto-fire, advisory logging

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | simple |
| **TDD** | — |
| **PR** | [https://github.com/sdnydude/portage/pull/69](https://github.com/sdnydude/portage/pull/69) |
| **Completed** | — |
| **Model** | claude-opus-4-6 |

## Approach

Deterministic detection for decisions (file-write pattern) and deferred items (ship-state.md parsing), advisory-only for corrections/bug-fixes

## Commits

- `2d33ea5 feat: capture-guarantee V2`
- `c04b200 fix: address review findings`

## Deferred Items

- Correction auto-fire
- Bug-fix auto-fire
- Malformed decision quality gate test

## Review

**Agents:** silent-failure-hunter, code-reviewer, pr-test-analyzer
**Critical issues found:** 0
**Important issues found:** 7

## Verification

- **lint:** n/a
- **tests:** 7/7 hook tests + 141/141 API tests
- **typecheck:** n/a

**Tags:** `capture-guarantee`, `v2`, `decisions`, `deferred-items`

