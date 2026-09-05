---
title: "R0 follow-up batch (deferrals 1/3/4/5/6/7/8)"
sidebar_label: "R0 follow-up batch (deferrals 1/3/4/5/6/7/8)"
sidebar_position: 110
slug: ship-e8445e7b
registry_id: e8445e7b-6bc0-4363-bd3b-48fe297ffea9
generated: true
---

# R0 follow-up batch (deferrals 1/3/4/5/6/7/8)

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | simple |
| **TDD** | Yes |
| **PR** | [#230](https://github.com/sdnydude/portage/pull/230) |
| **Completed** | 2026-07-15 |
| **Model** | claude-fable-5 |

## Approach

Inline TDD on fix/r0-followups: focus ring, avatar-menu ARIA keyboard (Escape/arrows), gradient transition, lg:min-h-0 overflow fix, bulk-bar safe-area clearance, useUnreadCount shared-context dedupe (UnreadCountProvider in AppShell, standalone fallback), orders-sync login-trigger spec gated E2E_ORDERS_SYNC. Live proof via throwaway Playwright spec vs rebuilt :3002 + dev-mode API :8026.

## Commits

- 4bc01b0 fix(web): R0 follow-up batch — a11y, layout, badge dedupe, spec gate

## Deferred Items

- Inventory select mode: card body tap navigates (nested Link in toggle button) — pre-existing, high
- #2 type=button on AskPorterBar buttons (Stephen verdict: stays deferred)

## Decisions

- #8 gate narrowed to login-trigger describe only — the two mocked sync-button specs pass against the prod container and stay ungated

## Review

- Agents: —
- Critical found: 0 · Important found: 0

## Verification

- **lint:** clean on touched files
- **tests:** web 445 pass (+6); e2e 25 pass + orders-sync 3/1-gated; live DoD proof (unread=1 fetch, overflow=0px, screenshots)
- **typecheck:** pass

**Tags:** `r0-followups`, `responsive-shell`, `a11y`, `dedupe`
