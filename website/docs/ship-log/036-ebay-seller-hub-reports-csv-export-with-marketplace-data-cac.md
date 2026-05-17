---
title: "eBay Seller Hub Reports CSV export with marketplace data caching"
sidebar_label: "eBay Seller Hub Reports CSV export with marketplac"
sidebar_position: 36
---

# eBay Seller Hub Reports CSV export with marketplace data caching

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [https://github.com/sdnydude/portage/pull/76](https://github.com/sdnydude/portage/pull/76) |
| **Completed** | 2026-05-17 |
| **Model** | claude-opus-4-6 |

## Approach

Cache-at-prepare + format-at-export: prepare-listing persists eBay data to JSONB, export reads it without API calls

## Commits

- `fe1d32d feat(schema): add marketplaceData JSONB column + MarketplaceData type`
- `b728e8b test(csv): add TDD tests for eBay Seller Hub Reports draft export`
- `21d7f7c feat(csv): rewrite export for eBay Seller Hub Reports draft format`
- `5fc38f0 feat(prepare-listing): persist eBay category/title to marketplaceData`
- `1772246 feat(export): wire new CSV return shape + missing-category headers`
- `2925721 fix(review): address Phase 6 findings`

## Deferred Items

- Export query row limit for large inventories
- missingPrices counter
- PicURL test index brittleness
- Protocol envelope comments
- Integration test for GET /items/export

## Decisions

- Use JSONB merge (||) not full replace to preserve future marketplace data
- Keep export as pure formatter with zero API deps
- Surface cache write failures as warnings not errors

## Review

**Agents:** silent-failure-hunter, type-design-analyzer, code-reviewer, comment-analyzer, pr-test-analyzer, code-simplifier
**Critical issues found:** 2
**Important issues found:** 3

## Verification

- **lint:** clean
- **tests:** 29/29 csv-export pass, 6/6 billing regression pass
- **typecheck:** pass

**Tags:** `ebay`, `csv`, `export`, `marketplace`, `jsonb`, `seller-hub`

