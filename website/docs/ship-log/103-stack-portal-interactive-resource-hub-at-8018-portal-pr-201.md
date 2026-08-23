---
title: "Stack portal — interactive resource hub at :8018/portal/ (PR #201)"
sidebar_label: "Stack portal — interactive resource hub at :8018/p"
sidebar_position: 103
slug: ship-4b984c18
registry_id: 4b984c18-f61c-44b0-b4eb-62b9045277e8
generated: true
---

# Stack portal — interactive resource hub at :8018/portal/ (PR #201)

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | simple |
| **TDD** | — |
| **PR** | [#201](https://github.com/sdnydude/portage/pull/201) |
| **Completed** | 2026-07-11 |
| **Model** | claude-fable-5 |

## Approach

Single-file playground (zero deps): resource catalog w/ live no-cors health pings, embedded previews for frameable resources, open-in-tab cards w/ stated reasons for frame-blocked ones, registry KB search w/ curl fallback, presets, copyable prompt from selection. Served via /portal/ alias from infra/portal (nested ro-mountpoint failure worked around with separate /srv/portal mount)

## Commits

- bd92be1 feat(infra): stack portal
- 06d6acb Merge pull request #201

## Review

- Agents: —
- Critical found: 0 · Important found: 0

## Verification

- **lint:** clean
- **tests:** live: portal 200, graph/wiki endpoints unaffected, browser screenshot w/ green health dots + embedded docs preview
- **typecheck:** pass (CI 7/7)

**Tags:** `portal`, `playground`, `nginx`, `dashboard`
