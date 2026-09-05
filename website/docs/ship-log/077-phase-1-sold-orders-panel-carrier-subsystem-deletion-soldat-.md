---
title: "Phase 1: sold-orders panel + carrier subsystem deletion + soldAt heal"
sidebar_label: "Phase 1: sold-orders panel + carrier subsystem del"
sidebar_position: 77
slug: ship-aca32f61
registry_id: aca32f61-6af2-42d3-874b-e2af6b64337d
generated: true
---

# Phase 1: sold-orders panel + carrier subsystem deletion + soldAt heal

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [#142](https://github.com/sdnydude/portage/pull/142) |
| **Completed** | 2026-07-01 |
| **Model** | claude-fable-5 |

## Approach

Worktree-isolated TDD build per approved 7-phase plan: relocate disclaimer flow, delete carrier layer (-2474 lines), items join for thumbnail/title rows, self-healing soldAt on re-sync; gate = rebuilt containers + Playwright e2e + live-data verification before merge

## Commits

- d22945e refactor(shipping): delete carrier subsystem
- 584f321 feat(orders): sold-orders panel — thumbnail, title, date, price
- 84c6bb4 fix(orders): heal stale soldAt on re-sync + sold-list e2e
- ac5ea55 docs(verification): sold-list e2e proof screenshots
- 6024d1f merge PR #142

## Deferred Items

- users.ship_from_address + shipping_auto_mark columns left inert (no consumer)
- label_purchased status remains in order enum + detail UI (defensive, no rows can reach it)

## Decisions

- Disclaimer flow relocated to /disclaimer router instead of dying with shipping.ts (FE hook paths updated)
- shipping_presets deleted along with providers — only consumers were the deleted routes/pages; weight/dims live on items
- Mark-as-Shipped via existing PATCH /orders/:id from payment_received (ship on eBay, record locally)
- sold-celebration Ship-It routes to order detail (component orphaned; no ItemID plumbing)

## Review

- Agents: —
- Critical found: 0 · Important found: 0

## Verification

- **lint:** 0 errors
- **tests:** api 546, web 224, e2e 15 green vs rebuilt containers; LIVE: 11 demo orders healed to real sold dates 06-02..06-23
- **typecheck:** pass (3 workspaces)

**Tags:** `orders`, `sold-list`, `carrier-deletion`, `soldat-heal`, `phase-1`, `trade-first`
