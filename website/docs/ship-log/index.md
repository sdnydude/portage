---
title: Ship Log
sidebar_label: Ship Log
sidebar_position: 0
---

# Portage Ship Log

Every `/ship` run, generated from the DHG Registry `ship_sessions` table plus hand-written entries. Total: 135 sessions.

| # | Feature | PR |
|---|---------|----|
| 001 | [Critical code health fixes — ILIKE escape, AI tool loop cap, stub shipping guard](001-critical-code-health-fixes-ilike-escape-ai-tool-loop-cap-stu) | no PR recorded |
| 002 | [JWT auto-refresh — intercept 401, auto-refresh with stored refresh token, retry, dedup concurrent refreshes](002-jwt-auto-refresh-intercept-401-auto-refresh-with-stored-refr) | [#32](https://github.com/sdnydude/portage/pull/32) |
| 003 | [Scan/lookup pipeline accuracy bugs — eBay condition normalization, comps limit, temperature tuning, Zod validation, multi-image vision](003-scan-lookup-pipeline-accuracy-bugs-ebay-condition-normalizat) | [#26](https://github.com/sdnydude/portage/pull/26) |
| 004 | [Listings CRUD — edit/update/delete from UI with marketplace sync](004-listings-crud-edit-update-delete-from-ui-with-marketplace-sy) | [#27](https://github.com/sdnydude/portage/pull/27) |
| 005 | [C1 — Fix order sync assigns wrong listing to incoming orders](005-c1-fix-order-sync-assigns-wrong-listing-to-incoming-orders) | [#28](https://github.com/sdnydude/portage/pull/28) |
| 006 | [C2 — Fix XSS via dangerouslySetInnerHTML with unsanitized AI text](006-c2-fix-xss-via-dangerouslysetinnerhtml-with-unsanitized-ai-t) | [#29](https://github.com/sdnydude/portage/pull/29) |
| 007 | [C3 — Replace sql.raw() with parameterized Drizzle APIs to prevent SQL injection](007-c3-replace-sql-raw-with-parameterized-drizzle-apis-to-preven) | [#30](https://github.com/sdnydude/portage/pull/30) |
| 008 | [C4 — Decouple encryption key from JWT_SECRET](008-c4-decouple-encryption-key-from-jwt-secret) | [#31](https://github.com/sdnydude/portage/pull/31) |
| 009 | [Fix Object URL memory leaks in listing flows](009-fix-object-url-memory-leaks-in-listing-flows) | [#33](https://github.com/sdnydude/portage/pull/33) |
| 010 | [Test infrastructure — vitest config, env setup, JWT helpers](010-test-infrastructure-vitest-config-env-setup-jwt-helpers) | [#34](https://github.com/sdnydude/portage/pull/34) |
| 011 | [P0 tests — crypto, jwt, password, auth middleware, error handler (27 unit tests)](011-p0-tests-crypto-jwt-password-auth-middleware-error-handler-2) | [#35](https://github.com/sdnydude/portage/pull/35) |
| 012 | [P0 route tests — auth endpoints + computePricing via createApp factory + supertest](012-p0-route-tests-auth-endpoints-computepricing-via-createapp-f) | [#36](https://github.com/sdnydude/portage/pull/36) |
| 013 | [Docker environment fixes — API crash, background removal, web container, multi-photo](013-docker-environment-fixes-api-crash-background-removal-web-co) | [#51](https://github.com/sdnydude/portage/pull/51) |
| 014 | [Unified photo capture + editing flow with multi-photo scan, inline toolbar, comp field copying](014-unified-photo-capture-editing-flow-with-multi-photo-scan-inl) | [#52](https://github.com/sdnydude/portage/pull/52) |
| 015 | [Fix Dependabot vulnerabilities + clean up website/ tooling](015-fix-dependabot-vulnerabilities-clean-up-website-tooling) | no PR recorded |
| 016 | [Ship session intelligence pipeline + unified KB search](016-ship-session-intelligence-pipeline-unified-kb-search) | no PR recorded |
| 017 | [Memory intelligence Loops 2+3 activated end-to-end](017-memory-intelligence-loops-2-3-activated-end-to-end) | no PR recorded |
| 018 | [Loop 4 self-training (Minimal) — corrections capture + briefing surface](018-loop-4-self-training-minimal-corrections-capture-briefing-su) | no PR recorded |
| 019 | [WebP to JPEG image format — fix marketplace compatibility](019-webp-to-jpeg-image-format-fix-marketplace-compatibility) | [#63](https://github.com/sdnydude/portage/pull/63) |
| 020 | [Registry KB acceleration — bulk ingest memory + CLAUDE.md files](020-registry-kb-acceleration-bulk-ingest-memory-claude-md-files) | [#64](https://github.com/sdnydude/portage/pull/64) |
| 021 | [Registry upsert/idempotency for all non-idempotent tables + dev_changelog KB source](021-registry-upsert-idempotency-for-all-non-idempotent-tables-de) | [#18](https://github.com/sdnydude/dhgaifactory3.5/pull/18) |
| 022 | [Code health week 1 — resolve 30 Important + 20 Minor findings](022-code-health-week-1-resolve-30-important-20-minor-findings) | [#65](https://github.com/sdnydude/portage/pull/65) |
| 023 | [Deferred items from code health review](023-deferred-items-from-code-health-review) | [#66](https://github.com/sdnydude/portage/pull/66) |
| 024 | [Full codebase code health review — 37 findings](024-full-codebase-code-health-review-37-findings) | [#65](https://github.com/sdnydude/portage/pull/65) |
| 025 | [audit-test](025-audit-test) | no PR recorded |
| 026 | [automation-test](026-automation-test) | no PR recorded |
| 027 | [Full wiring and deployment audit of memory/registry pipeline](027-full-wiring-and-deployment-audit-of-memory-registry-pipeline) | [#67](https://github.com/sdnydude/portage/pull/67) |
| 028 | [Hook-driven capture — guaranteed registry ingest via session hooks](028-hook-driven-capture-guaranteed-registry-ingest-via-session-h) | [#68](https://github.com/sdnydude/portage/pull/68) |
| 029 | [Capture-guarantee V2 — decisions + deferred auto-fire, advisory logging](029-capture-guarantee-v2-decisions-deferred-auto-fire-advisory-l) | [#69](https://github.com/sdnydude/portage/pull/69) |
| 030 | [Capture-guarantee V3 — corrections + bug-fixes auto-fire with context-window extraction](030-capture-guarantee-v3-corrections-bug-fixes-auto-fire-with-co) | [#70](https://github.com/sdnydude/portage/pull/70) |
| 031 | [Fix all 4 feedback loops — cron, journal aging, correction/bug-fix surfacing](031-fix-all-4-feedback-loops-cron-journal-aging-correction-bug-f) | [#71](https://github.com/sdnydude/portage/pull/71) |
| 032 | [Stripe subscription billing — Pro tier, trials, credit packs](032-stripe-subscription-billing-pro-tier-trials-credit-packs) | [#73](https://github.com/sdnydude/portage/pull/73) |
| 033 | [Billing enforcement gates — marketplace count + bg-removal](033-billing-enforcement-gates-marketplace-count-bg-removal) | [#74](https://github.com/sdnydude/portage/pull/74) |
| 034 | [Billing enforcement gaps — marketplace count limit + background removal billing gate](034-billing-enforcement-gaps-marketplace-count-limit-background-) | [#74](https://github.com/sdnydude/portage/pull/74) |
| 035 | [Reverb token-paste auth flow](035-reverb-token-paste-auth-flow) | [#75](https://github.com/sdnydude/portage/pull/75) |
| 036 | [eBay Seller Hub Reports CSV export with marketplace data caching](036-ebay-seller-hub-reports-csv-export-with-marketplace-data-cac) | [#76](https://github.com/sdnydude/portage/pull/76) |
| 037 | [scan comp cards + reverb UI + features doc + docs tunnel](037-scan-comp-cards-reverb-ui-features-doc-docs-tunnel) | [#78](https://github.com/sdnydude/portage/pull/78) |
| 038 | [eBay buyer messaging — read inbox + reply via Trading API](038-ebay-buyer-messaging-read-inbox-reply-via-trading-api) | [#84](https://github.com/sdnydude/portage/pull/84) |
| 039 | [Voice chat interface — Porter-powered home screen with streaming, voice input, and TTS](039-voice-chat-interface-porter-powered-home-screen) | [#87](https://github.com/sdnydude/portage/pull/87) |
| 039 | [Voice chat interface — Porter-powered voice control with redesigned home screen](039-voice-chat-interface-porter-powered-voice-control-with-redes) | [#87](https://github.com/sdnydude/portage/pull/87) |
| 040 | [#040 — Bulk Photo Export (ZIP Download)](040-bulk-photo-export-zip-download) | [#88](https://github.com/sdnydude/portage/pull/88) |
| 041 | [bulk image export — zip download of all photos for selected inventory items](041-bulk-image-export-zip-download-of-all-photos-for-selected-in) | [#88](https://github.com/sdnydude/portage/pull/88) |
| 041 | [#041 — Stage 1: Scan-Review Redesign + Inline eBay Aspects](041-stage1-scan-review-redesign-inline-ebay-aspects) | [#104](https://github.com/sdnydude/portage/pull/104) |
| 042 | [eBay production OAuth — sandbox coercion fix + prod/sandbox credential selection + callback page + legal pages](042-ebay-production-oauth-sandbox-coercion-fix-prod-sandbox-cred) | [#93](https://github.com/sdnydude/portage/pull/93) |
| 042 | [#042 — Stage 2: Pricing Engine, Best Offer Auto-Accept + Listing Footer](042-stage2-pricing-engine-best-offer-footer) | [#106](https://github.com/sdnydude/portage/pull/106) |
| 043 | [eBay listing publish hardening (PLANNED — checkpointed at Phase 2)](043-ebay-listing-publish-hardening-planned-checkpointed-at-phase) | no PR recorded |
| 044 | [eBay listing publish hardening — Phase 3 Plan](044-ebay-listing-publish-hardening-phase-3-plan) | no PR recorded |
| 045 | [eBay listing publish hardening + draft/live publish mode + auto-setup of business policies & inventory location](045-ebay-listing-publish-hardening-draft-live-publish-mode-auto-) | [#94](https://github.com/sdnydude/portage/pull/94) |
| 046 | [eBay required item specifics — proactive in-flow collection + publish gate](046-ebay-required-item-specifics-proactive-in-flow-collection-pu) | no PR recorded |
| 047 | [eBay return-policy diagnosis + 56-deferral audit + c3b3013c publish-wiring fix](047-ebay-return-policy-diagnosis-56-deferral-audit-c3b3013c-publ) | no PR recorded |
| 048 | [eBay package weight & dimension capture](048-ebay-package-weight-dimension-capture) | no PR recorded |
| 049 | [eBay publish hardening — Calculated default + AI weight estimation + editable price on every publish path](049-ebay-publish-hardening-calculated-default-ai-weight-estimati) | [#101](https://github.com/sdnydude/portage/pull/101) |
| 050 | [Redesign Ship 1 — DHG design system + Porter home + tab bar + /porter page + theme toggle](redesign-ship-1-build) | no PR recorded |
| 051 | [Redesign Ship 1 — DHG design system + Porter home + tab bar + /porter page + theme toggle (Phase 6 review + fixes + PR)](redesign-ship-1-phase6) | [#102](https://github.com/sdnydude/portage/pull/102) |
| 053 | [Claude tooling + batch-enhance backend + eBay updateListing packageType fix](053-claude-tooling-batch-enhance-backend-ebay-updatelisting-pack) | [#101](https://github.com/sdnydude/portage/pull/101) |
| 055 | [Stage 2.5: photo-gallery strip + full-screen editor overlay across scan, item detail, and all listing flows](055-stage-2-5-photo-gallery-strip-full-screen-editor-overlay-acr) | [#108](https://github.com/sdnydude/portage/pull/108) |
| 056 | [Deferral P1: eBay account-deletion compliance, fork-PR gating, prod boot guard](056-deferral-p1-ebay-account-deletion-compliance-fork-pr-gating-b) | [#309](https://github.com/sdnydude/portage/pull/309) |
| 057 | [Deferral P2: capture-pipeline integrity — landing-verified captures, DLQ durability, write-auth](057-deferral-p2-capture-pipeline-integrity) | no PR recorded |
| 058 | [Deferral P3: beta UX truth — guided Best Offer fix, scan/swipe outage surfacing, mobile deep-link guard](058-deferral-p3-beta-ux-truth) | [#315](https://github.com/sdnydude/portage/pull/315) |
| 059 | [Housekeeping batch 1 — price truth, aspect removal, est-value retirement, item status, chips, category filter, condition notes](059-housekeeping-1) | [#317](https://github.com/sdnydude/portage/pull/317) |
| 060 | [Pre-Stage-3 fix batch Phase A: per-device auth sessions + stay-logged-in + immediate session-loss redirect](ship-911ad540) | [#110](https://github.com/sdnydude/portage/pull/110) |
| 061 | [Pre-Stage-3 fix batch Phase B: publish-failure truth + price/weight capture + eBay taxonomy as THE category](ship-1bc804cc) | [#111](https://github.com/sdnydude/portage/pull/111) |
| 062 | [Pre-Stage-3 fix batch Phase C: inventory redirects + single review card + honest label/order pages (+2 live-gate crash fixes)](ship-cf6e90a1) | [#112](https://github.com/sdnydude/portage/pull/112) |
| 063 | [eBay category-persist + ATO publish hardening](ship-f4a461b0) | [#118](https://github.com/sdnydude/portage/pull/118) |
| 064 | [Dead /settings links fix + AI-specifics publish-result plan](ship-606e5d3a) | [#125](https://github.com/sdnydude/portage/pull/125) |
| 065 | [AI-specifics A-E core (scan aspect-fill -\> persist -\> publish carry-through, no aspect pop-up)](ship-b1fa6d2f) | no PR recorded |
| 066 | [F-GATE eBay-draft both-panel verification + in-app eBay-read route](ship-6652c23d) | no PR recorded |
| 067 | [F1 unify publish panels — both paths open one CreateListingSheet](ship-0af89c43) | no PR recorded |
| 068 | [F4 two-state publish result in CreateListingSheet](ship-d6f723e0) | no PR recorded |
| 069 | [eBay edit-sync (Part 1) + Listing Optimizer research panel (Part 2)](ship-c455bbbd) | [#133](https://github.com/sdnydude/portage/pull/133) |
| 070 | [eBay Trade-First refactor — Phase 1 (createListing → Trading API)](ship-dc0ef347) | no PR recorded |
| 071 | [eBay Trade-First refactor — Phase 1 (createListing to Trading API)](ship-78d8ec60) | no PR recorded |
| 072 | [eBay Trade-First Milestone A — createListing via Trading + live proof](ship-1e958052) | no PR recorded |
| 073 | [eBay Trade-First Milestone B — End/GetItem/Revise + drop offers](ship-7815d6e8) | no PR recorded |
| 074 | [eBay Trade-First (Phase F + Milestones A+B) — MERGED to main](ship-2dacc2f5) | [#133](https://github.com/sdnydude/portage/pull/133) |
| 075 | [Orders sync — orphan eBay-sale ingest via GetItem backfill](ship-6b9044cd) | [#139](https://github.com/sdnydude/portage/pull/139) |
| 076 | [Orders page: ship-on-eBay + sold-date fix (W1+W3)](ship-c6def906) | no PR recorded |
| 077 | [Phase 1: sold-orders panel + carrier subsystem deletion + soldAt heal](ship-aca32f61) | [#142](https://github.com/sdnydude/portage/pull/142) |
| 078 | [Phase 2: voice feature rip-out (parked for future release)](ship-32595eef) | [#146](https://github.com/sdnydude/portage/pull/146) |
| 079 | [Phase 3: AI-specifics follow-through (Type auto-pick, camera e2e, SKU proof, E-panel closure)](ship-3ab4ee8f) | [#147](https://github.com/sdnydude/portage/pull/147) |
| 080 | [Phase 4.1: Dependabot triage — single lockfile security PR](ship-417e7f9c) | [#148](https://github.com/sdnydude/portage/pull/148) |
| 081 | [Phase 4.1/4.2: PR backlog drain — merge queue + capture-guarantee hook](ship-f22c9bf9) | [#150](https://github.com/sdnydude/portage/pull/150) |
| 082 | [Phase 4.3: GTC auto-end — end eBay listings before monthly renewal](ship-e919081f) | [#151](https://github.com/sdnydude/portage/pull/151) |
| 083 | [Phase 4 closeout: proof-only decision + dead-helper sweep + docs refresh](ship-4fc00fa2) | [#152](https://github.com/sdnydude/portage/pull/152) |
| 084 | [Fresh-scan prepare: item at confirm + preview/comps on every path (Phase 5.3)](ship-b26697e8) | [#153](https://github.com/sdnydude/portage/pull/153) |
| 085 | [1:1 capture discipline: guided square camera capture + pan/zoom crop rewrite](ship-a4832032) | [#154](https://github.com/sdnydude/portage/pull/154) |
| 086 | [Multi-shot camera: one getUserMedia session per capture burst](ship-76d9a5cb) | [#155](https://github.com/sdnydude/portage/pull/155) |
| 087 | [App sitemap in docs: 3 SVG variants + PDF + generator with collision checking; docs-site outage fix](ship-5798cdeb) | [#156](https://github.com/sdnydude/portage/pull/156) |
| 088 | [Photo tools: inline BG removal + white-background flatten + exposure EV tool](ship-29b7e7d6) | [#166](https://github.com/sdnydude/portage/pull/166) |
| 089 | [Reverb marketplace publish path — per-user tokens, enrichment, live publish](ship-15a8af73) | [#173](https://github.com/sdnydude/portage/pull/173) |
| 090 | [Get Reverb marketplace publish path OPERATING end-to-end (createListing live-proven)](ship-801cf5f0) | no PR recorded |
| 091 | [DB-backed FAQs + admin FAQ editor](ship-200a3d28) | [#178](https://github.com/sdnydude/portage/pull/178) |
| 092 | [Idempotent publish retries — scoped client key + server resume of stuck drafts](ship-aa899e68) | [#180](https://github.com/sdnydude/portage/pull/180) |
| 093 | [Reverb per-image photo DELETE + hardening-batch audit](ship-c974d4f2) | [#181](https://github.com/sdnydude/portage/pull/181) |
| 094 | [Park Etsy marketplace integration](ship-d7aae5aa) | [#183](https://github.com/sdnydude/portage/pull/183) |
| 095 | [Seller-profile Business Policies removal + CodeRabbit follow-up fixes](ship-0a538737) | [#186](https://github.com/sdnydude/portage/pull/186) |
| 096 | [Orders/listings UI batch: fulfillment-status sync + canceled status + titles + badge](ship-d6433199) | [#187](https://github.com/sdnydude/portage/pull/187) |
| 097 | [Editable admin user management — add/archive/delete, role/plan/trial/credits, per-user limit overrides](ship-aef801ae) | [#188](https://github.com/sdnydude/portage/pull/188) |
| 098 | [Bake portage-api by default — override compose becomes opt-in dev overlay (PR #189)](ship-75129584) | [#189](https://github.com/sdnydude/portage/pull/189) |
| 099 | [TODO.md stale cleanup — close Task 34/35, drop obsolete Reverb OAuth item (PR #190)](ship-90204e98) | [#190](https://github.com/sdnydude/portage/pull/190) |
| 100 | [Docs site refresh: full staleness sweep + screenshot appendix + deployed-image-path fix (PR #191)](ship-2253e8af) | [#191](https://github.com/sdnydude/portage/pull/191) |
| 101 | [Sitemap diagrams regenerated for the 35-route tree (PR #193)](ship-822ec071) | [#193](https://github.com/sdnydude/portage/pull/193) |
| 102 | [portage-graph: code knowledge graph dashboard + wiki on :8018 (PR #200)](ship-82413ee4) | [#200](https://github.com/sdnydude/portage/pull/200) |
| 103 | [Stack portal — interactive resource hub at :8018/portal/ (PR #201)](ship-4b984c18) | [#201](https://github.com/sdnydude/portage/pull/201) |
| 104 | [Inventory Unlisted-badge fix — qualified items.id correlation in listed EXISTS subquery (PR #202)](ship-d8c3a8b6) | [#202](https://github.com/sdnydude/portage/pull/202) |
| 105 | [CI auto-review: claude-code-action on every PR (PR #203)](ship-8a611d5f) | [#203](https://github.com/sdnydude/portage/pull/203) |
| 106 | [Camera zoom + Continuity Camera device picker (PR #220)](ship-08a440b8) | [#220](https://github.com/sdnydude/portage/pull/220) |
| 107 | [Photo drag-reorder + 24-photo cap (F1+F2)](ship-7c876520) | [#223](https://github.com/sdnydude/portage/pull/223) |
| 108 | [0.5x ultra-wide zoom chip + Continuity camera-menu hint](ship-2d01e66e) | [#224](https://github.com/sdnydude/portage/pull/224) |
| 109 | [Responsive shell R0 - desktop sidebar, iPad, floating glass tab bar](ship-f3b8ae4a) | [#229](https://github.com/sdnydude/portage/pull/229) |
| 110 | [R0 follow-up batch (deferrals 1/3/4/5/6/7/8)](ship-e8445e7b) | [#230](https://github.com/sdnydude/portage/pull/230) |
| 111 | [Onboarding expansion — tutorial hub + screenshot show-and-tell](ship-ffc75f09) | [#231](https://github.com/sdnydude/portage/pull/231) |
| 112 | [Tutorial visual edit pass — all 24 phone graphics reviewed](ship-2ee0c5e6) | [#232](https://github.com/sdnydude/portage/pull/232) |
| 113 | [R1 desktop workbench — master-detail inventory/listings (build phase, PR pending)](ship-b23478eb) | no PR recorded |
| 114 | [R1 workbench merge + 15-finding adversarial fix round](ship-33abf77d) | [#237](https://github.com/sdnydude/portage/pull/237) |
| 115 | [4-tab bottom nav + app shell on /admin](ship-dae29f08) | [#240](https://github.com/sdnydude/portage/pull/240) |
| 116 | [Reverb shipping profiles + shipping UI (seller profile)](ship-c32ffda3) | no PR recorded |
| 117 | [Reverb category picker in publish sheet (non-gear dead-end fix)](ship-66f6681d) | no PR recorded |
| 118 | [Langfuse tracing + conditionNotes cap fix merged to main](ship-3b93421e) | [#253](https://github.com/sdnydude/portage/pull/253) |
| 119 | [Dependency audit pass — high vulns eliminated](ship-973e6c4a) | [#257](https://github.com/sdnydude/portage/pull/257) |
| 120 | [Beta bug batch: upload 500 + covered publish sheet](ship-1a023679) | [#262](https://github.com/sdnydude/portage/pull/262) |
| 121 | [Auth hardening: exchange breaker + per-identity rate limiting](ship-180b2379) | [#263](https://github.com/sdnydude/portage/pull/263) |
| 122 | [Per-listing Accept-offers toggle (publish sheet, eBay + Reverb)](ship-dd079e9b) | [#264](https://github.com/sdnydude/portage/pull/264) |
| 123 | [Advertising toggles — eBay Promoted Listings + Reverb Bump (publish sheet)](ship-827b1aba) | [#265](https://github.com/sdnydude/portage/pull/265) |
| 124 | [Per-listing shipping controls — scaffold + Phases 1-3 (eBay + Reverb + surfaces) + 2-day services](ship-f6afdcb4) | [#274](https://github.com/sdnydude/portage/pull/274) |
| 125 | [Reverb category cascade — taxonomy endpoints, AI resolution, UI + review-hardening batch](ship-24f2b99b) | [#280](https://github.com/sdnydude/portage/pull/280) |
| 126 | [Per-listing shipping controls — scaffold + Phases 1-3 + local-pickup](ship-719371f6) | [#274](https://github.com/sdnydude/portage/pull/274) |
| 127 | [Marketplace sync refactor — durable log, outbox worker, UI truth surface (P0-P3)](ship-21611579) | [#283](https://github.com/sdnydude/portage/pull/283) |
| 128 | [Sync audit fix batch — 19 of 20 findings (C1-C3, M1, M3-M9, m1-m8)](ship-26032c56) | [#287](https://github.com/sdnydude/portage/pull/287) |
| 129 | [Best Offer redesign + criticals (PRs #288/#289) + live repair of 4 listings](ship-1f010041) | [#289](https://github.com/sdnydude/portage/pull/289) |
| 130 | [Ship-program Phase 1 — beta-blocker UI batch (localPickup seed/save, BO conflict guided fix with healed flag, Reverb category cascade on publish)](ship-032d9d40) | [#295](https://github.com/sdnydude/portage/pull/295) |
| 131 | [Ship-program Phase 2 — marketplace-truth sync (status sweep + Reverb order sync/backfill) + 10-finding review-fix batch + Reverb blank-model publish fix](ship-31c6404f) | [#299](https://github.com/sdnydude/portage/pull/299) |
| 132 | [Phase 3a Porter reliability + granite switch (PR #303) and category-mismatch guard (PR #304, stacked)](ship-47cb5195) | [#303](https://github.com/sdnydude/portage/pull/303) |
| 133 | [Wrap PR #305 — rich-vision guard fix + Porter totals nudge + docs refresh](ship-9c2d6aad) | [#305](https://github.com/sdnydude/portage/pull/305) |
| 134 | [Deferral P4: docs & observability truth — ship-log generator revival, /about, rsync --delete, tutorials, eBay API reference](134-deferral-p4-docs-truth) | [#319](https://github.com/sdnydude/portage/pull/319) |
