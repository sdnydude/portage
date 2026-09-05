---
title: "Langfuse tracing + conditionNotes cap fix merged to main"
sidebar_label: "Langfuse tracing + conditionNotes cap fix merged t"
sidebar_position: 118
slug: ship-3b93421e
registry_id: 3b93421e-6e91-47c5-9761-76187a2aa95e
generated: true
---

# Langfuse tracing + conditionNotes cap fix merged to main

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | simple |
| **TDD** | — |
| **PR** | [#253](https://github.com/sdnydude/portage/pull/253) |
| **Completed** | 2026-07-22 |
| **Model** | claude-fable-5 |

## Approach

Merged feat/langfuse-tracing via PR #253 after resolving prepare-listing.ts conflict with PR #251 (reverbCategories kept inside traceRequest-wrapped generateListingFields call); protected-branch flow: merge commit moved to branch, PR opened, merged on green checks

## Commits

- 46fd5f0 Merge branch feat/langfuse-tracing into main
- 9855cb7 Merge pull request #253

## Deferred Items

- rebuild portage-api container from merged main
- Gemini vision 400 silent fallback to Claude
- JWT/CF cookie logging at info level

## Decisions

- merge whole branch over cherry-pick of cap fix only — self-host pivot changes env not code

## Review

- Agents: —
- Critical found: 0 · Important found: 0

## Verification

- **lint:** clean (CI)
- **tests:** 736/736 API pass
- **typecheck:** pass

**Tags:** `langfuse`, `tracing`, `conditionnotes`, `merge`
