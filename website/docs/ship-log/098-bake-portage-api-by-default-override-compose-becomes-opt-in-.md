---
title: "Bake portage-api by default — override compose becomes opt-in dev overlay (PR #189)"
sidebar_label: "Bake portage-api by default — override compose bec"
sidebar_position: 98
slug: ship-75129584
registry_id: 75129584-d685-4b49-b25f-bdf0d8db13e0
generated: true
---

# Bake portage-api by default — override compose becomes opt-in dev overlay (PR #189)

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | simple |
| **TDD** | — |
| **PR** | [#189](https://github.com/sdnydude/portage/pull/189) |
| **Completed** | 2026-07-10 |
| **Model** | claude-fable-5 |

## Approach

git mv docker-compose.override.yml docker-compose.dev.yml; README/CLAUDE.md deploy-ritual docs; pre-verified all NODE_ENV dev-to-prod deltas (CORS moot via /backend rewrite, CF_ACCESS_DEV_EMAIL unset, CF_ACCESS_AUD present, certs mounted); deployed baked image; live-proved admin limit-override PATCH round-trip (yesterday's failing flow) + inventory surface

## Commits

- 6228c77 build(docker): override compose becomes opt-in dev overlay
- 265508d Merge pull request #189

## Decisions

- Baked images now, not at launch — ritual-dependent dev-mode rejected
- Keep dev overlay as explicit opt-in file
- No /health build-sha tripwire — unnecessary once baked

## Review

- Agents: —
- Critical found: 0 · Important found: 0

## Verification

- **lint:** clean (CI)
- **tests:** CI full suite pass; live admin round-trip + inventory proven in browser
- **typecheck:** pass (CI)

**Tags:** `docker`, `infra`, `deploy`, `bind-mount`
