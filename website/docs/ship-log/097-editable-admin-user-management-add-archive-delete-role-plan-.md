---
title: "Editable admin user management — add/archive/delete, role/plan/trial/credits, per-user limit overrides"
sidebar_label: "Editable admin user management — add/archive/delet"
sidebar_position: 97
slug: ship-aef801ae
registry_id: aef801ae-ff7f-48b2-9142-0c720036f345
generated: true
---

# Editable admin user management — add/archive/delete, role/plan/trial/credits, per-user limit overrides

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [#188](https://github.com/sdnydude/portage/pull/188) |
| **Completed** | 2026-07-09 |
| **Model** | claude-fable-5 |

## Approach

TDD: POST create couples row + CF allowlist (IdP invariant); archive syncs allowlist both ways; delete guarded (Stripe 409, audit-FK 23503→typed 409 via e.cause); limit_overrides jsonb + effectiveLimits() through all 8 meter consumers; whole-panel edit UI per item-detail precedent

## Commits

- 1dfeb81 api backend
- (ui commit) admin users web

## Decisions

- overrides as one jsonb column not per-meter columns; Stripe fields/email/counters deliberately read-only; archive=disable+allowlist-pull

## Review

- Agents: —
- Critical found: 0 · Important found: 0

## Verification

- **lint:** clean
- **tests:** 662 api + 292 web; live lifecycle proof with throwaway user incl. CF allowlist flips
- **typecheck:** pass

**Tags:** `admin`, `users`, `limits`, `cf-access`
