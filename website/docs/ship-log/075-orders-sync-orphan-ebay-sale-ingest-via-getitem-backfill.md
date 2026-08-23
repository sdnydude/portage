---
title: "Orders sync — orphan eBay-sale ingest via GetItem backfill"
sidebar_label: "Orders sync — orphan eBay-sale ingest via GetItem "
sidebar_position: 75
slug: ship-6b9044cd
registry_id: 6b9044cd-c2d8-4061-9508-ee5468cf1e8d
generated: true
---

# Orders sync — orphan eBay-sale ingest via GetItem backfill

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [#139](https://github.com/sdnydude/portage/pull/139) |
| **Completed** | 2026-06-30 |
| **Model** | claude-opus-4-8 |

## Approach

Diagnosed H in two layers: swallowed errors (returned 200 \{synced:0\}) + the real blocker (orders for listings absent from local DB skipped at warn-level). Fix: errors\[\] surfacing + login-trigger + Sync button; GetItem backfill creating item+listing per eBay ItemID with lineItem-title fallback and in-run dedup. TDD throughout.

## Commits

- d09dafe feat(orders): ingest external eBay sales via GetItem backfill + surface sync errors

## Decisions

- Backfill orphan orders (create item+listing per ItemID) over nullable FKs or stub-from-payload
- Fire-and-forget login sync over blocking (never couple login to marketplace API)

## Verification

- **lint:** clean
- **tests:** api 538, web 221, 4 e2e green
- **typecheck:** pass

**Tags:** `ebay`, `orders`, `sync`, `backfill`, `getitem`
