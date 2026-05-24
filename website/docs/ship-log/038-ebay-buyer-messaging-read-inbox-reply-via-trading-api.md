---
title: "eBay buyer messaging — read inbox + reply via Trading API"
sidebar_label: "eBay buyer messaging — read inbox + reply via Trad"
sidebar_position: 38
---

# eBay buyer messaging — read inbox + reply via Trading API

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [https://github.com/sdnydude/portage/pull/84](https://github.com/sdnydude/portage/pull/84) |
| **Completed** | 2026-05-19 |
| **Model** | claude-opus-4-6 |

## Approach

Trading API (XML) with OAuth2 via X-EBAY-API-IAF-TOKEN, fast-xml-parser, sanitize-html, 5 endpoints, full frontend

## Commits

- `911eb3b feat: add eBay buyer messaging backend`
- `5534173 feat: add buyer messaging frontend`
- `3a60fdd fix: address 18 advisor review findings`
- `fd8c825 fix: resolve 11 PR #84 findings + 5 wiring issues`

## Deferred Items

- Sync pagination beyond page 1
- parseGetMyMessages dead code cleanup
- Reverb/Etsy messaging

## Decisions

- Trading API XML over REST Messaging API
- conversationKey = buyerUsername:itemId grouping
- Manual sync only, no background polling

## Review

**Agents:** silent-failure-hunter, type-design-analyzer, code-reviewer, comment-analyzer, pr-test-analyzer, code-simplifier
**Critical issues found:** 3
**Important issues found:** 10

## Verification

- **lint:** 0 errors
- **tests:** 238/238 pass (31 new)
- **typecheck:** pass

**Tags:** `messaging`, `ebay`, `trading-api`, `xml`, `tdd`

