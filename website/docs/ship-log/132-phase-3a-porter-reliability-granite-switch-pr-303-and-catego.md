---
title: "Phase 3a Porter reliability + granite switch (PR #303) and category-mismatch guard (PR #304, stacked)"
sidebar_label: "Phase 3a Porter reliability + granite switch (PR #"
sidebar_position: 132
slug: ship-47cb5195
registry_id: 47cb5195-2dda-4aa2-a040-8fd173133a44
generated: true
---

# Phase 3a Porter reliability + granite switch (PR #303) and category-mismatch guard (PR #304, stacked)

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [#303](https://github.com/sdnydude/portage/pull/303) |
| **Completed** | 2026-08-13 |
| **Model** | claude-fable-5 |

## Approach

3a: grounding validation + chat-path guards + model eval switch to granite4.1:8b + photos-strip. Guard: ancestor-root plausibility check, advisory banner, Tier-2 persistence. Both adversarially reviewed, live-proven with delivered screenshots.

## Commits

- 74be7ad feat(porter): Phase 3a reliability + grounding validation + granite4.1:8b model switch
- 487e08b feat(scan): eBay category-mismatch guard (advisory banner)

## Deferred Items

- A8 abort wiring slotted 3b.0 (registry e95934b4, operator-approved)

## Decisions

- granite4.1:8b over gemma4:12b after 4-source \<11B research + 125-prompt eval
- guard Approach A over client heuristic and alternate picker
- Tier 2 in (operator)

## Review

- Agents: cavecrew-reviewer, feature-dev:code-reviewer, pr-review-toolkit:silent-failure-hunter
- Critical found: 1 · Important found: 1

## Verification

- **lint:** clean
- **tests:** api 969/969, web 641/641
- **typecheck:** pass

**Tags:** `porter`, `granite`, `grounding`, `ebay`, `category-guard`
