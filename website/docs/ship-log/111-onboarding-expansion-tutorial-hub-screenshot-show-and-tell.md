---
title: "Onboarding expansion — tutorial hub + screenshot show-and-tell"
sidebar_label: "Onboarding expansion — tutorial hub + screenshot s"
sidebar_position: 111
slug: ship-ffc75f09
registry_id: ffc75f09-e2b9-4e4c-8fa6-3eb7060210d9
generated: true
---

# Onboarding expansion — tutorial hub + screenshot show-and-tell

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [#231](https://github.com/sdnydude/portage/pull/231) |
| **Completed** | 2026-07-15 |
| **Model** | claude-fable-5 |

## Approach

11-task plan executed inline (subagent dispatch declined) in an isolated git worktree; tdd-guard bridged to worktree test output via approved symlink. 8 React-free topic modules + capture manifests, DeviceFrame (4 overlay animations), TutorialPlayer, /tutorials hub + [topic] route (first async server-component page), 3 entry points, carousel device-frames, Playwright capture pipeline, 24 committed demo-account PNGs, overlay coords verified against real captures. Manifest re-verification vs R0 shell applied 2 deviations (porter input-scoped selector, visible-filter locators) — both proven necessary live.

## Commits

- 32ee719 tutorial content model
- 096d8f2 topics batch 1
- T3 topics batch 2
- 2f-series DeviceFrame/player/hub/route/entries/carousel
- f99e090 capture pipeline
- 90089ab screenshots + coords
- 29a2173 review round

## Deferred Items

- Bulk-mode capture for inventory/bulk.png — blocked by select-mode nested-Link bug (registry-logged, high)
- Orders/messages detail captures reuse empty-state frames until demo account has orders/conversations
- Richer demo-account inventory for marketing-grade tutorial screenshots

## Decisions

- Inline build over subagent dispatch (Stephen declined the Agent dispatch mid-plan)
- tdd-guard worktree bridge via symlink (Stephen-approved) over building in main checkout
- Capture-script skips stay exit-0 but are counted and surfaced (plan skip-and-reuse design kept against CodeRabbit fail-closed suggestion)

## Review

- Agents: CodeRabbit
- Critical found: 0 · Important found: 2

## Verification

- **lint:** 0 errors
- **tests:** web 467 (+15) / api 686; committed tutorials e2e green vs rebuilt :3002; DoD walks 390x844 + 375x667
- **typecheck:** pass

**Tags:** `onboarding`, `tutorials`, `capture-pipeline`, `device-frame`, `worktree`
