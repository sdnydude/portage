# Portage — Roadmap

**Progress: 50/52 tasks complete · 1 superseded (carrier APIs) · 1 obsolete (Reverb OAuth code-grant — PAT auth ships selling, live-proven PRs #173–#177)**
**Last updated:** 2026-07-09

---

## Phased Execution Plan (2026-07-01)

Ordered by dependency and value. Phase 1 (✅ complete, PR #142); Phase 2 rips out the voice feature (parked for a future release); Phase 3 closes the AI-specifics remnants; Phase 4 clears repo hygiene; Phases 5–7 burn down the backlog. A phase isn't done until its gate passes (DoD: rebuild containers + observe live behavior, not just green tests).

### Phase 1 — Simplified sold-orders panel + carrier cleanup — ✅ COMPLETE (PR #142, merged 2026-07-01)

All items shipped and live-verified; containers rebuilt from merged main. W2 Fulfillment sync-back + W5 ebay-api SDK dropped per 2026-07-01 decision.

- [x] W1 — sold-date fix: Fulfillment `creationDate` → `soldAt` (`e859abe`)
- [x] W3 — Ship-It opens eBay item page: list (`4ec0a36`), detail (`40f5130`), API `ebayItemId` (`0c7bb67`)
- [x] Simplified sold-orders panel — items join on GET /orders; rows: thumbnail + title + marketplace badge + status chip + relative sold date + gross price; buyer/tracking/address on detail view (`584f321`)
- [x] Carrier code cleanup — shipping.ts (17 handlers), `shipping_presets` + `shipping_providers` tables + enum (verified empty, dropped live), `useShipping*` hooks, ship page, shipping settings page, shared carrier types, all references (−2,474 lines, `d22945e`). Disclaimer flow relocated to `/disclaimer` (4 route tests); Mark-as-Shipped → `PATCH /orders/:id`, offered from payment_received
- [x] Net proceeds — resolved: Fulfillment API never returns fees (Finances API needed); gross price only
- [x] Sold-celebration Ship-It → routes to order detail (component currently has no callers; eBay link lives on detail)
- [x] **BONUS — soldAt heal (`84c6bb4`):** sync skipped existing rows forever, so pre-fix orders kept their import-date stamp; re-sync now heals soldAt in place. Live-proven: 11 orders healed 06-30 → real dates 06-02…06-23
- [x] **Gate passed:** containers rebuilt, e2e 15 green (sold-list rows + reload re-assert + carrier-gone 404), live API verified with real data, screenshots in website/static/img/verification/sold-list/
- [x] PR #142 merged on 6 green CI checks; main rebuilt + healthy; worktree + branch cleaned up
- [x] CLAUDE.md Progress + TODO.md updated (this commit)

### Phase 2 — Rip out the voice feature (parked → future release; registry deferred item e37f4cd4)

Product descoping 2026-07-01: voice returns in a future release. Removal is independent of the orders branch — branch from main. All A1–A8 hardening fixes are verified present on main, so the parked code is the hardened version.

- [x] Tag pre-removal main tip — `voice-parked-2026-07` pushed to origin; restore is a checkout
- [x] Web: removed `use-voice-input` + `use-porter-audio` hooks; VoiceButton, VoiceOverlay, AudioPlayback, FloatingMic, voice BottomSheet components; their wiring in FullChat/StreamingMessage/PorterProvider/tab-bar/home/porter pages (BottomSheet had zero callers — deleted outright)
- [x] API: removed `POST /porter/transcribe`, `POST /porter/speak`, TTS fire-and-forget in `POST /porter/stream`; shared types dropped `AudioEvent`/`audio_url`, `AudioPlayback`, `RichMessage.voiceTranscript`
- [x] Infra: removed dhg-stt (8018) + dhg-tts (8019) + `dhg-stt-models` volume from docker-compose; dropped `DHG_STT_URL`/`DHG_TTS_URL` from `.env.example` (they were never in the env.ts Zod schema — porter read process.env directly)
- [x] Tests: deleted porter-speak + porter-transcribe specs; replaced the stream TTS-failure test with a no-TTS regression guard (asserts no fetch + no audio_url frame); removed floating-mic mock from tab-bar test — API 537 + web 225 green
- [ ] Docs: CLAUDE.md Services/AI sections; TODO.md
- [x] **Gate:** typecheck + lint + test:api (537) / web (225) green; portage-app + portage-api rebuilt from the branch; live e2e `porter-text-chat.spec.ts` proves text chat streams end-to-end (assistant reply asserted as a 2nd marker occurrence — user bubble alone can't pass) + no voice UI on home/inventory/porter; authed `/porter/transcribe` + `/porter/speak` → 404 live; screenshots in `website/static/img/verification/voice-removal/`
- [x] Open PR → merge on green CI (PR merges only when checks pass; dhg-stt/dhg-tts containers stopped+removed post-merge)

(~5h)

### Phase 3 — AI-specifics follow-through

**Correction 2026-07-01:** `feat/ai-specifics-and-publish-result` MERGED as PR #132 on 2026-06-23 (reached main via #133's merge of main). Scan-time aspect prefill, inline [AI] auto-fill + chips, quantity capture, MPN "Does Not Apply" sentinel, F2 malformed-aspect guard, F9 enum validation are all live. Remaining from that epic (burndown 2.1, 3.3–3.5):

- [x] E-panel decision (burndown 2.1): CLOSED AS SUPERSEDED 2026-07-01 — inline `[AI]` auto-fill + chips (PR #132) is the consumer of AI-suggested aspects; `AiIdentificationPanel` was never built and won't be
- [x] Camera-driven scan→save Playwright e2e (burndown 3.3) — `camera-scan-save.spec.ts`: canvas-stream getUserMedia polyfill, mocked AI/taxonomy boundary, real `/items` save asserted after reload + cleanup
- [x] Type-AI auto-pick on high-cardinality aspects (burndown 3.4) — `aspect-pick.ts` constrained second pass wired into `generateListingFields` (covers scan prefill + prepare-listing); enum-validated, canonical casing, never throws
- [x] SKU "Custom label" check (burndown 3.5) — live GetItem proof: ended ItemIDs 307034606520/307034773471 return SKU `PRT-000016`/`PRT-000017`; Seller Hub Custom label = Trading SKU field (no new publish needed)
- [x] Plan-doc PR #126 CLOSED unmerged 2026-07-01 — plan superseded by the shipped shape (inline chips, Trade-First transport); history in registry ship sessions

### Phase 4 — Repo hygiene & Trade-First housekeeping — ✅ COMPLETE (2026-07-01)

- [x] PR #127 decided — superseded by PR #149: capture-guarantee Stop hook wired into the CURRENT settings.json (the stale diff would have created a duplicate `Stop` key vs the agentlint block)
- [x] Dependabot triage — single lockfile PR #148 (`npm audit fix` + tsx bump) resolved 22 of 23 alerts incl. 3 PR-less transitives; alert 11 (@anthropic-ai/sdk nested under tdd-guard) waits on upstream tdd-guard unpinning `claude-agent-sdk <0.2.113`. Merged #129 (checkout v7), #99 (upload-artifact v7), #150 (anthropic-sdk 0.109.1 + sharp 0.35.3, superseding Dependabot #115 whose lockfile generation is broken for this workspaces monorepo). 17 PRs closed; 6 deliberate defers remain open (#53/#55/#58/#60/#134/#135: zod 4, pino-http 11, eslint 10, TS 6, types majors — registry deferred items)
- [x] GTC / no-auto-renewal reconciliation — PR #151: opt-in `gtc_auto_end` toggle, login-triggered `/listings/gtc-sweep` ends listings via EndFixedPriceItem 2 days before the monthly anniversary, archives + notifies; no auto-relist (same insertion fee). Error path live-proven on the real account
- [x] Verify pre-flight wiring — DECIDED proof-only (registry decision log; revisit trigger = fee-preview UX)
- [x] Dead Inventory helper sweep — `isOfferExistsError` + `bestOfferTerms` deleted (Serena zero-reference proven). `resolveEbayCategoryCondition` confirmed live (prepare-listing.ts:333); `ebayOfferId` column deliberately kept
- [x] `docs/trade-first-burndown.md` refreshed — 1.17/1.19/1.20 closed, 2.4/2.7 marked shipped, 2.6 branch ref fixed
- [x] CLAUDE.md/TODO.md refreshed (this commit)

**Discovered + deferred (registry):** reconcile externally-ended eBay listings (Seller-Hub-ended rows stay `active` locally; only sold listings get healed).

### Phase 5 — Deferred product gaps (registry backlog) — audited 2026-07-02, 4/5 closed

- [x] Package weight + dims capture — AUDIT: already shipped (schema columns, scan + all 3 flows capture, `mergeItemShipping` on every eBay publish, `EBAY_WEIGHT_REQUIRED` gate)
- [x] Scan-flow Save & List honors `ebayPublishMode` — AUDIT: already fixed (profile read seeds `initialPublishNow` → `resolvePublishMode`); note: seller still confirms in CreateListingSheet (not silent), `scan-listing-payload.ts` is dead code (test-only)
- [x] ListingPreviewCard/CompsPricingWidget unreachable on fresh scans — FIXED (fresh-scan prepare PR): item created at recognition-confirm via `ensureItemCreated()`, prepare() runs on every path, error+Retry surface, Unlisted chip on inventory, hero-tap photo editor, iOS paddingBottom hero fix
- [x] Photo-gallery redesign — AUDIT: already shipped (Stage 2.5: strip + full-screen editor overlay, e2e-proven)
- [ ] Re-validate locked batch-enhance FE design against Stage 1 scan-review redesign before building *(design review task — parked)*

*(Former Phase 5 — voice-audit sweep A1–A8 from 2026-05 — DELETED 2026-07-01: evaluator verified all eight findings are already fixed on main, e.g. `porter.ts:525` req.file 400, `porter.ts:545` speak Zod schema, `use-voice-input.ts:94` stoppedRef guard, `use-porter-stream.ts:145` unconditional setConversationId.)*

### Phase 6 — Feature completeness

- [x] **Listing-hub merge** — EXECUTED 2026-07-11, all 6 plan tasks shipped as PRs #207–#212: itemId filter (API), Marketplace Listings hub on inventory/[id], ListingCard action surface, listings/[id] retired to a resolver-redirect (−913 lines), /inventory/[id]/preview PNG share (CORS solved via /img-cdn next.config rewrite — R2 bucket CORS deferred, no R2-admin credential), Reverb edit-sync. Plan: `docs/superpowers/plans/2026-07-11-listing-hub-merge.md`
- [ ] Notification system — push + in-app center (8h)
- [ ] Dashboard trends + AI insights — sparklines, category breakdown (6h)
- [ ] Enhanced-photo persistence — "Replace Photo" action after before/after (2h)
- [ ] Reconcile externally-ended eBay listings — Seller-Hub-ended rows stay `active` locally (only sold listings heal). Weekly GET active-listings reconciliation pass or manual "Reconcile with eBay" admin action; needed before real user volume (phantom actives + duplicate end-attempts in GTC sweep) (2h)

### Phase 7 — Quality & hardening

- [x] Integration testing — uncovered routes (Task 35) — route coverage +43 tests (PR #184, 2026-07-09); suites ~664 API + 293 web; ephemeral e2e stack in CI
- [x] Version Cloudflare tunnel config into repo (Task 34 gap) — `infra/cloudflared/config-portage.yml` + deploy README (2026-07-09)
- [x] Prod CORS single-origin restriction — done via PR #189 (2026-07-09): api now runs NODE_ENV=production, CORS list = prod domain only
- [ ] Pagination on listing/item hooks (4h)
- [x] Reverb listings don't sync on item edit — RESOLVED PR #211 (2026-07-11): sync loop widened to Reverb (syncs on listingId alone incl. remote drafts; eBay stays active-only), adapter maps brand/model→make/model. Live-proven: PUT /listings/99270095 fired; Reverb 403 "account under review" is the known shop-setup gate
- [x] eBay edit-sync silently failing for GetItem-imported listings — FIXED same session (fix/ebay-edit-sync-category-heal): sync loop reuses resolveEbayCategoryId self-heal + applyShipFromOrigin publish parity; live-proven ReviseFixedPriceItem success on ItemID 307038681268 (all 4 affected rows heal from item cache)
- [x] R2 CORS for portage-images — CLOSED: /img-cdn next.config rewrite is the permanent same-origin mechanism (decision logged); bucket CORS unnecessary
- [ ] Self-hosted runner hardening before public launch — `claude-review.yml`, `e2e.yml`, `deploy-docs.yml` all run `pull_request` jobs on the stateful g700data1 runner; gate to same-repo PRs (`github.event.pull_request.head.repo.full_name == github.repository`) or move untrusted jobs to `ubuntu-latest`. Fork PRs also receive no secrets. Low urgency while repo is private/solo (CodeRabbit finding, PR #203) (1h)

---

## Phase 1: Foundation (Tasks 1-8) — 8/8

- [x] **Task 1:** Monorepo scaffold — npm workspaces, TypeScript, ESLint, shared package
- [x] **Task 2:** Docker stack — PostgreSQL (5436), Express API (8016), Next.js (3002)
- [x] **Task 3:** Database schema — Drizzle ORM, 10 tables (users, items, images, listings, orders, conversations, notifications, marketplace_accounts, admin_audit_log, app_settings)
- [x] **Task 4:** Express API bootstrap — pino logging, error handling, health route
- [x] **Task 5:** Auth system — bcrypt password hashing, JWT + refresh tokens, register/login/refresh routes, 7 tests
- [x] **Task 6:** Next.js frontend — design system (forest green, Instrument Sans/Plus Jakarta/JetBrains Mono), 5-tab mobile nav, Tailwind v4
- [x] **Task 7:** Image pipeline — R2 storage, Sharp processing, upload/resize/webp, auth + file validation
- [x] **Task 8:** Camera capture — `useCamera` hook, `CaptureSheet`, `CameraCapture`, `ImagePicker` components, scan FAB in tab layout

## Phase 2: Core Intelligence (Tasks 9-11) — 3/3

- [x] **Task 9:** AI scan — Claude Vision API, item identification, value estimation, structured metadata extraction
- [x] **Task 10:** Item detail + edit — photo gallery, condition badges, value breakdown, brand/model fields, dirty tracking
- [x] **Task 11:** Inventory UI — search bar, category filters, grid/list toggle, loading/error/empty states, ItemCard component

## Phase 3: Image Processing (Tasks 12-13) — 2/2

- [x] **Task 12:** Background removal — client-side WASM (@imgly/background-removal), usage credit gating, before/after slider, progress tracking. Accessible from item detail page.
- [x] **Task 13:** Auto-enhance — server-side Sharp pipeline (normalize + sharpen + modulate), enhance endpoint, before/after comparison. *(Minor gap: enhanced photo cannot be saved/persisted — before/after is shown but no "Replace Photo" action exists.)*

## Phase 4: Marketplace (Tasks 14-20) — 6/7

- [x] **Task 14:** Marketplace adapter interface — shared TypeScript interface (create/update/delete listing, orders, categories)
- [x] **Task 15:** eBay OAuth2 — auth code grant, connect/callback/status/disconnect routes
- [x] **Task 16:** eBay adapter — Inventory API (SKU → offer → publish), Fulfillment API (orders), Taxonomy API (categories)
- [x] **Task 17:** Etsy PKCE OAuth2 — code_verifier/challenge, connect/callback/status/disconnect routes
- [x] **Task 18:** Etsy adapter — Listings API (create with photo upload), receipts (orders), taxonomy (categories)
- [x] **Task 19:** Listings UI — status filter pills, listing cards, create listing sheet, detail page with edit/update/delete + marketplace sync (PR #27)
- [x] **Task 20:** Orders UI — order list with status filters, sync from marketplaces, tracking/carrier updates

## Phase 5: AI Assistant (Tasks 24-25) — 2/2

- [x] **Task 24:** Porter AI backend — Claude Sonnet tool_use loop, 3 tools (search_inventory, get_inventory_stats, suggest_listing), conversation history in JSONB, free tier 20 msg/day. Fixed Zod validation bug rejecting null conversationId (9f8db4e).
- [x] **Task 25:** Porter chat UI — message bubbles, typing indicator, suggestion chips, new chat, keyboard enter-to-send

## Phase 10: Voice Chat Interface (PR #87) — complete, **PARKED 2026-07-01** (removed in Execution Phase 2; code preserved at tag `voice-parked-2026-07`; returns in a future release)

- [x] **Task 51:** Porter SSE streaming — `POST /porter/stream` using `client.messages.stream()`, live token streaming, tool transparency blocks, action pills, TTS fire-and-forget. JSONB upgraded to `blocks: ContentBlock[]` with lazy backward-compat migration.
- [x] **Task 52:** Voice I/O — `POST /porter/transcribe` (Whisper via dhg-stt), `POST /porter/speak` (Chatterbox via dhg-tts), `useVoiceInput` hook (push-to-talk + silence detection), `usePorterAudio` hook.
- [x] **Task 53:** Home screen redesign — Porter chat input, engaged-state expansion (chat grows, portfolio card/listings collapse), proactive greeting from dashboard data, full-screen chat overlay, PorterProvider React Context shared across tabs.
- [x] **Task 54:** Voice UI components — VoiceButton, VoiceOverlay (3 states), AudioPlayback, FloatingMic FAB (non-home tabs), BottomSheet slide-up voice interface. Tab bar restructured to 4 tabs (Porter tab removed).

## Phase 6: Auth (Task 33) — 1/1

- [x] **Task 33:** Auth flow — login/register pages, AuthProvider, More tab (user info, setting links, sign out). *(Settings link destinations are Task 32.)*

## Phase 7: Dashboard (Task 27) — 1/1

- [x] **Task 27:** Smart momentum dashboard — Home tab with greeting, portfolio value card, stat cards (active listings, monthly revenue), momentum tips, quick actions, recent items/orders. Spinner bug fixed (949a8dd). TabBar restructured to 5 tabs: Home/Inventory/Scan/Orders/More (84ba9ee). **GAP: no trends (charts/sparklines), no AI insights as originally scoped.**

## Phase 8: Admin Panel (Tasks 36-46) — 11/11

- [x] **Task 36:** DB migration — add `role`, `disabled_at`, `disabled_reason` to users; create `admin_audit_log` + `app_settings` tables
- [x] **Task 37:** Auth changes — JWT `role` field, `requireAdmin` middleware, admin seed script
- [x] **Task 38:** Admin API: dashboard stats + activity feed (`/admin/stats`, `/admin/activity`)
- [x] **Task 39:** Admin API: user management — list, detail, update role/tier, disable, delete, reset usage
- [x] **Task 40:** Admin API: inventory + listings + orders browse (all users, paginated, filterable)
- [x] **Task 41:** Admin API: Porter stats + conversation browser, marketplace health
- [x] **Task 42:** Admin API: app settings CRUD + audit log
- [x] **Task 43:** Admin frontend: layout (sidebar nav, top bar, middleware guard, responsive)
- [x] **Task 44:** Admin frontend: dashboard page (KPI cards, charts, activity feed)
- [x] **Task 45:** Admin frontend: user management (list + detail with tabs)
- [x] **Task 46:** Admin frontend: inventory/listings/orders/porter/marketplace/settings/audit pages

## Phase 9: Repo Infrastructure (Tasks 47-49) — 3/3 ✓

- [x] **Task 47:** GitHub repo setup — README.md, CLAUDE.md, CI workflow (lint + typecheck + test + build), dependabot, PR/issue templates
- [x] **Task 48:** ESLint fixes — disabled React 19 set-state-in-effect rule, fixed ref-during-render, CI green
- [x] **Task 49:** Branch protection — CI required on main, no force push *(verified: PR #69 shows all 3 checks required and passing)*

---

## Remaining Tasks

### Scan & Camera (Task 8 fixed)

- [x] **Task 50:** Scan entry point — FAB in tab layout on all tabs, wires CaptureSheet → image upload → AI scan → review screen → create item → navigate to detail. z-index fix for sheet overlay. *(Requires valid ANTHROPIC_API_KEY in .env for Claude Vision.)*

### Listings Completion (fix Task 19)

- [x] **Task 53:** Listing detail page — `/listings/[id]` with listing info, edit price, update status, delete listing, link to marketplace

### Shipping & Payments

- [~] **Task 21:** Shipping system — **SUPERSEDED (2026-07-01).** Carrier API integration (EasyPost/Shippo) is dead: decision is redirect-to-eBay for labels + Fulfillment API sync-back. The stubbed carrier subsystem (presets/provider config/rate quotes/label purchase/ship page/shipping settings) is slated for **deletion** in the Phase 1 carrier cleanup (see Phased Execution Plan).
- [x] **Task 23:** Stripe subscription — Free/Pro tier billing ($39/mo, $390/yr), 7-day trial, credit packs, usage limits enforcement (marketplace count, bg-removal, AI listings, Porter exchanges). PRs #73, #74.

### Settings

- [x] **Task 32:** Settings pages — 7 settings pages live: profile (with GET/PATCH /users/me API), marketplace accounts (connect/disconnect), seller profile, shipping, notifications (toggle switches), help (FAQ accordion), admin panel (admin-only). More page expanded with full navigation (ad03728). Only remaining gap: subscription/billing page (depends on Stripe — Task 23).

### Production & Testing

- [x] **Task 34:** Cloudflare tunnel + production Docker config — tunnel live (`portage.digitalharmonyai.com`, `portage-api.digitalharmonyai.com`), Docker production mode with HTTPS cert mount. Gap closed 2026-07-09: config versioned at `infra/cloudflared/config-portage.yml` (PR #182)
- [x] **Task 35:** Integration testing + final polish — route coverage +43 tests (PR #184, 2026-07-09); suites ~664 API + 293 web; ephemeral e2e stack in CI

---

## Resolved Criticals (2026-05-09, historical)

- ~~Dashboard spinner bug~~ — Fixed (949a8dd)
- ~~Dashboard navigation dead end~~ — TabBar restructured to 5 tabs (84ba9ee)
- ~~Settings pages 404~~ — 5 new pages + expanded More hub (ad03728→b5f0f33)
- ~~Porter chat broken~~ — Fixed Zod null validation (9f8db4e)

---

## Completed Work — May 26 → July 1 Round

| Ship | PR(s) | Summary |
|------|-------|---------|
| eBay listing hardening | #94 | Draft/live publish mode, one-click auto-setup, self-healing photo-first publish (49 commits, 351 tests) |
| Stripe billing | #73, #74 | Free/Pro tiers, 7-day trial, credit packs, enforcement gates |
| Reverb token-paste auth | #79 | Personal Access Token validated against live API (Reverb has no OAuth for PATs) |
| eBay buyer messaging | #84 | Inbox sync, conversation threads, reply via Trading API, 20 tests |
| Dead /settings links | #125 | Fixed dead navigation destinations |
| **eBay Trade-First** | **#133** | Full listing lifecycle Inventory→Trading API (AddFixedPriceItem/Revise/End/GetItem), inline terms, no Business Policies, `ebayOfferId` dropped from adapter interface, insert-first idempotency, VerifyAddFixedPriceItem dry-run tooling. Live-proven publish/revise/end on real eBay (ItemIDs 307034606520, 307034773471). 52 commits |
| **eBay orders sync** | **#139**, #140 | Errors[] surfacing + login-triggered sync (keepalive) + Sync button; GetItem orphan backfill ingests external eBay sales as item+listing per ItemID (lineItem-title fallback, in-run dedup). Live-proven synced:11 |
| Voice-audit-era infra | #127 (open) | Capture-guarantee Stop hook wired; registry silent-failure root cause found (tldr>280 → 500, scripts swallow it) |

---

## Completed Work — May 7–9 Development Round

### A. Three-Interface Listing Flow (PR #25 — 25 commits)

| # | Task | Commit |
|---|------|--------|
| 1 | Listing flow mockup demos (AI scanning, comps, shipping, post-publish) | `b7586d3` |
| 2 | Security: fix 3 HIGH + 1 MEDIUM CVEs | `8b99a10` |
| 3 | API endpoint hardening from code review | `894f839` |
| 4 | Design spec + review iterations | `de4853f`, `18233ce` |
| 5 | Implementation plan | `95e3838` |
| 6 | Schema: `listing_drafts` table, user prefs columns, reverb marketplace type | `d3b3e58` |
| 7 | Shared: fix MarketplaceType union to include reverb | `4661f3c` |
| 8 | API: Drafts CRUD route with upsert + stale cleanup | `14b561b` |
| 9 | API: User preferences GET/PATCH route | `c2eab2b` |
| 10 | Scan: `detail=full` multi-candidate recognition with reasoning | `c318de4` |
| 11 | API: mount drafts/preferences routes, add reverb to adapter factory | `4d7be8d` |
| 12 | Review fixes: unique constraint on drafts, type alignment | `5698a77` |
| 13 | Web: `useUserPreferences` hook | `7bfce44` |
| 14 | Web: `useDrafts` hook with debounced auto-save + retry | `dbe9fd2` |
| 15 | Web: `useListingFlow` shared state hook | `8c7e022` |
| 16 | Web: `RecognitionFork` component (smart-default item identification) | `ef6cb07` |
| 17 | Web: `FeeEstimate` + `PublishSuccess` shared components | `4a0485a` |
| 18 | Web: **HybridFlow** — Interface C (chat + inline cards + compact form) | `c3f86b7` |
| 19 | Web: **ConversationalFlow** — Interface A (Porter chat + pill actions) | `44f3817` |
| 20 | Web: **SwipeFlow** — Interface B (full-screen cards, speed-first) | `3a25087` |
| 21 | Web: `/list` page with conditional interface rendering | `6f58fc2` |
| 22 | Web: Listing detail page (status, inline edit, cross-list nudge) | `d42a90d` |
| 23 | Web: Photo FAB on home, empty state update, List for Sale button | `34ddc6b` |
| 24 | Web: `PhotoCapture` component (camera, upload, theme adaptation) | `4e37cb7` |
| 25 | Wire PhotoCapture into all three interfaces + comps search | `5ef6285`, `6c0ba14` |

### B. Smart Listing Prepare (13 commits)

| # | Task | Commit |
|---|------|--------|
| 26 | Shared types: `PreparedListingData`, `SellerProfile`, pricing types | `5e56f34` |
| 27 | DB: `seller_profiles` table for marketplace account settings | `a36b6d9` |
| 28 | API: rotate + crop image endpoints | `fed3df0` |
| 29 | API: seller profile route with eBay policies fetch | `ac8099d` |
| 30 | API: **Reverb marketplace adapter** (264 lines, comps search) | `7541356` |
| 31 | API: eBay category suggestion, aspects, full inventory fields | `a6ab9b8` |
| 32 | API: **prepare-listing endpoint** — AI field gen + comps pricing | `f693219` |
| 33 | Web: listing flow components (CompsWidget, PreviewCard) + seller profile page | `27c1ca2` |
| 34 | Web: `usePrepareListing` hook | `621fc26` |
| 35 | Web: wire PhotoCaptureFlow + ListingPreviewCard into all listing flows | `3918f32` |

### C. Developer Infrastructure (12 commits)

| # | Task | Commit |
|---|------|--------|
| 36 | Root + package-specific CLAUDE.md files | `f63cb62` |
| 37 | Resolve all 8 Dependabot vulnerabilities (bcrypt@6, npm overrides) | `b738bbb` |
| 38 | `/sync-memory` command + session-end hook + daily cron | `afe6300` |
| 39 | Session capture hook to AI Factory registry | `ea29360` |
| 40 | Decision log memory type with 5 seed decisions | `de22232` |
| 41 | SessionStart briefing hook (cold-start context injection) | `3cd4a0a` |
| 42 | Memory intelligence design spec + implementation | `a1cfb0a`→`abb4c9f` |
| 43 | Memory intelligence review — 6 findings fixed | `81d12ae` |
| 44 | Stop hook fixes (SIGPIPE, hanging) | `a2dfc21`, `7d5dd70` |
| 45 | Documentation sync (TODO.md, CLAUDE.md, architecture diagrams) | `4a3fccc`, `24f617c` |

### D. Code Health & Production Deployment (`0567ab8`)

| # | Task | Files |
|---|------|-------|
| 46 | ILIKE wildcard escape — admin.ts (2 locations) | `apps/api/src/routes/admin.ts` |
| 47 | ILIKE escape — porter.ts (AI tool input) | `apps/api/src/routes/porter.ts` |
| 48 | ILIKE backslash escape fix — items.ts | `apps/api/src/routes/items.ts` |
| 49 | AI tool-use loop iteration cap (MAX_TOOL_ITERATIONS=10) | `apps/api/src/lib/ai-client.ts` |
| 50 | Stub shipping label — stops mutating real order state | `apps/api/src/routes/shipping.ts` |
| 51 | Frontend: conditional label URL rendering (no `href="null"`) | `apps/web/src/app/orders/[id]/ship/page.tsx` |
| 52 | `LabelResponse` interface update (nullable URL, isStub flag) | `apps/web/src/hooks/use-shipping.ts` |
| 53 | Dockerfile fixes — `tsconfig.base.json` copy (×4 files) | `apps/api/Dockerfile`, `.dev`, `apps/web/Dockerfile`, `.dev` |
| 54 | Docker production: cert volume mount + HTTPS healthcheck | `docker-compose.yml` |
| 55 | Production deployment — full stack running with HTTPS via Cloudflare tunnel | (runtime) |

### E. Critical 3+ Ship (11 commits — 949a8dd→9f8db4e)

| # | Task | Commit |
|---|------|--------|
| 56 | Fix dashboard infinite spinner on cold load | `949a8dd` |
| 57 | Restructure TabBar: Home/Inventory/Scan/Orders/More | `84ba9ee` |
| 58 | Expand More page with 7 settings links + admin-only gate | `ad03728` |
| 59 | API: GET/PATCH `/users/me` + GET `/users/me/marketplace-accounts` | `aac0eac` |
| 60 | Profile settings page (display name, email, address) | `f86fe1b` |
| 61 | Marketplace accounts settings page (connect/disconnect) | `cad02be` |
| 62 | Help & Support page (FAQ accordion, contact) | `1fbbe74` |
| 63 | Notification preferences page (5 toggle switches) | `404be55` |
| 64 | Review fixes: error states, aria labels, address dirty tracking | `b5f0f33` |
| 65 | Fix toggle race condition in notification preferences | `922eabd` |
| 66 | Fix Porter chat: Zod `.optional()` → `.nullish()` for null conversationId | `9f8db4e` |

### G. Voice Chat Interface (PR #87 — 14 commits)

| # | Task | Commit |
|---|------|--------|
| 71 | API: `POST /porter/stream` SSE with `client.messages.stream()`, tool callbacks, TTS fire-and-forget | `cc8cdde` |
| 72 | API: `search_inventory` photos field; `POST /porter/transcribe` STT proxy; `POST /porter/speak` TTS proxy | `cf65b3f`–`6d4528b` |
| 73 | API: action pills system prompt + `parseActionPills()`; `chatStream()` in ai-client.ts | `50daddf`–`333d1c0` |
| 74 | Web: `usePorterStream`, `useVoiceInput`, `usePorterAudio`, `usePorterContext` hooks | `022721d`–`569335d` |
| 75 | Web: ToolBlock, InlineResultCard, CompTable, ActionPills, StreamingMessage, VoiceButton, AudioPlayback, VoiceOverlay, FloatingMic, BottomSheet, FullChat components | `022721d`–`44e0e57` |
| 76 | Web: Home screen redesign — engaged state, proactive greeting, PorterProvider context in tabs layout, tab bar restructured to 4 tabs | `975a5e2`–`7aecbe9` |
| 77 | API: JSONB migration to `blocks: ContentBlock[]` with `normalizeConversationMessages()` | `fe52da2` |
| 78 | Fix: Phase 6 review — SSE error handling fork, reader.cancel(), audio onerror, render-phase side effects | `d8c946c` |
| 79 | Infra: dhg-stt (Whisper large-v3-turbo, port 8018) + dhg-tts (Chatterbox Turbo, port 8019) in docker-compose | (docker-compose.yml) |

### F. eBay Buyer Messaging (PR #84 — 4 commits)

| # | Task | Commit |
|---|------|--------|
| 67 | API: eBay Trading API client (XML), message sync, conversation grouping, reply endpoint, 20 tests | `911eb3b` |
| 68 | Web: conversations list, thread view, reply composer, unread badge | `5534173` |
| 69 | Fix: 18 advisor review findings (auth gates, error display, fetch rename, Re: dedup) | `3a60fdd` |
| 70 | Fix: 11 PR findings + 5 wiring issues (non-XML guard, per-msg errors, conversationKey validation) | `fd8c825` |

---

## Responsive UI Program (approved 2026-07-15, precedes onboarding-expansion build)

Sequencing note: the onboarding-expansion ship (plan `docs/superpowers/plans/2026-07-14-onboarding-expansion.md`, spec PR #228) is QUEUED BEHIND Phase R0 — its tutorial screenshots must capture the new shell, not the old UI.

### Phase R0 — Responsive Shell (this ship, branch `feat/responsive-shell`)
- [ ] Desktop sidebar — persistent left nav ≥1024px, collapsible 240px ↔ 72px icon rail, Scan on top
- [ ] Desktop top bar — page title · Ask Porter input (focus-expands 1→3 lines, page-specific pills) · unread badge, theme toggle, avatar menu
- [ ] iPad/tablet — breakpoint-based: portrait (`md`) = mobile chrome + wider content grids; landscape (≥1024) = desktop shell
- [ ] Mobile tab bar redesign — floating inset glass bar, `rounded-[22px]` photo-editor idiom, keeps 6 tabs + orange Scan FAB
- [ ] Persistent Home chip — round glass chip bottom-left on all tab-bar-less pages (mobile/tablet)
- [ ] Ask Porter row — same component under PageHeader on inventory/listings/orders (mobile/tablet portrait)
- [ ] Content width system — shared responsive container replaces per-page `max-w-lg`; content region reserves right-dock slot (R3) + pane-capable main area (R1)

### Phase R1 — Desktop Workbench
- [ ] Master-detail inventory/listings — list pane + edit pane (`inventory/[id]` surface), arrow-key nav, no page swaps

### Phase R2 — Desktop Ingest
- [ ] Drag-and-drop photo ingest — drop image files → batch queue → vision-identify pipeline → items

### Phase R3 — Porter Everywhere
- [ ] Porter side dock — collapsible right dock on desktop, context-aware of on-screen item
- [ ] Porter conversation history UI — list/deep-links/resume over existing `GET /porter/conversations` endpoints

### Phase R4 — Cross-Device
- [ ] QR phone-camera handoff — desktop Scan → QR → phone captures → item lands live in desktop session

### Deferred / unscheduled
- [ ] Keyboard shortcuts (`g i`, `/`, `n`)
- [ ] Hover row-actions + dense table views

---

## Summary

| Phase | Open items | Est |
|-------|-----------|-----|
| 1 — Sold-orders panel + carrier cleanup | ✅ COMPLETE — PR #142 merged 2026-07-01 (+ soldAt-heal bonus) | done |
| 2 — Rip out voice feature (parked → future release) | tag, web strip, API strip, containers/env, tests, docs, gate, PR (8) | ~5h |
| 3 — AI-specifics follow-through (PR #132 merged 06-23) | E-panel decision, fake-camera e2e, aspect auto-pick, SKU check, #126 (5) | ~6h |
| 4 — Repo hygiene & Trade-First housekeeping | #127, Dependabot ×8, GTC renewal, verify-wiring decision, dead-code sweep, burndown+docs refresh (7) | ~5h |
| 5 — Deferred product gaps (registry) | weight/dims, publish-mode, preview reachability, photo gallery, batch-enhance (5) | ~12h |
| 6 — Feature completeness | notifications, dashboard trends, photo persistence (3) | ~16h |
| 7 — Quality & hardening | pagination (1) — integration testing, tunnel config, CORS all closed 2026-07-09 | ~4h |
| ~~Voice-audit sweep~~ | DELETED — evaluator verified A1–A8 all already fixed on main (2026-07-01) | — |
| Completed (all time) | 48 roadmap tasks + 8 major ships May 26→Jul 1 (PRs #73/#74/#79/#84/#94/#125/#133/#139) | — |
| Superseded | Task 21 carrier APIs → redirect-to-eBay (stub deleted in W4) | — |

---

## Legend

- [x] = Complete and verified
- [~] = Partial — core exists but has documented gaps
- [ ] = Not started

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | npm workspaces |
| API | Express 5, TypeScript, pino |
| Frontend | Next.js 16, React 19, Tailwind v4 |
| Database | PostgreSQL 15, Drizzle ORM |
| Auth | Cloudflare Access (IdP) + short-lived internal JWT — no passwords (bcrypt/refresh tokens removed, PRs #168–#172) |
| Images | Cloudflare R2, Sharp |
| AI | Claude Sonnet (vision + tool_use + SSE streaming via MessageStream) |
| Voice STT/TTS | REMOVED 2026-07-01 (Execution Phase 2) — parked at git tag `voice-parked-2026-07` for a future release |
| BG Removal | @imgly/background-removal (WASM) |
| Marketplaces | eBay (Trading API for listings + Fulfillment REST for orders), Reverb (REST, per-user PAT auth — selling live-proven), Etsy PARKED 2026-07-09 (tag `etsy-parked-2026-07`) |
| Token encryption | AES-256-GCM |

## Ports

| Service | Port |
|---------|------|
| portage-db | 5436 |
| portage-api | 8016 |
| portage-app | 3002 |
| dhg-docs (nginx) | 8017 |

## Demo Account

`demo@portage.app` / `demo1234demo1234` — 16 items, Pro tier (promoted 2026-05-09, all limits removed)

## DHG Assets pipeline (own project — Stephen 2026-07-15)

Registry table `dhg_assets` + ingest/search for marketing/collateral assets (registry deferred item, priority high):

- [ ] Table: project, repo path/URL, kind (screenshot|panel|frame|logo|doc), variant (with-copy|without-copy), dimensions, source_commit, tags, caption, pgvector embedding, FTS
- [ ] Ingest `docs/assets/**` from Portage (extendable to other repos)
- [ ] Process each asset for searchability: vision-model caption (Gemini per vision strategy) → embedding + FTS, exposed via hybrid KB search
- [ ] Autopost pipeline (post-assets.sh + rule) so future asset exports auto-ingest — use the autopost-setup agent
- [ ] Prereq for marketing-grade assets: stage real-looking demo inventory (items + order + conversation), recapture, re-export
