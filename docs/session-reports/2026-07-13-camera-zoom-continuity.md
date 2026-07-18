# Camera zoom + Continuity Camera — from "make zoom work" to a headless lightbox rig (PR #220)

**Span:** 2026-07-12 afternoon → 2026-07-13 evening · **PR:** #220 (merged, 93aa4c8)

## The story

Started with five words: "can you make zoom work in the camera?" Shipped, TDD throughout: a zoom API in `useCamera` (native sensor zoom via `track.applyConstraints` when the hardware exposes it, digital CSS-scale + center-crop fallback capped at 3×), 1×/2×/3× chips plus pinch-to-zoom in the shared `CameraCapture`, and crop math (`applyZoom`) that keeps the captured JPEG exactly matching the zoomed viewfinder. Proven with unit tests and a Playwright e2e against the ephemeral CI stack, screenshots archived.

Then the real goal surfaced: Stephen scans inventory in a lightbox with an iPhone mounted in the ceiling — screen unreachable — and wants to drive everything from his Mac. That became Continuity Camera support: device enumeration after the permission grant, a picker (only when >1 camera), `deviceId: {exact}` pinning, localStorage persistence with stale-device fallback, and a `zoom: true` constraint for Chrome's PTZ gate.

First live test failed — no iPhone in the list. Two guessed "fixes" earned a deserved "you guessed again?..." and a fabrication correction. The recovery defined the session: verify everything. Web research produced Apple's actual browser gate (the "magic pose": landscape, locked, screen off, motionless) and an open Chromium bug. Then claude-in-chrome automation of Stephen's actual Mac Chrome turned diagnosis empirical: enumerated his real 5 cameras, armed a `devicechange` watcher, watched "Stephen's iPhone Camera" appear the moment Photo Booth woke the Continuity session, and measured the hard truth — `getCapabilities()` exposes NO zoom on Continuity tracks; optical zoom from a web app is impossible, digital only. Stream: 1920×1440@30.

The watcher event also proved our one-shot enumeration bug: cameras that appear after the viewfinder opens never entered the list. A `devicechange` listener shipped (13th use-camera test), the live app rebuilt, and the whole flow was driven end-to-end in Stephen's browser: picker → iPhone → live studio view in the scan flow. "it works! good job!"

Merged as one PR: 16 files, +918, 353 web tests, 4 e2e specs green, 7/7 CI checks.

Session closed by drafting the next session's prompt (photo drag-reorder, 24-photo cap, video v1 with Pro.V tier + Producer/Editor agents + OSS-first research) — see `whats-next.md`.

## Learnings

- Continuity Camera is gated from browsers by Apple's "magic pose" (landscape, locked, screen off, motionless, unobstructed) or a native-app wake; native apps see it unconditionally. Sources: support.apple.com/102546, tomayac.com, Chromium issue 436126054.
- macOS exposes no zoom capability on Continuity tracks to browsers — measured live via getCapabilities. Digital zoom is the only web option.
- Enumerate-once misses late-appearing cameras; `devicechange` listener is mandatory for Continuity support.
- Local e2e must use the ephemeral stack (3998/8998, dev-bypass) — live prod-mode API has no CF-edge bypass and no service-token creds exist.
- tdd-guard rhythm: one test, run via the workspace test script (reporter visibility), minimal edit; stub-first on "not a function".
- claude-in-chrome automation of the user's own browser beats asking them to run console commands — enumerate, watch events, drive the real flow.

## Insights

- Apple's browser gate means device lists are *dynamic by design* on macOS — any camera UI that enumerates once is wrong there.
- A pixel-sampling e2e (draw video frame to canvas, read center pixel) can deterministically prove a live stream switched sources — no visual diffing needed.

## Deferred

- (none from this arc — next-session scope lives in whats-next.md)
