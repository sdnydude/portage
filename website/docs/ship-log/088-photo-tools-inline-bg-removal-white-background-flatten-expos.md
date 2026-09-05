---
title: "Photo tools: inline BG removal + white-background flatten + exposure EV tool"
sidebar_label: "Photo tools: inline BG removal + white-background "
sidebar_position: 88
slug: ship-29b7e7d6
registry_id: 29b7e7d6-a854-42c1-875c-3def9504d66a
generated: true
---

# Photo tools: inline BG removal + white-background flatten + exposure EV tool

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [#166](https://github.com/sdnydude/portage/pull/166) |
| **Completed** | 2026-07-07 |
| **Model** | claude-opus-4-8 |

## Approach

TDD throughout under tdd-guard. API: flattenToWhite (Sharp flatten onto #ffffff, opaque JPEG) wired into /images/remove-bg; new POST /images/exposure with evToBrightnessMultiplier (2^ev, clamped ±2) + adjustExposure. Web: new ExposureTool (EV slider, CSS brightness(2^ev) live preview matching the server bake) wired into all 7 editor hosts; item-detail BG Remove made inline via useBgRemoval (interstitial BgRemovalPanel deleted); useBgRemoval exposes resultKey. Deterministic e2e vs rebuilt :3002 incl. corner-pixel-is-white proof on the saved file.

## Commits

- 9bcd46c feat(photo-tools): inline BG remove, white-bg flatten, exposure tool

## Deferred Items

- Photos BG-removed before the fix remain transparent PNGs in R2 — re-running the tool fixes each

## Decisions

- Exposure = post-capture EV slider over live camera EVC (iOS Safari getUserMedia has no exposure constraints)
- Flatten rembg cutouts to white JPEG at save time (matches eBay white-background preference)

## Review

- Agents: —
- Critical found: 0 · Important found: 0

## Verification

- **lint:** clean
- **tests:** 569 api + 266 web + e2e 21 passed/0 failed (photo-tools 3/3 incl. white-pixel proof)
- **typecheck:** pass

**Tags:** `photo-tools`, `exposure`, `bg-removal`, `rembg`, `sharp`
