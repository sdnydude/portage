---
title: "Reverb per-image photo DELETE + hardening-batch audit"
sidebar_label: "Reverb per-image photo DELETE + hardening-batch au"
sidebar_position: 93
slug: ship-c974d4f2
registry_id: c974d4f2-0549-4bb2-a264-280589a4c08e
generated: true
---

# Reverb per-image photo DELETE + hardening-batch audit

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | simple |
| **TDD** | Yes |
| **PR** | [#181](https://github.com/sdnydude/portage/pull/181) |
| **Completed** | 2026-07-09 |
| **Model** | claude-fable-5 |

## Approach

Audit first: 6 review items + PATCH re-enrich all already closed in-ship (registry marked resolved). Real gap TDD: updateListing diffs GET /listings/:id/images by original_url (shape live-pinned via owner-token probe) and DELETEs stale images; dashboard uploads untouched; failures degrade to warning

## Commits

- 91a28d7 feat(api): Reverb per-image DELETE — dropped photos no longer linger

## Decisions

- stale-image diff keyed on original_url echo, not position; unknown-origin images never deleted

## Review

- Agents: —
- Critical found: 0 · Important found: 0

## Verification

- **lint:** clean
- **tests:** 609 api green; live-proven DELETE on draft 96910051 (image 302496836 removed, kept image intact, state draft)
- **typecheck:** pass

**Tags:** `reverb`, `photos`, `marketplace`
