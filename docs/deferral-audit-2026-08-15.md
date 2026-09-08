# Portage Deferral-Log Audit — 2026-08-15

Audited all 170 open registry deferred_items against main (b275295 + deps merges). Method: 5 parallel read-only verification agents (34 items each), evidence-checked per item; 4 agent-missed items hand-verified. Registry updated same session: RESOLVED → status=resolved, OBSOLETE → status=wont_fix, each with a resolution_reason citing evidence.

| Verdict | Count | Registry action |
|---|---|---|
| RESOLVED | 61 | status=resolved |
| OBSOLETE | 16 | status=wont_fix |
| OPEN | 84 | unchanged |
| UNCERTAIN | 9 | unchanged, flagged below |

Priority escalations applied: `223b0419` self-hosted-runner fork risk medium→high (repo is now PUBLIC — original private-repo rationale void); `c683b4bc` eBay Marketplace Account Deletion endpoint high→critical (mandatory compliance, live prod storing eBay data).

## Open items (84) — by priority

### CRITICAL

- `7d218492` (2026-06-21) **CRITICAL: harden capture pipeline — landing-verified + idempotent (captures silently drop)**
  - All 3 bugs remain: post-insight.sh exit 0 on curl failure no dead-letter; capture-guarantee.py counts calls not registry landings; no idempotency key in payload builders.
- `c683b4bc` (2026-06-28) **Verify + likely implement eBay Marketplace Account Deletion notification endpoint (mandatory for prod keyset s**
  - No account-deletion/challenge-code endpoint anywhere; app live in prod storing eBay tokens/messages/orders since PR #133 — eBay-mandated compliance gap.
### HIGH

- `bccbc90e` (2026-06-21) **Dead-end / unwired-artifact audit + cleanup across codebase (CodeGraph + Graphify)**
  - capture-guarantee.py now registered in settings.json:184, but no systematic CodeGraph+Graphify dead-end sweep done.
- `610ee575` (2026-06-23) **Ship /about page with terms/conditions/waiver links (F3b microcopy target)**
  - No /about route under apps/web/src/app — F3b microcopy link target unbuilt.
- `183474c5` (2026-06-30) **Build deterministic Stop-hook for insight/decision/correction auto-capture**
  - No Stop hook parsing transcript for Insight/decision/correction blocks; capture still rule-driven; daemon briefing flags repeated-instruction pattern consistent with gap.
- `223b0419` (2026-07-11) **Harden pull_request workflows running on self-hosted runner before public launch**
  - claude-review.yml + e2e.yml still on: pull_request + self-hosted, no fork gating. REPO NOW PUBLIC (gh repo view: visibility PUBLIC) — original private-repo rationale void; live fork-PR code-execution risk on stateful runner.
- `2e2201ce` (2026-07-17) **Ship-log generator revival + 54-session backfill + SOP/hooks enforcement**
  - ship-log: duplicate 042 pair, highest entry 055, index.md mtime 2026-07-09 — generator revival/backfill/dedup never done.
- `73dd1664` (2026-07-28) **Widen the boot guard: required-key presence check (R2, eBay, Stripe, Anthropic) in production**
  - env.ts:81-98 superRefine validates only CF_ACCESS_AUD; R2_*, EBAY_*, STRIPE, ANTHROPIC keys remain optional with no prod-required check.
- `25afd214` (2026-08-05) **Price editors must surface the Best Offer thresholds that can block the save**
  - Backend half done (981aafe BEST_OFFER_CONFLICT details); no FE consumer — PriceField plain, BestOfferFloorNote pre-publish only. Live-breaking UX gap from 2026-08-05 remains.
- `13699992` (2026-08-08) **30-day container-log retention into dhg-aifactory registry table with search/knowledge processing**
  - No log-retention config in docker-compose.yml; no dhg-aifactory ingest code — operator-directed work not started.
### MEDIUM

- `20bd6a97` (2026-06-03) **Replace in-memory OAuth stateStore with DB-backed oauth_state table**
  - ebay-auth.ts:20 still in-process Map for OAuth CSRF state (lost on restart); etsy half moot (parked).
- `0790405b` (2026-06-04) **Auto-pull eBay seller address (+name/email/phone) from Commerce Identity API on OAuth connect**
  - ebay-auth.ts callback (193-211) only fetches marketplaceUserId; no address/name/email/phone prefill, no address.readonly scope.
- `c3b3013c` (2026-06-04) **Photo-first eBay publish drops ebayPreparedFields + publishMode on fallback paths**
  - hybrid-flow.tsx:496 + conversational-flow.tsx:774-776 forward ebayPreparedFields+publishMode on fallback paths, but swipe-flow.tsx:1605-1611 still gates prepare() on pre-existing inventoryItemId with no photo-first fallback — partial fix, swipe path still drops prepared fields.
- `32fe6586` (2026-06-05) **Resume photo gallery feature ship (v89) — chunks 2–6 remaining**
  - No manage_photos Porter tool, no photo_selection SSE, no /inventory/photos sub-page; ship-state_v89.md still unresolved in repo.
- `eed1f6a5` (2026-06-06) **Porter has no update_item tool — cannot change item condition/price from chat**
  - porter.ts tools array (51-86) still exactly 3 tools — no update_item tool.
- `227af3ce` (2026-06-08) **Full scan review-step extraction (only the action bar + price was extracted)**
  - scan-flow.tsx still 1569 lines w/ inline edit inputs (1154-1501); only ScanReviewActions + ScanAspectsSection extracted.
- `ee0e9f9a` (2026-06-09) **Wire frontend caller for POST /images/batch-enhance (enhance-all-photos UX)**
  - No apps/web file references batch-enhance — endpoint still has zero FE callers.
- `125cbc53` (2026-06-10) **useRequiredAspects needs isError flag — Complete badge can show on fetch failure**
  - use-required-aspects.ts:54,59 still .catch(() => setAspects({})) returning only {aspects,isLoading} — no isError; test file exists, bug unfixed.
- `62e1061e` (2026-06-10) **Condition snap should notify the user when their selected condition is changed**
  - scan-flow.tsx:216-220 still silent setEditCondition(nearestAllowedCondition) — no user notice.
- `0ffa17fe` (2026-06-10) **Shared-types pass for the 4 sync-by-comment contracts in scan aspects feature**
  - No RequiredAspect type/condition-map export in shared types.ts; all 4 contracts still local.
- `c8e0e606` (2026-06-10) **Re-validate locked batch-enhance FE design against Stage 1 scan-review redesign before building**
  - Backend batch-enhance shipped (8f6ddb7) but zero FE wiring — no useBatchEnhance/EnhanceAllButton/BatchEnhanceReviewSheet in apps/web; locked FE design needs re-validation.
- `e955f1b9` (2026-06-10) **Surface comps-fetch failures in scan-flow (empty .catch swallows pricing-data errors)**
  - scan-flow.tsx:425 comps fetch still .catch(() => {}) with no compsError state.
- `9ed1d07e` (2026-06-10) **Migrate inventory/[id] photo editing onto usePhotoEdit + collapse photoIndex/editingPhotoIndex dual state**
  - item-detail.tsx own handleRotate(324)/handleCropApply(350)/useEnhance + dual photoIndex/editingPhotoIndex; usePhotoEdit not imported there.
- `7c4d4a18` (2026-06-11) **Multi-tab refresh rotation race: losing tab gets logged out (UX) — grace window or storage-event sync**
  - No grace-window/storage-event cross-tab logic in api.ts; no matching commits.
- `9e7e6bee` (2026-06-15) **Surface eBay error parameters (e.g. ATO_TASR_block account lock) instead of the generic errorId 25019 message**
  - ebay-adapter.ts:400-405 parses only errorId/longMessage/message, drops parameters array — no ATO_TASR_block detection.
- `0d3f1670` (2026-06-21) **EbayAdapter has two divergent UA-injection paths: request() vs 4 static methods inlining EBAY_USER_AGENT**
  - 4 static methods (searchComps:1123, getCategorySuggestion:1285, getRequiredAspects:1346, getValidConditions:1392) still inline EBAY_USER_AGENT instead of request(); all live-called.
- `1219f63d` (2026-07-02) **Dev-deps majors pass: eslint 10 (root+web), @types/node 26, vitest 4, TypeScript 6**
  - package.json: eslint ^9, @types/node ^22/^25, vitest ^3, typescript ^5 — none of the 4 majors moved.
- `b767f698` (2026-07-02) **Zod 3->4 migration (api + root) as dedicated ship**
  - apps/api zod still ^3.24.0 — 3→4 migration not done.
- `eb71967d` (2026-07-14) **Thumbnail variant pipeline for photo strips (24 full-res thumbs)**
  - No thumbnailUrl field, no thumbnail pipeline — unbuilt.
- `2a1ab009` (2026-07-14) **R2 reference-safe photo deletion (orphan GC)**
  - storage.ts:66-70 deleteImage() zero callers; no reference-check/sweep — R2 objects never GC'd.
- `14efa906` (2026-07-16) **Mobile deep link ?item=/?listing= mounts hidden fetching ItemDetail**
  - inventory/page.tsx:213-216 mount effect unconditionally sets selectedId from ?item= with no viewport guard — hidden pane fetches on mobile.
- `db5e046a` (2026-07-17) **deploy-docs.yml img copy accumulates deleted files — needs rsync --delete**
  - deploy-docs.yml:35 still cp -r || true, not rsync --delete — deleted images accumulate.
- `2dcca6ef` (2026-07-17) **Regenerate tutorial/onboarding PNGs and sitemap SVGs for the 4-tab bar + update tutorials/listings.ts copy**
  - tutorials/listings.ts:11 still 'Listings tab' copy — stale since PR #240; PNG mtimes suggest partial regen, copy fix + inspection incomplete.
- `e8dc2168` (2026-07-27) **Scope beta feature requests: eBay/Reverb inventory sync, item tag editing UI, not-for-sale tag**
  - No inventory-sync/tag-editing/not-for-sale commits; needs its own design session, not held.
- `cf6d2ce2` (2026-08-07) **Adapter-path BEST_OFFER_CONFLICT enrichment — guided fix for live-revise rejections**
  - Route-level conflict path carries details; adapter-level throws at 752-753/816-817/864-865 still plain prose 422. Operator-approved deferral 2026-08-07, correctly tracked.
- `44f48482` (2026-08-07) **Codebase-wide audit: stale-token silent no-op guards on action buttons**
  - ship-program tasks 6a.7 unchecked; APPROVED DEFERRAL 2026-08-07, registry 44f48482 — correctly tracked, not built.
- `c9c15852` (2026-08-08) **Log aggregation/reporting/analysis service with web UI dashboard, live stats, and AI log-chat assistant**
  - No log-aggregation service code/commits anywhere — operator-directed 2026-08-08 spec-first work not started.
- `e95934b4` (2026-08-11) **Porter stream abort wiring: req.on(close) → AbortController through chatStream (slotted 3b.0)**
  - porter.ts POST /stream (333-573) no req.on('close') handler, no AbortController through chatStream; already operator-approved, slotted 3b.0.
### LOW

- `404b1e16` (2026-05-17) **Reverb token revocation detection**
  - No Reverb PAT health-check/polling in reverb-adapter.ts; no matching commit.
- `668ee616` (2026-05-17) **Add row limit to GET /items/export query**
  - items.ts GET /export (230-276) still no LIMIT/row cap — unbounded select into in-memory CSV.
- `b9c43cd4` (2026-05-27) **SSRF regression test for photo export — verify fetch not called for disallowed origins**
  - photo-export.test.ts has no isAllowedImageOrigin=false mock test; prod guard live at items.ts:151.
- `d65d1e9e` (2026-05-27) **export_tokens cleanup job**
  - No cleanup job for export_tokens; runRetentionSweep (sync-worker.ts:65) only sweeps syncJobs/marketplaceSyncLog.
- `818605da` (2026-06-03) **Store eBay refresh-token 18-month expiry + reconnect prompt**
  - token-manager.ts:77-80 no refreshTokenExpiresAt; partially mitigated — invalid_grant now typed 409 EBAY_RECONNECT_REQUIRED (69-71).
- `fbc670b2` (2026-06-03) **Fix fetchEbayAppToken(forceProd=false) sandbox-creds-on-prod-URL inconsistency**
  - token-manager.ts:152-169 fetchEbayAppToken(false) uses EBAY_CLIENT_ID unconditionally while baseUrl switches — unchanged.
- `d56aff62` (2026-06-03) **Add test for eBay Identity fetch network-error (throw) path** *(candidate wont_fix — needs operator call)*
  - ebay-auth.test.ts exists but no dedicated network-error-throw test; item self-flagged as low-value near-duplicate coverage.
- `6adfadb4` (2026-06-03) **Seller profile GET auto-create race condition — needs upsert**
  - seller-profile.ts:26-28 still plain db.insert with no onConflictDoNothing — race unfixed.
- `17c90eea` (2026-06-04) **Surface a draft-fallback warning for publishMode=live failures in POST /listings**
  - listings.ts:727 warning keys on body.publishImmediately while trigger at 574 also honors publishMode='live' — explicit live falling to draft gets no warning.
- `b77e2423` (2026-06-04) **Review + commit/deploy eBay API reference doc (website/docs/api/ebay.md)** *(candidate wont_fix — needs operator call)*
  - website/docs/api/ebay.md never committed — no file, no git history, 10+ weeks of docs work elsewhere.
- `166909d3` (2026-06-05) **Reconcile stale repo .claude/scripts/post-*.sh duplicates with dhg-memreg shims** *(candidate wont_fix — needs operator call)*
  - ~/.claude/scripts symlinks into dhg-memreg; repo .claude/scripts/post-insight.sh remains separate stale copy.
- `8f94d453` (2026-06-06) **Surface a warning when getValidConditions returns [] on Metadata API failure (avoid silent fallback to USED_GO**
  - ebay-adapter.ts:212-214 resolveEbayCategoryCondition returns {} silently on empty validConditionIds; consumed at prepare-listing.ts:559.
- `dd1b3c60` (2026-06-08) **Item detail read view does not surface items.price (only AI estimate shown)**
  - item-detail.tsx:473-477 valueDisplay only uses estimatedValue*; item.price never read in read view.
- `ac10157f` (2026-06-09) **Per-workspace tdd-guard data dirs to fix parallel-track test.json contention**
  - Single unified .claude/tdd-guard/ data dir; no per-workspace split.
- `cf3eb3a2` (2026-06-09) **Aspect seeding suggests single-letter enumerated values (e.g. Series ✨A) from article words**
  - aspect-seeding.ts suggestAspectValues (11-31) no min-length/stopword filter — single-char values still match.
- `2b8aefb1` (2026-06-10) **Distinguish category-resolution outage from genuine no-match in scan flow**
  - scan-flow.tsx:1441-1443 single generic 'eBay category unresolved' message, no outage-vs-no-match distinction.
- `77106d9c` (2026-06-10) **aspect-fill-sheet still uses forest-green classes (pre-DHG tokens)**
  - aspect-fill-sheet.tsx:91,124 still bg-forest-green classes, not DHG tokens.
- `7107c1b8` (2026-06-10) **Metrics coverage for category-aspects and getValidConditions cache behavior**
  - metrics.ts:48-52 ebayTaxonomyCalls route-level only; no cache_hit/miss labels for validConditions/requiredAspects caches.
- `1ad367db` (2026-06-10) **Best Offer observability log lines: bestOfferTerms inversion-guard drop + applyFooter over-limit drop**
  - bestOfferTerms inversion-guard half obsolete (code deleted); applyFooter over-limit drop (footer.ts:26) still silent — no log line.
- `a5a2b944` (2026-06-11) **use-scan-aspects: track resolvedFor + resolveError; manual-override flag vs title auto-resolve**
  - use-scan-aspects.ts has resolvedVisionCategory + manual override (PR #304/#305) but no resolveError state — catch at 158-162 still swallows transient failures.
- `903cfeac` (2026-06-11) **Phase B fast-follows: price clearing, per-flow warning prop tests, AI-weight path test, ScanFab dead component**
  - items.ts:93 price still z.number().min(0.01).optional() not nullable — cannot clear; ScanFab still zero callers.
- `e5e39461` (2026-06-16) **Add error-context to EbayAdapter.request() success-path JSON.parse**
  - ebay-adapter.ts:416 request() success path still bare response.json() — non-JSON 200 throws bare SyntaxError.
- `3b00baeb` (2026-06-22) **Lever A hardening: add response_format json_object to chatText OpenAI no-tools path**
  - chatOpenAI (822) and chatText (674) — no response_format/json_object anywhere.
- `d37981ff` (2026-06-23) **Rename/remove DisclaimerSheet listingId prop (fed itemId; only a useEffect dep)** *(candidate wont_fix — needs operator call)*
  - disclaimer-sheet.tsx:56-75 prop still named listingId (fed itemId), useEffect reset key only — harmless misname.
- `90ca92c2` (2026-06-27) **Resolve tdd-guard apps/web exemption drift (config vs frontend-verification skill)**
  - tdd-guard config.json now only {guardEnabled:true} — no ignorePatterns — while apps/web/CLAUDE.md + frontend-verification skill still assert web exemption; contradiction persists, arguably worse.
- `d72b38ca` (2026-06-27) **Wire Envato Market API to fetch purchased fonts into the repo**
  - No embedded font in sitemap SVGs; still blocked on Envato personal token + font choice; user explicitly paused.
- `96ca8b9f` (2026-06-28) **Evaluate eBay Inventory Mapping API (GraphQL AI listing-preview) as post-refactor AI listing-quality enhanceme**
  - No Inventory Mapping API reference anywhere — evaluation never started.
- `49d4f385` (2026-06-30) **1.20 dead-code sweep: remove orphaned Inventory-era helpers + inert ebayOfferId column**
  - Partially stale: isOfferExistsError/bestOfferTerms gone; resolvers actively used; only inert ebayOfferId column (schema.ts:125, listings.ts:509 null write) remains to drop.
- `43e86493` (2026-06-30) **Install gh system-wide (apt repo + sudo) and remove the per-user ~/.local/bin/gh** *(candidate wont_fix — needs operator call)*
  - /usr/bin/gh still 2.45 root-owned; ~/.local/bin/gh 2.95.0 shadows via PATH; sudo still required.
- `394f3c61` (2026-07-02) **pino-http 10->11 major bump (api)**
  - apps/api pino-http still ^10.4.0 — major 11 not taken.
- `69676181` (2026-07-08) **Dedupe APP_URL + quote RESEND_FROM in .env.example** *(candidate wont_fix — needs operator call)*
  - APP_URL deduped (line 25 'Define ONCE'); RESEND_FROM (23) still unquoted with spaces/angle brackets.
- `a59b14ba` (2026-07-09) **Unwind the inert /:id/publish policy-ID self-heal block (32-test mock refactor)**
  - listings.ts:1063-1077 still injects policy IDs into marketplaceSpecific on /:id/publish — inert self-heal block unremoved.
- `d76e2040` (2026-07-11) **Hoist duplicated listing status-pill config into shared module**
  - listing-card.tsx:20-28 statusConfig + listings/page.tsx:24-29 statusColors remain duplicated (archived drifted zinc).
- `8228b40e` (2026-07-14) **eBay updateListing: hasContentChange treats any photos array as content change — fast path dead** *(candidate wont_fix — needs operator call)*
  - ebay-adapter.ts:789-798 hasContentChange still counts any photos array as change; marketplace-sync.ts:108 documents as accepted tradeoff.
- `192807c7` (2026-07-15) **Scoped Cache-Control exception for /tutorials/** static PNGs**
  - master-detail.tsx + listings/page.tsx still lightweight tabIndex=0 + aria-current, no full listbox/roving-tabindex.
- `eebda2c5` (2026-07-15) **Extract responsive shell as deployable DHG template (dhg-app-shell)** *(candidate wont_fix — needs operator call)*
  - No dhg-app-shell package/template anywhere — extraction never started; no second consumer demonstrated.
- `e213a59a` (2026-07-16) **Live list↔pane field sync in workbench**
  - listings/page.tsx:449-461 workbench pane only wires onDeleted — field edits don't refetch list.
- `57c97baa` (2026-07-16) **Workbench list pane: full aria listbox/roving-tabindex semantics**
  - master-detail.tsx + listings/page.tsx still lightweight tabIndex/aria-current, no listbox/roving-tabindex (same as 192807c7).
- `ab4f51ba` (2026-07-16) **Workbench small follow-ups: replaceState param clobber, unauth redirect target, desktop toast offset, data-ite**
  - 2 of 4 sub-items remain: toast fixed bottom-24 offset (page.tsx:106); unauth redirect hardcodes /inventory (item-detail.tsx:432).
- `099ebb2b` (2026-07-17) **Two infra changes awaiting Stephen go: rehearsal:3004 ingress delete + :8018 landing to /explore/**
  - Part 2 shipped (graphify-nginx.conf / → /explore/, 'Stephen go 2026-07-17'); Part 1 not done: config-portage.yml still routes rehearsal to :3004.
- `86b12195` (2026-07-17) **Expose session_reports as a /api/kb/search source in DHG Registry**
  - registry-search.md still documents session_reports as invalid sources value — registry side unchanged.
- `0a9f24b7` (2026-07-28) **Langfuse follow-ups: per-purpose generation names + setActiveTraceIO migration + Ollama unreachable from prod **
  - Zero generationName uses in repo; tracing.ts still calls deprecated setActiveTraceIO (lines 4, 99) — neither sub-item migrated.
- `01a90cba` (2026-08-02) **Reverb category: scan-review ride-along + listing-card inline edit**
  - listing-card ReverbCategorySection inline edit done; scan-flow.tsx zero Reverb references — scan-review ride-along half unbuilt.
- `11b2ae1b` (2026-08-03) **Retire the photo-save UI mutex in item-detail now that photo sync is async**
  - item-detail.tsx:76,79 isSavingPhoto/isSavingPhotoRef mutex still gates handlers (286,303,313,353,381).
- `3fd972b6` (2026-08-07) **Lint warning burn-down: 18 img-element conversions + 8 hook dependency-array fixes**
  - npm run lint -w apps/web: exactly 26 warnings (18 img + 8 hook-deps), matches filed count; already operator-approved deferral 2026-08-07.
- `1c2d031c` (2026-08-11) **Task 2.6 per-user sweep pacing — revisit at second active seller** *(candidate wont_fix — needs operator call)*
  - sync-worker.ts no pacing/fairness across users — matches description; revisit trigger (second active seller) not verifiable from repo. Operator-approved deferral tied to trigger.

## Uncertain (9) — not verifiable from repo

- `118eb901` Tune the no-force-push agentlint rule — it over-fires on normal pushes and branch deletes
  - No no-force-push/agentlint hook found in either hooks dir — possibly removed entirely; rule definition not locatable.
- `dbcb1035` dhg-docs nginx trailing-slash 301 drops the :8017 port
  - dhg-docs nginx config lives on host/container, not in repo — trailing-slash redirect not verifiable here.
- `9dd89324` R2 bucket CORS rule for portage-images (needs R2 Admin token)
  - Blocked on R2 Admin token; CORS state not verifiable from repo.
- `c6f43445` Resolve docs.digitalharmonyai.com Cloudflare Access gate (perceived as down)
  - CF Access policy state for docs.digitalharmonyai.com not verifiable from repo; agent sandbox had no LAN connectivity.
- `376a5b7b` R2 portage-images bucket CORS blocks LAN dev origins — photo recognition broken from 10.0.0.251
  - R2 CORS is CF-dashboard config, not repo-tracked; no client-side pattern change found.
- `a3455f37` Docs cleanup pass: execute Q-verdict-unblocked worklist lines
  - Docs audit program recorded CLOSED but Q11 (session_reports KB source) still open per registry-search.md live note; granular lines not independently verifiable.
- `43a7295a` Investigate + fix Claude Code session latency (harness-side, NOT compute)
  - PreToolUse Bash hook stack unchanged (check-ports, enforce-frontend-e2e 120s, deferral-gate, git-gate, review-before-commit); actual latency not verifiable from static inspection.
- `f25bc5f5` Ship-log generator must escape MDX brace expressions
  - Ship-log generator lives in dhg-memreg tooling repo, not portage — MDX brace-escaping state not verifiable here.
- `7bc3d37f` Item bbaddd00 eBay edit-sync silently fails: valid leaf category required
  - Specific DB-row data issue (item bbaddd00 marketplaceSpecificFields.categoryId); agent had no DB access; no backfill script in repo.

## Resolved this audit (61)

- `7fc6959e` Fix 6 pre-existing failing tests on main (billing PRO_TIER_LIMITS + batch-enhance) — Full apps/api suite green — 973/973 across 82 files (incl. billing-utils.test.ts and batch-enhance.test.ts), confirmed by running npm run te
- `e00a2315` Tune TDD-guard: false-positives on cross-file wiring + stale-assertion fixes — tdd-one-test-per-write.md HARD RULE + tdd-guard playbook memory codify the requested friction fixes.
- `216ca2da` batch-enhance route unimplemented — 4 failing tests in untracked batch-enhance.test.ts — POST /images/batch-enhance implemented (images.ts:145-211, commit 8f6ddb7), ancestor of origin/main.
- `de51fcdf` Resolve 5 Dependabot vulnerabilities on portage default branch (2 critical, 3 moderate) — PR #257 + dependabot stream (#301/#302); original 2-critical/3-moderate alert cleared; current audit 0 critical.
- `1ec36ef5` Fix express-rate-limit ERR_ERL_KEY_GEN_IPV6 thrown from billing.ts rateLimit() config — billing.ts:31-32 uses ipKeyGenerator from express-rate-limit ^8.5.2 in billingRateLimitKey — v7 IPv6 error fixed.
- `f1858ee4` Cache EbayAdapter.getRequiredAspects per category (24h TTL) — ebay-adapter.ts:33-34 requiredAspectsCache + 24h TTL, checked at 1347-1348/1385.
- `929ac05a` AI-fill eBay item specifics (aspects) during scan — replace publish-time bottom-sheet picker — use-scan-aspects.ts resolves category early, fetches required aspects, AI-fills with [AI] provenance; AspectFillSheet demoted to publish-tim
- `bce9afa3` Add package weight + dimensions capture (items schema + listing flow) — required for eBay Calculated — schema.ts:96-105 weightOz/lengthIn/widthIn/heightIn/ebayPackageType/weightEstimated + WeightFillSheet/WeightDimsInputs + EBAY_WEIGHT_REQUIRE
- `5407ccfd` Orphaned /inventory/[id]/edit route page — not linked anywhere — item-detail.tsx:492-495 + listing-card.tsx:578-586 route to /inventory/[id]/edit as canonical edit page.
- `f8b715d8` batch-enhance.test.ts — 4 failing tests (pre-existing) — POST /images/batch-enhance implemented (images.ts:145-211); batch-enhance.test.ts passes in green 973/973 suite.
- `d1e9054e` Scan-flow Save & List ignores ebayPublishMode seller setting (always drafts) — scan-flow.tsx:696-706 seeds CreateListingSheet initialPublishNow from seller-profile ebayPublishMode (F1 comment), replacing hardcoded publi
- `e8326638` Add seller default listing footer (boilerplate appended after AI description) — defaultListingFooter column (schema.ts:334) + PATCH field + footer.ts applyFooter() wired into listings.ts at publish/update.
- `4a95b345` User-configurable pricing percentile bands in Settings (seller_profiles) — pricingSuggestPercentile/pricingFloorPercentile (schema.ts:330-331) + Settings pricing section + PRICING_FLOOR_INVALID guard (seller-profile
- `ba9df51b` Add RecentListing.confidence field + render confidence % chip on home listing cards — RecentListing.confidence (use-dashboard.ts:18) sourced from aiConfidence, rendered as % match chip (home/page.tsx:429-431).
- `f82a334c` Orb gradient inner stop uses theme-dependent --teal-dark → near-black in light theme on the always-d — globals.css:47 theme-independent --orb-core #0B6360 consumed by home/porter/porter-dock instead of --teal-dark.
- `fc967271` Verify eBay Taxonomy API rate-limit budget (up to 3 taxonomy calls per scan vs app-token bucket) — ebay-adapter.ts:28-44 TTL caches for getValidConditions (1h) and getRequiredAspects (24h) keyed by categoryId.
- `a579ff81` Nested <button> in scan photo strip causes React hydration error warning — photo-gallery-strip.tsx redesign: single button per thumb, delete moved to PhotoManageSheet — no nested buttons.
- `8dcb4e58` Build approved photo-gallery redesign: remove inline photo editor from scan-review + item detail; ga — item-detail.tsx:540-541 comment: always-on hero + inline tools gone (Stage 2.5 redesign); PhotoGalleryStrip + PhotoEditPanel live in item-de
- `724ea182` ListingPreviewCard/CompsPricingWidget unreachable in hybrid+conversational flows — prepare() gated o — fresh-scan-prepare.spec.ts proves fresh-scan confirm creates item + runs prepare — ListingPreviewCard/CompsPricingWidget render on fresh pat
- `0475ba83` updateListing warning contract for Etsy/Reverb adapters (eBay returns warnings; others never do) — reverb-adapter.ts:266-335 updateListing returns terminalWarning/photoWarning — same warning channel as eBay; Etsy moot.
- `3db31cb1` Re-sync VISION_PROVIDERS chain into Doppler once workplace is reinstated — vision provider chain re-pinned in Doppler 2026-08-05 (gemini-2.5-flash + claude-haiku-4-5) per project_vision_provider_strategy.
- `d44b3c45` Playwright e2e: share auth via storageState instead of per-test logins (auth limiter makes consecuti — apps/web/e2e/auth.setup.ts logs in once via GET /auth/session and persists portage_token/portage_user into Playwright storageState.
- `74e9fa98` Seller-profile settings page section cards use hardcoded rgba(0,0,0,0.03/0.08) backgrounds — seller-profile page.tsx zero hardcoded rgba backgrounds remaining.
- `2d1797e3` Remove dead AI_UNAVAILABLE guard in chatStream (buildChain throws first) — buildChain throws AppError(503,AI_UNAVAILABLE) (ai-client.ts:137-138); dead chatStream guard removed w/ comment at 457.
- `0575b1eb` orders.ts decrypts Reverb token directly instead of using token-manager getReverbAccessToken() — orders.ts no longer imports decrypt; order sync via order-sync.ts:50 new ReverbAdapter(userId) resolving token internally.
- `66096dd7` CRITICAL: no GLOBAL capture backstop — most DHG apps capture NOTHING — User-level Stop hook wires dhg-memreg memory-sync.sh globally — project-agnostic capture backstop exists.
- `61bbbc14` Proof-gate system: per-task screenshot → docs/proof → NEW registry proof_artifacts table → VERIFIED  — proof-before-push.sh live deterministic gate (PRs #267-268) blocks push when UI diffs lack fresh proof screenshot; original proof_artifacts 
- `d6a48d02` Phase G: Save & List publishes a draft, not a live listing — publish-mode.ts resolvePublishMode + CreateListingSheet publishNow toggle; scan-listing-payload.ts keeps conservative draft default for sile
- `63d1c928` Phase F: Unify publish into one sheet with price + terms panels (7-day version-scoped dismiss) — Merged as PR #133 (5d22368 phase-f-publish-unification).
- `6543a1c6` updateListing aspect handling less defensive than createListing (F6) — ebay-adapter.ts:825-827 updateListing full-content path calls shared buildTradingInput() — PR #133 closed the gap.
- `78eea626` Scan review: move Quantity field to the left of Price in the bottom action bar — scan-review-actions.tsx:50-71 — Qty field renders left of Price in bottom action bar.
- `47a8ab40` CONFIRMED: populate aspects.MPN item-specific (eBay MPN blank); + dup listings row + MPN not shown o — ebay-adapter.ts:362 normalizeAspects: if (identity.mpn && !aspects.MPN) aspects.MPN=[identity.mpn] — shared by create/updateListing.
- `ad219bf3` Seller-configurable inline shipping/return fields for Trading listings — shipping-fields-section.tsx per-listing method/flatCost/service/handlingDays/localPickup — delivered via PRs #274/#276/#278.
- `d257d2c6` Frontend should send a stable idempotencyKey on publish (POST /listings) — scopedPublishIdempotencyKey sent from use-listing-flow.ts:86 + CreateListingSheet; publish-idempotency.spec.ts proves round-trip.
- `4e1723d2` Disable/guard POST /seller-profile/ebay/auto-setup (creates Business Policies — counter-productive u — POST /ebay/auto-setup REMOVED 2026-07-09 — stronger than requested guard; policy-cleanup.test.tsx confirms no UI/fetch.
- `b0a63fa8` 1.20 dead-code: remove now-unused eBay Business-Policy adapter methods + FE Set-up-eBay button — createFulfillmentPolicy/createPaymentPolicy/createReturnPolicy: zero codegraph results — whole Business-Policy adapter surface deleted 2026-
- `2ac1c365` Reconcile stale eBay listing row 307034606520 (active locally, ended on eBay) — Generalized by PR #299 status sweep (sync-worker.ts:107-170) — stale row falls under live sweep.
- `e37f4cd4` Voice feature parked: remove from web UI + backend now, re-release in a future version — Voice fully removed (PR #146 3eaf57d + f09bca6/0c8a261/e120a24); tag voice-parked-2026-07.
- `e6ac066f` POST /porter/message (non-streaming fallback) returns empty message string against local qwen3 — ai-client.ts:883-888 chatOpenAI throws on blank reply so chain advances — exact root cause handled with fail-over.
- `92655e97` Reconcile externally-ended eBay listings — local rows stay active forever — PR #299 status sweep reconciles externally-ended listings every 45 min, archives on ended.
- `d44a50f5` Delete dead capture components: capture-sheet.tsx + photo-capture.tsx — photo-capture.tsx deleted; capture-sheet.tsx no longer dead — used by photo-gallery-strip.tsx.
- `2fc34236` Web sends no idempotencyKey on publish — failed publish retries accumulate orphan draft rows — scopedPublishIdempotencyKey called from use-listing-flow.ts:86 + CreateListingSheet; publish-idempotency.spec.ts proves round-trip.
- `d377897d` Regenerate docs sitemap SVGs (gen_sitemaps.py) — route counts stale — Commit d47e9d4 'docs(sitemap): regenerate diagrams for the 35-route tree' (PR #193) landed after filing.
- `f6870faa` Fix inventory UNLISTED badges on items with active listings — items.ts:21-27 itemListedExpr correlated EXISTS on listings.status IN (active,sold) w/ comment documenting the Drizzle qualifier fix.
- `8574deec` Reverb listings do not sync on item edit — extend PATCH /items revise loop beyond eBay — items.ts:549 PATCH selects ebay+reverb listings through outbox; marketplace-sync.ts:117-149 full Reverb updateListing branch.
- `a0eb2e98` Porter conversation history UI (list, deep-links, resume) over existing API — porter-dock.tsx full history view (list via usePorterConversations, resume via loadConversation, New chat); deep-link route minor gap.
- `e7a7abd2` R0 follow-up batch: Stephen verdicts DO 1/4/5/6/7, DEFER 2, pending 3+8 — Merged as PR #230 (1f79f5c, R0 follow-up batch).
- `694c85f6` Inventory select mode: card body tap navigates instead of toggling (nested Link inside toggle button — inventory/page.tsx:174-177 ItemCard interactive={false} with comment citing registry 334daef2 — nested-Link bug fixed.
- `440b667b` DHG Assets table in Registry + asset ingest/search pipeline — DHG Registry now serves /api/assets, /api/assets/bulk, /api/assets/search, /api/assets/{item_id} — assets table + ingest/search pipeline liv
- `334daef2` Workbench select-mode: card body click navigates away (nested Link in toggle button) — now replicate — inventory/page.tsx:174-177 ItemCard interactive={false} in select mode; comment cites registry 334daef2.
- `7028477a` Workbench filter-out behavior diverges: inventory keeps pane open, listings clears it — Merged as PR #242 (b2a6db1) — listings pane survives filter-out, matching inventory.
- `9babd10b` Inventory filter row crowding at 390px — chips truncated by count + view toggles — view-controls.tsx redesigned: scrollable chip row capped at 5 + More… select, flex justify-between isolates count/toggles.
- `85dea545` README intro paragraph: 4 factual errors, fix in cleanup pass — README intro fixes all 4 cited errors. NEW discrepancy flagged: Features section says 5 tabs vs shipped 4-tab nav (PR #240).
- `1c0ae91e` Gemini vision returns 400 (no body) — prod-primary vision provider silently falling back to Claude — vision.ts + ai-client.ts implement schema-drift coercion + provider fail-over (2026-08-05 incident comments); silent-fallback visibility gap
- `a43698d5` Marketplace submission panel additions: ad bump (Reverb/eBay), make-offer toggle + min/auto-accept,  — Reverb setBump, eBay promoteListing, BO toggle w/ min+auto-accept, ShippingFieldsSection all wired in publish panel.
- `87d5da5e` Single transient network failure logs the user out + unbounded session-exchange retry storm — PR #263: requestExchange circuit breaker (5s→15s→45s→60s, in-flight dedup) in api.ts:42-83 — retry storm eliminated.
- `3e03bfc5` Flaky CI test: seller-profile policy-cleanup ZIP guard (save spy fires once on CI only) — policy-cleanup.test.tsx:82-91 now uses await screen.findByText — async-safe per the item's own recommended fix.
- `6454017d` listing-card shipping editor drops localPickup on save + open — listing-card.tsx:182-212 seeds+persists localPickup; inline comment cites bug id 6454017d.
- `b6536cc1` Listing status reconciliation: poll marketplace status so ended/removed listings do not sit stale-ac — sync-worker.ts:107 runStatusSweepScan() periodic eBay/Reverb status check — shipped PR #299.
- `98f9f383` Backfill Reverb orders for 6 sold-on-Reverb listings + wire Reverb order sync — PR #299 (b9ca9b8) shipped Reverb order sync + one-time backfill.
- `307ffa75` Listing-card publish path needs a Reverb category picker (create-sheet cascade UI only) — listing-card.tsx reverbCategoryMissing/handleReverbCategorySave wired to REVERB_CATEGORY_REQUIRED catch; comment cites id 307ffa75.

## Obsolete / wont_fix this audit (16)

- `102005c1` TTS (chatterbox) GPU support blocked by RTX 5080 Blackwell sm_120 — needs PyTorch 2.7+/CUDA 12.8+ — Voice/TTS feature REMOVED 2026-07-01 (tag voice-parked-2026-07); chatterbox GPU support moot with no voice feature in codebase.
- `28828843` Build Etsy OAuth callback page (same missing-bridge gap as eBay) — Etsy adapter/routes/UI removed 2026-07-09 (etsy-parked-2026-07); no Etsy consent flow exists to receive a callback.
- `f664b502` Etsy marketplace wiring fix — same marketplaceSpecificFields gap as eBay — Etsy fully removed from use-listing-flow.ts; parked 2026-07-09.
- `51231c5a` Orphaned eBay inventory_item cleanup sweep — Trade-First (PR #133): adapter no longer manages Inventory API inventory_item records — sweep target is dead code path.
- `3fadb3f1` DRY: extract shared fetchEbayPolicies helper for GET /ebay-policies and POST /ebay/auto-setup — GET /ebay-policies + POST /ebay/auto-setup REMOVED 2026-07-09 — duplication no longer exists.
- `3fd52d03` Implement Porter chatStreamOpenAI (Gemini streaming) and switch Porter chat to gemini-3.5-flash->2.5 — chatStreamOpenAI implemented (ai-client.ts:566); Porter switched to local granite4.1:8b (PR #303) instead of Gemini — ask superseded by diff
- `06884559` getFulfillmentPolicy: distinguish 4xx-propagate vs network fail-open — getFulfillmentPolicy gone; weight gate redesigned (line 477) checks shippingMethod directly — fail-open class eliminated.
- `de683d60` Setup leaves orphaned eBay *Copy fulfillment policies (e.g. Portage Standard Fulfillment Copy, FLAT_ — Business Policies endpoints REMOVED 2026-07-09 Trade-First (seller-profile.ts:122-126) — orphaned *Copy policies can no longer be produced.
- `06f80e39` Verify Etsy real description length limit for footer guard (descriptionLimitFor non-eBay default 50k — Etsy parked 2026-07-09 — no Etsy publish path; footer limit verification moot.
- `5b5d1dfb` Carrier API integration (EasyPost/Shippo) — real shipping rates + label purchase — shipping.ts deleted; carrier stubs removed PR #142, superseded by redirect-to-eBay (decision 2026-07-01).
- `33c83ccd` Shipping label CTA silently no-ops while carrier integration is stubbed — surface or hide until carr — Carrier subsystem deleted (d22945e, PR #142); shipping.ts gone — no stub label CTA left to surface/hide.
- `c1082f98` Refresh defense-in-depth: assert JWT sub === session.userId; misc auth edges (register stayLoggedIn, — No refresh/register/stayLoggedIn code; CF Access (PRs #168-172) replaced the session model entirely.
- `b7736895` scan-flow condition-snap test flaky on CI runner (passes 5/5 locally, failed once in CI) — One-off CI flake from PR #110; test exists (scan-flow.test.tsx:600) and passes; no recurrence since 2026-06-11.
- `22b85321` GET /seller-profile/ebay-policies does not filter marketplaceAccounts by marketplace=ebay — GET /ebay-policies route REMOVED 2026-07-09 (seller-profile.ts:122-125) — buggy route no longer exists.
- `d3abc2cb` eBay auto-setup forces Portage Standard policies — add option to use the seller existing/default eBa — Business Policies auto-setup deleted wholesale 2026-07-09 — no policy-picker code path to extend.
- `fe1d2b43` Fix SessionStart active-ship-state pointer — picks a stale ship-state file after ship-state.md was g — session-briefing.sh rewritten — no ship-state*.md references; stale-pointer mechanism gone.

## Notable cross-cutting findings

- **Repo is now public** — self-hosted runner workflows (`claude-review.yml`, `e2e.yml`) run on `pull_request` with no fork gating: fork-PR code execution risk on a stateful runner (`223b0419`, escalated high).
- **eBay Marketplace Account Deletion notification endpoint** never built; mandatory for prod apps storing eBay data (`c683b4bc`, escalated critical).
- **Capture pipeline integrity** (`7d218492`, critical): post-*.sh scripts still fire-and-forget with no landing verification, no dead-letter, no idempotency keys.
- README Features section says "5 tabs" — contradicts shipped 4-tab nav (PR #240); new discrepancy found during audit, not yet a registry item.
- Best Offer price-edit conflict UX (`25afd214`, high): backend ships structured conflict details, no FE consumer — live-breaking UX gap since 2026-08-05.

---

## Round 2 — Independent adversarial review (devstral-small-2:24b, 2026-08-15)

Operator rejected round 1 pending third-party review. All 170 verdicts re-judged by a local Mistral Devstral Small 2 (24B) via Ollama — different vendor, zero shared context — each fed a fresh evidence bundle rebuilt from the repo at review time.

**Result: 130/170 agree, 40 disagree.** Every disagreement triaged; 9 hand-verified in source.

| Disagreement class | Count | Outcome |
|---|---|---|
| Harness artifacts (bundle couldn't reach out-of-repo files; two path-regex defects fixed mid-run; git-grep window) | ~28 | Rejected — verified by hand where load-bearing |
| Model misreads (agreement phrased as disagreement, backwards logic, truncated-window inferences) | ~9 | Rejected — 8 spot-checked in source (AppError guard, photo-capture deletion, conditions-warning branch, global Stop hooks, idempotency call sites, ReverbCategorySection render, images.ts route) |
| **Real audit defects caught** | **3** | Corrected below |

**Corrections applied:**
1. `fbc670b2` (eBay app-token sandbox-creds inconsistency) — **flipped OPEN → RESOLVED.** Code changed since filing: `fetchEbayAppToken` now uses `EBAY_PROD_CLIENT_ID/SECRET` fallback chain on forceProd and honors `EBAY_SANDBOX` (token-manager.ts:152-170). Registry patched.
2. `192807c7` (tutorials Cache-Control exception) — round-1 evidence was mismatched (aria-listbox text belonging to `57c97baa` was attached to it). Hand-verified truth: next.config.ts still sends blanket `no-store` on `/:path*` with no `/tutorials/**` carve-out — **verdict OPEN stands**, evidence corrected here.
3. `223b0419` (self-hosted runner hardening) — round-1 evidence overstated: `claude-review.yml` is label-gated (`pull_request: types: [labeled]`), NOT auto-run on fork PRs. The live exposure is `e2e.yml`, which runs on ALL PRs to main on the self-hosted runner and is a required check. **Verdict OPEN and high priority stand** on the e2e.yml exposure.

**Ship-log item 8 (`2e2201ce`) re-verified by hand after operator challenge:** generator script exists and runs (in place since May); the 07-17 decision's fix + 54-session backfill + SOP/hooks worklist is unbuilt — repo tops out at entry 055, and the live docs page `/ship-log/` currently returns HTTP 500 (new finding, worse than round 1 reported). Verdict OPEN stands with corrected framing: "revival worklist unbuilt," not "generator missing."

**Round-2 net effect:** 84 open → 83 open; resolved 61 → 62. Devstral disagreement rate on verdicts that survived triage: 3/170 (1.8%).
