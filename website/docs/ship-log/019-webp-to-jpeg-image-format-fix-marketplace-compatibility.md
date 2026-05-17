---
title: "WebP to JPEG image format — fix marketplace compatibility"
sidebar_label: "WebP to JPEG image format — fix marketplace compat"
sidebar_position: 19
---

# WebP to JPEG image format — fix marketplace compatibility

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | simple |
| **TDD** | No |
| **PR** | [https://github.com/sdnydude/portage/pull/63](https://github.com/sdnydude/portage/pull/63) |
| **Completed** | 2026-05-14 |
| **Model** | claude-opus-4-6 |

## Approach

Switch all Sharp image processing from .webp() to .jpeg(). Update content-types and extensions in upload routes. Background removal stays PNG. No schema or adapter changes.

## Commits

- `4c75edc fix: switch image pipeline from WebP to JPEG for marketplace compatibility`
- `503037e fix: review fixes — restore WebP ext for legacy remove-bg, fix photo.webp filename`

## Deferred Items

- image.test.ts — core image functions have no direct unit tests
- ProcessedImage.format should be literal union type
- fetchPhotosAsBase64 silent content-type fallback (pre-existing)
- scan.ts R2 upload catch block loses userId (pre-existing)
- Comments on ALLOWED_TYPES for WebP input acceptance

## Surprises

- Code reviewer found missed photo.webp reference in frontend hook — outside the API file map
- Silent-failure-hunter caught legacy WebP branch removal in remove-bg ternary

## Decisions

- JPEG over WebP for all marketplace-bound images
- Preserve WebP branch in remove-bg for legacy R2 objects

## Review

**Agents:** silent-failure-hunter, type-design-analyzer, code-reviewer, comment-analyzer, pr-test-analyzer, code-simplifier
**Critical issues found:** 0
**Important issues found:** 3

## Verification

- **lint:** n/a
- **tests:** 93/93 pass (12 files)
- **typecheck:** pass (3 workspaces)

**Tags:** `image-processing`, `marketplace`, `ebay`, `etsy`, `reverb`, `webp`, `jpeg`, `sharp`, `deferred-item-13`

