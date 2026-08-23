---
title: "Camera zoom + Continuity Camera device picker (PR #220)"
sidebar_label: "Camera zoom + Continuity Camera device picker (PR "
sidebar_position: 106
slug: ship-08a440b8
registry_id: 08a440b8-5305-48f3-a00e-255ebd46a4fc
generated: true
---

# Camera zoom + Continuity Camera device picker (PR #220)

| Field | Value |
|-------|-------|
| **Status** | complete |
| **Complexity** | complex |
| **TDD** | Yes |
| **PR** | [#220](https://github.com/sdnydude/portage/pull/220) |
| **Completed** | 2026-07-13 |
| **Model** | claude-fable-5 |

## Approach

TDD on useCamera/square-capture/CameraCapture: native-or-digital zoom (chips+pinch), device enumeration with deviceId pinning, localStorage persistence, stale fallback, devicechange live refresh, PTZ zoom constraint; e2e vs ephemeral stack + live diagnosis on users Mac via claude-in-chrome (magic-pose root cause, zoom-not-exposed measured)

## Commits

- 08f7d78 feat(web): camera zoom + Continuity Camera device picker

## Decisions

- Digital zoom capped 3x (2048px source quality floor)
- Optical zoom from web declared impossible — macOS exposes no zoom capability on Continuity tracks (measured live)

## Verification

- **lint:** clean
- **tests:** 353 web + 4 e2e green
- **typecheck:** pass

**Tags:** `camera`, `zoom`, `continuity-camera`, `device-picker`
