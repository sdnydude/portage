---
title: "eBay listing publish hardening (PLANNED — checkpointed at Phase 2)"
sidebar_label: "eBay listing publish hardening (PLANNED — checkpoi"
sidebar_position: 43
---

# eBay listing publish hardening (PLANNED — checkpointed at Phase 2)

| Field | Value |
|-------|-------|
| **Status** | in_progress |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | — |
| **Completed** | — |
| **Model** | claude-opus-4-8 |

## Approach

Draft-first: wire prepare-listing fields through, auto-create policies+location, draft(unpublished offer)/live publish, global+per-listing mode, condition USED_* + Metadata validate, quantity, offerId reuse/dedup, updateListing sync, bulk-publish, orphan cleanup

## Decisions

- Seller Hub drafts not API-feasible -\> Portage-managed unpublished offer only
- everything-now scope ~20 tasks
- auto-create policies+location via eBay API
- global default + per-listing publish mode

**Tags:** `ebay`, `listing`, `publish`, `draft`, `hardening`

