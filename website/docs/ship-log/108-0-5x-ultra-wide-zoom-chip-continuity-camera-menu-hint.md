---
title: "0.5x ultra-wide zoom chip + Continuity camera-menu hint"
sidebar_label: "0.5x ultra-wide zoom chip + Continuity camera-menu"
sidebar_position: 108
slug: ship-2d01e66e
registry_id: 2d01e66e-defe-42a3-a426-6439e28c755b
generated: true
---

# 0.5x ultra-wide zoom chip + Continuity camera-menu hint

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | simple |
| **TDD** | Yes |
| **PR** | [#224](https://github.com/sdnydude/portage/pull/224) |
| **Completed** | 2026-07-14 |
| **Model** | claude-fable-5 |

## Approach

minZoom exposed from getCapabilities().zoom.min; 0.5x chip gated on hardware floor \<=0.5 (Safari 17+ virtual multi-lens camera); Continuity = WebKit-gated so viewfinder hints at macOS menu-bar camera dial

## Commits

- 0.5x ultra-wide zoom chip + Continuity camera-menu hint

## Review

- Agents: —
- Critical found: 0 · Important found: 0

## Verification

- **lint:** clean
- **tests:** 403 web pass, 3 new; real-device proof confirmed by Stephen (iPhone 0.5x chip + Mac hint)
- **typecheck:** pass

**Tags:** `camera`, `zoom`, `ultra-wide`, `continuity`
