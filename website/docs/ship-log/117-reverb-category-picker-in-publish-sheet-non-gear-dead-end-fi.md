---
title: "Reverb category picker in publish sheet (non-gear dead-end fix)"
sidebar_label: "Reverb category picker in publish sheet (non-gear "
sidebar_position: 117
slug: ship-66f6681d
registry_id: 66f6681d-75a0-4850-8d76-46d67ab51b6c
generated: true
---

# Reverb category picker in publish sheet (non-gear dead-end fix)

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | simple |
| **TDD** | Yes |
| **PR** | no PR recorded |
| **Completed** | 2026-07-21 |
| **Model** | claude-fable-5 |

## Approach

GET /marketplace/reverb/categories (cached flat list), useReverbCategories hook, picker select in ListingPreviewCard (prefilled from AI-prepared category for gear), Reverb publish button unlocked for non-gear items once a category is chosen, uuid carried through onPublish -\> PublishOptions.reverbCategoryUuid -\> marketplaceSpecificFields.categoryUuid in hybrid + conversational flows

## Verification

- **lint:** clean
- **tests:** 719 api / 556 web
- **typecheck:** pass

**Tags:** `reverb`, `categories`, `publish-sheet`, `frontend`
