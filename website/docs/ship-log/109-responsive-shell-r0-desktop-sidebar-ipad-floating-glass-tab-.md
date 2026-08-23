---
title: "Responsive shell R0 - desktop sidebar, iPad, floating glass tab bar"
sidebar_label: "Responsive shell R0 - desktop sidebar, iPad, float"
sidebar_position: 109
slug: ship-f3b8ae4a
registry_id: f3b8ae4a-0378-464b-9dc8-37a5b49ced41
generated: true
---

# Responsive shell R0 - desktop sidebar, iPad, floating glass tab bar

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [#229](https://github.com/sdnydude/portage/pull/229) |
| **Completed** | 2026-07-15 |
| **Model** | claude-fable-5 |

## Approach

11-task SDD: Sonnet builders + Fable orchestrator/inline T3+T11 + per-task boundary reviews + Fable whole-branch final review; 4 review-driven fix commits

## Commits

- 98b2054 nav constants
- 37e2874 PageHeader avatar
- 542be34 AppShell
- 8a9174b AskPorterBar
- f5771b6 TopBar
- 2f204b1 Sidebar
- 8ae84ba porter autosend
- a545adc TabBar
- 95d88ec TabBar review fixes
- e17af06 page wiring
- 61d5e47 content-width
- f1b6e47 sticky-nav ScanFlow fix
- 4952ce5 compose clearance
- de83365 compact-bar clearance sweep
- a503d50 mobile-scope clearance

## Deferred Items

- AskPorterBar focus ring
- type=button send/pills
- avatar menu aria-haspopup+Escape
- gradient transition
- tabs layout min-h-dvh lg overflow
- bulk bars clearance
- useUnreadCount dedupe
- orders-sync spec env gate

## Decisions

- listings flex-to-grid kept after screenshot adjudication
- compact-bar clearance scoped mobile-only (unlayered CSS beats Tailwind layers)
- SwipeFlow z-60 immersive tier

## Review

- Agents: sonnet-5 x9 task reviews, fable-5 final whole-branch x2 rounds
- Critical found: 0 · Important found: 4

## Verification

- **lint:** clean
- **tests:** web 439 + api 686 green; e2e 27 pass 1 env-bound known-fail
- **typecheck:** pass

**Tags:** `responsive-shell`, `R0`, `multimodel`
