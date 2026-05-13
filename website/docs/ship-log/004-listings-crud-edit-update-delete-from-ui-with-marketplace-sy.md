---
title: "Listings CRUD — edit/update/delete from UI with marketplace sync"
sidebar_label: "Listings CRUD — edit/update/delete from UI with ma"
sidebar_position: 4
---

# Listings CRUD — edit/update/delete from UI with marketplace sync

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | simple |
| **TDD** | No |
| **PR** | [https://github.com/sdnydude/portage/pull/27](https://github.com/sdnydude/portage/pull/27) |
| **Completed** | 2026-05-10 |
| **Model** | claude-opus-4-6 |

## Commits

- `6eb7db4 feat: add marketplace sync to listing PATCH + fix hook types`
- `b0f2b83 fix: detail page save now persists title/description to items table`
- `c66363c feat: add Publish, Archive, and Relist buttons to listing detail page`
- `07d0ec9 feat: add Archived filter tab and Reverb to listings index`
- `a250817 fix: review fixes — error states, aria labels, address dirty tracking`

## Deferred Items

- Duplicate Listing type in hook vs @portage/shared
- statusConfig Record\<string\> should use exhaustive key union
- Duplicate editable field / confirmation modal patterns
- Test coverage — listings.test.ts recommended
- Three independent loading flags (consolidate to pendingAction)

## Review

**Agents:** silent-failure-hunter, type-design-analyzer, code-reviewer, comment-analyzer, pr-test-analyzer, code-simplifier
**Critical issues found:** 2
**Important issues found:** 6

**Tags:** `listings`, `crud`, `marketplace`, `ui`

