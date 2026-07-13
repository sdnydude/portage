# 0.5× Ultra-Wide in Browser — iPhone Direct vs Mac Continuity Camera

Researched 2026-07-13 from current sources (WebKit main source fetched same day, webkit.org release blogs, WebKit Bugzilla, Chromium tracker). UNVERIFIED items flagged.

## Verdict

| Context | 0.5× possible? | How |
|---|---|---|
| iPhone direct, Safari/PWA | **YES** (iOS 16.3+/best iOS 17+) | `applyConstraints({advanced:[{zoom:0.5}]})` on default rear (virtual Dual Wide/Triple device), or deviceId-select "Back Ultra Wide Camera" |
| Mac Chrome + Continuity Camera | **NO — not from browser** | WebKit gates zoom to iOS platform only (deliberate, source-verified). Closest: user manually sets 0.5× in macOS green-camera menu Video controls (Center Stage off) — system-wide, feeds the browser stream |

## A. iPhone direct — two paths

### A1. Device selection (iOS 16.3+)
- enumerateDevices exposes ALL rear cameras since iOS 16.3 (up to 7 devices on Pro models). WebKit device priority: BuiltInTripleCamera, BuiltInDualWideCamera, BuiltInUltraWideCamera, BuiltInDualCamera, BuiltInWideAngleCamera, BuiltInTelephotoCamera (verified in AVVideoCaptureSource.mm `cameraCaptureDeviceTypes()`).
- Selecting ultra-wide via `deviceId:{exact}` gives full native FOV = 0.5× view.
- Caveats: labels localized ("Back Ultra Wide Camera" English only — never pattern-match labels for logic); **deviceIds re-randomized per page load in WebKit** — cannot persist across sessions; labels need a granted getUserMedia first.

### A2. Zoom constraint (iOS/Safari 17+) — the clean path
- Safari 17.0 added `zoom` in MediaTrackCapabilities (webkit.org 17.0 release notes). Stale third-party articles claiming "iOS Safari has no zoom" predate this.
- Verified in current WebKit main (AVVideoCaptureSource.mm): `cameraZoomScaleFactor()` = 2.0 for BuiltInTripleCamera/BuiltInDualWideCamera → `computeMinZoom()` = **0.5**; max = min(videoMaxZoomFactor/scale, 10). Web `zoom:0.5` → AVFoundation videoZoomFactor 1.0 → full ultra-wide FOV — exactly how native Camera app 0.5× works. Web zoom values display-referenced (1.0 = normal 1×).
- Default `facingMode:{exact:"environment"}` opens Triple (Pro) / Dual Wide virtual camera → `getCapabilities().zoom ≈ {min:0.5, max:10}` on modern iPhones.
- Gate at runtime on `'zoom' in track.getCapabilities()`, not UA sniffing.
- iOS Chrome = WKWebView/WebKit, same AVVideoCaptureSource path — expected identical (UNVERIFIED: no source demonstrating zoom:0.5 in iOS Chrome specifically; one device test).
- UNVERIFIED nuance: zoom in initial getUserMedia constraints vs applyConstraints post-open — apply on track to be safe.

## B. Mac Continuity Camera — platform-gated, no browser path

1. Source-verified: `computeMinZoom()`/`computeMaxZoom()` return nullopt outside PLATFORM(IOS_FAMILY) → `getCapabilities()` NEVER contains zoom on macOS (built-in FaceTime HD or Continuity). Source comment: "We restrict zoom for now as it might require elevated permissions." Confirms PR #220 live measurement; deliberate gate, not a quirk.
2. Chrome often can't even see the Continuity device ("magic pose" gate + open Chromium #436126054: Chrome enumerates only FaceTime HD while Safari sees iPhone). Safari = reliable Mac browser for Continuity.
3. **Closest achievable:** macOS green-camera menu-bar Video controls have a pan/zoom dial **0.5× (Ultra Wide) to 5×** for Continuity Camera; applies system-wide to the feed any app receives; only works with Center Stage disabled (Macworld). Should reach a browser getUserMedia stream — UNVERIFIED with browser as consumer; 2-minute manual test recommended. Not programmatically triggerable from a page.
4. Desk View Camera: uses the ultra-wide lens (feed split), and WebKit discovery list includes AVCaptureDeviceTypeDeskViewCamera → Safari can enumerate it (source-level; live confirmation UNVERIFIED). But it's a perspective-corrected top-down desk crop, not a 0.5× scene view.

## C. Android Chrome (brief)

zoom constraint supported since ~Chrome 87 era, but sub-1.0 zoom not standardized; ultra-wide exposure OEM-dependent (Samsung exposes extra camera2 devices, Pixels hide behind logical camera); no spec-level lens-type metadata (w3c/mediacapture-main #655). Same runtime capability-probing code covers whatever a device offers.

## Implementation sketch (Portage)

```js
// Preferred: zoom on default environment camera — iOS 17+
const caps = track.getCapabilities();
if (caps.zoom && caps.zoom.min <= 0.5) {
  await track.applyConstraints({ advanced: [{ zoom: 0.5 }] });
}
// Fallback: deviceId-select ultra-wide (iOS 16.3+); re-enumerate each load.
```

- use-camera already has native zoom mode (getCapabilities().zoom + applyConstraints, PR #220) — extend: expose `minZoom` from capabilities (default 1), add 0.5× chip when minZoom ≤ 0.5. Digital mode floor stays 1× (cannot digitally widen FOV).
- Continuity on Mac: when iPhone device selected and no zoom capability, show hint pointing at macOS menu-bar camera controls (0.5×, Center Stage off).

Key sources: github.com/WebKit/WebKit AVVideoCaptureSource.mm (main, fetched 2026-07-13), webkit.org/blog/14445 (Safari 17.0), WebKit bug #253186, dominikschilling.de iOS all-back-cameras note, Chromium issue #436126054, Macworld continuity pan-zoom article, w3c/mediacapture-main #655.
