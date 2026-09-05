# Two-Day Marathon: Bugs, Hardening, Enforcement Gates, Outages, Langfuse — 9 PRs

**Span:** 2026-07-27 14:00 → 2026-07-28 10:10 ET · **PRs:** #262–#270 merged

## Story

**Beta bug batch.** Nine in-app beta reports triaged: two real bugs (image-upload 500 — sharp's uncaught throw on unparseable buffers, now 400 `INVALID_IMAGE`; publish-sheet buttons under the TabBar) shipped as PR #262. The reporter came back: still covered "on some pages" — the fix had addressed the *instance*, not the *class*. Six more bottom sheets shared the identical z-50 tie. PR #266 lifted them all and added a permanent pixel-level CI gate (`tabbar-overlay-audit`, `elementFromPoint` ground truth — bbox intersection was rejected for false-flagging correct stacking), red-proven by deliberately reintroducing the bug before trusting the green.

**Self-inflicted auth incident.** Local e2e runs burned the `/auth/session` rate budget — the limiter keyed by IP while every browser request rides one proxy hop, so the storm starved the operator's real session (photo capture "looped"). PR #263: two-tier limiter (coarse 600/15min per-IP + 120/15min per-identity via `sha256(CF assertion)`) plus a client-side `requestExchange()` breaker (10s success reuse, 5→60s transient backoff, definitive-loss exclusion, `/home` reload-loop guard). Advisor-reviewed plan; storm rerun: 5 exchange hits vs 120+.

**Features.** Accept-offers toggle (PR #264): eBay Best Offer without a floor + auto-decline minimum; Reverb per-listing intent rides a new `offersEnabledExplicit` provenance key so profile-driven sync propagation survives. Ad toggles (PR #265): Reverb Bump (`PUT /bump/v2/bids`, doc-verified) and eBay Promoted Listings (find-or-create CPS campaign; Marketing API live-probed 200 with the real seller token); fire-and-warn on both publish paths.

**Enforcement layer.** Token- and proof-discipline corrections escalated into machine gates: `codegraph-first` (blocks source-code grep + the Grep tool where a CodeGraph index exists), `graph-memory-first` (exploration agents require a `[context-checked: …]` attestation), `proof-before-push` (UI pushes require fresh screenshots) — each pipe-tested, live-fired, and red-proven. Documented as the **Trust Gates** Docusaurus section (PRs #267/#268) with 4 SVGs; deploying it surfaced and fixed the shared docs-site config clobber (`module.exports` swallowing the whole Docusaurus export — every docs build broken since 07-22). Aifactory `feat/langfuse-selfhost` merged to master.

**Env-drift outage.** The Jul-26 Doppler resync had gutted `portage/dev` (29 keys missing, 9 emptied). First symptom: login dead (single CF aud → `unexpected "aud"` on every exchange). Second: photo-save 500 (`R2_ACCOUNT_ID` empty → `portage-images..r2` double-dot). Restored via bak-merge + Doppler re-upload with a proven resync round-trip; PR #269 added a boot guard — production refuses to start on a missing/single `CF_ACCESS_AUD` (red-proven on the built image).

**Langfuse.** Ran the official `langfuse/skills` audit loop (fresh docs → live trace → CLI fetch → checklist): instrumentation passes baseline except Porter's root observation — typed `agent` in PR #270 (Agent Graph), live-verified. The traces also exposed that local Ollama had *never* been reachable from the prod container (`localhost` URL) — config-fixed; Porter turns now serve from local qwen at $0.

**Shipping controls.** Plan approved via Ultraplan; the cloud session verified the plan and built the scaffold (shared types, `GeteBayDetails` probe, parameterized verify-dryrun; 755 tests green) but couldn't push — its sandbox had no git remote and the classifier blocked adding one. Full recreation spec + continuation order captured in `whats-next.md`.

## Learnings
- Behavioral rules lose to task momentum, recency, and volume dilution — only hooks and CI gates hold (they blocked their own author 7+ times on installation day).
- Fix the class, not the instance; a gate that has never gone red is just a promise.
- `elementFromPoint` is ground truth for occlusion; bounding-box math false-flags correct stacking.
- Env-drift is a class: guards must verify config *shape* (two auds), not mere presence.
- Cloud execution sandboxes may lack git remotes — plan the publish path before dispatching.

## Insights
- Shared-proxy-IP rate limiting starves everyone behind one hop — key by identity with a coarse IP backstop.
- Provenance keys (the `offersEnabledExplicit` pattern) reconcile per-listing intent with profile-driven sync.
- Observability paid for itself immediately: Langfuse surfaced a dead LLM provider nobody had ever seen fail.

## Deferred
- Shipping controls: scaffold recreation → probe → dryrun matrix → Phases 1–3 (see `whats-next.md`).
- Per-purpose `observeOpenAI` generation names; `setActiveTraceIO` migration; boot-guard required-key set; marketplace sync + tag editing (unscoped).
