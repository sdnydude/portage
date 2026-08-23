---
title: "AI-specifics A-E core (scan aspect-fill -> persist -> publish carry-through, no aspect pop-up)"
sidebar_label: "AI-specifics A-E core (scan aspect-fill -> persist"
sidebar_position: 65
slug: ship-b1fa6d2f
registry_id: b1fa6d2f-77f4-4de4-888d-78ba32f3697d
generated: true
---

# AI-specifics A-E core (scan aspect-fill -\> persist -\> publish carry-through, no aspect pop-up)

| Field | Value |
|-------|-------|
| **Status** | in_progress |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | no PR recorded |
| **Completed** | 2026-06-22 |
| **Model** | claude-opus-4-8 |

## Approach

Phased A-E. A: scan AI-fills eBay specifics (2nd vision call). B/C: items.aspects column + carry into all publish paths + fix MPN-\>25002. D: scan UI persists aspects. E-core: AI aspects surface as confirmable [AI] chips in scan review.

## Commits

- 43ff199 A: mpn + scan-time aspect prefill
- 129b76c B+C: items.aspects + carry-through + MPN fix
- e2c9c51 D: scan UI persists aspects
- d001429 E-core: [AI] chips

## Deferred Items

- E-panel AiIdentificationPanel (cosmetic)
- F unify publish + price/terms 7-day dismiss
- G Save&List lists not draft
- H orders sync
- I remove carriers-\>eBay policy
- camera scan e2e

## Decisions

- B2 2nd-vision-call over text-only/Lever A
- defer carriers-\>eBay shipping policy

## Verification

- **lint:** clean
- **tests:** api 513, web 185, e2e 8/8 vs rebuilt portage-app
- **typecheck:** pass

**Tags:** `ebay`, `aspects`, `scan`, `publish`, `mpn`, `ai-specifics`
