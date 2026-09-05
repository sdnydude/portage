---
title: "Multi-shot camera: one getUserMedia session per capture burst"
sidebar_label: "Multi-shot camera: one getUserMedia session per ca"
sidebar_position: 86
slug: ship-76d9a5cb
registry_id: 76d9a5cb-46cc-409d-bf6d-be95408553e1
generated: true
---

# Multi-shot camera: one getUserMedia session per capture burst

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | simple |
| **TDD** | Yes |
| **PR** | [#155](https://github.com/sdnydude/portage/pull/155) |
| **Completed** | 2026-07-02 |
| **Model** | claude-fable-5 |

## Approach

Root cause of iOS/macOS re-prompts on photo 2+: per-shot stream teardown (CameraCapture stop() in handleCapture + scan-flow closing per shot) = new getUserMedia per photo = new Safari prompt. Now one live stream per session: shutter-per-photo with flash + count badge, Done releases once; scan-flow stays open (MAX_PHOTOS auto-close); PhotoCaptureFlow CameraMode dup replaced with shared CameraCapture (also gains 1:1 guide + square capture it missed). Dead code flagged untouched: capture-sheet.tsx, photo-capture.tsx (zero callers).

## Commits

- 73ce81a fix(capture): one camera session per multi-photo capture

## Deferred Items

- delete dead capture-sheet.tsx + photo-capture.tsx (zero callers)

## Verification

- **lint:** clean (baseline)
- **tests:** web 257; camera e2e green vs rebuilt container post-merge; 6 CI checks green
- **typecheck:** pass

**Tags:** `camera`, `permissions`, `ios`, `capture`
