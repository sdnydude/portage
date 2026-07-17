---
id: outcomes-study
title: Multi-Agent Team Outcomes Study
sidebar_position: 1
---

# Multi-Agent Team Outcomes Study

**Status: COMPLETE** — study closed 2026-07-17; see [Outcome](#outcome).

## Purpose

Measure whether a multi-agent team approach (Systems Architect + Code Architect + Advisor) produces better outcomes than single-agent /ship runs for complex features.

## Study Period

**Start:** 2026-05-11 (ship-session intelligence pipeline)
**Baseline:** All prior /ship runs (PRs #28-52) used single-agent approach
**Treatment:** This /ship run and subsequent complex features use multi-agent team

## Hypothesis

Multi-agent team produces:
- Fewer implementation-phase surprises (plan quality)
- Lower defect rate in review phase (architectural quality)
- More reusable patterns (design quality)
- Comparable or better total time-to-ship (efficiency)

## Metrics

### Per /ship Run (collect for both baseline and treatment)

| Metric | How to Measure | Source |
|--------|---------------|--------|
| **Plan accuracy** | Tasks added/removed/changed during Phase 4 vs Phase 3 plan | ship-state.md |
| **Review defects** | Critical + Important issues found in Phase 6 | ship-state.md review section |
| **Rework cycles** | Number of Phase 4→5→4 loops (verification failures) | ship-state.md |
| **Time-to-ship** | Wall clock from Phase 1 start to Phase 7 PR | ship-state.md timestamps |
| **Agent dispatches** | Count of subagent calls by type and model | Team experiment log |
| **Advisor invocations** | Count of Opus advisor calls + what they decided | Team experiment log |
| **Token cost** | Total tokens across all agents | Session metadata |
| **Deferred items** | Count of items discovered but not fixed | ship-state.md deferred section |
| **Pattern reuse** | Did this run produce reusable infrastructure? | Qualitative assessment |

### Baseline Data (from prior /ship runs)

Reconstruct from the 16 ship-state_v*.md files:
- Complexity rating per run
- Number of tasks per run
- Review findings per run (where recorded)
- Deferred items per run

### Comparison Protocol

1. **Match by complexity.** Only compare complex features (>5 tasks, cross-service) against each other.
2. **Control for novelty.** First-time patterns (e.g., first autopost pipeline) take longer regardless of approach. Note when a run is breaking new ground.
3. **Qualitative notes.** After each /ship run, record: what went well, what was surprising, where did agents add/subtract value.

## Team Composition

| Role | Agent Type | Model | Standing Auth |
|------|-----------|-------|---------------|
| Systems Architect | `systems-architect` | sonnet | Yes — dispatch freely |
| Code Architect | `feature-dev:code-architect` | sonnet | Yes — dispatch freely |
| Advisor | Any agent type | opus | **No — user authorizes each instance** |
| Builder/Orchestrator | Main session | opus | Yes — active session |
| Explore agents | `Explore` | sonnet | Yes — dispatch freely |
| Review agents | Various review types | sonnet | Yes — dispatch freely (Phase 6) |

## Agent Usage Guidelines

### When to dispatch Systems Architect
- Design decisions with 3+ viable approaches
- Cross-system data flow design
- Scalability and long-term pattern decisions

### When to dispatch Code Architect
- Implementation blueprints with specific files/functions
- Mapping existing codebase patterns for reuse
- Build sequence and dependency ordering

### When to request Advisor (requires user authorization)
- Information architecture decisions affecting long-term organization
- Tradeoff decisions where the stakes are high and reversibility is low
- Resolving conflicts between architect recommendations
- Process/methodology decisions

### When NOT to dispatch agents
- Single-file changes with obvious implementation
- Bug fixes with clear root cause
- Routine CRUD operations
- Tasks already well-specified in the plan

## Data Collection Checklist

After each /ship run using the multi-agent team:

- [ ] Record agent dispatches (type, model, purpose, outcome) in team experiment log
- [ ] Record Advisor invocations (what was asked, what was decided, was it followed)
- [ ] Note plan accuracy: did Phase 4 follow Phase 3 exactly, or were tasks added/changed?
- [ ] Note review defects: how many Critical/Important found in Phase 6?
- [ ] Note rework cycles: how many verification failures required revisiting?
- [ ] Record qualitative observation: where did agents add the most value?
- [ ] Record qualitative observation: where was agent overhead not worth it?

## Analysis Plan

After 5 multi-agent /ship runs:
1. Tabulate metrics for treatment runs
2. Reconstruct baseline metrics from historical ship-state files
3. Compare matched-complexity pairs
4. Write findings summary with recommendations
5. Decide: adopt multi-agent as default, modify team composition, or revert to single-agent

## Outcome

The instrumentation outlived the experiment. Instead of stopping at the 5-run pilot in the Analysis Plan, the ship-session capture pipeline went to production and has recorded every /ship run since the study started — the registry holds 109 ship sessions for Portage as of 2026-07-17. The formal matched-complexity comparison was never tabulated as a standalone report; the multi-agent pattern (architect dispatches for complex features, per-task subagent implementers and reviewers) became standing practice, as the captured sessions themselves document. Study closed 2026-07-17.
