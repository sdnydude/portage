---
title: "eBay category-persist + ATO publish hardening"
sidebar_label: "eBay category-persist + ATO publish hardening"
sidebar_position: 63
slug: ship-f4a461b0
registry_id: f4a461b0-31ff-4618-b65b-c9d982181872
generated: true
---

# eBay category-persist + ATO publish hardening

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | — |
| **PR** | [#118](https://github.com/sdnydude/portage/pull/118) |
| **Completed** | 2026-06-19 |
| **Model** | claude-opus-4-8 |

## Approach

Persist eBay leaf categoryId on items; serialized stable SKU (atomic UPDATE..COALESCE) + idempotent offer + User-Agent to kill ATO churn signals; independent /code-review ultra triaged read-only, all 5 findings kept

## Commits

- 6fcd1ca User-Agent
- d960246 serialized SKU
- 8e157c1 stable mint
- 24d4f9f idempotent offer
- 26f4a62 omitted fn
- b405754 ultra review fixes

## Deferred Items

- End-to-end publish blocked by account-side ATO lock
- eBay/Cloudflare docs ingestion to KB+Docusaurus

## Decisions

- Keep direct residential egress (reject Cloudflare/proxy)
- Atomic COALESCE mint over read-then-write
- Publish prefers listing.ebaySku over item SKU

## Review

- Agents: /code-review ultra
- Critical found: 0 · Important found: 2

## Verification

- **lint:** clean
- **tests:** api 489/489, web 177/177
- **typecheck:** pass

**Tags:** `ebay`, `ato`, `sku`, `idempotency`, `code-review`
