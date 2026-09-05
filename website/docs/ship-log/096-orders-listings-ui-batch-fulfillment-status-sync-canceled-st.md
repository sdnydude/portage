---
title: "Orders/listings UI batch: fulfillment-status sync + canceled status + titles + badge"
sidebar_label: "Orders/listings UI batch: fulfillment-status sync "
sidebar_position: 96
slug: ship-d6433199
registry_id: d6433199-a176-40f5-8826-4d08f8c75227
generated: true
---

# Orders/listings UI batch: fulfillment-status sync + canceled status + titles + badge

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [#187](https://github.com/sdnydude/portage/pull/187) |
| **Completed** | 2026-07-09 |
| **Model** | claude-fable-5 |

## Approach

TDD: adapter maps orderFulfillmentStatus + cancelStatus; sync imports + heals (upgrade-only for shipped, cancel wins); 90d window + next-link pagination; listings items join; BetaCta repositioned; detail canceled notice; display_name data fix

## Commits

- b0274f6 UI batch
- 45f3bcc 90d window
- 448b4ba canceled status
- e6ee5f7 pagination + detail notice

## Decisions

- fulfillmentStatus normalized in shared adapter contract; cancel wins over FULFILLED and over any local state; shipped heal upgrade-only

## Review

- Agents: coderabbit
- Critical found: 0 · Important found: 2

## Verification

- **lint:** clean
- **tests:** 655 api + 290 web; LIVE: 12/12 orders truthful (11 shipped + 1 canceled), ship queue empty, screenshots
- **typecheck:** pass

**Tags:** `orders`, `fulfillment`, `canceled`, `heal`
