---
title: "Pre-Stage-3 fix batch Phase C: inventory redirects + single review card + honest label/order pages (+2 live-gate crash fixes)"
sidebar_label: "Pre-Stage-3 fix batch Phase C: inventory redirects"
sidebar_position: 62
slug: ship-cf6e90a1
registry_id: cf6e90a1-5b61-461a-abaf-fbbbd2bb23d8
generated: true
---

# Pre-Stage-3 fix batch Phase C: inventory redirects + single review card + honest label/order pages (+2 live-gate crash fixes)

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [#112](https://github.com/sdnydude/portage/pull/112) |
| **Completed** | 2026-06-11 |
| **Model** | claude-fable-5 |

## Approach

PublishSuccess Back-to-Inventory primary CTA + sheet redirect; hybrid Item Details collapses to summary once Review shows (re-collapses on List Another); stubbed label purchase -\> amber No Label Yet w/ settings link; LIVE-GATE FIXES: GET /orders/:id joins item (both order pages crashed on every real order — true cause of dead print-label); ebay-adapter normalizes AI single-string aspect values (500 on prepared publish), numbers coerce + drops logged

## Commits

- 49d0776 inventory redirects
- 0d35ca8 collapsed details card
- 4a6192d No Label Yet state
- f7858cc orders item join + crash fix
- 11c8100 review fixes + aspects normalization

## Deferred Items

- registry tracker 33c83ccd (label stub silent no-op) RESOLVED by C3

## Decisions

- orders item fetch isolated — degrades to item:null instead of 500ing the order view
- aspect normalization coerces primitives, logs real drops (no silent vanish into missing-aspect errors)

## Review

- Agents: silent-failure-hunter
- Critical found: 1 · Important found: 3

## Verification

- **lint:** 0 errors
- **tests:** web 174, api 475; live: locked-account publish -\> Saved as draft + real reason + /inventory landing; real $431 order shipped flow -\> No Label Yet amber
- **typecheck:** pass x2

**Tags:** `listing-ux`, `orders`, `redirect`, `label`
