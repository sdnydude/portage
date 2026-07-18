# Portage Documentation Audit — 2026-07-17

**Type:** read-only audit (no docs edited). **Executor of findings:** `2026-07-docs-audit-worklist.md` (same directory) — this report justifies every worklist line.
**Method:** 7 parallel auditors (6 accuracy vs. code/PRs/infra + 1 editorial), all on Fable; orchestrator spot-checked verdicts directly against source. Every defect below carries doc `file:line` plus verifying evidence (code `file:line`, PR #, or command output). Unverifiable claims are marked UNVERIFIED and collected in §9.

**Corpus vs. verdict-table reconciliation (required check):**

| Category | Files on disk | Table rows |
|---|---|---|
| website/docs/ | 99 | 99 |
| docs/ (excl. docs/audits/ — audit output dir + 12 files created mid-audit by another session, see §9 Q14) | 235 | 235 |
| Repo-root product .md | 8 | 8 |
| website/static/img/ (graphics disposition) | 222 | 222 |
| **Total** | **564** | **564** |

Full per-file table: Appendix A. Sources of truth used, in priority order: code at HEAD (2026-07-17) → merged PRs (`gh pr view`) → docs/TODO.md + CLAUDE.md → DHG Registry KB.

---

## 1. Top 10 defects by reader impact

1. **Both embedded architecture diagrams teach the deleted auth model.** `architecture-system-overview.svg` + `architecture-data-flow.svg` (embedded as current at `website/docs/architecture/overview.md:13,17`) show email+password/bcrypt/refresh-token auth, "3 containers", "16 tables", Etsy active, EasyPost/Shippo pending, Claude Vision primary, Inventory-API offers. Every one of those is false today (CF Access PRs #168–172; 5 compose services `docker-compose.yml`; 18 tables `apps/api/src/db/schema.ts`; Etsy parked 2026-07-09; carrier deleted PR #142; Gemini primary; Trade-First PR #133). Verdict: recreate both.
2. **README.md is wrong end to end** — pitches "eBay and Etsy" (`README.md:9,15,87`), claims bcrypt/refresh-token auth (`:33`), client-side WASM bg-removal (`:14,36`), wrong tab list (`:21,130`), a broken/wrong-scheme features link (`:23`), and committed demo credentials (`:119–126`) that violate the no-committed-secrets rule and are functionally dead (no password login path exists — `apps/api/src/routes/auth.ts:72–75`). Verdict: rewrite.
3. **Committed demo credentials in three files** — `README.md:119–126`, `ONBOARDING.md:116`, `docs/TODO.md:419`. Policy violation (CLAUDE.md: demo creds live in Doppler) regardless of the password being dead. Remove all three.
4. **api/items.md documents a schema that doesn't exist** — `valueLow/valueHigh/valueMedian/aiConfidence` vs. actual `estimatedValueMin/Max/Recommended`, `aiConfidenceScore` (verified `schema.ts:73–91`); comps response shape wrong; `bulk/update` scope overstated (category+condition only, `items.ts:653–661`); 4 live endpoints missing. Verdict: rewrite.
5. **13 live route groups have zero API documentation** — messages (5 endpoints), seller-profile, dashboard, usage, users/preferences (GET), disclaimer, survey, beta, faqs, health, plus items comps/research/photo-export, listings `:id/ebay-offer`, images `r2/*` proxy (full list §5.1, from a two-direction sweep of `apps/api/src/app.ts:92–115` + every route file).
6. **The product's post-R0 shell is documented nowhere and contradicted everywhere.** Code has 5 tabs + center Scan (`tab-bar.tsx:12–18`, verified directly) and an AppShell/Sidebar/TopBar responsive shell (PR #229). `frontend/app-structure.md` (6-tab, no shell — rewrite), `architecture/overview.md:35` (a third, also-wrong 5-tab list), `README.md:21`, `style-guide.md:601`, and root `CLAUDE.md` ("6-tab … More") all disagree with the code. features.md:193 is the only page that has it right.
7. **images.md / competitive-analysis.md / style-guide.md claim client-side WASM background removal** (`images.md:82`, `competitive-analysis.md:19,59`, `style-guide.md:768` — the named `BgRemovalPanel` component doesn't exist). Reality: server-side portage-rembg container, billing-gated (`images.ts:287–303`). Public-facing capability claims that are simply false. (Side-find for a code session: `@imgly/background-removal` is a dead dep in `apps/web/package.json:17`, zero imports.)
8. **competitive-analysis.md is stale on every product-side row** — "3 marketplaces" (2 live), "Claude Vision" primary (Gemini), carrier "still stubbed" (deleted PR #142), strategic priorities list where 3 of 4 items are shipped or dead. Dated 2026-05-17, presented undated as current. Verdict: rewrite (product side) or hard point-in-time banner.
9. **Ship-log pipeline is dormant and its output is corrupted at the edges** — 54 of 109 registry ship sessions missing (last generated entry = PR #108, 2026-06-10); index claims "55 sessions" with 2 dead links + 1 malformed href (`ship-log/index.md:50,63,64`); 4 orphaned duplicate entries stranded by the generator's ordinal renumbering (`generate-ship-log.sh:76–94`, no cleanup logic). Decision needed: revive or retire (§9 Q2).
10. **Infrastructure docs are operationally hollow exactly where an operator needs them** — tunnel ops runbook exists only in `infra/cloudflared/README.md` (not on the docs site); dhg-docs (:8017) run mechanism (aifactory compose stack) documented nowhere in-repo while `deploy-docs.yml:48–54` carries a divergent fallback; `deployment.md:16,121` says "4 services" (compose has 5 — `docker-compose.yml:92–103` portage-graph); self-hosted runner (3 workflows depend on it) has no setup doc; CF Access app/bypass inventory undocumented. Full matrix §5.2.

Also flagged at severity just below top-10: Pro-tier "unlimited" claims in 3 API pages (Pro = 75 listings/mo, 500 Porter/day — `constants.ts:25–31`, verified); the 12-photo cap in 3 pages (24 since PRs #223–226 — `constants.ts:60`, verified); `error-handling.md` lists 2 codes that don't exist in the codebase and misses ~20 that do.

---

## 2. Per-file defect detail — website/docs

Verdicts for every file: Appendix A. Detail below covers files with defects; evidence format is `doc:line → reality (evidence)`.

### 2.1 api/ (14 files; ground truth `apps/api/src/app.ts:92–115` + route files)

- **overview.md — fix.** :14 dev base `https://localhost:8016` → convention is 10.0.0.251 (`index.ts:20`, CLAUDE.md). :71 "Pro … unlimited" → 75/mo listings, 500/day Porter (`constants.ts:25–31`). :54–67 endpoint-groups table omits `/dashboard /messages /usage /users/me /seller-profile /disclaimer /faqs /survey /beta /health /metrics`. :15 prod base `portage-api.digitalharmonyai.com` VERIFIED correct (`infra/cloudflared/config-portage.yml:7`) — do not "fix"; but note D3 tension with `deployment.md:20` + `environment-variables.md:101` (frontend uses `/backend` rewrite; both true — one page should say so).
- **authentication.md — fix.** :116–123 PATCH preferences body keys `listingFlowPreference/compactMode` don't exist → schema accepts `listingInterface/listingForkPref/listingCompactMode` (`preferences.ts:10–14`). GET `/users/me/preferences` undocumented (`preferences.ts:20–46`). :26–37 session response missing usage-counter fields (`auth.ts:110–126`). Core CF Access flow claims all verified correct.
- **items.md — rewrite.** Defects 1–7 as in §1.4 plus: list response omits `listed/limit/offset` (`items.ts:27,205–210`); create/update accepts ~12 undocumented fields (`items.ts:71–97`); PATCH may return `syncWarnings` (`items.ts:517,614`); undocumented: `GET /items/:id/comps` (:288), `GET /items/:id/research` (:318), `POST /items/photos/export/prepare` (:742), token-auth `GET /items/photos/export` mounted before requireAuth (:111–169).
- **listings.md — fix.** POST body missing `publishMode` (draft|live|ebay_draft) + `suppress7d` (`listings.ts:177,190`); list query missing `itemId` (:202); response omits `itemTitle/limit/offset` (:291–311); `GET /listings/:id/ebay-offer` undocumented (:336–360). GTC sweep, idempotency, publish lifecycle all verified correct.
- **marketplace.md — keep.** Cosmetic: :99 column names are `accessTokenEncrypted/refreshTokenEncrypted` (`ebay-auth.ts:213–214`, orchestrator-verified). :101 "refresh 5 min before expiry" — consistent with apps/api/CLAUDE.md, token-manager.ts not read → verify on touch.
- **orders.md — fix.** :22–46 response omits `pagination` wrapper + join fields, query params undocumented (`orders.ts:26–56`); PATCH missing `shippingLabelUrl` (:99–104); :64 "runs automatically on login" is a frontend claim — UNVERIFIED (§9).
- **scan.md — fix.** :51–79 refine response `{detailed, single}` → actual `{identification, detailed}` (`scan.ts:202–205`); :51 says 200 → both endpoints return 201 (:130,202); POST /scan response shape never shown (:130–143). Everything else (limits, SSRF fail-closed, error table) verified.
- **porter.md — fix.** :44–57 non-streaming response `{response, toolCalls}` → actual `{conversationId, message}` (`porter.ts:486–489`); :97 `LIMIT_REACHED` → `PORTER_LIMIT_REACHED` (:315,439); :97 "unlimited for Pro" → 500/day (`constants.ts:29`); :83–88 search_inventory also takes `category/condition` (:44–53).
- **images.md — fix.** :82 client-side WASM claim (§1.7); :220 "up to 12" → 24 (`constants.ts:60`); :175–183 DELETE key is a query param (`images.ts:512–515`); `GET /images/r2/*path` undocumented (:490–507); remove-bg response shape + 4 error codes missing (:325–331, :92–104).
- **billing.md — fix.** :16 "Unlimited AI tools" for Pro (§1); :44 free Porter example limit 20 → 5/day (`constants.ts:21`); :122 Porter 429 code; missing: 10/hr rate limit (`billing.ts:35–42`), `STRIPE_PORTAL_CONFIG` (:203).
- **drafts.md — fix.** :80–88 "DELETE /drafts deletes all" → deletes only drafts >30 days old, returns `{cleaned:true}` (`drafts.ts:148–159`). The ":9 auto-save every 2s" claim VERIFIED (`use-drafts.ts:83`).
- **admin.md — keep.** Minor: :117 settings PATCH accepts only `maintenance_mode` (`admin.ts:768–779`); :46 reset-usage resets scans+bg-removals, not listings (:444–448); :138 "Porter — AI assistant config" — no config endpoints exist (:601–658), UI claim UNVERIFIED.
- **shipping.md — keep.** Clean; correctly documents the PR #142 removal (no shipping.ts exists — orchestrator-verified route listing).
- **error-handling.md — fix.** :59 `502 MARKETPLACE_ERROR` and :60 `503 SERVICE_UNAVAILABLE` exist nowhere in apps/api/src (grep 0 hits); real code `503 MARKETPLACE_UNAVAILABLE` (`items.ts:305`). :50 missing `PORTER_LIMIT_REACHED`. :32 `USER_NOT_FOUND` is thrown as both 401 (`scan.ts:51`) and 404 (`billing.ts:255`, `usage.ts:27`, `preferences.ts:32`). ~20 live codes absent (full list in worklist E11). :64–72 web `ApiError` UNVERIFIED (§9).

### 2.2 architecture/ + frontend/ + design/

- **architecture/overview.md — fix.** :35 nav list wrong under any era (code: `tab-bar.tsx:12–18` + `navigation.ts:4–13`); :92 "sole global provider" → PorterProvider also exists (`(tabs)/layout.tsx:9`); :31–38 no responsive shell (AppShell at `app/layout.tsx:69`); :75 order lifecycle omits `label_purchased` enum value (`schema.ts:16` — liveness UNVERIFIED §9). Embedded SVGs → §6.
- **architecture/database.md — fix.** :29 items columns (§1.4 — orchestrator-verified against `schema.ts:73–91`); :30 listings has no `title/description` (`schema.ts:115–143`); :38 notifications is a records table, prefs live in `users.notificationPreferences` (`schema.ts:181–193,46`). 18-table list, idempotency index, encryption all verified exact. Add: `items.aspects` + serialized `ebaySku` reliability stories (`schema.ts:81–84, 4–7, 104–108`).
- **architecture/marketplace-adapters.md — fix.** One stale line: :81 "OAuth code-grant remains planned" → declared obsolete 2026-07-09, PAT live-proven. Otherwise the most accurate doc in the set (interface reproduced exactly per `packages/shared/src/marketplace.ts:67–75`). Add `MarketplaceListingInput` contract (mpn-vs-model gotcha, `marketplace.ts:13–15`) and wire the 8 Trade-First SVGs (§6).
- **architecture/ai-pipeline.md — keep.** Clean (provider table matches `env.ts:12–27` exactly; rembg, SSRF, Zod all verified). Optional adds: Gemini `reasoningEffort:'none'` gotcha (`ai-client.ts:43,69`), Porter differentiation framing.
- **architecture/sitemap.md — fix (regenerate).** :9 "35 pages" → 38 page.tsx on disk; `gen_sitemaps.py` missing `/tutorials`, `/tutorials/[topic]` (PR #231), `/inventory/[id]/preview`; :35 "10 admin pages" → 11 rendered (`gen_sitemaps.py:201–204,283`).
- **frontend/app-structure.md — rewrite.** 7 defects: 6-tab claim + `/more` bar-tab row (:15,:22–25); tree omits `tutorials/ beta/ legal/` (:67–73); TabBar mounts once in AppShell not per-layout (:70 vs `app-shell.tsx:15`); layout/ missing AppShell/Sidebar/TopBar (:80); "sole provider" (:92); route map missing 6 shipped routes (:29–63); zero responsive-shell content. Source the rewrite from apps/web/CLAUDE.md (current) + PR #229.
- **frontend/design-system.md — fix.** :61 tab bar uses `.glass-nav` not `.glass-thick` (`tab-bar.tsx:96`, `globals.css:411–415`); missing R0 tokens/utilities (`.glass-nav/.glass-control/.content-container/prefers-reduced-transparency`, `globals.css:52–53,373–436`); :88 "All animations respect prefers-reduced-motion" — `confetti-fall` not in the disable block (`globals.css:354–370` vs :249–252), UNVERIFIED component-side gating (§9). All token hex values verified exact. Dedupe vs style-guide per E-C2.
- **design/style-guide.md — fix + partial merge.** :601–611 TabBar "6 tabs … More" stale; :553 `max-w-lg` everywhere superseded by `.content-container` (`globals.css:424–436`); :786 onboarding step titles wrong (`onboarding-flow.tsx:26–59`); :768 `BgRemovalPanel`/@imgly claim false (§1.7); :108–109 Warning/Error hex contradicts code AND the doc's own CSS snippet (`globals.css:27–29` vs :202–203); :745–756 PublishSuccessProps missing `itemId` (`publish-success.tsx:9`); no R0 components. Merge plan: style-guide = DHG-canonical palette/typography/SVG guide; design-system = Portage implementation; move Component Library (:567–795) into frontend/.
- **frontend/listing-flow.md — keep.** Verified clean line-by-line (state names, 9 actions, multipliers 0.85/1.0/1.2 — orchestrator-verified `use-listing-flow.ts:337–340`; components all exist). Add a "why it matters" intro (§8).
- **frontend/scan-flow.md — fix.** :27,:29 "1-12 photos" → 24 (`constants.ts:60`, orchestrator-verified; consumed `scan-flow.tsx:56–57`); camera zoom + Continuity picker (PRs #220/#224, `camera-capture.tsx:12,41–67,136–200`) entirely absent; component table missing 5 existing files. First-3-photos-to-AI + state enum verified.

### 2.3 Top-level + development/ + reference/ + team-process/ + appendix/

- **getting-started.md — fix (minor).** :87 "~664 tests" stale (three-way conflict, §9 Q1). All commands/ports verified against `package.json:10–25` + compose. Editorial: split Doppler/non-Doppler paths (E-E1), fix `https://localhost:8016` vs README `http://` (E-E2), add differentiation bullets + next-step links.
- **deployment.md — fix.** :17 "4 services" and :121 "all four" → 5 (`docker-compose.yml:92–103`); portage-graph absent from the page; portage-graph has no healthcheck (true but unacknowledged). Tunnel diagram verified exact vs `config-portage.yml:4–10`.
- **environment-variables.md — fix (minor).** Doc is more accurate than `.env.example`, which is itself stale: contains `EASYPOST_API_KEY` (:77 — subsystem deleted PR #142) + empty Etsy header (:74); missing `EBAY_PROD_CLIENT_ID/SECRET` (`ebay-credentials.ts:19`), `REVERB_API_TOKEN` (`reverb-adapter.ts:348`), `METRICS_SECRET` (`env.ts:52`). Doc gaps: `API_PORT/WEB_PORT/NODE_ENV` (`.env.example:92–94`, `env.ts:6–7`).
- **features.md — fix.** :107 12→24 photos; :207 7→8 metrics (`metrics.ts:5–52`, orchestrator-verified); :167,:230 Reverb OAuth "Planned" → obsolete (contradicts history.md:139); :10 "covers every shipped feature" — missing tutorial hub (#231), camera zoom/Continuity (#220/#224), photo reorder (#223–226), responsive shell R0 (#229). Note: :193 "5-tab" is CORRECT per code. "Only in Portage" section is the corpus's best differentiation text — preserve.
- **monitoring.md — keep.** All 8 metrics verified exact. Companion NEW item: cite `observability/grafana/portage-dashboard.json` (currently promised at :30 without a path — grep 0 hits repo-wide).
- **competitive-analysis.md — rewrite.** §1.8 + E-C4 (differentiators table contradicts features.md on vision provider and bg-removal). Keep market matrix/positioning/pricing; refresh or banner as point-in-time (2026-05-17).
- **development/code-graph.md — fix (minor).** :21 "338 articles" → 713 on disk (`ls graphify-out/wiki/*.md | wc -l`); the dated node/edge counts pass.
- **development/frontend-e2e-verification.md — keep.** Every artifact verified on disk incl. all 10 proof images.
- **development/history.md — fix (minor).** :137–139 "Current Status (as of 2026-07-09) — 50/52" — 5+ weeks and one whole program stale; :50 "25 PRs (#28–52)" vs 24 table rows, PR #51 exists but is missing from the table.
- **development/memory-system.md — fix.** :55–63 "7-section briefing" → hook emits more (`.claude/hooks/session-briefing.sh:54,186,214`; 9 observed live per auto-memory). SVG refs exist; file-structure claims verified.
- **development/registry-integration.md — fix.** :29–40 "8 subcommands" → 9th pipeline `post-session-reports` exists (`~/.claude/scripts/post-session-reports.sh`, live since PR #199). Strongest infra page otherwise; all channels verified.
- **reference/ebay-ato-and-publish-hardening.md — fix (banner).** :54–77,:92–100 describe the Inventory-API publish path as operative — superseded by Trade-First 11 days after writing (PR #133). ATO model + SKU/UA hardening still accurate. 3-line supersession banner suffices; body stays as dated reference.
- **team-process/outcomes-study.md — fix.** :106–113 study protocol opened 2026-05-11, never closed; registry now holds 109 ship sessions and no findings section exists. Close with findings or merge into history.md as a completed experiment.
- **appendix/screenshots.md + _category_.json — keep.** 117/117 refs verified; historical framing explicit and correct.

### 2.4 ship-log/ (wiring spot-check only, per constraints)

Generator: `.claude/scripts/generate-ship-log.sh`, invoked by nothing automatic (deploy-docs.yml doesn't call it; only retired `/ship_v3` instructed entries). Last entry PR #108 (2026-06-10); registry has 109 sessions → 54 missing. Numbering is ordinal-position based with no stale-file cleanup (`generate-ship-log.sh:76–94`) → 4 orphaned duplicates on disk (039-voice-…-home-screen, 040-bulk-photo-export…, 041-stage1-…, 042-stage2-…; 59 files vs 55 indexed). index.md:50 malformed 2-URL href; :63–64 two dead links (targets carry doc-ids `redesign-ship-1-build/phase6` — 050/051 resolve by id, 063/064's targets don't exist as written). 050/051 duplication is upstream (one ship run captured twice in the registry), not a generator bug.

---

## 3. Per-file defect detail — docs/ working docs + repo root

- **docs/TODO.md — fix.** :3 "50/52" vs CLAUDE.md "51/52" (§9 Q1); :4 "Last updated 2026-07-09" vs 07-15 content in body; :342–348 R0 items unchecked though shipped (#229); :339 onboarding "QUEUED" though shipped (#231); no in-flight markers for open PRs #236/#237 despite CLAUDE.md delegating "live backlog + in-flight branches" here; :374–376 summary table lists closed phases as open with hour estimates; :419 committed demo credentials.
- **docs/PORTAGE_HISTORY.md — keep + banner.** Self-dated snapshot (2026-06-24); §7 backlog 100% closed since, §6 lists removed voice containers. One-line banner on §7 prevents misreads. §4 "blockers & solutions" is the best institutional-knowledge section in the corpus — candidate for promotion (E-C3).
- **docs/ebay-api-reference.md — fix.** :113,:202–221 present the Inventory API as Portage's primary listing path — inverted since PR #133 (`ebay-adapter.ts:7,499–500` calls Trading builders); file list omits `ebay-trading-client.ts`/`ebay-trading-builders.ts`. REST reference tables stay as background.
- **docs/trade-first-burndown.md — fix + archive.** :5 header claims an open item that :50 marks "✅ Verified fixed 2026-07-02"; :7–11 presents a finished epic as "the canonical execution queue". Stamp EPIC COMPLETE.
- **docs/secrets-guide.md — merge-into pointer.** No factual defects; 287-line DHG-wide guide duplicating the canonical docs-site Doppler page (verified live: `http://10.0.0.251:8017/docs/infrastructure/doppler` → 200). Matches the standing deferred decision.
- **docs/ADMIN_PLAN.md — keep + IMPLEMENTED banner.** :40 seed command superseded by promote-admin.ts; :9–10,:36–39 password-auth flow superseded by CF Access. Shipped admin exceeds the plan (PR #188).
- **docs/incomplete-work-backlog.md — delete (or SUPERSEDED stamp).** Claims "live execution queue"/"source of truth" while every phase is closed (F: #132/#133; H: #139; I: #142; G fixed; camera e2e done). Actively misleading as written.
- **Research (3), brand (2), superpowers plans (8) + specs (11) + narrative, session reports (9) — keep.** All session-report PR claims verified against `gh` merge history; zero factual errors found. Two shipped plans lack the EXECUTED banner the listing-hub plan models (onboarding-expansion, responsive-shell); the onboarding plan + 4 session reports are untracked on disk — needs a docs commit (also flagged by whats-next.md:25).
- **README.md — rewrite** (§1.2, ten enumerated defects in worklist E1). **ONBOARDING.md — fix** (Etsy :3; "238 tests" :53,:114; JWT+refresh :61; creds :116). **CLAUDE.md — fix** (nav line — code verified 5 tabs + Scan; 51/52 vs 50/52; forest-green table presented as canonical vs `globals.css:19` "Legacy brand" label; 686-vs-676 test count vs apps/api/CLAUDE.md).
- **TO-DOS.md, findings.md, progress.md, task_plan.md — delete** (completed 2026-04/05 planning scratch; findings.md additionally carries org-infra survey data that doesn't belong in the product repo root). **whats-next.md — keep** (gitignored session-handoff scratch, designed lifecycle).
- **Housekeeping:** 37 `.DS_Store`/AppleDouble files (all untracked — `git ls-files` empty) → delete + .gitignore entries; `docs/eba-ad cloudfllare-dev-docs/` and `docs/scrrenshots/` contain ONLY resource-fork litter (no real content on disk) → delete dirs; `docs/voice-chat-mockups/` (10 tracked HTML) → delete, era preserved at tag `voice-parked-2026-07`; `docs/screenshots/` (117 png) → byte-identical md5-verified duplicate of `website/static/img/screenshots/` → delete after canonical confirmation (§9 Q5); `docs/labs/dispatch-log.jsonl` → keep.

---

## 4. Structure & editorial findings (technical editor)

Sidebar mechanics verified: shared docs-site `sidebars.ts:35–40` autogenerates the whole Portage category from `website/docs/` — ordering/labels are controlled entirely in-repo via frontmatter + `_category_.json`.

1. **A1/A2** Duplicate `sidebar_position` (getting-started=deployment=1; features=environment-variables=2) and 3 pages with none → arbitrary sidebar order.
2. **A3** Only appendix/ has `_category_.json`; the other 8 dirs render raw dirnames ("api", "team-process", "ship-log") in the sidebar.
3. **A4** Ship-log floods the sidebar (57 truncated labels) — collapse + high position.
4. **A5** 19 of 34 content pages have zero inbound content links (full list in editor findings; worst: deployment.md, features.md, all architecture sub-pages). The corpus is a bag of pages, not a web.
5. **B** Broken links: `README.md:23` (https+wrong path → `http://10.0.0.251:8017/portage/features`); `ship-log/index.md:50,63,64` (§2.4). Systemic: 22 absolute `/docs/...` links survive only via the `deploy-docs.yml:26` sed rewrite and 404 everywhere else; two authoring conventions coexist (§9 Q9). All image links resolve on disk.
6. **C** Duplication: secrets ×3 (C1); style-guide vs design-system ~200 overlapping lines that already drift (C2); history.md vs PORTAGE_HISTORY (C3 — keep both, cross-link, banner §7); features vs competitive-analysis contradictions (C4); README/ONBOARDING/getting-started triple quick-start with 3 disagreeing test counts (C5); three self-declared canonical queues in docs/ (C6 — TODO.md wins).
7. **D** Consistency: tab-count told 3 different ways (D1); test counts 238/~664/676/686 (D2); prod hostname framing split (D3); frontmatter id/slug mix + style-guide title≠H1 (D4); "Trade-First" named on exactly one site page (D5); tone split + a rendered generator artifact in outcomes-study.md:9 (D6); freshness stamps on only 2 pages (D7).
8. **E** Reader journeys: new-dev env-strategy fork unreconciled (E1); https/http first-curl contradiction (E2); operator path orphaned (E3); evaluator path enters via the broken README link (E4); no architecture reading path (E5); tutorial hub/responsive shell invisible (E6); docs/ triage needs an index (E7 → new docs/README.md).

---

## 5. Gaps

### 5.1 Undocumented live API surface (from the two-direction endpoint sweep)
`health` · `dashboard` (GET /dashboard) · `usage` (GET /usage; POST /usage/bg-removal) · `messages` (5 endpoints: list, unread-count, thread GET w/ read-marking, sync, reply) · `seller-profile` (GET auto-create; PATCH ~20 fields incl. PRICING_FLOOR_INVALID cross-check) · `disclaimer` (version; accept-terms) · `survey` (3 public rate-limited endpoints, NO auth) · `beta` (POST /beta/report, tier-gated registry proxy) · `faqs` (GET) · `preferences` (GET) · items: comps/research/photo-export ×2 · listings: `:id/ebay-offer` · images: `r2/*path` proxy.

### 5.2 Infrastructure documentation matrix (16 pieces inventoried; full evidence in worklist N-group)
Well-documented: portage-db/api/app, dev overlay, Doppler (over-documented ×3), Registry integration, monitoring metrics. Partial: dhg-docs (one sentence; real run mechanism = aifactory compose stack, undocumented; deploy-docs.yml fallback diverges), tunnel (flow yes; ops/config/systemd unit no — `infra/cloudflared/README.md` not on site), R2 (vars yes; provisioning no), runner (pipeline yes; setup no), Grafana (promised, path never cited — `observability/grafana/portage-dashboard.json`). Absent: portage-graph on deployment page, CF Access app/bypass inventory, dhg-network cross-stack bridge (`docker-compose.yml:127–129`; only mention is stale `PORTAGE_HISTORY.md:113`). Diagram coverage zero for: rembg, portage-graph, dhg-docs, dhg-network, CI/CD. Notable negative: pgvector is NOT in Portage (postgres:15-alpine; zero schema hits) — correctly undocumented; don't add it.

### 5.3 Shipped features with zero docs footprint
Tutorial hub (#231 — zero grep hits corpus-wide) · Responsive shell R0 (#229) · camera zoom/Continuity (#220/#224) · photo reorder + 24-cap (#223–226) · Reverb publish as a feature page · messages/conversations UI · GTC sweep (API-documented at listings.md:119, no feature/architecture coverage) · Porter frontend (aurora/orb, ask-pills, PorterProvider) · Trade-First as a current-state reference doc (the single highest-value missing page — the only reference doc describes the superseded path).

---

## 6. Graphics disposition (222 files: 137 referenced / 85 unreferenced; per-file rows in Appendix A)

| Group | Count | Disposition | Evidence |
|---|---|---|---|
| img/screenshots/ | 117 | keep | all referenced by appendix; 117/117 verified |
| img/verification/ inline-edit + photo-tools | 10 | keep | referenced by frontend-e2e-verification.md:51–83 |
| img/verification/ other (12 subdirs) | 76 | keep-unlinked, decision pending | deployed but linked from nowhere; index page vs prune (§9 Q4); listing-hub/ holds two overlapping capture generations |
| architecture-system-overview.svg, architecture-data-flow.svg | 2 | **recreate** | §1.1 — quoted stale text inside SVGs: "/auth login, register, refresh", "bcrypt verify", "Etsy PKCE", "Inventory API (SKU/Offer)", "EasyPost/Shippo (pending)", "16 tables", "3 containers", "Claude Vision (primary)", "5-tab bottom nav" |
| memory-*.svg | 4 | update counts | "7 sections"→9; "23 files"; "37/52"; sync-phases internally inconsistent ("Light mode (2 phases)" vs "Light: removed"); byte-identical twins in docs/superpowers/architecture/ must move in the same change (§9 Q6) |
| ebay-trade-first-* (+dark) | 8 | keep + wire | content verified accurate vs PR #133/CLAUDE.md; all 8 unreferenced; wire into marketplace-adapters.md via ThemedImage (plain img would orphan the dark variants); caption phases.svg as the dated migration record |
| sitemap/ (3 svg + pdf) | 4 | regenerate | §2.2 sitemap.md |
| docusaurus.png | 1 | delete | stock scaffold asset, unreferenced |

Variant pairs: only the eBay set has dark variants (4 complete, byte-distinct pairs); architecture/memory/sitemap SVGs have none (opaque light bg — legible but inconsistent in dark mode). docs-side graphics groups (mockups 7, superpowers SVGs 4, brand 10, screenshots-duplicate 117, voice mockups 16): dispositions in Appendix A / §3.

**Missing graphics (create):** CF Access auth-flow diagram (the only auth diagram that exists draws the deleted password flow) · 18-table ER diagram · AI-pipeline/vision-chain diagram · infra topology (5 compose services + dhg-docs + tunnel + runner + Registry + dhg-network) · responsive-shell as-built (defer until R1 merges).

---

## 7. Differentiation opportunities

1. README front-door pitch is the weakest text in the corpus while features.md:20–26 already has the killer framing (scan → AI → real sold comps → one tap; 4-6x items/hour) — lift it.
2. Trade-First is named on exactly one site page; add a Key-Design-Decision row (architecture/overview) + the new reference page; the ATO/publish-hardening war story (currently orphaned) is the proof behind any reliability claim.
3. Porter: api/porter.md:9 buries "function-calling access to your real inventory"; Porter frontend (orb/ask-pills) undocumented.
4. Scan: the 3-photos-to-AI cost story (`scan-flow.tsx:387`), confidence-with-reasoning UX, zoom/Continuity — absent or buried in scan-flow.md.
5. Listing flow: "three interfaces, one state machine; drafts survive; retries can never double-list" — one intro paragraph.
6. Schema stories: `items.aspects` ("never re-asks for data already captured") and serialized `ebaySku` (idempotent, ATO-safe) invisible in database.md.
7. "Teal = AI, never purple" brand line (style-guide:15) — the best positioning sentence in the corpus, buried in the least-read file.
8. getting-started: 3-bullet "why Portage is different" block costs 5 lines.

---

## 8. Verification performed

- Corpus reconciliation: table generated mechanically from a disk walk; 564 rows = 564 files (per-category counts in header; Appendix A prints its own totals).
- Orchestrator spot-checks (direct source reads, this session): tab-bar.tsx:12–18 (5 tabs + Scan — validates §1.6 and the CLAUDE.md defect); metrics.ts (8 metrics — validates monitoring.md keep + features.md defect); use-listing-flow.ts:337–340 (multipliers — validates listing-flow.md keep); constants.ts:25–31,60 (Pro limits + 24-cap — validates billing/porter/images/scan-flow defects); ebay-auth.ts:213–214 (validates marketplace.md keep); schema.ts:73–91 (validates items.md/database.md rewrites); routes dir listing (no shipping.ts — validates shipping.md keep). All passed.
- No defect row in this report or the worklist uses "probably"/"likely"; unverifiable items are below.

## 9. Open questions for Stephen (all UNVERIFIED items)

1. **Task/test counts:** 50/52 (TODO.md, per PR #190 recount) vs 51/52 (CLAUDE.md); tests 238/~664/676/686 across four files. One recount + one suite run settles both; the audit did not re-derive the ledger or run the suite.
2. **Ship-log pipeline:** revive `generate-ship-log.sh` (54 sessions missing, fixes belong in the generator: numbering by stable id not ordinal, stale-file cleanup, pr_url validation, registry dedup for 050/051-type double-captures) — or retire the section? No decision record found either way.
3. **CLAUDE.md nav wording:** code is 5 tabs + center Scan (verified). Update root CLAUDE.md and apps/web/CLAUDE.md (which still shows `more/` under (tabs)/) in the docs pass, or does Stephen want the More tab restored?
4. **76 unreferenced verification PNGs** deployed to the docs site: index page, keep unlinked, or prune?
5. **docs/screenshots/ duplicate:** confirm website/static/img/screenshots/ is canonical before deleting the docs/ copy.
6. **memory-*.svg twins** (website + docs/superpowers, byte-identical): pick a canonical side before updating counts.
7. **style-guide.md scope:** declares itself the DHG-wide reference (:8) — move to the shared docs-site with Portage keeping the Extended Palette?
8. **`rehearsal.digitalharmonyai.com` → localhost:3004** ingress in `config-portage.yml:15–16`: non-Portage service on the Portage tunnel, nothing on :3004 in docker ps, undocumented.
9. **`/docs/` sed-rewrite convention** (22 links) vs migrating to relative links — deliberate (registry ingest expectations?) or accreted?
10. **`demo@portage.app`** — still a live CF Access identity? (Committed password is dead regardless; removal stands.)
11. **`session_reports` as a searchable KB source** — capture rule implies yes; registry-integration.md and the search rule both omit it.
12. **memory-sync-phases.svg** internal contradiction — current light-mode status of /sync-memory?
13. **Verify-on-touch list** (below defect threshold, no evidence either way): token-manager 5-min refresh; `label_purchased` enum liveness post-#142; scan refine server-side max-3 enforcement; web `ApiError` shape; standalone scan-fab z-index; features.md "Pagination Shipped" vs CLAUDE.md remaining item; `settings/marketplace/callback` route liveness; Prometheus scrape config (aifactory-side); "54 secrets" Doppler count; Registry health-endpoint path; live `/etc/cloudflared` vs versioned config sync (needs sudo).
14. **docs/audits/2026-07-graphify-interface\*** (12 files) appeared on disk mid-audit from another session — excluded from this corpus; fold into a future pass if they're staying.
15. **Dead dependency** `@imgly/background-removal` (`apps/web/package.json:17`, zero imports) — code change, out of docs-pass scope; route to a code session.

---

# Appendix A — Per-file verdict table (564 rows, generated from disk walk)

### website/docs — 99 files

| File | Verdict | Basis |
|---|---|---|
| website/docs/api/admin.md | keep | 3 minor: settings key allowlist; reset-usage scope; Porter-config sidebar claim |
| website/docs/api/authentication.md | fix | PATCH preferences body wrong keys; GET preferences undocumented |
| website/docs/api/billing.md | fix | Pro-unlimited claim; free Porter 5/day; rate-limit + STRIPE_PORTAL_CONFIG missing |
| website/docs/api/drafts.md | fix | DELETE /drafts semantics wrong (30-day cleanup, not delete-all) |
| website/docs/api/error-handling.md | fix | 2 nonexistent codes; ~20 live codes missing; USER_NOT_FOUND dual status |
| website/docs/api/images.md | fix | client-side-WASM claim false (server rembg); 12 vs 24 cap; shapes/error codes; r2 proxy undocumented |
| website/docs/api/items.md | rewrite | field names don't exist (valueLow et al.); comps shape; bulk/update scope; 4 undocumented endpoints |
| website/docs/api/listings.md | fix | publishMode/suppress7d/itemId missing; ebay-offer endpoint undocumented |
| website/docs/api/marketplace.md | keep | 2 cosmetic nits (column names; verify token-refresh on touch) |
| website/docs/api/orders.md | fix | response shape omits pagination+joins; shippingLabelUrl missing |
| website/docs/api/overview.md | fix | dev base URL; Pro-unlimited claim; endpoint-groups table omits 10+ groups |
| website/docs/api/porter.md | fix | non-streaming shape wrong; PORTER_LIMIT_REACHED; Pro 500/day not unlimited |
| website/docs/api/scan.md | fix | refine response shape wrong; 200 vs 201; POST /scan response never shown |
| website/docs/api/shipping.md | keep | clean — correctly documents the PR #142 removal |
| website/docs/appendix/_category_.json | keep | valid |
| website/docs/appendix/screenshots.md | keep | 117/117 image refs verified; historical framing correct |
| website/docs/architecture/ai-pipeline.md | keep | clean; optional adds (reasoningEffort gotcha, Porter framing) |
| website/docs/architecture/database.md | fix | items/listings/notifications column claims wrong; add aspects+ebaySku stories |
| website/docs/architecture/marketplace-adapters.md | fix | one stale line (Reverb OAuth 'planned'); wire Trade-First SVGs; add input contract |
| website/docs/architecture/overview.md | fix | 5-tab nav wrong; no responsive shell; PorterProvider; both embedded SVGs stale (see GRAPHICS) |
| website/docs/architecture/sitemap.md | fix | 35 vs 38 routes; 10 vs 11 admin pages; regenerate via gen_sitemaps.py |
| website/docs/competitive-analysis.md | rewrite | product-side claims aged out (3 markets, WASM, Claude-primary, carrier 'pending', dead priorities) |
| website/docs/deployment.md | fix | 4-services claim (5 in compose); portage-graph absent; healthcheck count |
| website/docs/design/style-guide.md | fix | TabBar 6-tab stale; max-w-lg superseded; onboarding titles; BgRemovalPanel nonexistent; semantic-color conflict; partial merge of Component Library into frontend/ |
| website/docs/development/code-graph.md | fix | minor: wiki article count 338 vs 713 |
| website/docs/development/frontend-e2e-verification.md | keep | all artifacts verified on disk |
| website/docs/development/history.md | fix | minor: 'Current Status' 5 weeks stale; PR-table count off by one |
| website/docs/development/memory-system.md | fix | 7-section briefing claim (9 observed live) |
| website/docs/development/registry-integration.md | fix | omits 9th pipeline (post-session-reports) |
| website/docs/environment-variables.md | fix | minor: API_PORT/WEB_PORT/NODE_ENV gaps; .env.example itself stale (companion edit) |
| website/docs/features.md | fix | 12 vs 24 photos; 7 vs 8 metrics; Reverb-OAuth row obsolete; 4 shipped features missing |
| website/docs/frontend/app-structure.md | rewrite | pre-R0 framing invalid: 6-tab claim, missing AppShell/Sidebar/TopBar, missing routes, sole-provider claim |
| website/docs/frontend/design-system.md | fix | tokens verified; glass-nav attribution; missing R0 tokens/utilities; reduced-motion overclaim; dedupe vs style-guide |
| website/docs/frontend/listing-flow.md | keep | verified clean line-by-line; add differentiation intro |
| website/docs/frontend/scan-flow.md | fix | 12 vs 24 cap; camera zoom/Continuity feature absent; component table gaps |
| website/docs/getting-started.md | fix | minor: stale test count; env-strategy split; add differentiation + links |
| website/docs/monitoring.md | keep | all 8 metrics verified exact; add dashboard JSON path (companion NEW item) |
| website/docs/reference/ebay-ato-and-publish-hardening.md | fix | add Trade-First supersession banner; ATO model itself still accurate |
| website/docs/ship-log/001-critical-code-health-fixes-ilike-escape-ai-tool-loop-cap-stu.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/002-jwt-auto-refresh-intercept-401-auto-refresh-with-stored-refr.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/003-scan-lookup-pipeline-accuracy-bugs-ebay-condition-normalizat.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/004-listings-crud-edit-update-delete-from-ui-with-marketplace-sy.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/005-c1-fix-order-sync-assigns-wrong-listing-to-incoming-orders.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/006-c2-fix-xss-via-dangerouslysetinnerhtml-with-unsanitized-ai-t.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/007-c3-replace-sql-raw-with-parameterized-drizzle-apis-to-preven.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/008-c4-decouple-encryption-key-from-jwt-secret.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/009-fix-object-url-memory-leaks-in-listing-flows.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/010-test-infrastructure-vitest-config-env-setup-jwt-helpers.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/011-p0-tests-crypto-jwt-password-auth-middleware-error-handler-2.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/012-p0-route-tests-auth-endpoints-computepricing-via-createapp-f.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/013-docker-environment-fixes-api-crash-background-removal-web-co.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/014-unified-photo-capture-editing-flow-with-multi-photo-scan-inl.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/015-fix-dependabot-vulnerabilities-clean-up-website-tooling.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/016-ship-session-intelligence-pipeline-unified-kb-search.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/017-memory-intelligence-loops-2-3-activated-end-to-end.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/018-loop-4-self-training-minimal-corrections-capture-briefing-su.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/019-webp-to-jpeg-image-format-fix-marketplace-compatibility.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/020-registry-kb-acceleration-bulk-ingest-memory-claude-md-files.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/021-registry-upsert-idempotency-for-all-non-idempotent-tables-de.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/022-code-health-week-1-resolve-30-important-20-minor-findings.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/023-deferred-items-from-code-health-review.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/024-full-codebase-code-health-review-37-findings.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/025-audit-test.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/026-automation-test.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/027-full-wiring-and-deployment-audit-of-memory-registry-pipeline.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/028-hook-driven-capture-guaranteed-registry-ingest-via-session-h.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/029-capture-guarantee-v2-decisions-deferred-auto-fire-advisory-l.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/030-capture-guarantee-v3-corrections-bug-fixes-auto-fire-with-co.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/031-fix-all-4-feedback-loops-cron-journal-aging-correction-bug-f.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/032-stripe-subscription-billing-pro-tier-trials-credit-packs.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/033-billing-enforcement-gates-marketplace-count-bg-removal.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/034-billing-enforcement-gaps-marketplace-count-limit-background-.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/035-reverb-token-paste-auth-flow.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/036-ebay-seller-hub-reports-csv-export-with-marketplace-data-cac.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/037-scan-comp-cards-reverb-ui-features-doc-docs-tunnel.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/038-ebay-buyer-messaging-read-inbox-reply-via-trading-api.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/039-voice-chat-interface-porter-powered-home-screen.md | delete | orphan from generator renumbering; not in index; duplicate of a renumbered entry |
| website/docs/ship-log/039-voice-chat-interface-porter-powered-voice-control-with-redes.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/040-bulk-photo-export-zip-download.md | delete | orphan from generator renumbering; not in index; duplicate of a renumbered entry |
| website/docs/ship-log/040-voice-chat-interface-porter-powered-home-screen-with-streami.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/041-bulk-image-export-zip-download-of-all-photos-for-selected-in.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/041-stage1-scan-review-redesign-inline-ebay-aspects.md | delete | orphan from generator renumbering; not in index; duplicate of a renumbered entry |
| website/docs/ship-log/042-ebay-production-oauth-sandbox-coercion-fix-prod-sandbox-cred.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/042-stage2-pricing-engine-best-offer-footer.md | delete | orphan from generator renumbering; not in index; duplicate of a renumbered entry |
| website/docs/ship-log/043-ebay-listing-publish-hardening-planned-checkpointed-at-phase.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/044-ebay-listing-publish-hardening-phase-3-plan.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/045-ebay-listing-publish-hardening-draft-live-publish-mode-auto-.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/046-ebay-required-item-specifics-proactive-in-flow-collection-pu.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/047-ebay-return-policy-diagnosis-56-deferral-audit-c3b3013c-publ.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/048-ebay-package-weight-dimension-capture.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/049-ebay-publish-hardening-calculated-default-ai-weight-estimati.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/050-redesign-ship-1-dhg-design-system-porter-home-tab-bar-porter.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/051-redesign-ship-1-dhg-design-system-porter-home-tab-bar-porter.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/052-stage-1-scan-review-redesign-inline-ebay-item-specifics-aspe.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/053-claude-tooling-batch-enhance-backend-ebay-updatelisting-pack.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/054-stage-2-pricing-engine-r-7-percentile-bands-seller-tunables-.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/055-stage-2-5-photo-gallery-strip-full-screen-editor-overlay-acr.md | keep | generated ship-log history (audit-exempt per constraints; wiring defects filed on index.md) |
| website/docs/ship-log/index.md | fix | stale (55 of 109 sessions, stops PR #108); 2 dead links; 1 malformed link |
| website/docs/team-process/outcomes-study.md | fix | unclosed 2-month-old study protocol; close with findings or merge into history |

### docs/ (working docs + assets) — 235 files

| File | Verdict | Basis |
|---|---|---|
| docs/.DS_Store | delete | OS litter (.DS_Store/AppleDouble); untracked; add .gitignore entries |
| docs/._.DS_Store | delete | OS litter (.DS_Store/AppleDouble); untracked; add .gitignore entries |
| docs/ADMIN_PLAN.md | keep | add IMPLEMENTED banner; seed-command + password-auth lines superseded |
| docs/PORTAGE_HISTORY.md | keep | add snapshot banner on section 7 (backlog fully closed since) |
| docs/TODO.md | fix | stale header/date; R0/R1 states unchecked though shipped; phases table contradicts body; committed demo creds :419 |
| docs/brand/reverb-shop/README.md | keep | accurate asset inventory |
| docs/brand/reverb-shop/dhg-closet-reverb-banner.png | keep | active pending asset (Reverb shop setup pending) |
| docs/brand/reverb-shop/overtone-philosophy.md | keep | design language, nothing to drift |
| docs/brand/reverb-shop/rack-a1-vu-needle.png | keep | active pending asset (Reverb shop setup pending) |
| docs/brand/reverb-shop/rack-a1-vu-needle.svg | keep | active pending asset (Reverb shop setup pending) |
| docs/brand/reverb-shop/rack-a2-silverface.png | keep | active pending asset (Reverb shop setup pending) |
| docs/brand/reverb-shop/rack-a2-silverface.svg | keep | active pending asset (Reverb shop setup pending) |
| docs/brand/reverb-shop/rack-a3-orange-badge.png | keep | active pending asset (Reverb shop setup pending) |
| docs/brand/reverb-shop/rack-a3-orange-badge.svg | keep | active pending asset (Reverb shop setup pending) |
| docs/brand/reverb-shop/render.mjs | keep | active pending asset (Reverb shop setup pending) |
| docs/brand/reverb-shop/render3.mjs | keep | active pending asset (Reverb shop setup pending) |
| docs/brand/reverb-shop/renderA.mjs | keep | active pending asset (Reverb shop setup pending) |
| docs/design/mockups/responsive-shell/mock-desktop-endstate-r1-r3.svg | keep | R1-R3 design spec still in use (PR #237 in flight); archive after R3 |
| docs/design/mockups/responsive-shell/mock-desktop-home.svg | keep | R1-R3 design spec still in use (PR #237 in flight); archive after R3 |
| docs/design/mockups/responsive-shell/mock-desktop-inventory.svg | keep | R1-R3 design spec still in use (PR #237 in flight); archive after R3 |
| docs/design/mockups/responsive-shell/mock-ipad-inventory.svg | keep | R1-R3 design spec still in use (PR #237 in flight); archive after R3 |
| docs/design/mockups/responsive-shell/mock-iphone-inventory.svg | keep | R1-R3 design spec still in use (PR #237 in flight); archive after R3 |
| docs/design/mockups/responsive-shell/mock-iphone-settings-compactbar.svg | keep | R1-R3 design spec still in use (PR #237 in flight); archive after R3 |
| docs/design/mockups/responsive-shell/mock-iphone-settings-homechip.svg | keep | R1-R3 design spec still in use (PR #237 in flight); archive after R3 |
| docs/eba-ad cloudfllare-dev-docs/.DS_Store | delete | OS litter (.DS_Store/AppleDouble); untracked; add .gitignore entries |
| docs/eba-ad cloudfllare-dev-docs/._.DS_Store | delete | OS litter (.DS_Store/AppleDouble); untracked; add .gitignore entries |
| docs/eba-ad cloudfllare-dev-docs/._20260617-ebay-docs | delete | OS litter (.DS_Store/AppleDouble); untracked; add .gitignore entries |
| docs/eba-ad cloudfllare-dev-docs/._ebay-api-reference.md | delete | OS litter (.DS_Store/AppleDouble); untracked; add .gitignore entries |
| docs/eba-ad cloudfllare-dev-docs/20260617-ebay-docs/._Account API resources _ eBay Developers Program.pdf | delete | OS litter (.DS_Store/AppleDouble); untracked; add .gitignore entries |
| docs/eba-ad cloudfllare-dev-docs/20260617-ebay-docs/._Anthropic · Cloudflare One docs.pdf | delete | OS litter (.DS_Store/AppleDouble); untracked; add .gitignore entries |
| docs/eba-ad cloudfllare-dev-docs/20260617-ebay-docs/._Build your own vulnerability harness.pdf | delete | OS litter (.DS_Store/AppleDouble); untracked; add .gitignore entries |
| docs/eba-ad cloudfllare-dev-docs/20260617-ebay-docs/._Cloudflare tunnels and reverse proxy - Application Performance _ Getting Started - Cloudflare Community.pdf | delete | OS litter (.DS_Store/AppleDouble); untracked; add .gitignore entries |
| docs/eba-ad cloudfllare-dev-docs/20260617-ebay-docs/._Finding categories for a listing _ eBay Developers Program.pdf | delete | OS litter (.DS_Store/AppleDouble); untracked; add .gitignore entries |
| docs/eba-ad cloudfllare-dev-docs/20260617-ebay-docs/._Inside Cloudflare_ Preventing Account Takeovers.pdf | delete | OS litter (.DS_Store/AppleDouble); untracked; add .gitignore entries |
| docs/eba-ad cloudfllare-dev-docs/20260617-ebay-docs/._Request Headers _ eBay Developers Program.pdf | delete | OS litter (.DS_Store/AppleDouble); untracked; add .gitignore entries |
| docs/eba-ad cloudfllare-dev-docs/20260617-ebay-docs/._charity_api.json | delete | OS litter (.DS_Store/AppleDouble); untracked; add .gitignore entries |
| docs/eba-ad cloudfllare-dev-docs/20260617-ebay-docs/._curent notes.pdf | delete | OS litter (.DS_Store/AppleDouble); untracked; add .gitignore entries |
| docs/eba-ad cloudfllare-dev-docs/20260617-ebay-docs/._deal_api.json | delete | OS litter (.DS_Store/AppleDouble); untracked; add .gitignore entries |
| docs/eba-ad cloudfllare-dev-docs/20260617-ebay-docs/._eBay's ATO (Account Takeover) protection flags your account when the….pdf | delete | OS litter (.DS_Store/AppleDouble); untracked; add .gitignore entries |
| docs/eba-ad cloudfllare-dev-docs/20260617-ebay-docs/._inventory_mapping.pdf | delete | OS litter (.DS_Store/AppleDouble); untracked; add .gitignore entries |
| docs/eba-ad cloudfllare-dev-docs/20260617-ebay-docs/._key_management_api (1).json | delete | OS litter (.DS_Store/AppleDouble); untracked; add .gitignore entries |
| docs/eba-ad cloudfllare-dev-docs/20260617-ebay-docs/._key_management_api.json | delete | OS litter (.DS_Store/AppleDouble); untracked; add .gitignore entries |
| docs/eba-ad cloudfllare-dev-docs/20260617-ebay-docs/._marketing_beta_api.json | delete | OS litter (.DS_Store/AppleDouble); untracked; add .gitignore entries |
| docs/eba-ad cloudfllare-dev-docs/20260617-ebay-docs/._notification_api (1).json | delete | OS litter (.DS_Store/AppleDouble); untracked; add .gitignore entries |
| docs/eba-ad cloudfllare-dev-docs/20260617-ebay-docs/._notification_api.json | delete | OS litter (.DS_Store/AppleDouble); untracked; add .gitignore entries |
| docs/eba-ad cloudfllare-dev-docs/20260617-ebay-docs/._sell_account_v1_oas3.json | delete | OS litter (.DS_Store/AppleDouble); untracked; add .gitignore entries |
| docs/eba-ad cloudfllare-dev-docs/20260617-ebay-docs/._sell_account_v1_oas3.yaml | delete | OS litter (.DS_Store/AppleDouble); untracked; add .gitignore entries |
| docs/eba-ad cloudfllare-dev-docs/20260617-ebay-docs/._taxonomy_api.json | delete | OS litter (.DS_Store/AppleDouble); untracked; add .gitignore entries |
| docs/eba-ad cloudfllare-dev-docs/20260617-ebay-docs/._translation_api.json | delete | OS litter (.DS_Store/AppleDouble); untracked; add .gitignore entries |
| docs/eba-ad cloudfllare-dev-docs/20260617-ebay-docs/._vero_public_apis.json | delete | OS litter (.DS_Store/AppleDouble); untracked; add .gitignore entries |
| docs/ebay-api-reference.md | fix | 'Current Integration' section inverts Trade-First reality; REST tables fine as background |
| docs/incomplete-work-backlog.md | delete | or SUPERSEDED stamp: claims live-queue status; every phase closed |
| docs/labs/dispatch-log.jsonl | keep | SDD dispatch telemetry, referenced by session reports |
| docs/research/2026-07-13-ultrawide-camera-browser-access.md | keep | clean historical research record |
| docs/research/2026-07-13-video-tooling-and-marketplace-limits.md | keep | clean historical research record |
| docs/research/2026-07-15-apple-hig-ios26-shell-alignment.md | keep | clean; acted on in R0 |
| docs/screenshots/bp-01-demo-notenrolled.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/bp-02-enrolling.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/bp-03-optout-modal.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/bp-04-dark-readable.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/bp-05-back-header.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/capture-sheet-open.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/checkpoint-1-review-aspects-complete-collapsed.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/checkpoint-2-aspects-complete-category-line.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/checkpoint-3-aspects-expanded-optional.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/checkpoint-4-aspect-chips-suggestion.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/checkpoint-5-required-missing-disabled-list.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/checkpoint-6-required-brand-error-highlight.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/conv-scanning.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/conv-step1.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/crit-00-login.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/crit-01-home.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/crit-02-inventory.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/crit-03-orders.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/crit-04-more.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/crit-05-scan-flow.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/crit-05-scan.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/crit-06-detail-vp.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/crit-06-detail.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/dark-home-real.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/dashboard-authenticated.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/dashboard-unauthenticated.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/dashboard-with-fab.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/dev-steps-camera.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/dev-steps-conversational.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/dev-steps-hybrid.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/dev-steps-swipe.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/final-conversational.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/final-hybrid.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/final-swipe.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/funnel-path-verified.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/glass-scrolled.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/glass-top.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/greet-oneline.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/inventory-with-fab.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/list-page-authed.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/list-page-live.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/list-page-mobile.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/list-page-restarted.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/list-page-with-capture.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/list-page.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/listing-flow-duplicate-fields-390x844.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/phase5-dark-1-complete.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/phase5-dark-2-blocked.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/phase5-dark-3-unblocked.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/phaseA-session-lost-redirect-home.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/phaseB-scan-review-weight-category-live.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/phaseC-hybrid-collapsed-details-live.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/phaseC-no-label-yet-stub-live.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/phaseC-saved-as-draft-real-reason-live.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/photo-capture-overlay.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/porter-dhg-tabbar.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/porter-dhg.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/porter-hero-fixed.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/redesign-full.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/redesign-viewport.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/root-redirect.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/s25-item-detail-editor-overlay.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/s25-item-detail-strip-light.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/s25-scan-review-editor-light.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/s25-scan-review-gallery-dark.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/s25-scan-review-gallery-light.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/s25-scan-review-gallery-top-light.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/scan-dhg-editor.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/scan-dhg-top.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/scan-editor.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/scan-pricing-v2.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/scan-pricing-v3.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/scan-pricing.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/scan-review-redesign-proof.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/scan-review-v2.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/scan-review.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/scan-scanning-state.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/scan-v2-editor-apply.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/scan-v2-shipping.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/scan-v2-top.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/screen1-item-detail.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/screen2-create-ebay.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/screen3-create-reverb.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/screen4-listing-active.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/screen5-listing-draft.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/screenshot-2026-05-27-113151.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/scroll-audit-onboarding-clipped-844x390.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/scroll-audit-onboarding-fixed-844x390.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/seller-profile-consolidated.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/seller-profile-panel.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/stage2-bands-scan-review-dark.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/stage2-bands-scan-review-dark2.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/stage2-bands-scan-review-light.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/stage2-capture-scroll-fix-720h.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/stage2-checkpoint-pricing-settings.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/stage2-dark-input-zoom.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/stage2-review-scrolled-bottom.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/survey-01-welcome.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/survey-02-preferred.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/t1-home-authed.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/t1-home-dark.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/t1-home-state.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/t2-porter-fixed.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/t2-porter-streaming.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/t2-porter.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/t3-porter-nav.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/t3-tabbar-home.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/t4-home-dark.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/t4-home-engaged.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/t4-home-idle.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/t4-home-idle2.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/t5t6-home.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/t7-home-final.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/t7-inventory-regression.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/t8-hero-dark-toggled.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/t8-hero-light-toggle.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/screenshots/t8-toggle-light.png | delete | byte-identical duplicate of website/static/img/screenshots/ (md5-verified); website copy is canonical/referenced |
| docs/scrrenshots/.DS_Store | delete | OS litter (.DS_Store/AppleDouble); untracked; add .gitignore entries |
| docs/scrrenshots/._.DS_Store | delete | OS litter (.DS_Store/AppleDouble); untracked; add .gitignore entries |
| docs/scrrenshots/screenshots-bugs/.DS_Store | delete | OS litter (.DS_Store/AppleDouble); untracked; add .gitignore entries |
| docs/scrrenshots/screenshots-bugs/._.DS_Store | delete | OS litter (.DS_Store/AppleDouble); untracked; add .gitignore entries |
| docs/scrrenshots/screenshots-bugs/._June 18, 2026 | delete | OS litter (.DS_Store/AppleDouble); untracked; add .gitignore entries |
| docs/scrrenshots/screenshots-bugs/June 18, 2026/.DS_Store | delete | OS litter (.DS_Store/AppleDouble); untracked; add .gitignore entries |
| docs/scrrenshots/screenshots-bugs/June 18, 2026/._.DS_Store | delete | OS litter (.DS_Store/AppleDouble); untracked; add .gitignore entries |
| docs/scrrenshots/screenshots-bugs/June 18, 2026/._IMG_0495.jpeg | delete | OS litter (.DS_Store/AppleDouble); untracked; add .gitignore entries |
| docs/scrrenshots/screenshots-bugs/June 18, 2026/._IMG_0496.jpeg | delete | OS litter (.DS_Store/AppleDouble); untracked; add .gitignore entries |
| docs/secrets-guide.md | merge-into /infrastructure/doppler (docs-site) | no factual defects; 287-line DHG-wide duplicate; reduce to pointer per standing decision |
| docs/session-reports/2026-07-10-scan-outage-and-beta-bug-batch.md | keep | record verified accurate vs gh PR history; 4 reports untracked - commit |
| docs/session-reports/2026-07-11-listing-hub-execution.md | keep | record verified accurate vs gh PR history; 4 reports untracked - commit |
| docs/session-reports/2026-07-11-unlisted-fix-merge-plan-ci-review.md | keep | record verified accurate vs gh PR history; 4 reports untracked - commit |
| docs/session-reports/2026-07-13-camera-zoom-continuity.md | keep | record verified accurate vs gh PR history; 4 reports untracked - commit |
| docs/session-reports/2026-07-14-onboarding-expansion-brainstorm.md | keep | record verified accurate vs gh PR history; 4 reports untracked - commit |
| docs/session-reports/2026-07-14-photo-reorder-ship-and-beta-fixes.md | keep | record verified accurate vs gh PR history; 4 reports untracked - commit |
| docs/session-reports/2026-07-15-r0-followups-and-onboarding-build.md | keep | record verified accurate vs gh PR history; 4 reports untracked - commit |
| docs/session-reports/2026-07-15-responsive-shell-design-and-hig.md | keep | record verified accurate vs gh PR history; 4 reports untracked - commit |
| docs/session-reports/2026-07-15-responsive-shell-r0-build.md | keep | record verified accurate vs gh PR history; 4 reports untracked - commit |
| docs/superpowers/architecture/01-system-overview.svg | keep | byte-identical twin of website memory-*.svg - update in same change or de-dupe |
| docs/superpowers/architecture/02-data-lifecycle.svg | keep | byte-identical twin of website memory-*.svg - update in same change or de-dupe |
| docs/superpowers/architecture/03-feedback-loop.svg | keep | byte-identical twin of website memory-*.svg - update in same change or de-dupe |
| docs/superpowers/architecture/04-sync-phases.svg | keep | byte-identical twin of website memory-*.svg - update in same change or de-dupe |
| docs/superpowers/architecture/memory-intelligence-narrative.md | keep | companion narrative |
| docs/superpowers/designs/listing-flow-mockup.html | keep | historical design artifact |
| docs/superpowers/designs/listing-flow-mockups.zip | keep | historical design artifact |
| docs/superpowers/plans/2026-05-08-smart-listing-prepare.md | keep | historical plan record |
| docs/superpowers/plans/2026-05-08-three-interface-listing-flow.md | keep | historical plan record |
| docs/superpowers/plans/2026-05-09-decision-log.md | keep | historical plan record |
| docs/superpowers/plans/2026-05-09-memory-intelligence.md | keep | historical plan record |
| docs/superpowers/plans/2026-05-09-session-briefing.md | keep | historical plan record |
| docs/superpowers/plans/2026-07-11-listing-hub-merge.md | keep | historical plan record |
| docs/superpowers/plans/2026-07-14-onboarding-expansion.md | keep | add EXECUTED banner (shipped PR #231); file is untracked - commit it |
| docs/superpowers/plans/2026-07-15-responsive-shell.md | keep | add EXECUTED banner (R0 shipped PR #229) |
| docs/superpowers/specs/2026-04-25-shipping-and-listing-terms-design.md | keep | historical spec record (all dated+statused) |
| docs/superpowers/specs/2026-05-07-ebay-listing-flow-design.md | keep | historical spec record (all dated+statused) |
| docs/superpowers/specs/2026-05-08-smart-listing-prepare-design.md | keep | historical spec record (all dated+statused) |
| docs/superpowers/specs/2026-05-08-three-interface-listing-flow-design.md | keep | historical spec record (all dated+statused) |
| docs/superpowers/specs/2026-05-09-decision-log-design.md | keep | historical spec record (all dated+statused) |
| docs/superpowers/specs/2026-05-09-memory-intelligence-design.md | keep | historical spec record (all dated+statused) |
| docs/superpowers/specs/2026-05-09-session-briefing-design.md | keep | historical spec record (all dated+statused) |
| docs/superpowers/specs/2026-06-27-ebay-trade-first-refactor-design.md | keep | historical spec record (all dated+statused) |
| docs/superpowers/specs/2026-07-13-photo-reorder-24cap-design.md | keep | historical spec record (all dated+statused) |
| docs/superpowers/specs/2026-07-14-onboarding-expansion-design.md | keep | historical spec record (all dated+statused) |
| docs/superpowers/specs/2026-07-15-responsive-shell-design.md | keep | historical spec record (all dated+statused) |
| docs/trade-first-burndown.md | fix | header says open items; body says all closed — stamp COMPLETE, archive |
| docs/voice-chat-mockups/01-home-default.html | delete | voice feature removed 2026-07-01; era preserved at tag voice-parked-2026-07 |
| docs/voice-chat-mockups/02-home-engaged.html | delete | voice feature removed 2026-07-01; era preserved at tag voice-parked-2026-07 |
| docs/voice-chat-mockups/03-full-chat.html | delete | voice feature removed 2026-07-01; era preserved at tag voice-parked-2026-07 |
| docs/voice-chat-mockups/04-voice-states.html | delete | voice feature removed 2026-07-01; era preserved at tag voice-parked-2026-07 |
| docs/voice-chat-mockups/05-floating-mic.html | delete | voice feature removed 2026-07-01; era preserved at tag voice-parked-2026-07 |
| docs/voice-chat-mockups/home-screen-concept.html | delete | voice feature removed 2026-07-01; era preserved at tag voice-parked-2026-07 |
| docs/voice-chat-mockups/index.html | delete | voice feature removed 2026-07-01; era preserved at tag voice-parked-2026-07 |
| docs/voice-chat-mockups/porter-home-redesign.html | delete | voice feature removed 2026-07-01; era preserved at tag voice-parked-2026-07 |
| docs/voice-chat-mockups/scan-review-redesign.html | delete | voice feature removed 2026-07-01; era preserved at tag voice-parked-2026-07 |
| docs/voice-chat-mockups/screenshots/00-index.png | delete | voice feature removed 2026-07-01; era preserved at tag voice-parked-2026-07 |
| docs/voice-chat-mockups/screenshots/01-home-default.png | delete | voice feature removed 2026-07-01; era preserved at tag voice-parked-2026-07 |
| docs/voice-chat-mockups/screenshots/02-home-engaged.png | delete | voice feature removed 2026-07-01; era preserved at tag voice-parked-2026-07 |
| docs/voice-chat-mockups/screenshots/03-full-chat.png | delete | voice feature removed 2026-07-01; era preserved at tag voice-parked-2026-07 |
| docs/voice-chat-mockups/screenshots/04-voice-states.png | delete | voice feature removed 2026-07-01; era preserved at tag voice-parked-2026-07 |
| docs/voice-chat-mockups/screenshots/05-floating-mic.png | delete | voice feature removed 2026-07-01; era preserved at tag voice-parked-2026-07 |
| docs/voice-chat-mockups/voice-chat-concept.html | delete | voice feature removed 2026-07-01; era preserved at tag voice-parked-2026-07 |

### Repo-root markdown — 8 files

| File | Verdict | Basis |
|---|---|---|
| CLAUDE.md | fix | nav line says 6-tab w/ More (code: 5 tabs + Scan, verified tab-bar.tsx:12-18); 51/52 vs TODO 50/52; forest-green presented as canonical |
| ONBOARDING.md | fix | Etsy; 238-test count (~450 stale); JWT+refresh auth claim; committed demo creds |
| README.md | rewrite | public face: Etsy pitch, bcrypt/refresh-token auth, WASM bg-removal, 5-tab-wrong-tabs, dead demo creds, broken features link, no CF Access in quick start |
| TO-DOS.md | delete | 2026-05-10 scratch; items resolved or belong to other repos |
| findings.md | delete | completed 2026-04 Doppler-migration planning artifact; carries org-infra survey data that doesn't belong in repo root |
| progress.md | delete | completed planning artifact ('Awaiting user review' for finished work) |
| task_plan.md | delete | completed planning artifact, 100% unchecked boxes for done work |
| whats-next.md | keep | gitignored session-handoff scratch; designed lifecycle; no action |

### website/static/img (graphics disposition) — 222 files

| File | Verdict | Basis |
|---|---|---|
| website/static/img/architecture-data-flow.svg | recreate | teaches pre-CF-Access password auth, 3 containers, 16 tables, Etsy live, carrier pending, Claude-primary, 5-tab-old - referenced as current by architecture/overview.md:13,17 |
| website/static/img/architecture-system-overview.svg | recreate | teaches pre-CF-Access password auth, 3 containers, 16 tables, Etsy live, carrier pending, Claude-primary, 5-tab-old - referenced as current by architecture/overview.md:13,17 |
| website/static/img/docusaurus.png | delete | stock Docusaurus scaffold asset, unreferenced |
| website/static/img/ebay-trade-first-architecture-dark.svg | keep+wire | accurate vs Trade-First (PR #133) but unreferenced; wire into marketplace-adapters.md via ThemedImage |
| website/static/img/ebay-trade-first-architecture.svg | keep+wire | accurate vs Trade-First (PR #133) but unreferenced; wire into marketplace-adapters.md via ThemedImage |
| website/static/img/ebay-trade-first-phases-dark.svg | keep+wire | accurate vs Trade-First (PR #133) but unreferenced; wire into marketplace-adapters.md via ThemedImage |
| website/static/img/ebay-trade-first-phases.svg | keep+wire | accurate vs Trade-First (PR #133) but unreferenced; wire into marketplace-adapters.md via ThemedImage |
| website/static/img/ebay-trade-first-pipeline-dark.svg | keep+wire | accurate vs Trade-First (PR #133) but unreferenced; wire into marketplace-adapters.md via ThemedImage |
| website/static/img/ebay-trade-first-pipeline.svg | keep+wire | accurate vs Trade-First (PR #133) but unreferenced; wire into marketplace-adapters.md via ThemedImage |
| website/static/img/ebay-trade-first-workflow-dark.svg | keep+wire | accurate vs Trade-First (PR #133) but unreferenced; wire into marketplace-adapters.md via ThemedImage |
| website/static/img/ebay-trade-first-workflow.svg | keep+wire | accurate vs Trade-First (PR #133) but unreferenced; wire into marketplace-adapters.md via ThemedImage |
| website/static/img/memory-data-lifecycle.svg | update | structurally accurate; stale counts (7-vs-9 briefing sections, 23 files, 37/52); sync docs/superpowers twin |
| website/static/img/memory-feedback-loop.svg | update | structurally accurate; stale counts (7-vs-9 briefing sections, 23 files, 37/52); sync docs/superpowers twin |
| website/static/img/memory-sync-phases.svg | update | structurally accurate; stale counts (7-vs-9 briefing sections, 23 files, 37/52); sync docs/superpowers twin |
| website/static/img/memory-system-overview.svg | update | structurally accurate; stale counts (7-vs-9 briefing sections, 23 files, 37/52); sync docs/superpowers twin |
| website/static/img/screenshots/bp-01-demo-notenrolled.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/bp-02-enrolling.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/bp-03-optout-modal.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/bp-04-dark-readable.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/bp-05-back-header.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/capture-sheet-open.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/checkpoint-1-review-aspects-complete-collapsed.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/checkpoint-2-aspects-complete-category-line.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/checkpoint-3-aspects-expanded-optional.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/checkpoint-4-aspect-chips-suggestion.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/checkpoint-5-required-missing-disabled-list.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/checkpoint-6-required-brand-error-highlight.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/conv-scanning.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/conv-step1.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/crit-00-login.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/crit-01-home.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/crit-02-inventory.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/crit-03-orders.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/crit-04-more.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/crit-05-scan-flow.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/crit-05-scan.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/crit-06-detail-vp.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/crit-06-detail.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/dark-home-real.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/dashboard-authenticated.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/dashboard-unauthenticated.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/dashboard-with-fab.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/dev-steps-camera.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/dev-steps-conversational.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/dev-steps-hybrid.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/dev-steps-swipe.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/final-conversational.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/final-hybrid.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/final-swipe.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/funnel-path-verified.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/glass-scrolled.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/glass-top.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/greet-oneline.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/inventory-with-fab.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/list-page-authed.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/list-page-live.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/list-page-mobile.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/list-page-restarted.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/list-page-with-capture.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/list-page.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/listing-flow-duplicate-fields-390x844.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/phase5-dark-1-complete.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/phase5-dark-2-blocked.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/phase5-dark-3-unblocked.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/phaseA-session-lost-redirect-home.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/phaseB-scan-review-weight-category-live.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/phaseC-hybrid-collapsed-details-live.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/phaseC-no-label-yet-stub-live.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/phaseC-saved-as-draft-real-reason-live.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/photo-capture-overlay.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/porter-dhg-tabbar.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/porter-dhg.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/porter-hero-fixed.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/redesign-full.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/redesign-viewport.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/root-redirect.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/s25-item-detail-editor-overlay.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/s25-item-detail-strip-light.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/s25-scan-review-editor-light.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/s25-scan-review-gallery-dark.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/s25-scan-review-gallery-light.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/s25-scan-review-gallery-top-light.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/scan-dhg-editor.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/scan-dhg-top.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/scan-editor.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/scan-pricing-v2.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/scan-pricing-v3.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/scan-pricing.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/scan-review-redesign-proof.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/scan-review-v2.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/scan-review.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/scan-scanning-state.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/scan-v2-editor-apply.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/scan-v2-shipping.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/scan-v2-top.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/screen1-item-detail.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/screen2-create-ebay.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/screen3-create-reverb.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/screen4-listing-active.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/screen5-listing-draft.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/screenshot-2026-05-27-113151.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/scroll-audit-onboarding-clipped-844x390.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/scroll-audit-onboarding-fixed-844x390.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/seller-profile-consolidated.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/seller-profile-panel.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/stage2-bands-scan-review-dark.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/stage2-bands-scan-review-dark2.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/stage2-bands-scan-review-light.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/stage2-capture-scroll-fix-720h.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/stage2-checkpoint-pricing-settings.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/stage2-dark-input-zoom.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/stage2-review-scrolled-bottom.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/survey-01-welcome.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/survey-02-preferred.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/t1-home-authed.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/t1-home-dark.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/t1-home-state.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/t2-porter-fixed.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/t2-porter-streaming.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/t2-porter.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/t3-porter-nav.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/t3-tabbar-home.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/t4-home-dark.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/t4-home-engaged.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/t4-home-idle.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/t4-home-idle2.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/t5t6-home.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/t7-home-final.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/t7-inventory-regression.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/t8-hero-dark-toggled.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/t8-hero-light-toggle.png | keep | referenced by appendix/screenshots.md |
| website/static/img/screenshots/t8-toggle-light.png | keep | referenced by appendix/screenshots.md |
| website/static/img/sitemap/portage-sitemap-admin-collapsed.svg | regenerate | route data stale: missing /tutorials, /tutorials/[topic], /inventory/[id]/preview; 10-vs-11 admin label |
| website/static/img/sitemap/portage-sitemap-vertical.svg | regenerate | route data stale: missing /tutorials, /tutorials/[topic], /inventory/[id]/preview; 10-vs-11 admin label |
| website/static/img/sitemap/portage-sitemap.pdf | regenerate | route data stale: missing /tutorials, /tutorials/[topic], /inventory/[id]/preview; 10-vs-11 admin label |
| website/static/img/sitemap/portage-sitemap.svg | regenerate | route data stale: missing /tutorials, /tutorials/[topic], /inventory/[id]/preview; 10-vs-11 admin label |
| website/static/img/verification/camera-device-picker/1-builtin-red.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/camera-device-picker/2-picker-open.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/camera-device-picker/3-iphone-blue.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/camera-device-picker/4-reload-still-iphone.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/camera-zoom/1-chips-1x.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/camera-zoom/2-zoomed-2x.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/camera-zoom/3-zoomed-3x.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/camera-zoom/4-captured-at-2x.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/f4-publish-result/f4-result-draft.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/f4-publish-result/f4-result-listing.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/fresh-scan/1-recognition.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/fresh-scan/2-preview-card.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/fresh-scan/3-inventory-unlisted.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/gtc/01-toggle-flipped.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/gtc/02-toggle-persisted-after-reload.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/gtc/03-detail-gtc-date.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/inline-edit/1-readonly.png | keep | referenced by development/frontend-e2e-verification.md |
| website/static/img/verification/inline-edit/2-editing.png | keep | referenced by development/frontend-e2e-verification.md |
| website/static/img/verification/inline-edit/3-saved.png | keep | referenced by development/frontend-e2e-verification.md |
| website/static/img/verification/inline-edit/4-persisted-after-reload.png | keep | referenced by development/frontend-e2e-verification.md |
| website/static/img/verification/listing-hub/01-item-hub-full.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/listing-hub/02-deeplink-highlight.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/listing-hub/03-archive-confirm-sheet.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/listing-hub/04-edit-shared-notice.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/listing-hub/05-listings-tab.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/listing-hub/06-old-url-redirected.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/listing-hub/07-preview-page.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/listing-hub/08-draft-card-actions-small.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/listing-hub/08-draft-card-actions.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/listing-hub/1-section.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/listing-hub/2-deeplink.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/listing-hub/3-price-edited.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/listing-hub/5-actions-gtc.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/listing-hub/6-redirect-landed.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/listing-hub/8-preview-real-item.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/listing-hub/9-shared.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/optimizer/1-optimizer-rendered.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/optimizer/2-after-reload.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/orders-sync/orders-imported-live.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/orders-sync/orders-sync-clean.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/orders-sync/orders-sync-error-banner.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/photo-gallery/pg-1-strip.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/photo-gallery/pg-2-editor-overlay.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/photo-gallery/pg-3-strip-after-reload.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/photo-gallery/pg-4-strip-dark.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/photo-gallery/pg-5-editor-dark.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/photo-gallery/pg-6-listing-compact-editor.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/photo-reorder-24cap/pr-1-before.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/photo-reorder-24cap/pr-2-sheet.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/photo-reorder-24cap/pr-3-after-drag.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/photo-reorder-24cap/pr-4-persisted.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/photo-reorder-24cap/pr-5-deleted.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/photo-tools/bg-1-inline-processing.png | keep | referenced by development/frontend-e2e-verification.md |
| website/static/img/verification/photo-tools/bg-2-before-after-preview.png | keep | referenced by development/frontend-e2e-verification.md |
| website/static/img/verification/photo-tools/bg-3-white-persisted-after-reload.png | keep | referenced by development/frontend-e2e-verification.md |
| website/static/img/verification/photo-tools/exposure-1-slider.png | keep | referenced by development/frontend-e2e-verification.md |
| website/static/img/verification/photo-tools/exposure-2-applied.png | keep | referenced by development/frontend-e2e-verification.md |
| website/static/img/verification/photo-tools/exposure-3-persisted-after-reload.png | keep | referenced by development/frontend-e2e-verification.md |
| website/static/img/verification/ship1-phase6/ship1-deferrals-light.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/ship1-phase6/ship1-home-light-real.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/ship1-phase6/ship1-home-light.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/ship1-phase6/ship1-nodefer-dark.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/ship1-phase6/ship1-nodefer-light.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/ship1-phase6/ship1-orb-check1.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/ship1-phase6/ship1-porter-activedot.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/ship1-phase6/ship1-porter-light.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/ship1-phase6/ship1-tabbar-dark-inventory.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/sold-list/live-more-no-shipping.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/sold-list/live-order-detail-fees-fixed.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/sold-list/live-order-detail.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/sold-list/live-sold-list.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/sold-list/ship-page-404.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/sold-list/sold-list-rows-after-reload.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/sold-list/sold-list-rows.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/square-capture/1-viewfinder.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/square-capture/1b-multishot-done.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/square-capture/pg-2b-crop-panzoom.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/tutorials/carousel-laststep-375x667.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/tutorials/carousel-step1-375x667.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/tutorials/tutorials-hub.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/tutorials/tutorials-topic-playing.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/voice-removal/voice-gone-home.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/voice-removal/voice-gone-inventory.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/voice-removal/voice-gone-porter-text-chat.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/weight-capture/weight-1-editing.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |
| website/static/img/verification/weight-capture/weight-2-persisted-after-reload.png | keep-unlinked | unreferenced PR-proof artifact; disposition pending Stephen (index page vs prune) - open question |

**Row counts:** website/docs 99 · docs/ 235 · root md 8 · img 222 · **total 564**. Unassigned rows: 0 (must be 0).

