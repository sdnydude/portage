---
title: "Capture-guarantee V3 — corrections + bug-fixes auto-fire with context-window extraction"
sidebar_label: "Capture-guarantee V3 — corrections + bug-fixes aut"
sidebar_position: 30
---

# Capture-guarantee V3 — corrections + bug-fixes auto-fire with context-window extraction

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | simple |
| **TDD** | No |
| **PR** | [https://github.com/sdnydude/portage/pull/70](https://github.com/sdnydude/portage/pull/70) |
| **Completed** | 2026-05-17 |
| **Model** | claude-opus-4-6 |

## Approach

Promote V2 advisory to auto-fire using deferred-resolution context windows (corrections) and last-assistant-text extraction (bug-fixes)

## Commits

- `eaec173 feat: capture-guarantee V3`
- `2eed903 fix: exclude python/node/echo from detection`
- `e0014cf fix: address review findings`

## Review

**Agents:** code-reviewer
**Critical issues found:** 0
**Important issues found:** 5

## Verification

- **tests:** 10/10 pass
- **performance:** 141ms on 35MB

**Tags:** `hooks`, `capture-guarantee`, `corrections`, `bug-fixes`

