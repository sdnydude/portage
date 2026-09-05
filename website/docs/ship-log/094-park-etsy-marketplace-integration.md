---
title: "Park Etsy marketplace integration"
sidebar_label: "Park Etsy marketplace integration"
sidebar_position: 94
slug: ship-d7aae5aa
registry_id: d7aae5aa-f894-43c0-90a8-0e1eb4c27c35
generated: true
---

# Park Etsy marketplace integration

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | simple |
| **TDD** | Yes |
| **PR** | [#183](https://github.com/sdnydude/portage/pull/183) |
| **Completed** | 2026-07-09 |
| **Model** | claude-fable-5 |

## Approach

Voice-park recipe: tag etsy-parked-2026-07, remove adapter/auth routes/UI/env/copy, drop etsy from all type unions + zod enums, swap admin/badges/porter to reverb, keep DB enum value inert with TDD-d typed 400 dead end for stray rows, update live FAQ rows

## Commits

- 9cb35c9 docs: CLAUDE.md sync + Etsy park notes
- b38dcc3 feat: park the Etsy marketplace integration

## Decisions

- DB enum value kept (PG cannot drop enum values) — inert + annotated; stray etsy rows dead-end typed via getAdapter 400 rather than crash

## Review

- Agents: —
- Critical found: 0 · Important found: 0

## Verification

- **lint:** clean
- **tests:** 610 api + 281 web; live: /marketplace/etsy 404, FAQ API + bundle zero etsy
- **typecheck:** pass

**Tags:** `etsy`, `park`, `marketplace`
