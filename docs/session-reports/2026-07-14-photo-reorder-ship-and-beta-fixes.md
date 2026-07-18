# Photo Reorder + 24-Cap Ship, Wide-Angle, and the Beta-Report Fix Batch

**Session span:** 2026-07-13 evening → 2026-07-14 evening
**PRs:** #223 (merged), #224 (merged), #225 (merged), #226 (merge pending CodeRabbit)

## The story

The session opened by executing the whats-next.md handoff prompt: three listing-media features (photo drag-reorder, 24-photo cap, video v1). Research ran first in background agents while the photo features were brainstormed — three verified research reports landed and were committed: video production tooling (verdict: 100% OSS — ffmpeg + Mediabunny + R2/CF, no mandatory hosted component; fluent-ffmpeg is dead, Remotion disqualified by its $100/mo automation floor), eBay/Reverb media limits (eBay video works with our Trading path via `Item.VideoDetails.VideoID`; Reverb video is YouTube-link only; photo caps 24/25 — making our 24 exactly right), and 0.5× ultra-wide browser access (iPhone direct: YES via `zoom: 0.5` on the virtual multi-lens camera, Safari 17+, WebKit-source-verified; Mac Continuity: hard platform gate, menu-bar dial is the only control).

F1+F2 were combined into one /ship. The defining moment was Stephen ordering **adversarial** architect + engineer plan reviews: both REJECTED plan v1 with four verified blockers — flow reorder that publish would silently ignore (publish reads `items.photos`, drafts don't), a drag mechanism that was mouse-only by construction (touch implicitly captures the pointer, so `pointerenter` drop targets never fire), a per-drop PATCH pipeline that meant one full eBay revise per gesture plus a stale-state clobber race, and index-keyed async photo tools that corrupt the wrong photo under concurrent reorder. Plan v2 rebuilt the persistence model (optimistic order + one coalesced PATCH on release) and specified a touch-capable hook contract (elementFromPoint hit-testing, live-reorder preview, pointercancel, scroll-wins tolerance, click suppression). A deferral scrub under the no-deferrals rule pulled the draft stale-retry race fix and lazy thumb loading INTO scope, keeping only two deferrals with dev-impact rationale (thumbnail pipeline = separate storage-domain ship with backfill migration; R2 orphan GC = data-loss risk without a reference-safety design).

The 14-task TDD build surfaced two bugs no unit layer could catch: the C12 import inserter placed `import` above `"use client"` in 5 files — vitest and tsc both green, only the Next prod build (and therefore the Docker e2e image build) failed; and the e2e drag failed because Playwright measured tile boundingBoxes mid slide-up animation, targeting coordinates a full viewport below the screen (an instrumented headless probe isolated it; a settle-wait on `rect.y === 0` fixed it). Live proof ran against real prod data: a GetItem-imported item with seven keyless photos was reordered through the deployed UI, DB-verified as the exact `movePhoto` result with renormalized isPrimary, then restored byte-identical.

The 7-agent phase-6 review earned its cost: two shipping-grade criticals (picture-guard errors thrown as plain `Error` were being buried as generic 500s by the routes — converted to `AppError(400,'EBAY_PICTURE_LIMIT')`; and the zero-photo revise throw would have silently starved price/title sync for photo-less listed items because `hasContentChange` treats any photos array as content — resolved as warn-and-keep-pictures with an explicit `allowEmptyPictures` opt-in), plus the optimistic preview literally not wired into the render (two agents independently), crop/exposure handlers that had silently missed the key-safe refactor (indentation made the earlier replace a no-op), an unhandled-rejection save path, and a double-tap PATCH-body race.

Post-merge reality testing drove three more fixes the same day. iPhone: the long-press opened iOS's image save/copy callout instead of the drag (`-webkit-touch-callout: none` + contextmenu suppression — invisible to every automated layer). Desktop: drag was dead because the touch-tuned hold-still contract cancelled the desktop press-and-drag habit (pointer-type split: mouse activates on >5px travel). Then Stephen asked about beta reports and caught a bad miss: the answer "no reports, no mechanism exists" was wrong — beta reports proxy to the DHG Registry, not the app DB, and his critical same-day report was sitting there. Correction posted. The report's three symptoms all fixed in #226: gallery-add restored in the capture stage after the first photo, the + tile now opens the Camera/Gallery CaptureSheet everywhere instead of a bare file picker, and "could not fetch" on save (server logs proved the requests never arrived — CF Access session expiry killing the fetch) now recovers via session re-exchange + one retry, with an actionable message on hard failure.

The 0.5× wide-angle mini-ship (#224) rode the research: `minZoom` exposed from capabilities, capability-gated 0.5× chip, Continuity hint pointing at the macOS camera dial. Device-proven by Stephen.

## Learnings

- The touch/mouse pointer split is not an implementation detail — it is two different activation contracts (hold for touch, travel for mouse), and testing one with synthetic events of the other proves nothing.
- vitest + tsc + lint form a gate with a hole: only the Next production build enforces `"use client"` placement; run it before any e2e image build.
- Playwright boundingBox during entry animations targets pre-animation coordinates; any sheet/overlay spec needs a settle-wait before measuring.
- "Verified live" via dispatched pointer events is weaker than real input: the synthetic desktop proof held still 650ms and masked the mouse-activation bug real users hit immediately.
- Categorical absence claims ("no reports exist") must state literal scope of what was searched; the beta pipeline writes to the Registry, not the app DB.
- Adversarial plan review before build converted four would-be production bugs into plan changes — the cheapest fixes of the whole ship.
- eBay omitted-field Revise semantics cut both ways: omission preserves state (useful for zero-photo items, with a warning) but silently diverges if unacknowledged.

## Insights

- The registry-backed beta pipeline works end-to-end (report → registry → triage → fix → resolved) but has zero push notification: reports sit unseen until someone asks. Wiring a notifier (or a session-start briefing line) closes the loop.
- Live proof against production data beats seeded staging for path coverage: the arbitrary first unlisted item happened to be a keyless GetItem import — exactly the population the `photoSchema.key` fix targeted.
- `hasContentChange` computes from field presence, not field change — both routes always send photos, so the ReviseInventoryStatus fast path is dead code in production (logged as deferred).

## Deferred

- Thumbnail variant pipeline (storage domain: Sharp resize, R2 key scheme, backfill migration) — lazy/async decoding shipped as mitigation.
- R2 reference-safe photo deletion (orphan GC) — needs reference-check/soft-delete design.
- eBay `hasContentChange` always-full-revise inefficiency.
- `applyToPhoto` mid-flight race UI test (race unreachable through today's UI; helper is second-layer defense).
- Beta-report notification path (reports currently sit unseen in the Registry).

## Verification state at close

685 API / 408 web / 28 e2e green; typecheck + lint clean; live containers run main + #226 branch content; PR #226 awaiting CodeRabbit (required check) then merge.
