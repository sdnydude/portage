---
title: "1:1 capture discipline: guided square camera capture + pan/zoom crop rewrite"
sidebar_label: "1:1 capture discipline: guided square camera captu"
sidebar_position: 85
slug: ship-a4832032
registry_id: a4832032-55cf-482e-9348-1d5b9d309926
generated: true
---

# 1:1 capture discipline: guided square camera capture + pan/zoom crop rewrite

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [#154](https://github.com/sdnydude/portage/pull/154) |
| **Completed** | 2026-07-02 |
| **Model** | claude-fable-5 |

## Approach

guideCaptureRect maps the on-screen guide square through object-cover to the capture crop (one ResizeObserver measurement drives overlay + crop), 2000px eBay cap; CropTool rewritten Instagram-style (stationary window, pointer-anchored pinch/wheel zoom via rescaleOffset, clamped cover, unchanged CropRegion contract). Post-merge e2e initially red: api tsx watch had not reloaded the mounted code — container restart fixed; full e2e 19 green.

## Commits

- e2bebfd feat(capture): 1:1 discipline — square capture + pan/zoom crop

## Decisions

- guide sized from measured px, never CSS aspect-ratio (iOS collapse)
- aspect chips removed — fixed 1:1 only per square discipline

## Verification

- **lint:** clean (baseline)
- **tests:** web 254 + full e2e 19 green vs rebuilt containers; 6 CI checks green
- **typecheck:** pass

**Tags:** `capture`, `camera`, `crop`, `1:1`, `phase-6`
