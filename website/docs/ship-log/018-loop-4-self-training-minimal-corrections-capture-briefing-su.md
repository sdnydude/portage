---
title: "Loop 4 self-training (Minimal) — corrections capture + briefing surface"
sidebar_label: "Loop 4 self-training (Minimal) — corrections captu"
sidebar_position: 18
---

# Loop 4 self-training (Minimal) — corrections capture + briefing surface

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | No |
| **PR** | — |
| **Completed** | 2026-05-13 |
| **Model** | claude-opus-4-6 |

## Approach

Smallest viable feedback loop: corrections table in registry, auto-capture rule on user pushback patterns, briefing Section 8 with stats. No scoring algorithm yet — measurement first.

## Commits

- `7add557 feat(registry): add corrections table for Loop 4 self-training`
- `2e71aab feat: Loop 4 self-training correction capture + briefing surface`

## Deferred Items

- Strategy scoring algorithm (correction rate per approach over time)
- Auto-generated feedback_*.md from frequent corrections (\>3 occurrences)
- Grafana dashboard for correction trends
- A/B framework for testing rule variants
- Confidence scoring on captured patterns
- Cross-project pattern detection

## Surprises

- First correction captured was the user pushback from this very session — meta-evidence the loop works
- Pattern reuse across 4 autopost pipelines now feels frictionless (insights, decisions, ship_sessions, corrections)

## Decisions

- Build Approach #1 (Minimal) over #2 or #3
- Categories enum: docker-guessing, fabrication, missed-context, wrong-assumption, repeated-instruction, workflow-violation, other
- Stats endpoint separate from list (briefing needs aggregates not raw rows)
- Add corrections as 5th source in unified KB search

## Review

**Agents:** self-review (no new code review agents — pattern fully validated)
**Critical issues found:** 0
**Important issues found:** 0

## Verification

- **lint:** clean
- **tests:** 4 curl tests passed: capture, list, stats, KB unified search
- **typecheck:** n/a (Python registry, Pyright false positives only)

**Tags:** `loop-4`, `self-training`, `corrections`, `feedback-loop`, `autopost`, `kb-search`, `pattern-reuse`, `minimal-viable`

