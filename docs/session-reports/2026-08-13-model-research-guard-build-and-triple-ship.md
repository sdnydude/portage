# 2026-08-13 — Model research, category guard build, and a triple ship

**Span:** 2026-08-12 ~01:45 ET → 2026-08-13 ~12:15 ET (one long arc across two calendar days)
**PRs:** #303 (merged), #304 (merged), #305 (open at wrap)
**Branches:** feat/porter-reliability-3a, feat/category-mismatch-guard, chore/wrap-2026-08-13

## The story

The session resumed at the Phase 3a model-decision gate (gemma4:12b recommended, wiring pending). Stephen approved gemma, then immediately redirected: research the best open models **under 11B released in the last six months** across HuggingFace, Ollama, LM Studio, and NVIDIA. A 4-agent parallel sweep produced a verified table; **granite4.1:8b** stood out (dense, Apache 2.0, official Ollama tools tag, BFCL v3 68.3, no known Ollama bugs — unlike Qwen3.5-9B, whose tool-call rendering is broken in Ollama, the exact fabrication class that killed qwen3:14b).

The prior session's eval harness was recovered from the old scratchpad and run against granite: 3× 25-prompt battery (24/25 each; the sole fail was a harness iteration-cap artifact that completes at prod's cap) plus a 50-prompt soak (50/50 after two scorer false-positives were hand-verified as grounded). **125 prompts, zero fabrications, ~1.0s average turn vs 6.9s for gemma4:12b — and zero code wiring needed**, killing the planned LOCAL_LLM_REASONING_EFFORT task. Operator switched: `CHAT_PROVIDERS=local:granite4.1:8b,gemini`.

Live PoD then exposed an eval-blind defect: prod `search_inventory` shipped each item's full `photos` JSONB (~80% of the payload) to the model, which granite misread as "duplicate listings / image crop variations" — the eval fixture had no photos field. Photos were stripped (no consumer ever existed; the web client renders text blocks only), and the clean re-run returned **6/6 cable items with every field DB-exact**. One honest defect remained: the model hand-summed a $650 total whose true value was $450.

That clean run surfaced "Baseball Jackets" as the Impeto cable's category — which unwound into the session's second arc. eBay's Taxonomy suggestion API had suggested a clothing leaf for a fiber-optic cable title on 08-10, and scan-flow silently saved it (by design: eBay taxonomy is THE category, and scan-flow lacked the edit page's confirm gate). A planning pair (code-explorer + Plan agent) produced a 3-approach design; Approach A won: parse the ancestor path already present in eBay's response (zero extra API calls), check the suggestion's root against a per-vision-category plausible-roots table, return an advisory `mismatch` flag, render a dismissible banner. Tier 2 (persisting `scan.visionCategory` on items) was operator-approved in.

The build fought tdd-guard: the validator accepted the row-per-red-test pattern six times then deadlocked rejecting identical evidence three times; the operator approved a scoped bypass for the last four data rows (guard re-enabled and proven ON the same turn). An adversarial review pair found 4 real issues (Critical: unbounded AI category strings could 400 the whole item save; dismissal didn't stick; a banner-text race; a root-election fallback) — all fixed with tests, then a fix-review found 3 more (title:null injection into the scan JSONB entry; mixed-level root election; a coverage gap) — all fixed. Live PoD proved banner, dismissal, and no-false-positive against real eBay data.

Post-merge, Stephen asked the load-bearing question: "how do I dismiss it without using it?" — the banner's two actions both kept eBay's suggestion. A third action, **"Don't use it"**, was built: clears the resolution outright (scan-flow then requires picking a category — new items have no fallback; the edit page falls back to the stored value), with rejection persisting per-category like dismissal. Mid-verification the banner vanished on a fresh page despite green tests and verified source — root cause was a **stale docker cache franken-image** (`docker inspect Created` predating the source edits); `--no-cache` rebuild restored it, and the full 3-step chain was proven live.

The wrap's "do all that" pass then delivered the session's best catch. A real photo scan (driven end-to-end through the browser, photo injected into the gallery input) **reproduced the Baseball Jackets incident live — and the merged guard stayed silent.** The request log showed why: the scan refine path sends `visionCategory=Audio Cables & Adapters` — a rich eBay-style string, not the 14-value coarse enum the plausibility table expects. Unknown value → fail-open → guard inert on the primary incident surface. Every reviewer and the plan itself had assumed the enum. Fix: `isPlausibleSuggestion` — coarse values keep the root table; rich strings get a token-overlap backstop against the suggested leaf+root names (zero overlap = flag); garbage still fails open. Rebuilt, re-scanned: the banner fired on the exact incident query with all three actions, the corrected item saved with `scan.visionCategory` persisted (DB-verified), and the test item was deleted. A Porter system-prompt nudge (never hand-sum totals; use get_inventory_stats) and the CLAUDE.md shipped-state refresh rode the same PR #305.

Also this session: eBay's Taxonomy suggestions proved **unstable across runs** — the same title returned Baseball Jackets (under Clothing root), then Audio Cables & Interconnects, then Baseball Jackets again under a *Sporting Goods* root. The guard's advisory design absorbs this; a deterministic mapping would not have.

## Learnings

- Eval fixtures must mirror prod tool-result shapes exactly — the photos-JSONB divergence hid a live failure mode behind a 125-prompt clean eval.
- The guard's own plan documented the vision "enum" as prompt-convention-only (risk R3), yet every layer still assumed enum values; the live scan was the only test that used real refine-path data. Live PoD on the true surface is irreplaceable.
- eBay Taxonomy get_category_suggestions is nondeterministic across runs, including tree placement of the same leaf. Never treat its top-1 as stable truth.
- docker compose --build can silently produce a stale franken-image; `docker inspect Created` vs source mtimes is the 30-second check that beats hours of state-theory debugging.
- tdd-guard's validator can deadlock rejecting a pattern it repeatedly accepted; the scoped-bypass protocol (operator-approved, same-turn re-enable with proof) handled it cleanly.

## Insights

- Small-model bake-offs: benchmark tables predicted less than the 25-prompt realistic battery on real inventory; and Ollama-specific tool-rendering bugs (Qwen3.5) matter more than BFCL scores.
- Advisory-only guards (flag, never block or substitute) compose safely with unstable upstream APIs — every downstream consumer (aspects fetch, Best-Offer pre-flight) stays keyed on eBay's own id.
- "How do I say no?" is a UX question worth asking of every confirmation surface — Use anyway / Find different both meant "yes, some eBay category"; rejection was unrepresentable until built.

## Deferred

- A8 abort wiring — pre-existing approved deferral, slotted 3b.0 (registry e95934b4). Unchanged.
- Multi-candidate category picker + existing-items category audit — named out-of-scope in the guard plan, operator-acknowledged, revisit on banner-dismissal telemetry.

## Evidence

Gates at wrap: api 973/973, web 646/646, typecheck clean both, lint 0 errors. 14 screenshots delivered across the session (granite clean run, guard trilogy, Don't-use-it trilogy, scan-flow incident + resolution). Review records: 08977a07, 9aeb3caf, a2c8380a, ac537425, 4ca526da.
