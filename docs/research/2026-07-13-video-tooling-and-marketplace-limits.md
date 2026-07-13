# Video Tooling + Marketplace Media Limits — Research Report

Date: 2026-07-13. Inputs for the listing-media features (photo reorder, 24-photo cap, video v1).
Two research sweeps: (A) OSS/commercial video production tooling, (B) eBay/Reverb video + photo API limits (verified against current official docs; UNVERIFIED items flagged).

---

## A. Video production tooling sweep

**Scope:** ≤10-second product clips, one per item. Stages: capture → trim → cleanup (stabilize/denoise/color) → assembly (clips/transitions/text) → transcode/thumbnail → delivery. Context: Node/Express 5 API + Next.js 16, Docker on g700data1 (64GB Ubuntu), Cloudflare account + R2 already in production for photos.

### Executive summary

For 10-second single-item clips, **the entire pipeline is achievable with OSS at zero marginal cost**, and the frameworks category (editly, Remotion, etc.) is largely unnecessary overhead — a 10s clip does not need an NLE abstraction, it needs a well-constructed ffmpeg filtergraph. Landscape shifts to know: **fluent-ffmpeg is dead** (repo archived May 22, 2025; npm "no longer supported"), and the browser side has consolidated around **Mediabunny** (MPL-2.0, WebCodecs-based) — Remotion itself deprecated `@remotion/webcodecs` in Feb 2026 and recommends Mediabunny.

**Recommended core:** ffmpeg (GPL build, sidecar or in API container) driven via `spawn` (or `node-av` bindings); Mediabunny in the browser for capture-side trim/remux; R2 + Cloudflare CDN for delivery (zero egress); Cloudflare Media Transformations (already in the CF account, 5,000 free ops/month, sources directly from R2) as optional delivery-time trim/thumbnail convenience. **No mandatory hosted component.**

### Stage coverage map

| Tool | Capture | Trim | Cleanup | Assembly | Transcode/Thumb | Delivery |
|---|---|---|---|---|---|---|
| ffmpeg (+filters) | — | Yes | Yes (vidstab, hqdn3d/nlmeans, eq) | Yes (xfade, drawtext, concat) | Yes | — |
| Mediabunny (browser) | assists | Yes (frame-accurate) | — | limited | Yes (WebCodecs) | — |
| MediaRecorder + fix-webm-duration | Yes | — | — | — | — | — |
| mp4box.js | — | segment-level | — | — | fragment/parse | — |
| editly / FFCreator / etro | — | Yes | — | Yes | Yes | — |
| Remotion | — | Yes | — | Yes (React comps) | Yes | — |
| auto-editor / PySceneDetect | — | Yes (auto) | — | — | — | — |
| Cloudflare Stream | — | — | — | — | Yes | Yes (HLS/ABR) |
| CF Media Transformations | — | Yes (URL param) | — | — | Yes (frame/thumb) | Yes |
| Mux / api.video | — | — | — | — | Yes | Yes |
| Shotstack / Transloadit | — | Yes | some | Yes (JSON edit spec) | Yes | partial |
| AWS MediaConvert | — | Yes | some | — | Yes | — |

### ffmpeg core (server-side)

All cleanup stages are native filters:

- **Stabilization:** `vidstabdetect` → `vidstabtransform` two-pass (superior to built-in `deshake`). vid.stab ships only in **GPL builds** of ffmpeg — no obligation server-side (GPL triggers on distribution), but use a GPL static build (BtbN/johnvansickle) or compile `--enable-gpl` in the Docker image.
- **Denoise:** `hqdn3d` (fast; ghosting at high luma) or `nlmeans` (higher quality, slow — fine at ~300 frames total).
- **Color:** `eq`, `colorbalance`, `curves`, `unsharp`. Standard product pipeline: scale (lanczos) → hqdn3d → unsharp → eq.
- **Assembly:** `concat`, `xfade` transitions, `drawtext` text overlay, `overlay` watermark.
- **Thumbnail:** `-ss <t> -frames:v 1` or `thumbnail` filter.
- **Scene detection:** `scdet` / `select='gt(scene,0.4)'`.

Docker/self-host trivial; a 10s 1080p H.264 transcode is seconds of CPU; no GPU needed. Cost $0.

### Node wrappers — 2026 state

| Option | License | Status (verified) | Verdict |
|---|---|---|---|
| fluent-ffmpeg | MIT | **Archived May 22, 2025**; npm "no longer supported" | Do not adopt |
| **node-av** (seydx/node-av) | MIT | v6.1.1 July 6, 2026; active; bundles ffmpeg binaries; full TS types (~580 filters) | Best typed option; young, single-maintainer risk |
| beamcoder | GPL-3 | Last publish ~4 years | Skip |
| **Direct `spawn` of ffmpeg** | n/a | Always works | Lowest-risk; for agent-driven pipelines *preferable* — agent emits CLI args: testable, loggable, model-legible |
| ffmpeg.wasm | MIT | Alive but 5–10x slower than WebCodecs paths, whole-file in memory, needs COOP/COEP | Not recommended anywhere here |

**Recommendation:** spawn ffmpeg behind a thin internal `videoTools` module (mirrors the `vision.ts` provider pattern); node-av only if frame-level programmatic access needed later.

### Assembly frameworks (evaluated, not recommended)

| Tool | License | Status | Notes |
|---|---|---|---|
| editly | MIT | Revived; latest v0.15.0-rc.1 (Jan 2025) sat ~18mo | headless-gl native dep = Docker pain; medium-high risk |
| Remotion | Source-available | Very active | **Free only ≤3-person for-profit teams.** Automated pipeline = "Automators" tier: $0.01/render, **$100/mo minimum**. Disqualified here; revisit only for branded animated templates |
| etro | GPL-3 | ~2+ years stale | Skip |
| FFCreator | MIT | Sparse maintenance, native GL deps | Skip |
| MoviePy (Python) | MIT | v2.2.1 maintained ("Maintainers wanted") | Adds a Python service for things ffmpeg does natively; skip |

**Takeaway:** one 10s clip with text overlay + maybe one transition = raw ffmpeg filtergraphs cover 100%.

### Browser-side capture & trim

- **MediaRecorder** (native): capture primitive; Portage already has the camera stack (PR #220). Warts: WebM output (Safari: MP4); Chrome WebM blobs have no duration metadata (`Infinity`) — fix with zero-dep **fix-webm-duration**.
- **Mediabunny** — the standout. Pure TS, zero deps, **MPL-2.0** (free for closed-source commercial). Reads/writes MP4/WebM/MKV/etc.; wraps WebCodecs for hardware-accelerated encode/decode; microsecond-precision trimming. Enables: capture → trim UI in-app → transcode WebM→MP4 client-side → upload final-ish MP4. ~8x faster than ffmpeg.wasm (1080p H.264). Endorsed by Remotion as its own replacement.
- **mp4box.js**: maintained; lower-level box surgery; Mediabunny covers the trim/remux case with friendlier API.
- **Diffusion Studio core**: relicensed non-commercial + watermark. Avoid.

**Practical flow:** MediaRecorder → fix-webm-duration → Mediabunny trim + convert to H.264/AAC MP4 → upload. Server only validates/normalizes. Feature-detect WebCodecs; fall back to raw-upload + server-transcode.

### Hosted services (scale math: 10k items ≈ 1,667 total minutes)

| Service | Pricing (verified 2026) | At 10k items | Notes |
|---|---|---|---|
| Cloudflare Stream | Encode free; storage $5/1,000 min; delivery $1/1,000 min | ~$8.35/mo | Same account; overkill at 10s clips; upgrade path for ABR/analytics |
| **CF Media Transformations** | GA Nov 2025. $0.50/1,000 ops; **5,000 free/mo**; video = 1 op per output-second | Likely $0 | Sources directly from R2 by URL. Trim, resize/crop, frame extraction, audio strip. Input MP4/H.264 ≤100MB ≤10min |
| Mux | Encode $0.015/src-min; storage $0.007/min/mo; delivery $0.00059/min | ~$11.70/mo | Best DX; second vendor, no synergy |
| api.video | Encode free; storage $0.00285/min/mo | ~$4.75/mo | Cheapest hosted; smaller company risk |
| Shotstack | $0.20–0.30/rendered min | ≈$333–500 one-time | Hosted equivalent of the Editor agent; expensive vs $0 ffmpeg |
| Transloadit | $69/mo floor (40GB) | ~$69/mo | Fixed floor |
| AWS MediaConvert | $0.0075–0.015/min | ~$25 one-time | Pure transcode; new vendor + egress |

R2 delivery itself: ~10MB per 10s clip ⇒ 100GB per 10k items ⇒ ~$1.50/mo storage, zero egress.

**Verdict:** no hosted component required. Only CF Media Transformations (free at our volume, R2-native) worth adopting; CF Stream later if ABR/analytics matter.

### AI auto-editing

- **auto-editor** (OSS, active mid-2026): cuts dead space by audio/motion thresholds (`--edit motion`) — auto-trims fumbling before/after showing the item. Python, Docker-trivial.
- **PySceneDetect** (OSS, active): shot/cut detection; feeds cut lists to Producer agent. Free vs Rekognition ($0.05/min).
- **ffmpeg `scdet`**: zero-dependency scene scoring.
- **Vision-LLM as editor's eyes:** sample 5–10 frames through the existing Gemini 2.5/Claude vision chain ("which segment shows the product clearly, well-lit, in focus?"). The 2026-native way to auto-edit a 10s product clip; no off-the-shelf service does it better than the chain we already run.
- **Topaz Labs enhancement API**: credible hosted denoise/upscale/stabilize if ffmpeg-grade cleanup ever insufficient. GPU OSS upscalers (Real-ESRGAN) skip on CPU-only box.

### Recommended stacks

**(a) Upload-existing-file path — all OSS, $0 marginal:**
1. Client: optional Mediabunny pre-trim; enforce ≤10s client-side.
2. API: `ffprobe` validation (codec/duration/dimensions) → ffmpeg normalize (H.264 High + AAC, 1080p max, `+faststart`, ~4–6 Mbps) → poster thumbnail.
3. Storage/delivery: video + poster to R2, served via CF CDN as progressive MP4 (no HLS at 10s). `items` gains video fields alongside `photos` JSONB.
4. Optional: CF Media Transformations for delivery-time variants.

Queue ffmpeg jobs (concurrency 2–3) in API container or a `portage-ffmpeg` sidecar (mirrors portage-rembg pattern); GPL static build for vidstab.

**(b) Capture-in-app + agent post-production:**
- Capture: existing camera stack + MediaRecorder → fix-webm-duration → Mediabunny quick-trim UI → client-side MP4 where WebCodecs allows → upload; server-transcode fallback.
- **Video Producer agent (planning, Claude):** inputs = ffprobe metadata, scene-cut list (PySceneDetect/scdet), shakiness metric from `vidstabdetect` pass-1 transforms file (doubles as jitter analyzer), 5–10 vision-scored frames, item title/category. Output = **EDL JSON**: trim in/out, stabilize y/n+strength, denoise level, eq, text overlay spec, transition, thumbnail timestamp.
- **Video Editor agent (execution):** deterministic EDL JSON → ffmpeg filtergraph(s). QC loop: extract 3 output frames → vision check → one bounded retry → publish to R2. Tool surface = validated ffmpeg arg templates, not free-form shell (model-legible, testable, injection-safe).

Bespoke part is thin glue (EDL schema + filtergraph builder) — exactly the layer no OSS framework provides well and no hosted service provides cheaply.

### Risk register

| Risk | Mitigation |
|---|---|
| fluent-ffmpeg snippets across ecosystem docs | Standardize on spawn/node-av day one |
| node-av single-maintainer | Behind `videoTools` interface; spawn is drop-in fallback |
| WebCodecs gaps (older Safari/Firefox) | Feature-detect; server-transcode fallback |
| vidstab = GPL ffmpeg build | No obligation server-side; document build choice |
| Remotion license creep if adopted later | $0.01/render + $100/mo minimum — budget line |
| CPU contention on g700data1 | Low-concurrency queue; sidecar isolates |

---

## B. eBay & Reverb — video and photo limits (verified 2026-07-13)

Method note: developer.ebay.com blocks server-side fetches; eBay facts verified from recent (2026) Wayback captures of official pages cross-checked against live export.ebay.com. Reverb API docs fetched live.

### eBay video — supported, fits the Trade-First path

Flow: **Media API** (`POST /commerce/media/v1/video` createVideo → `uploadVideo` binary, resumable → poll `getVideo`) → attach via **`Item.VideoDetails.VideoID`** in AddFixedPriceItem / ReviseFixedPriceItem (both in the supported call list — NOT Inventory-API-only).

- Replace: Revise with new VideoID. Remove: `<DeletedField>Item.VideoDetails.VideoID</DeletedField>`. GetItem returns VideoDetails (seller-only).
- Video may attach before `LIVE` state; not viewable until LIVE.

| Constraint | Value |
|---|---|
| Max file size | **150 MB** (157,286,400 bytes; createVideo `size` must be byte-exact or seller may be blocked) |
| Formats | .mp4 (MPEG-4 AVC) / .mov |
| Length | "one minute or less" — **recommendation; hard seconds cap UNVERIFIED** (none documented) |
| Resolution | ≤1080p upload; renditions 240/360/480/720p |
| Videos per listing | **One** |
| Variations | Not supported with video |
| Expiry | Video resource expires **30 days** after upload (re-upload per listing cycle matters) |
| Moderation | PENDING_UPLOAD → PROCESSING → LIVE / PROCESSING_FAILED / BLOCKED; consumer-facing 48h–7 business days |
| Rate limit | Media API POST: 50 req / 5 s / user |
| Thumbnail | eBay-generated; custom not supported |
| Marketplaces | **EBAY_US**, EBAY_MOTORS_US, EBAY_GB (US covered) |
| Display | Fixed second position in gallery; desktop display UNVERIFIED (eBay's own pages conflict) |
| External hosting | **No** — binary upload to eBay only; no YouTube/self-hosted URL option |

### Reverb video — YouTube link only

```json
"videos": [{ "link": "https://www.youtube.com/watch?v=..." }]
```
on POST/PUT /listings. No direct upload; Reverb embeds the player. Max videos per listing / non-YouTube behavior: UNVERIFIED (single-element example, UI exposes one slot).

**Implication for v1:** Reverb video requires a YouTube upload leg (or skip Reverb video in v1). eBay requires binary upload to eBay's CDN.

### eBay photos — cap confirmed 24 (Trading API)

From PictureDetailsType (2026 snapshot):
> "A listing can include up to 24 picture URLs … All URLs must use the 'https' protocol."

- 24 free in almost all categories (motor vehicles excepted).
- **Min 500px longest side** or listing may be blocked.
- **Total of all PictureURL values ≤ 3975 characters** — validate at publish with 24 R2 URLs.
- Gallery/hero image = first PictureURL in the array.
- Self-hosted (R2) URLs fully supported, auto-copied to EPS; no EPS/self-hosted mixing; HTTPS mandatory; spaces `%20`; no semicolons; CMYK silently dropped; stored max 1600×1600.
- Variations: max 12 per variation (lightly flagged, consistent across sources).

### Reverb photos — 25 (policy), API doc silent

- API `photos` = plain array of URL strings, no documented max; Reverb ingests external URLs (no binary upload).
- Help center: **up to 25 images per listing**; 620×620 min / 1600×1600 max guidance — exact pixel figures UNVERIFIED-current.
- Behavior at photo #26 (reject vs truncate): UNVERIFIED — worth one live PAT test before shipping.

### Summary table

| | eBay | Reverb |
|---|---|---|
| Video | Media API upload + `Item.VideoDetails.VideoID` (Trading API) | `videos: [{link}]` YouTube URL only |
| Video limits | 1/listing, 150MB, mp4(AVC)/mov, ≤1080p, ~1min rec., 48h–7d moderation, 30-day expiry | Undocumented beyond format |
| Photo cap | **24** (≥500px, ≤3975 chars total URLs) | **25** (policy) |
| External hosting | Photos yes (auto-EPS); video no | Photos yes; video YouTube only |

**Portage cap at 24 = min(24 eBay, 25 Reverb) — the requested number is exactly right.**

Full source URL lists retained in the session transcript; key ones: developer.ebay.com Managing videos guide, PictureDetailsType, Picture hosting guide, uploadVideo API ref, export.ebay.com video help, reverb-api.com/docs/create-listings, help.reverb.com image guidelines.
