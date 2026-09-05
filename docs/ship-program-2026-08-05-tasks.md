# Ship Program Task Lists — 2026-08-05 (rev2, post advisor review)

Source: plan rev2 + docs/deferred-audit-2026-08-05.md. Each phase = one /ship cycle unless marked. Tasks here are the program-level breakdown; each build phase still runs its own /ship Phase 3 (plan) refinement before code. Git: per-action approval on every commit/push/PR/merge, both repos. tdd-guard: one test per Write/Edit, always.

---

## Phase 0 — Operator decision session (no PR, ~1h)

Decisions (each → decision-log record):
- [ ] 0.1 eBay account-deletion (c683b4bc): dev-portal check → **exempt** (screenshot, close in 6b) or **build** (→ 4.4)
- [x] 0.2 docs.digitalharmonyai.com (c6f43445): decided PUBLIC — CF Access bypass-everyone (decision on record in registry); proof: proof-of-done page fetched publicly HTTP 200 on 08-10 (docs.digitalharmonyai.com/portage/proof/…)
- [ ] 0.3 Ship-log: confirm 07-17 REVIVAL directive stands (or supersede on record). Revival ⇒ MDX-escape fix named in 6a
- [ ] 0.4 Porter history (a0eb2e98): accept dock-only (close vs PR #252) or require deep-links + mobile (→ Phase 7)
- [ ] 0.5 Batch-enhance (c8e0e606): build (→ Phase 7) or drop (→ 6a removes endpoint + tests)
- [ ] 0.6 /about (610ee575): retarget /legal/terms (→ 1.4) or build page (→ Phase 7)
- [ ] 0.7 Authorize one prod /scan → Langfuse trace provider=gemini closes 1c0ae91e
- [ ] 0.8 Rewrite 3fd52d03 vs local-first decision + disposition of chatModel-override sub-item (build in 3a.4 or dated rejection)
- [ ] 0.9 Porter hallucination approach: reference-by-ID w/ degrade-on-stream semantics — approve/amend/reject (→ 3b)
- [x] 0.10 Approval-on-record for 08-05 rows: 25afd214 + 307ffa75 (→ Phase 1), 98f9f383 + b6536cc1 (→ Phase 2) — satisfied by built+merged PRs #295/#299
- [ ] 0.11 Proof-gate (61bbbc14): build as specced vs re-scope against 4-hook stack (→ 5.4)
- [ ] 0.12 Order-decrement + refund-increment push: into Phase 7 scoping spec by name, or dated rejection
- [ ] 0.13 Boot-guard key policy: Anthropic unconditional vs provider-conditional (recommended) (→ 4.1)

Executed proofs (same session):
- [ ] 0.14 `doppler secrets get VISION_PROVIDERS` vs container env diff, then SessionStart resync + re-diff (non-destructive proof) — closes 3db31cb1
- [ ] 0.15 Prod scan per 0.7 — closes 1c0ae91e
- [x] 0.16 Container→host Ollama reachability check — feeds 3a.3. EXECUTED 08-10 21:54: `10.0.0.251:11434` reachable from portage-api container (11 models incl. qwen3:14b); `host.docker.internal` NOT reachable. LOCAL_LLM_BASE_URL already uses 10.0.0.251 — correct as-is

---

## Phase 1 — Beta-blocker UI batch (/ship PR, TDD, ~half day) — SHIPPED PR #295 (2026-08-05)

Constraint: three independent minimal diffs in listing-card.tsx; no refactor; pathspec-scoped commit per task. Anchors pre-edit.

- [x] 1.1 localPickup card fix (6454017d)
  - Files: apps/web/src/components/listing/listing-card.tsx (handleOpenShipping :156-167, handleSaveShipping :177-188)
  - Do: seed `localPickup` from stored `ebayShipping.localPickup` on open; include in save payload
  - Verify: component test — stored true renders toggle on, survives save round-trip; live proof screenshot pickup ON after reopen
  - Risk: low (local)
- [x] 1.2 BO conflict api half (25afd214a)
  - Files: apps/api/src/routes/listings.ts (:830 throw; also :482, :989 audit for same treatment)
  - Do: add `details: { bestOfferEnabled, bestOfferAutoAcceptPrice, minimumBestOfferPrice }` to the BEST_OFFER_CONFLICT AppError (heal already persisted :825-828; errorHandler serializes details)
  - Verify: api test — 422 body carries details
  - Risk: low (additive response field)
- [x] 1.3 BO conflict FE half (25afd214b)
  - Files: listing-card.tsx (handleSavePrice catch :140-141, BO fields :452-489)
  - Do: on code BEST_OFFER_CONFLICT open/highlight BO fields seeded from `err.details` (NOT stale listing prop)
  - Verify: component test on the code branch; live proof: below-threshold price edit shows guided-fix UI (screenshot)
  - Risk: low
- [x] 1.4 Reverb category picker (307ffa75)
  - Files: listing-card.tsx (handlePublish catch :276-285, AspectFillSheet pattern :649-665); reuse ReverbCategorySection (reverb-category-section.tsx:35)
  - Do: REVERB_CATEGORY_REQUIRED (listings.ts:203) opens category cascade; publish retries after selection
  - Verify: component test on 422 code; live proof: category-less draft publishes after cascade (screenshots)
  - Risk: low-medium (publish path)
- [ ] 1.5 /about retarget (610ee575, if 0.6=retarget)
  - Files: apps/web/src/components/listing/create-listing-sheet.tsx:690
  - Do: microcopy link → /legal/terms
  - Verify: click-through logged-in + logged-out screenshots
  - Risk: low
- [x] 1.6 /ship Phases 5-6: suite + typecheck + lint + 6 review agents + proofs archived test-results/proof/
- [x] 1.7 PR (per-action approval) — PR #295 merged 8221ca2
  - 1.5 /about retarget NOT done — still gated on 0.6 (undecided)

---

## Phase 2 — Marketplace-truth sync (/ship PR, TDD, ~1 day) — SHIPPED PR #299 (merged 2026-08-10, 5044535)

Constraint: additive job registration only; outbox paths untouched. Precedent: retention timer (sync-worker.ts:76-77,:96-111).

- [x] 2.1 Status-sweep job scaffold
  - Files: apps/api/src/lib/sync-worker.ts
  - Do: second periodic job (30-60 min interval, final in spec), drip active listings through existing 5s tick — no burst
  - Verify: unit test — job registers, start/stop idempotent
  - Risk: medium (shared worker); Rollback: git revert
- [x] 2.2 Status transitions
  - Files: sync-worker.ts + adapters (getListingStatus ebay :850, reverb :390)
  - Do: flip rows ONLY on positive ended/sold; `'unknown'` = no-op (adapters swallow errors into unknown — token outage must not mass-end); sync-log row per transition
  - Verify: one test per case (ended / sold / unknown-no-op), separate writes
  - Risk: medium (data transitions)
- [x] 2.3 Periodic Reverb order sync
  - Files: sync-worker.ts (caller), orders sync machinery (orders.ts:143-183, already Reverb-capable)
  - Do: order-sync interval alongside sweep
  - Verify: test — timer triggers order sync
  - Risk: low-medium
- [x] 2.4 Backfill run (inside 90-day window) — 17/17 Reverb orders healed, real fees/paid_at, cancelled 26127575 out of ship queue
  - Do: execute POST /orders/sync for affected user NOW
  - Verify: SQL count ≥6 reverb orders matching named listings (output archived)
  - Risk: low (idempotent heal path exists)
- [x] 2.5 Live sweep proof — sync log carries real `status_sweep` transitions since 08-07: 8 "reports ended — archived" + 6 "reports sold — sold locally" rows (verified in DB 08-10 21:54); survived 2.5h NIC outage 08-07 with zero false flips
- [x] 2.6 Per-user pacing: PR-noted + operator-approved deferral, registry `1c2d031c-ec28-4001-a3a5-c5fcffc47a9f`; revisit trigger = second active seller
- [x] 2.7 /ship Phases 5-6 + PR — PR #299, 10-finding review batch all fixed pre-commit; §5-row closures still due in 6b

---

## Phase 3a — Porter reliability (/ship PR, TDD, ~half day)

- [ ] 3a.1 /porter/message blank fix (e6ac066f)
  - Files: apps/api/src/lib/ai-client.ts (chatOpenAI create() calls :796-802, :821-827; extraction :831)
  - Do: pass reasoning_effort (mirror chatStreamOpenAI :571); empty content = failed call, not success
  - Verify: test + executed POST /porter/message non-empty against local chain (output)
  - Risk: low-medium (chat path)
- [ ] 3a.2 AI_UNAVAILABLE guard (2d1797e3)
  - Files: ai-client.ts (:126-128 buildChain, :437-439 dead guard)
  - Do: buildChain/chatChain throw AppError(503,'AI_UNAVAILABLE'); delete dead guard; flip tests asserting 500→503
  - Verify: test — empty CHAT_PROVIDERS → 503 non-streaming
  - Risk: low (request-time only, verified)
- [ ] 3a.3 Langfuse follow-ups (0a9f24b7)
  - Files: ai-client.ts:33 (observeOpenAI), apps/api/src/lib/tracing.ts:99
  - Do: per-purpose generation names (porter-chat/scan-vision/prepare-listing); setActiveTraceIO migration; Ollama per 0.16 outcome
  - Verify: Porter-turn trace screenshot — provider=local, zero ERROR spans, names visible, trace table still named
  - Risk: low
- [ ] 3a.4 chatModel-override sub-item (if 0.8=build)
  - Files: ai-client.ts:119-121
  - Do: provider:model chain entry also sets chatModel
  - Verify: test
- [ ] 3a.5 /ship Phases 5-6 + PR

---

## Phase 3b — Porter hallucination fix (/ship PR, TDD, ~1.5-2 days, gated on 0.9)

- [ ] 3b.0 Porter stream abort wiring: req.on(close) → AbortController through chatStream + all 4 provider functions; signal check between grounding attempts (APPROVED DEFERRAL from 3a advisor finding A8, operator "slot in 3b" 2026-08-11, registry e95934b4-afc1-4365-ad71-73aa2bd5b880)
- [ ] 3b.1 Design doc per approved 0.9: item_ref blocks on action-pills rails (post-stream parse porter.ts:233-251; new SSE frame like action_pills :436; FE strips tags during stream). STREAM = degrade on invalid ID (drop ref, fallback text, log); NON-STREAM = failed-call retry
- [ ] 3b.2 Server: accumulate tool-result IDs per turn (executeToolCallStructured `structured` currently discarded); validate refs post-stream
- [ ] 3b.3 Persistence: widen blocks JSONB for item_ref (porter.ts:381-382); normalizeConversationMessages typing (:209-218); model-history rebuild policy for non-text blocks (:383-389)
- [ ] 3b.4 /porter/message structured response shape (:555-558)
- [ ] 3b.5 FE: item-card renderer — InlineResultCard EXISTS (apps/web/src/components/porter/inline-result-card.tsx; the 3b technical reviewer's "does not exist" claim was wrong) — evaluate reuse vs new + new SSE frame handling in use-porter-stream
- [ ] 3b.6 PORTER_SYSTEM prompt: emit item_ref IDs, never retype item data (working-tree tightening folds in here)
- [ ] 3b.7 Tests: valid / invalid / unknown / empty ID — one test per write, degrade (stream) + failed-call (non-stream) paths
- [ ] 3b.8 Executed proof: live Porter turn, cards hydrated from DB rows (screenshot + trace); qwen3:14b re-run of the 3 corrupted transcripts — zero invented items
- [ ] 3b.9 update_item tool (eed1f6a5) ONLY if design session approves rails (userId guard, user-field-authority); else → Phase 7
- [ ] 3b.10 /ship Phases 5-6 + PR

## Phase 3c — Adapter-path Best Offer enrichment design pass (APPROVED DEFERRAL 2026-08-07, registry cf6d2ce2)

- [ ] 3c.1 Design: structured data on the P0 soft-warn contract (08-02) so live-revise BEST_OFFER_CONFLICT rejections can drive the guided-fix UI without breaking PR #283 sync-status consumers; then build per approved design

---

## Phase 4 — Config/compliance hardening (/ship PR, ~half day)

- [ ] 4.1 Boot guard (73dd1664, policy per 0.13)
  - Files: apps/api/src/lib/env.ts (superRefine :81-98)
  - Do: production presence checks — R2/eBay/Stripe unconditional; Anthropic per policy (provider-conditional recommended)
  - Verify: one test per key case (NO batch matrix writes — tdd-guard); executed negative boot: container minus one key exits 1 naming it; prod env boots clean
  - Risk: medium (boot path); Rollback: git revert
- [ ] 4.2 e2e.yml runner gate
  - Files: .github/workflows/e2e.yml (:12,:23)
  - Do: `github.event.pull_request.head.repo.full_name == github.repository` on self-hosted job (claude-review.yml optional — already label-gated)
  - Verify: POSITIVE (same-repo PR runs) + NEGATIVE (fork/simulated mismatch → job SKIPPED, or recorded infeasibility + workflow-lint substitute)
  - Risk: medium (CI); Rollback: git revert
- [ ] 4.3 Dependabot successor (12 alerts, 3 high)
  - Do: single-lockfile npm-audit upgrade PR (prior decision pattern)
  - Verify: `gh api .../dependabot/alerts?state=open` → 0 high/critical (output) + CI green
  - Risk: medium (dep bumps)
- [ ] 4.4 eBay account-deletion endpoint (c683b4bc, if 0.1=build)
  - Do: challenge-echo GET + deletion-event POST purging user marketplace_accounts/ebay_messages rows
  - Verify: eBay portal test button passes (screenshot) + API purge test
  - Risk: medium (compliance endpoint)
- [ ] 4.5 /ship Phases 5-6 + PR (absorbs §5 runner-hardening row 07-11 — close in 6b)

---

## Phase 5 — Enforcement-infra criticals (/ship PR portage + per-action-approved dhg-memreg commits, ~1-1.5 days, estimate unvalidated)

- [ ] 5.1 Hook latency measurement (43a7295a): timing wrapper → per-hook p50/p95 one real session → prune/scope → re-measure vs budget. Deliverable: report
- [ ] 5.2 Global capture backstop (66096dd7): port breadcrumb resolution into dhg-memreg capture-guarantee.py (cwd bug :96-97); register once globally (~/.claude, versioned via claude-memory repo). Proof: non-portage session missed-★Insight lands with correct project_name (curl)
- [ ] 5.3 Landing-verification + idempotency (7d218492): content-hash landing check replacing count-based; unique constraints/upsert insights/decisions/corrections. Proof: known-failed post detected; double-fire → one row
- [ ] 5.4 Proof-gate (61bbbc14, per 0.11): build (proof_artifacts live 200 + SELECT-confirmed insert + docs/proof/ + Stop-hook demo blocking unproven done-claim) or re-scope on record
- [ ] 5.5 /ship Phases 5-6 + PR(s), both repos per-action approved

---

## Phase 6a — Hygiene + docs (/ship PR; split docs/assets vs workflow/audit if review degrades)

- [ ] 6a.1 TODO.md: 3 flips-to-x EACH with §1 proof executed (enhanced-photo = live edit→save→reload screenshot); 5 annotations; header counts
- [ ] 6a.2 CLAUDE.md trio lands via pathspec-scoped commits (trio files only, dirty tree)
- [ ] 6a.3 README.md:21 4-tab wording one-liner (85dea545 residual)
- [ ] 6a.4 Tutorial/asset regen (2dcca6ef): capture:tutorials + copy fix + per-PNG inspection record + sitemap regen. Decide at spec time: run now + budget post-Phase-7 re-capture, or defer regen to post-7 (on record)
- [ ] 6a.5 deploy-docs hardening (f25bc5f5): notify-on-failure + temp-build atomic swap + rsync --delete (§5 row). Proof: broken-MDX dispatch → notification + old site serving
- [ ] 6a.6 Ship-log revival (2e2201ce, per 0.3): MDX-escape fix in dhg-memreg generator (pre-first-entry) + backfill to latest PR + idempotent double-run proof + enforcement step
- [ ] 6a.7 Dead-end audit (bccbc90e): orphan enumeration → WIRED or DELETED each with sha + recurring detector (first report zero new). Includes batch-enhance endpoint per 0.5, reap-orphan-sessions.sh, codegraph sync, AND stale-token silent-no-op button audit (APPROVED DEFERRAL 2026-08-07, registry 44f48482)
- [ ] 6a.7b Lint burn-down (APPROVED DEFERRAL 2026-08-07, registry 3fd972b6): 18 next/image conversions with visual proof pass (R2 + /img-cdn) + 8 dep-array fixes each behavior-checked (refetch-loop history)
- [ ] 6a.8 DHG assets pipeline (440b667b): post-assets.sh + autopost rule + ingest docs/assets/** + live search proof total>0
- [ ] 6a.9 /ship Phases 5-6 + PR(s)

## Phase 6b — Registry closure session (operator-supervised, deferral-gated, after 6a merge)

- [ ] 6b.1 Close 21 already-done + 4 obsolete rows — EACH audit "Proof to close" EXECUTED, artifacts in test-results/proof/
- [ ] 6b.2 Close rows resolved by Phases 0-4: c6f43445, 1c0ae91e, 3db31cb1, c683b4bc-if-exempt, absorbed §5 rows (2× Phase 2, 1× Phase 4, 1× 6a.5, batch-enhance tests per 0.5)
- [ ] 6b.3 Residual dispositions on record: E31 refile (a3455f37); MPN-display refile-low or reject (47a8ab40); localStorage-JWT successor decide pre-beta (47a82384)

---

## Phase 7 — Product-decision builds (spec-first /ship cycles; convened by Stephen ≤14 days after 6a merge; each item exits merged-PR or dated rejection)

- [ ] 7.1 Beta scoping spec (e8dc2168): tags, not-for-sale, pull-sync — schedule or reject each; includes decrement/refund push (0.12); reconcile with Phase 2 sweep
- [ ] 7.2 Porter history remainder (if 0.4 requires): /porter?c=<id> deep-links + mobile history
- [ ] 7.3 Batch-enhance FE (if 0.5=build): fresh design pass → build wired to POST /images/batch-enhance
- [ ] 7.4 /about page build (if 0.6=build)
- [ ] 7.5 update_item tool (if not shipped in 3b)

---

## Phase 8 — Logging program (operator-directed 2026-08-08, after container-rebuild log loss blinded the eBay hold forensics)

- [ ] 8.1 30-day log retention: ship container logs to a table in the dhg-aifactory registry, processed for search/knowledge (FTS + embeddings like doc_pages); llmwiki ingest once installed; possible memreg key-issue feed
  - Trigger: 2026-08-08 eBay payout-hold investigation — 08-07 05:30→22:20 container logs were unrecoverable (json-file driver dies with the container)
- [ ] 8.2 Log aggregation, reporting & analysis service: web UI with dashboard, live stats, and an AI chat assistant scoped to the logs
  - Spec-first /ship cycle; scope, stack (vs existing Loki/Grafana in aifactory), and hosting decided at spec time

---

## Program completion self-check

- [ ] Every audit §1-§4 item maps to: merged PR | closed row w/ executed proof | dated operator decision record
- [ ] Enumeration run against the audit doc before declaring program done (no-deferral rule)
