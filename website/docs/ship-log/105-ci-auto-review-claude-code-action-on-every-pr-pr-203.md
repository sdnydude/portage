---
title: "CI auto-review: claude-code-action on every PR (PR #203)"
sidebar_label: "CI auto-review: claude-code-action on every PR (PR"
sidebar_position: 105
slug: ship-8a611d5f
registry_id: 8a611d5f-93a3-44c8-b886-14504cb02aa3
generated: true
---

# CI auto-review: claude-code-action on every PR (PR #203)

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | simple |
| **TDD** | No |
| **PR** | [#203](https://github.com/sdnydude/portage/pull/203) |
| **Completed** | 2026-07-11 |
| **Model** | claude-fable-5 |

## Approach

anthropics/claude-code-action@v1 on pull_request, self-hosted runner, claude-sonnet-5, max-turns 12, concurrency-cancel; secrets via container-env file-redirect; first run self-skipped by design (workflow not yet on default branch); live cost test = next PR

## Commits

- 312b749 ci: Claude auto-review on every PR

## Deferred Items

- required-status-check after cost measurement
- CodeRabbit overlap decision

## Decisions

- GitHub required-check wall over Claude-side hook tripwire for deterministic review enforcement

## Review

- Agents: —
- Critical found: 0 · Important found: 0

## Verification

- **lint:** clean
- **tests:** CI green on PR #203; review job validated-skip as designed
- **typecheck:** n/a (workflow yaml)

**Tags:** `ci`, `claude-code-action`, `review-automation`
