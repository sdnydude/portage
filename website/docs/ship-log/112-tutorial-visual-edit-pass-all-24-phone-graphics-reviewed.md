---
title: "Tutorial visual edit pass — all 24 phone graphics reviewed"
sidebar_label: "Tutorial visual edit pass — all 24 phone graphics "
sidebar_position: 112
slug: ship-2ee0c5e6
registry_id: 2ee0c5e6-947e-41e4-9cca-1fc266810d5c
generated: true
---

# Tutorial visual edit pass — all 24 phone graphics reviewed

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | simple |
| **TDD** | No |
| **PR** | [#232](https://github.com/sdnydude/portage/pull/232) |
| **Completed** | 2026-07-15 |
| **Model** | claude-fable-5 |

## Approach

Orchestrator fixed frame-level defects (fake notch occluding screenshot headers; player overflowing 390x844) then dispatched 4 parallel Sonnet workers (2 topics each, isolated data files) with a view-edit-rerender loop against a hot-reload dev server + step-render QA harness. Workers pixel-measured element bounds, resized 10 rings, converted 3 misleading empty-state tap ripples to honest callouts, shortened wrapping callout copy. Orchestrator viewed all 24 final renders, fixed green-vs-orange copy, shortened porter callout, recaptured help.png (post-#231 Tutorials card) and rang it.

## Commits

- 82286a3 visual edit pass
- 5de48c9 QA harness finally+portable out

## Deferred Items

- Porter action-pills, messages thread/reply, orders detail steps: reuse empty-state frames until demo account has real orders/conversations, then recapture + re-run render QA

## Decisions

- Notch removed from DeviceFrame — decorative chrome must not occlude captured content
- Overlays never imply controls the screenshot does not show — empty-state steps get honest callouts
- render-tutorial-steps.mjs committed as the standing visual-QA loop after any recapture

## Review

- Agents: CodeRabbit
- Critical found: 0 · Important found: 1

## Verification

- **lint:** 0 errors
- **tests:** web 467 / rails green; all 24 steps re-rendered + orchestrator-reviewed
- **typecheck:** pass

**Tags:** `tutorials`, `visual-qa`, `overlays`, `multimodel`
