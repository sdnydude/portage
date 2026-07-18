---
title: "eBay required item specifics — proactive in-flow collection + publish gate"
sidebar_label: "eBay required item specifics — proactive in-flow c"
sidebar_position: 46
---

# eBay required item specifics — proactive in-flow collection + publish gate

| Field | Value |
|-------|-------|
| **Status** | in_progress |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | — |
| **Completed** | 2026-06-06 |
| **Model** | claude-opus-4-8 |

## Approach

Fixed the eBay publish bug chain (25709 Accept-Language header, 25001 transient, 25002 missing required item specifics). Server gate in createListing throws EbayAspectsRequiredError(422) before any eBay/DB write; AppError carries structured details. Reactive AspectFillSheet on listing detail (path A) + all 3 flows as backstop. Then reworked per user correction to PROACTIVE: new GET /marketplace/ebay/category-aspects/:categoryId + useRequiredAspects hook; preview card renders editable AI-prefilled item specifics, flags required-empty, blocks eBay live publish until filled.

## Commits

- `60d9c82 fix(ebay): Accept-Language en-US (25709)`
- `c687b3f feat(ebay): gate publish on required item specifics with 422`
- `6757315 feat(web): reactive Complete eBay details sheet (path A)`
- `978a692 feat(web): wire all 3 flows to aspect-fill sheet`
- `c61de00 feat: collect eBay item specifics in the flow not at publish`

## Deferred Items

- cache getRequiredAspects per category 24h TTL

## Decisions

- gate aspects inside createListing not the route
- proactive in-flow collection; publish gate is backstop only

## Verification

- **lint:** clean (0 errors)
- **tests:** api touched-files green (ebay-adapter 40, listings 9, error 5, ebay-auth 6); web 12 green
- **typecheck:** pass

**Tags:** `ebay`, `aspects`, `item-specifics`, `publish`, `listing-flow`, `ux`

