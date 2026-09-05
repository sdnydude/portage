---
title: "Dependency audit pass — high vulns eliminated"
sidebar_label: "Dependency audit pass — high vulns eliminated"
sidebar_position: 119
slug: ship-973e6c4a
registry_id: 973e6c4a-1827-4b1a-977e-9e8afece4808
generated: true
---

# Dependency audit pass — high vulns eliminated

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | simple |
| **TDD** | — |
| **PR** | [#257](https://github.com/sdnydude/portage/pull/257) |
| **Completed** | 2026-07-22 |
| **Model** | claude-fable-5 |

## Approach

npm audit fix sweep + dropped deprecated @types/sharp + root overrides (sharp ^0.35.3, postcss ^8.5.10) against next@16.2.11 vulnerable pins + full package-lock regen (npm would not honor overrides against stale lock)

## Commits

- 201d8af chore(deps): audit pass — 15 vulns (5 high) down to 8 moderate

## Deferred Items

- 16 dependabot major-bump PRs (typescript 7, eslint 10, vitest 4, zod 4, p-limit 7, pino-http 11) — migration work, not security
- @opentelemetry/core baggage DoS — no fix upstream, openinference pins it

## Decisions

- override next pins rather than wait for next release — next@16.2.11 is latest and still pins vulnerable sharp/postcss

## Review

- Agents: —
- Critical found: 0 · Important found: 0

## Verification

- **lint:** clean (CI)
- **tests:** 736/736 API + 556/556 web
- **typecheck:** pass

**Tags:** `deps`, `audit`, `sharp`, `postcss`, `overrides`
