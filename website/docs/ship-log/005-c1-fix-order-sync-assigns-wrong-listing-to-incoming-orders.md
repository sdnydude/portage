---
title: "C1 — Fix order sync assigns wrong listing to incoming orders"
sidebar_label: "C1 — Fix order sync assigns wrong listing to incom"
sidebar_position: 5
---

# C1 — Fix order sync assigns wrong listing to incoming orders

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | simple |
| **TDD** | No |
| **PR** | [https://github.com/sdnydude/portage/pull/28](https://github.com/sdnydude/portage/pull/28) |
| **Completed** | 2026-05-10 |
| **Model** | claude-opus-4-6 |

## Commits

- `2c640e3 feat: add marketplaceListingId to MarketplaceOrderResult in all adapters`
- `cb95aec fix: order sync matches by marketplaceListingId instead of first active`
- `9fcac4a fix: review fixes — marketplace filter, Reverb sync, null type, error logging`

## Deferred Items

- Missing shippingAddress column on orders table
- Hardcoded marketplaceFees: 0 for Etsy and Reverb
- Lost soldAt timestamps from marketplace APIs
- Multi-item eBay orders only sync first line item
- No test coverage for order sync

## Review

**Agents:** silent-failure-hunter, type-design-analyzer, code-reviewer, comment-analyzer, pr-test-analyzer, code-simplifier
**Critical issues found:** 3
**Important issues found:** 3

**Tags:** `security`, `orders`, `marketplace`, `c1`

