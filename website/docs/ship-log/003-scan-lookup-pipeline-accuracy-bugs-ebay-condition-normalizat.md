---
title: "Scan/lookup pipeline accuracy bugs — eBay condition normalization, comps limit, temperature tuning, Zod validation, multi-image vision"
sidebar_label: "Scan/lookup pipeline accuracy bugs — eBay conditio"
sidebar_position: 3
---

# Scan/lookup pipeline accuracy bugs — eBay condition normalization, comps limit, temperature tuning, Zod validation, multi-image vision

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | No |
| **PR** | [https://github.com/sdnydude/portage/pull/26](https://github.com/sdnydude/portage/pull/26) |
| **Completed** | 2026-05-10 |
| **Model** | claude-opus-4-6 |

## Commits

- `e8e3604 fix: normalize eBay condition strings + increase comps limit to 25`
- `dbcf3da fix: pass category to comps search + null-safe brand+model query`
- `bb61b2a fix: add temperature/maxTokens params, set temp=0 for structured output`
- `23e5709 fix: add Zod runtime validation for AI scan/listing responses`
- `21b1bb5 feat: switch generateListingFields to multi-image vision`
- `e374f67 fix: review fixes`

## Deferred Items

- Consolidate analyzeImage/analyzeImages duplicate provider loops
- Replace ListingFieldsOutput interface with z.infer
- Remove redundant .optional() from Zod .default() chains
- Add unit tests for normalizeCondition, normalizeEbayCondition, extractJSON

## Review

**Agents:** silent-failure-hunter, type-design-analyzer, code-reviewer, comment-analyzer, pr-test-analyzer, code-simplifier
**Critical issues found:** 3
**Important issues found:** 4

**Tags:** `ai`, `vision`, `ebay`, `scan`, `validation`

