---
title: "TODO.md stale cleanup — close Task 34/35, drop obsolete Reverb OAuth item (PR #190)"
sidebar_label: "TODO.md stale cleanup — close Task 34/35, drop obs"
sidebar_position: 99
slug: ship-90204e98
registry_id: 90204e98-73ff-4b2a-ac86-602635c3ae78
generated: true
---

# TODO.md stale cleanup — close Task 34/35, drop obsolete Reverb OAuth item (PR #190)

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | simple |
| **TDD** | — |
| **PR** | [#190](https://github.com/sdnydude/portage/pull/190) |
| **Completed** | 2026-07-10 |
| **Model** | claude-fable-5 |

## Approach

Docs-only: Task 35 marked done (PR #184 +43 route tests), Task 34 gap closed (tunnel config PR #182), prod CORS single-origin closed via PR #189, Reverb OAuth code-grant line deleted (PAT selling live-proven), tech-stack rows refreshed (CF Access auth, Etsy parked), header recount 48/52 to 50/52, root CLAUDE.md Remaining synced

## Commits

- a4dce30 docs(todo): close Task 34/35, drop obsolete Reverb OAuth item
- 54f57b3 Merge pull request #190

## Decisions

- Reverb OAuth code-grant declared obsolete — PAT auth ships selling

## Review

- Agents: —
- Critical found: 0 · Important found: 0

## Verification

- **lint:** clean (CI)
- **tests:** CI full suite pass (docs-only)
- **typecheck:** pass (CI)

**Tags:** `docs`, `todo`, `roadmap`
