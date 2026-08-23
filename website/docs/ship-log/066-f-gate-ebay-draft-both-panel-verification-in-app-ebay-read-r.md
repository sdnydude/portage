---
title: "F-GATE eBay-draft both-panel verification + in-app eBay-read route"
sidebar_label: "F-GATE eBay-draft both-panel verification + in-app"
sidebar_position: 66
slug: ship-6652c23d
registry_id: 6652c23d-6a52-4886-9df8-3410f5b4f174
generated: true
---

# F-GATE eBay-draft both-panel verification + in-app eBay-read route

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | no PR recorded |
| **Completed** | 2026-06-23 |
| **Model** | claude-opus-4-8 |

## Approach

TDD adapter read (getEbayItemVerification) + user-scoped GET /listings/:id/ebay-offer; Playwright drives eBay-draft on both publish panels (item-detail + scan w/ real AI), reads offer back, asserts aspects.MPN. Live 3/3, independently verified via route.

## Deferred Items

- F-ORPHAN orphan-offer cleanup
- F1-F4 unified publish-confirm sheet + price/terms panels + result screen

## Decisions

- in-app read route over standalone tsx (token-refresh deadlock)
- both panels live in Playwright per user
- leave orphan eBay drafts for F-ORPHAN

## Verification

- **lint:** clean
- **tests:** api 523, web 199; live e2e 3/3
- **typecheck:** pass

**Tags:** `ebay`, `f-gate`, `verification`, `playwright`, `phase-f`
