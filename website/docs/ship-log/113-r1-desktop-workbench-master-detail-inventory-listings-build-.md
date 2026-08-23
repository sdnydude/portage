---
title: "R1 desktop workbench — master-detail inventory/listings (build phase, PR pending)"
sidebar_label: "R1 desktop workbench — master-detail inventory/lis"
sidebar_position: 113
slug: ship-b23478eb
registry_id: b23478eb-d987-4c38-8993-8f26eb7267c9
generated: true
---

# R1 desktop workbench — master-detail inventory/listings (build phase, PR pending)

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | no PR recorded |
| **Completed** | 2026-07-16 |
| **Model** | claude-fable-5 |

## Approach

Subagent-driven development: 6 tasks, fresh sonnet implementer + reviewer per task, Fable whole-branch review. Prop-driven ItemDetail extraction (route page = thin wrapper, page.test.tsx untouched gate), useListNav hook, MasterDetail lg-only two-pane shell, ItemCard/ListingCard button modes, client-state selection + history.replaceState deep links (?item=/?listing=), CSS-only breakpoints (dual-render, within(workbench)-scoped tests)

## Commits

- 9eca471 refactor(web): extract prop-driven ItemDetail from inventory/\[id\] route
- 6c8fa9a feat(web): useListNav — arrow-key selection hook for workbench panes
- caf27fe feat(web): MasterDetail two-pane workbench layout (lg+)
- 4a19749 feat(web): ItemCard workbench button mode — onOpen + selected ring
- 5fcf13a feat(web): inventory desktop workbench — master-detail with arrow-key nav
- 8c87995 fix(web): hide workbench Export/Select controls when inventory is empty
- 7853134 feat(web): listings desktop workbench — master-detail with listing focus
- cbcf8b0 docs: check off Phase R1 desktop workbench
- 6de7957 fix(web): final review round — lint imports, back-chevron a11y, deterministic selected border, TODO date

## Deferred Items

- select-mode nested Link replicated into desktop pane (high, pre-existing)
- mobile deep-link hidden ItemDetail fetch
- inventory-vs-listings filter-out divergence
- live list-pane field sync
- aria listbox/roving tabindex + Enter/Escape
- replaceState param clobber + unauth redirect target + toast offset + data-item-id naming batch

## Decisions

- listing-title.test.tsx minimally scoped with within() — dual-mount jsdom disambiguation (controller-authorized)
- grid ItemCard block class adjudicated visually inert (grid blockification)

## Review

- Agents: task-reviewer x6 (sonnet), whole-branch reviewer (fable)
- Critical found: 0 · Important found: 2

## Verification

- **lint:** 0 errors, 24 warnings (-2)
- **tests:** 482/482 web (92 files); page.test.tsx regression gate 24/24 unchanged
- **typecheck:** pass

**Tags:** `workbench`, `master-detail`, `responsive`, `sdd`
