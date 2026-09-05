---
title: "DB-backed FAQs + admin FAQ editor"
sidebar_label: "DB-backed FAQs + admin FAQ editor"
sidebar_position: 91
slug: ship-200a3d28
registry_id: 200a3d28-d7d2-4c47-8c2b-2ac30874269e
generated: true
---

# DB-backed FAQs + admin FAQ editor

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | simple |
| **TDD** | Yes |
| **PR** | [#178](https://github.com/sdnydude/portage/pull/178) |
| **Completed** | 2026-07-09 |
| **Model** | claude-fable-5 |

## Approach

faqs table + GET /faqs + admin CRUD/reorder with audit logging; 14 approved FAQs seeded idempotently; help page fetches from API (stale hardcoded set deleted); FaqSection editor (add/edit/delete/show-hide/reorder) mounted on admin App Settings

## Commits

- ed739cc api storage+routes
- seed
- help page
- faq editor

## Review

- Agents: —
- Critical found: 0 · Important found: 0

## Verification

- **lint:** clean
- **tests:** 601 API + 277 web green
- **typecheck:** pass

**Tags:** `faq`, `admin`, `help`
