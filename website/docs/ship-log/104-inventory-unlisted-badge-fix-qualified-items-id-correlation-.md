---
title: "Inventory Unlisted-badge fix — qualified items.id correlation in listed EXISTS subquery (PR #202)"
sidebar_label: "Inventory Unlisted-badge fix — qualified items.id "
sidebar_position: 104
slug: ship-d8c3a8b6
registry_id: d8c3a8b6-deea-4f14-8cda-c9b7cc6b00bd
generated: true
---

# Inventory Unlisted-badge fix — qualified items.id correlation in listed EXISTS subquery (PR #202)

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | simple |
| **TDD** | Yes |
| **PR** | [#202](https://github.com/sdnydude/portage/pull/202) |
| **Completed** | 2026-07-11 |
| **Model** | claude-fable-5 |

## Approach

Diagnosis loop: live-API curl repro (12/12 listed:false vs DB truth 12/12 true) -\> drizzle toSQL revealed unqualified correlated ref binding to listings.id -\> sql.raw-qualified outer ref + drizzle.mock toSQL regression test

## Commits

- 72d69fa fix(api): qualify items.id correlation in listed EXISTS subquery

## Review

- Agents: —
- Critical found: 0 · Important found: 0

## Verification

- **lint:** clean (CI)
- **tests:** 666/666 API tests pass (+1 regression)
- **typecheck:** pass

**Tags:** `drizzle`, `inventory`, `unlisted-badge`, `sql-generation`
