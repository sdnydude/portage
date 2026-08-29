# Deferral Program — Phased Spec & Plan

**Date:** 2026-08-15 · **Source:** `docs/deferral-audit-2026-08-15.md` (170-item audit + devstral round-2 review) · **Registry:** statuses updated same session (62 resolved, 16 wont_fix, 2 priority escalations, park triggers on 2 items)

**Position:** 83 open (2 critical / 8 high / ~28 medium / ~45 low) + 8 unverifiable. This document is the source of truth for the execution program. Each phase below runs as its **own /ship session**; a phase's spec here is its Phase-1 starting point, refined (max 5 iterations) at the top of that session before Explore/Plan/Build.

## Execution protocol

1. One phase = one /ship run, started with `/ship <phase id> from docs/deferral-plan-2026-08-15.md`.
2. The session reads this doc + the audit report; no re-audit, no re-litigation of park/close decisions.
3. Registry ids are cited in commits/PR bodies; on merge, each shipped item is PATCHed `resolved` with PR evidence.
4. Standing rules apply unchanged: per-action git approvals, proof-before-push, tdd-guard one-test rhythm, no deferrals without per-item operator approval.
5. Phase order below is the recommended sequence; operator may reorder at session start.

---

## P1 — Compliance/security ship *(spec status: written, iteration 1, pending operator approval; also in `.claude/ship-state.md`)*

**Items:** `c683b4bc` (critical) · `223b0419` (high) · `73dd1664` (high)

### Item 1 — eBay Marketplace Account Deletion endpoint (`c683b4bc`)
- **What:** Public router `apps/api/src/routes/marketplace/ebay-deletion.ts` at `/marketplace/ebay/account-deletion`, mounted before auth.
  - `GET ?challenge_code=X` → `200 {"challengeResponse": sha256hex(challengeCode + verificationToken + endpointURL)}`. New envs: `EBAY_DELETION_VERIFICATION_TOKEN` (32-80 chars), `EBAY_DELETION_ENDPOINT_URL` (exact registered URL). Missing challenge_code → 400.
  - `POST`: verify `x-ebay-signature` (kid-keyed eBay public key via Notification API, in-memory 24h cache, ECDSA over raw body). Invalid → 412, zero writes. Valid → 204 immediately, then async: anonymize the eBay identity across `marketplace_accounts` (delete row + tokens), `orders` (buyer fields + shippingAddress → redaction marker), `conversations`/`ebay_messages` (usernames/PII → `[deleted-ebay-user]`, skeletons kept). `admin_audit_log` row (hashed userId, table:rowcount). Counter `ebay_deletion_notifications_total{result}`. Per-path rate limit 60/min/IP; body cap 100kb → 413. Non-deletion topics → 204 no-op.
- **Not:** No UI; no Portage-account deletion; no outbound eBay calls beyond the response.
- **Acceptance:** handshake test vector exact; no-sig/bad-sig → 412 + zero writes; seller match → account row gone + audit; buyer match → anonymized skeletons + audit; unknown → 204 + counter, zero writes; duplicates idempotent; all other routes still auth-gated; live handshake from eBay portal test through tunnel (screenshot + log PoD).
- **Edge/error:** key rotation (unknown kid → single refetch); malformed JSON → 400 pre-verify; match precedence userId > username > eiasToken; pubkey fetch failure → 503 (eBay retries); DB failure post-ack → audit failure row + heal on eBay redelivery.
- **Operator actions (sequenced):** mint token → Doppler; set endpoint URL env; CF Access bypass rule for exact path; register URL+token in eBay dev portal; fire test notification.

### Item 2 — e2e.yml fork-PR gating (`223b0419`)
- **What:** Job-level `if: github.event.pull_request.head.repo.full_name == github.repository` (event-type-guarded so push/workflow_dispatch unaffected) on every job in `e2e.yml`; Phase-2 audit of all `.github/workflows/*.yml` for other `pull_request`+self-hosted combos (claude-review.yml already label-gated — verified 08-15); file comment documenting fork policy + maintainer path (push branch to internal ref).
- **Not:** No GitHub environments/required reviewers (upgrade path noted in comment); no branch-protection changes.
- **Acceptance:** same-repo PR runs (this ship's own PR proves); fork context evaluates false (expression review, act dry-run if available); dependabot (same-repo) unaffected.

### Item 3 — Prod boot-guard widening (`73dd1664`)
- **What:** Extend `env.ts` superRefine production block (PR #269 pattern): require non-empty R2 creds+bucket, `EBAY_CLIENT_ID/SECRET`, `STRIPE_SECRET_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, + both item-1 envs. Exact names verified against schema in Phase 2. Aggregate error naming every missing key.
- **Not:** No value probing at boot; no dev/test change; provider-chain-conditional keys stay runtime-checked (chain experiments must not brick boot).
- **Acceptance:** unit tests per-key rejection by name + aggregate two-key error + dev passthrough; live boot clean on current Doppler set before merge.
- **Deploy order:** Doppler envs land before the boot guard deploys (avoid self-inflicted PR #269).

---

## P2 — Capture-pipeline integrity ship

**Items:** `7d218492` (critical) · `183474c5` (high) · fold-in `166909d3` (low)
**Repos touched:** dhg-memreg (scripts/daemon), `~/.claude/` (hooks, user-level), portage `.claude/` (stale copies only). Registry API (:8011) gains one lookup route if none exists.

### Item 1 — Landing-verified + idempotent capture (`7d218492`)

**What it does:**
- Every `post-*.sh` (insight, decision-logs, ship-session, deferred-items, bug-fixes, correction, test-coverage, session-reports) adds `"idempotency_key": "<sha256(project|title-or-tldr|date)>"` to its payload; registry upserts on that key (verify existing unique constraints; add column + unique index via Alembic migration where missing).
- After POST, script verifies landing: expects `2xx` with `{"id": ...}` in the body; anything else (network fail, 5xx, no id) → append `{payload, endpoint, ts, attempt}` as one JSON line to `~/.claude/capture-dead-letter/<pipeline>.jsonl`. Script still exits 0 (never blocks a session).
- dhg-memreg daemon gains a replay loop: every 5 min, drain dead-letter files oldest-first, re-POST, remove line on confirmed landing; exponential backoff per file (5m→1h cap) on repeated failure; Prometheus gauge `capture_dead_letter_depth{pipeline}` + counter `capture_replayed_total`.
- `capture-guarantee.py` rewritten from call-counting to landing-verification: at Stop, for each capture the transcript shows was fired, GET the registry by idempotency key; missing → warn block into the session output + dead-letter the reconstructed payload.

**Does NOT:** change any capture-rule trigger semantics; block or slow session end (all verification ≤2s budget, else defer to daemon); touch registry data retroactively.

**Acceptance:**
1. Registry stopped → capture fired → dead-letter line written, script exit 0, session unblocked.
2. Registry restarted → daemon replays within one cycle → row lands; dead-letter line removed; gauge returns to 0.
3. Same capture fired twice → exactly one registry row (idempotency proven by direct DB count).
4. `capture-guarantee.py` catches a deliberately-dropped landing (registry POST mocked to 200-without-persist) and dead-letters it.
5. All 8 pipelines pass 1-4 (parameterized test run).

**Edge cases:** duplicate replay racing a live re-fire (unique index wins, replay treats conflict as success); dead-letter file corruption (skip bad line, quarantine to `.bad`); registry schema drift (409/422 on replay → quarantine, don't loop).

**Error scenarios:** daemon down → dead-letters accumulate, gauge alerts via existing Grafana; disk full → capture logs to stderr only (accepted terminal loss, alerted).

### Item 2 — Deterministic Stop-hook capture (`183474c5`)

**What it does:**
- New Stop hook (user-level, after memory-sync): parse the session transcript for `★ Insight` blocks, decision-log markers (`decision_*.md` writes), and correction-shaped exchanges; diff against registry landings this session (by idempotency key); fire any missing capture through the same post-*.sh scripts (which now dead-letter on failure — item 1 dependency).
- Detection is regex/structural, zero-LLM (deterministic): insight blocks by the `★ Insight` marker; decisions by memory-file writes matching `decision_*.md`; corrections stay advisory-only (fire only on the explicit categories the rule file names — no sentiment guessing).

**Does NOT:** replace the in-session capture rules (they remain primary; hook is the backstop); post duplicates (idempotency keys from item 1); parse with an LLM.

**Acceptance:** synthetic transcript with 1 uncaptured insight + 1 captured one → hook fires exactly the missing one; runs <5s on a 2MB transcript; hook failure (registry down) dead-letters and never blocks session end.

**Edge cases:** insight block edited/retracted later in transcript (last occurrence wins); multi-session same-day identical insight (idempotency key includes date — lands once).

### Item 3 — Stale-copy cleanup (`166909d3`)

**What:** delete portage `.claude/scripts/post-*.sh` self-contained copies that shadow the dhg-memreg symlinked versions; verify every rule file references `~/.claude/scripts/` paths (symlinks), not repo-local ones. **Acceptance:** capture smoke test per pipeline still lands post-deletion; no rule file references a deleted path.

**Operator actions:** review hook diffs before install (touches enforcement toolchain); approve the registry migration (idempotency column).

**Rollback:** hooks are files — git revert in dhg-memreg + re-symlink; registry migration is additive (column + index), inert if scripts roll back.

## P3 — Beta UX truth ship

> **SHIPPED 2026-08-22 — PR #315 (`734ae42`).** All 9 items resolved in the registry; ship-log 058; proof page `website/docs/proof/2026-08-22-p3-beta-ux-truth.md`; appendix `website/docs/appendix/p3-visual-guide.md`. Zero deferrals.

**Items:** `25afd214` (high) · `cf6d2ce2` (med, approved-defer slotted here) · `c3b3013c` (med) · `e955f1b9` (med) · `62e1061e` (med) · `125cbc53` (med) · `14efa906` (med) · `2b8aefb1` (low, rides) · `a5a2b944` (low, rides)
**Theme:** every silent failure or silent mutation in the beta-facing scan/price/publish path becomes visible truth. All web changes carry the frontend-verification gate (run-the-app proof, screenshots).

### `25afd214` + `cf6d2ce2` — Best Offer conflict surfacing (one unit)
**What:** (a) Adapter-level BO 422 throws (`ebay-adapter.ts:752/816/864`) attach the same structured `BestOfferConflictDetails` payload the route-level pre-flight already produces (981aafe): thresholds, healed flag — replacing plain-prose messages. (b) FE price editors (item-detail price edit + listing-card price path) catch `BEST_OFFER_CONFLICT`, render the guided-fix banner (existing listing-card BO component pattern): show blocking thresholds, offer "adjust to X / disable BO for this listing" actions, honor healed flag copy.
**Not:** no changes to BO never-delete semantics (decision `decision_api_bestoffer_never_delete`); no new eBay calls.
**Acceptance:** unit — each adapter throw site carries details (3 tests); FE — mocked 422 renders guided fix with both actions wired; live — repro the 2026-08-05 blocked price-save on a real listing, screenshot the guided banner, complete the fix path end-to-end.
**Edge:** conflict details missing (old-format error) → generic banner fallback, never crash; healed-flag true → "fixed automatically, retry" copy.

### `c3b3013c` — swipe-flow photo-first prepared-fields fix
**What:** port hybrid-flow's photo-first pattern (hybrid-flow.tsx:638-643): when `state.inventoryItemId` is null at the prepare gate (swipe-flow.tsx:1605-1611), create the item first, then run `prepare()` — so `ebayPreparedFields` + `publishMode` survive the swipe path.
**Not:** no swipe UX changes; no shared-hook refactor (that's `227af3ce`, kept open).
**Acceptance:** hook/component test — fresh-scan swipe publish payload carries ebayPreparedFields; existing-item swipe path regression-tested; hybrid/conversational untouched (their tests stay green).
**Edge:** item-create fails mid-swipe → surfaced error, no silent draft (matches hybrid's handling).

### `e955f1b9` — comps fetch error surface
**What:** `scan-flow.tsx:425` `.catch(() => {})` → `compsError` state; inline notice in the pricing area ("comps unavailable — using AI estimate only"), non-blocking.
**Acceptance:** test — comps 500 → notice rendered, price flow proceeds; success path unchanged.

### `62e1061e` — condition-snap notice
**What:** `scan-flow.tsx:216-220` silent `setEditCondition(nearestAllowedCondition(...))` → same mutation + visible notice (inline chip/toast): "Condition adjusted to <new> — <old> isn't offered in this category."
**Acceptance:** test — snap fires → notice with old→new values; no-snap case → no notice.
**Edge:** snap to identical value → no notice.

### `125cbc53` + `2b8aefb1` — aspects/category failure truth (one unit)
**What:** `use-required-aspects.ts` returns `isError` (drop the `.catch(() => setAspects({}))` fail-open at :54,59); Complete badge suppressed when isError; scan-flow category message (:1441-1443) splits outage ("category service unavailable — retry") from genuine no-match ("no eBay category matched") using the new error signal.
**Acceptance:** tests — fetch fail → isError, badge hidden, outage copy; empty-but-successful → no-match copy, badge logic unchanged.

### `14efa906` — mobile deep-link hidden fetch guard
**What:** `inventory/page.tsx:213-216` mount effect gates `?item=` selectedId on a desktop-viewport check (matchMedia against the workbench breakpoint) so mobile never mounts the hidden pane's ItemDetail fetches.
**Acceptance:** test — narrow viewport + ?item= → no item fetch; desktop → pane opens as today.
**Edge:** resize crossing breakpoint after mount → pane hydrates on next selection (no live-resize requirement).

### `a5a2b944` — use-scan-aspects resolveError
**What:** catch at `use-scan-aspects.ts:158-162` records `resolveError` instead of swallowing; save-time inline notice when aspects were skipped due to a transient failure (pairs with 125cbc53's surface).
**Acceptance:** test — resolver rejection → resolveError set + notice; retry clears it.

**Deploy:** single web+api deploy; no schema, no config. **Rollback:** revert commits (all local blast radius).

## P4 — Docs & observability truth ship

**Items:** `2e2201ce` (high, folds `f25bc5f5`) · `610ee575` (high) · `db5e046a` (med) · `2dcca6ef` (med) · fold-in `b77e2423` (low)

### `2e2201ce` — Ship-log generator revival (+ `f25bc5f5`)
**What:**
1. Generator fixes (`.claude/scripts/generate-ship-log.sh`, per the 2026-07-17 decision's worklist): `escape_mdx` also escapes `{`/`}` (currently angle-brackets only — f25bc5f5); stable-id numbering keyed on registry row id (not positional — prevents renumber churn and dup ids); dedup the two 042-prefixed files; `pr_url` validation (skip/flag malformed); stale-file cleanup for sessions deleted from registry.
2. Backfill: regenerate full set from registry ship_sessions (055 → current, ~54+ missing); manual spot-review of 5 random pages for MDX validity.
3. Diagnose + fix live `/ship-log/` HTTP 500 on :8017 (likely the MDX-brace class breaking the Docusaurus build, or the stale index — root-cause during ship, not assumed).
4. Determinism: wire generator into the docs deploy path (CI step in deploy-docs.yml after copy, or /ship Phase 7 hook) so entries can't silently stop.
**Not:** no llmwiki work; no registry schema changes; no rewrite of historical entry content.
**Acceptance:** live `/ship-log/` returns 200 listing entries through the latest ship; docs build green with all backfilled pages; running the generator twice → zero diff (idempotent); a synthetic `{expr}` in a session title renders escaped.
**Edge:** registry session without pr_url (legacy rows) → entry generated with "no PR recorded"; duplicate titles across projects → project-scoped fetch already filters.

### `610ee575` — /about page
**What:** static `apps/web/src/app/about/page.tsx` — product blurb, terms/conditions, liability waiver, contact; linked from the disclaimer microcopy (F3b target) and avatar menu; design-system tokens, mobile-first.
**Not:** no CMS, no legal-content authoring beyond operator-supplied text (operator provides/approves copy during the session — page ships with real text, no placeholders per /ship rules).
**Acceptance:** route live in prod, linked from DisclaimerSheet microcopy + More menu; screenshots (mobile 375px + desktop); lighthouse-sane (no layout shift).
**Operator action:** supply/approve the terms + waiver text.

### `db5e046a` — deploy-docs image sync
**What:** `.github/workflows/deploy-docs.yml:35` `cp -r ... || true` → `rsync -a --delete` for `website/static/img/`.
**Acceptance:** delete a test image from source → next deploy removes it from the served site; existing images byte-identical.
**Edge:** first rsync run on accumulated orphans → expect a one-time large deletion; list it in the run log for review.

### `2dcca6ef` — tutorials refresh (4-tab truth)
**What:** fix stale copy (`src/lib/tutorials/listings.ts:11` "Listings tab" et al — full sweep of `src/lib/tutorials/*` for pre-PR #240 nav references); recapture PNGs (`npm run capture:tutorials`, app running); verify overlay coords via `node scripts/render-tutorial-steps.mjs`; inspect every regenerated PNG (zero-defect published-asset rule).
**Acceptance:** zero stale-nav references (sweep proof); rendered step screenshots reviewed; tutorials pages serve new PNGs.

### `b77e2423` — eBay API reference doc
**What:** write `website/docs/api/ebay.md`: Trade-First lifecycle calls (AddFixedPriceItem/Revise*/End/GetItem), Fulfillment (orders), Taxonomy (categories/aspects), Metadata (BO policies), OAuth + RuName trap (reference_ebay_oauth_env), account-deletion endpoint (P1), rate-limit notes.
**Acceptance:** page in docs nav, builds clean, ingested to registry doc_pages on deploy (CI does this), spot query via KB search returns it.

**Deploy order:** generator fixes → backfill → docs deploy (CI) → live checks. **Rollback:** all git-revertable; docs deploy re-run restores prior site.

## P5 — Log program (spec-first, operator-directed 08-08)

**Items:** `13699992` (high) · `c9c15852` (med)

**Session 1 is a SPEC/design session, not a build** — output is an approved architecture doc, then build ships follow.

**Spec-session agenda (the spec for producing the spec):**
1. **Scope inventory:** which containers feed retention (portage-api/app/db/rembg + dhg-aifactory stack?), current log volumes measured (`docker logs --since 24h | wc -c` per container), 30-day projection.
2. **Retention design (`13699992`):** ship: Docker logging-driver caps (max-size/max-file) + a collector (existing Loki? or direct-to-registry table?) into a dhg-aifactory registry table with FTS; redaction rules (JWT/bearer/cookie headers — the incident logs this session carried full tokens; redaction is REQUIRED, not optional); retention sweep at 30d.
3. **Analysis service design (`c9c15852`):** web UI dashboard (live stats, per-container error rates), AI log-chat grounded on the log table (local model per Porter pattern + grounding validation), alert hooks into existing Grafana.
4. **Options each with cost/complexity; operator picks.** Existing-stack reuse first (Loki/Grafana already run — decision needed: extend vs new table).
**Acceptance (spec session):** written architecture doc with measured volumes, redaction spec, chosen option per component, and the build-phase task breakdown — operator-approved before any build session.
**Acceptance (build, later):** 30 days retention queryable; token-redaction proven against a seeded secret-bearing log line; UI live; log-chat answers a real incident question (e.g. this week's CL=0 upload burst) with citations.

## P6 — Dependency majors ship

**Items:** `b767f698` zod 3→4 (med) · `1219f63d` eslint 10 / @types/node 26 / vitest 4 / TS 6 (med) · `394f3c61` pino-http 10→11 (low)

**What / order (each its own commit, gates between):**
1. **zod 3→4** (api + root + shared): mechanical API changes (error shape `.errors`→`.issues` consumers, `z.record` arity, coerce semantics, `.default()` interactions) — every route's validation touched; error-handler's ZodError branch re-verified (400 detail arrays keep shape — API contract, not internal); `z.coerce.boolean` footgun re-checked against `reference_env_files_loading`.
2. **TS 6 + @types/node 26** together (compiler first so later steps type-check against final target); fix new strictness fallout only — no drive-by refactors.
3. **vitest 4:** config migration, snapshot/timer API changes; suite must stay at current counts (973 API / 646 web) — any test deleted/rewritten is called out individually.
4. **eslint 10** (root+web): flat-config migration if forced; new-rule violations fixed or explicitly disabled with rationale comments; warning count must not grow (26 baseline).
5. **pino-http 11:** changelog review, logger init + redaction config re-verified.
**Not:** no Next.js/React/Express majors (separate decision); no new lint rule adoption beyond defaults.
**Acceptance:** all gates green per step and at end (typecheck, lint ≤26 warnings, full suites at current counts); container builds succeed; live smoke: scan → publish (draft) → Porter question — behavior identical; `npm audit` no new highs.
**Edge:** zod4 incompatibility inside a dependency (drizzle-zod etc.) → pin that package's compatible major or hold zod at 3 for that workspace with a written blocker note (that's a genuine must-defer rationale, presented for approval).
**Rollback:** per-step commits revert independently; lockfile snapshots before each step.

## P7 — Paper-cuts half-day batch (14 sub-hour items)

Rhythm: tdd-guard one-test-per-write; one commit per item citing its registry id; items PATCHed resolved with commit refs at the end.

| ID | What (files) | Verify |
|---|---|---|
| `d56aff62` | Test: eBay Identity fetch network-error throw path (ebay-auth.test.ts) | new test red→green |
| `43e86493` | `sudo apt install gh` (official repo) + remove `~/.local/bin/gh` shadow | `which gh` → /usr/bin, `gh --version` ≥2.95 |
| `69676181` | Quote RESEND_FROM in .env.example | file inspect |
| `d37981ff` | DisclaimerSheet `listingId` prop → `itemId` (mechanical, callers updated) | web tests green |
| `6adfadb4` | seller-profile GET auto-create → `onConflictDoNothing` + re-select | test: concurrent create → single row |
| `668ee616` | GET /items/export row cap (10k + explicit "truncated" flag in response) | test: cap + flag |
| `b9c43cd4` | Photo-export SSRF regression test: disallowed origin → fetch not called | test red→green |
| `d65d1e9e` | export_tokens cleanup in runRetentionSweep (expired >7d) | test: expired swept, valid kept |
| `3b00baeb` | `response_format: json_object` on chatText OpenAI no-tools path | test: request body carries flag |
| `7107c1b8` | cache_hit/cache_miss labels on taxonomy cache lookups (metrics.ts) | /metrics shows both labels after 2 calls |
| `ac10157f` | Per-workspace tdd-guard data dirs (test.json contention fix) | parallel api+web test runs don't clobber |
| `90ca92c2` | Reconcile tdd-guard config vs apps/web/CLAUDE.md + frontend-verification skill text (truth: guard ON for web) | docs match config, no contradiction |
| `17c90eea` | Draft-fallback warning keys on resolved shouldPublish (listings.ts:727 vs :574) | test: publishMode=live falling to draft → warning |
| `8f94d453` | Empty-conditions `{}` return gains warning (ebay-adapter.ts:216) consumed by prepare-listing | test: empty validConditionIds → warning surfaced |

**Acceptance:** all gates green; every item resolved-with-commit in registry; `43e86493` is the only sudo/system change (operator present).

## P8 — Unverifiable settle pass (1 short session, live access)

Procedure per item: run the check, record evidence, PATCH registry (resolved / wont_fix / confirmed-open with corrected evidence), update plan doc.

| ID | Check (exact) | Outcome path |
|---|---|---|
| `7bc3d37f` | `SELECT marketplace_data->'ebay'->>'categoryId' FROM items WHERE id::text LIKE 'bbaddd00%'` (+ current listing state) | resolved, or 5-min data fix via edit UI |
| `c6f43445` | Browser + curl `docs.digitalharmonyai.com` through CF Access as operator | resolved, or a CF-rule task with exact policy named |
| `dbcb1035` | `curl -sI http://10.0.0.251:8017/architecture` (no slash) — Location header keeps :8017? | resolved, or 1-line nginx `absolute_redirect off;` |
| `376a5b7b` + `9dd89324` | R2 dashboard/API CORS ruleset for portage-images (operator R2 Admin token) | single CORS rule allowing LAN dev origins; both items close together |
| `118eb901` | Search all hook dirs + dhg-memreg for the no-force-push agentlint rule | present → tune; absent → wont_fix (rule removed) |
| `43a7295a` | Time the PreToolUse chain: 20 trivial Bash calls with/without hooks (hyperfine or timestamp diff) | data → tune worst hook or close with measurements |
| `a3455f37` | Diff docs-audit Q-verdict worklist lines against current docs tree; Q11 folds into `86b12195` | per-line verdicts, remainder becomes concrete items or closes |

**Outcome (2026-08-28, evidence in each registry row's `resolution_reason`):**

- `7bc3d37f` resolved — item `unlisted`, eBay listing 307038681268 archived, `categoryId` 123445 stored; nothing live to revise.
- `c6f43445` resolved — `docs.digitalharmonyai.com` returns 200 with no Access redirect.
- `dbcb1035` resolved — reproduced; `absolute_redirect off;` added to `aifactory3.5/docs-site/nginx.conf`, dhg-docs restarted (bind-mount inode swap — reload alone was not enough); `Location: /portage/architecture/sitemap/` → 200 on :8017.
- `376a5b7b` + `9dd89324` resolved (2026-08-29) — minted account token `claude-cloudflare-ops` (scope C per the 2026-06-06 cloudflare-ops spec) via the existing `Account API Tokens Write` token, stored as `CF_OPS_TOKEN` (Doppler `dhg-infra/prd` + `portage/prd`); PUT bucket CORS (prod + `http(s)://10.0.0.251:3002/3003`, GET/HEAD, maxAge 86400); live-verified `access-control-allow-origin` on a real R2 object from each origin, none for a foreign origin.
- `118eb901` resolved — agentlint 2.5.3: plain push and branch-delete push are silent; only the lease-force variant emits an advisory.
- `43a7295a` resolved with measurements — Bash PreToolUse chain ~140 ms, UserPromptSubmit ~130 ms, PostToolUse ~230 ms, 3 MCP servers; hooks are not the multi-minute source.
- `a3455f37` resolved — E31 done (index shows 140 sessions), Q4 76 → 14 → 0 unreferenced PNGs (14 removed in this pass), Q11 carried by `86b12195`.

**Program status:** P1–P8 closed. Open residue: `86b12195` (session_reports KB source).

---

## Keep-open backlog — rationale (reason to save · future use)

**Medium:**

| ID | Item | Reason to save | Future use / trigger |
|---|---|---|---|
| `eed1f6a5` | Porter update_item tool | Real capability; write-tools need grounding-validation design first | Porter 3b write-tools phase |
| `e95934b4` | Porter stream abort wiring | Approved + slotted 3b.0 | Porter 3b |
| `32fe6586` | Photo gallery v89 chunks 2-6 | Approved design partially superseded by Stage 2.5 — re-scope, don't discard | Next photo UX cycle |
| `c8e0e606` | Batch-enhance FE design re-validation | Locked design predates scan-review redesign; backend live | Re-validate, then small ship w/ `ee0e9f9a` |
| `ee0e9f9a` | Batch-enhance FE wiring | Endpoint has zero callers — feature invisible to users | Same ship as above |
| `20bd6a97` | DB-backed OAuth state | Restart during active OAuth handshake loses state (rare today) | Next auth ship or multi-instance move |
| `7c4d4a18` | Multi-tab session race | UX annoyance only; CF re-exchange recovers | Next auth ship |
| `0790405b` | eBay identity address prefill | Onboarding friction cut; needs new OAuth scope | Next onboarding/marketplace-connect ship |
| `9e7e6bee` | Surface eBay error parameters | ATO block took hours to identify without them | Next eBay-adapter hardening ship |
| `eb71967d` | Thumbnail pipeline | Perf cost scales with catalog | Photo strips slow / >500 items |
| `2a1ab009` | R2 orphan GC | Storage cost control; needs reference-safe design | R2 bill or object count grows |
| `0ffa17fe` | Shared-types pass (4 sync-by-comment contracts) | Drift risk between api/web | Next shared-package touch |
| `9ed1d07e` | item-detail onto usePhotoEdit | Dedup photo-edit logic; behavior correct today | Next item-detail refactor |
| `227af3ce` | Scan review-step extraction | 1569-line file maintainability | Next scan-flow feature forces it |
| `e8dc2168` | Beta requests scoping (sync/tags/not-for-sale) | Needs its own design session with operator | Dedicated session |
| `44f48482` | Stale-token no-op button audit | Approved + slotted 6a.7 | Ship-program 6a |
| `86b12195` | session_reports as KB source | Unblocks llmwiki + report recall | Registry maintenance window |
| `c9c15852` | Log analysis service | In P5 spec session | P5 |

**Low:**

| ID | Item | Reason to save | Future use / trigger |
|---|---|---|---|
| `404b1e16` | Reverb token revocation detection | Sellers see silent failures if PAT revoked | Reverb adapter hardening sweep |
| `818605da` | eBay refresh-token 18-mo expiry surfacing | Typed 409 exists; proactive reconnect prompt missing | Same sweep |
| `0d3f1670` | UA-injection dedup (4 static methods) | Divergent paths = drift risk on UA policy | Same sweep |
| `e5e39461` | request() JSON-parse error context | Bare SyntaxError on non-JSON 200 hinders incident debugging | Same sweep |
| `96ca8b9f` | Inventory Mapping API eval | Potential AI listing-quality lever | When eBay GA + a listing-quality cycle |
| `49d4f385` | Drop inert ebayOfferId column | Last Inventory-era remnant | Next schema-touch ship |
| `a59b14ba` | Unwind inert policy self-heal block | Dead write on publish path; 32-test mock refactor cost | Next listings.ts refactor |
| `d76e2040` | Status-pill config dedup | Two drifting copies (archived already drifted) | Next listings UI touch |
| `903cfeac` | Price clearing + ScanFab orphan + Phase B fast-follows | Each traces to a known gap | Next scan-flow ship rides |
| `dd1b3c60` | items.price in read view | Sellers can't see their own set price without edit mode | Next item-detail UI touch |
| `11b2ae1b` | Retire photo-save UI mutex | Async sync landed (PR #283); mutex now only blocks UX | Next item-detail refactor w/ `9ed1d07e` |
| `cf3eb3a2` | Aspect-seeding single-letter filter | Cosmetic suggestion noise | Next aspects ship |
| `77106d9c` | aspect-fill-sheet forest-green tokens | Pre-DHG palette remnant; remap incomplete (known) | Design-system remap pass |
| `57c97baa` | Workbench aria listbox/roving-tabindex | A11y completeness for desktop workbench | Next R-series/workbench pass |
| `192807c7` | /tutorials/** Cache-Control carve-out | Tutorial PNGs re-download every visit (blanket no-store) | Next docs/perf touch |
| `e213a59a` | Live list↔pane field sync | Workbench polish; manual refetch works | Next workbench pass |
| `ab4f51ba` | Workbench toast offset + redirect target nits | Cosmetic/latent | Next workbench pass |
| `01a90cba` | Reverb category scan-review ride-along | listing-card half shipped; scan half needs scan-flow surgery | Next scan-flow ship |
| `2dcca6ef` | (in P4) | — | — |
| `3fd972b6` | Lint warning burn-down (26) | Approved defer 08-07; zero-error goal for launch | Pre-launch polish |
| `1c2d031c` | Per-user sweep pacing | Approved defer; single-seller today | Second active seller |
| `d72b38ca` | Envato font wiring | Blocked on operator token + font choice | When tokens provided |
| `1ad367db` | applyFooter over-limit log line | Silent footer drop = support mystery later | Adapter sweep or paper-cuts II |
| `d56aff62`→P7 · `43e86493`→P7 · `69676181`→P7 · `d37981ff`→P7 · `6adfadb4`→P7 · `668ee616`→P7 · `b9c43cd4`→P7 · `d65d1e9e`→P7 · `3b00baeb`→P7 · `7107c1b8`→P7 · `ac10157f`→P7 · `90ca92c2`→P7 · `17c90eea`→P7 · `8f94d453`→P7 | — | — | P7 batch |
| `b77e2423`→P4 · `166909d3`→P2 | — | — | folded |
| `bccbc90e` | Dead-end/unwired-artifact sweep (high) | Systematic sweep still undone; feeds P7-class batches | Own session after P2 (capture tooling helps) |
| `13699992` | (in P5) | — | — |
| `43a7295a` | (in P8) | — | — |
| `1219f63d`/`b767f698`/`394f3c61` | (in P6) | — | — |

## Parked with trigger (registry rows stay open, trigger recorded)

| ID | Item | Trigger |
|---|---|---|
| `8228b40e` | hasContentChange photos fast-path | Item-edit sync volume growth or eBay revise-quota pressure (second-seller class) |
| `eebda2c5` | dhg-app-shell extraction | First non-Portage DHG app needing the responsive shell — extract against two real consumers |

## Closed this audit

62 resolved + 16 wont_fix with per-item evidence: see `docs/deferral-audit-2026-08-15.md` (round 1 + round 2 addendum). `3fd52d03` wont_fix stands (superseded by granite chain).
