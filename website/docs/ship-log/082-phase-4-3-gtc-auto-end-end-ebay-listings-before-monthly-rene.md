---
title: "Phase 4.3: GTC auto-end — end eBay listings before monthly renewal"
sidebar_label: "Phase 4.3: GTC auto-end — end eBay listings before"
sidebar_position: 82
slug: ship-e919081f
registry_id: e919081f-4613-4b34-80f8-0e49901b5a58
generated: true
---

# Phase 4.3: GTC auto-end — end eBay listings before monthly renewal

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [#151](https://github.com/sdnydude/portage/pull/151) |
| **Completed** | 2026-07-02 |
| **Model** | claude-fable-5 |

## Approach

Full TDD under tdd-guard: gtc-renewal anniversary math (month-clamped, 2-day window) -\> POST /listings/gtc-sweep gated on seller_profiles.gtc_auto_end -\> login fire-and-forget trigger (no scheduler in api) -\> settings toggle + listing-detail Auto-ends date. Live proof on real eBay account: gate/window/error-path proven (target listing was already Seller-Hub-ended; error collected, row not archived, stale row healed). Success path composes Trade-First-proven EndFixedPriceItem.

## Commits

- 94e5cf0 feat(listings): GTC auto-end — end eBay listings before monthly renewal

## Deferred Items

- Reconcile externally-ended eBay listings (local rows stay active when ended via Seller Hub)

## Decisions

- auto-end without auto-relist (relist = same insertion fee as renewal, loses watchers)
- 2-day pre-anniversary window generalizes the day-28 ask across month lengths
- gtc math duplicated in apps/web/src/lib/gtc.ts (shared pkg is type-only)

## Verification

- **lint:** clean (baseline warnings only)
- **tests:** api 560 + web 230 + e2e green vs rebuilt containers; 6 CI checks green
- **typecheck:** pass

**Tags:** `gtc`, `ebay`, `listings`, `phase-4`
