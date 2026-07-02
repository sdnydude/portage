---
title: "eBay return-policy diagnosis + 56-deferral audit + c3b3013c publish-wiring fix"
sidebar_label: "eBay return-policy diagnosis + 56-deferral audit +"
sidebar_position: 47
---

# eBay return-policy diagnosis + 56-deferral audit + c3b3013c publish-wiring fix

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | No |
| **PR** | — |
| **Completed** | — |
| **Model** | claude-opus-4-8 |

## Approach

Live eBay API diagnosis (token mint from encrypted refresh token); 7 parallel CodeGraph/Serena agents auditing 56 deferrals; 2-line publish-pill wiring fix mirroring swipe-flow

## Deferred Items

- c3b3013c manual Gate-2 verify pending
- AI-fill aspects during scan epic
- Porter update_item tool

## Decisions

- Fallback/chat publish pills default publishMode to explicit live

## Verification

- **lint:** clean (0 errors)
- **tests:** 12/12 web tests pass
- **typecheck:** pass

**Tags:** `ebay`, `audit`, `listing-flow`, `registry`

