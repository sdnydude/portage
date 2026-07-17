# Adversarial tree review — findings report (Phase 0 of docs-refresh landing)

Reviewed: 2026-07-17, six parallel Fable review slices + orchestrating-agent cross-checks. Scope: the uncommitted docs-refresh working tree (57 M / 14 D / 36 ?? paths). Coverage: **105 of 107 changed paths** (see §Coverage). Nothing edited during review. Every finding carries ground-truth evidence read/run in-session. Disposition column filled by the Phase 1 fix pass.

**One-line verdict:** new content (infra/frontend/reference pages, 14 diagrams) is clean — the escaped-defect class concentrates in README.md (8 more instances) plus a stale pre-R0 nav/WASM cluster in three deployed pages, i.e. exactly the Q1/Q3-skipped files.

## HIGH — public-facing false capability/feature claims

| # | Location | Defect | Ground truth | Fix | Disposition |
|---|---|---|---|---|---|
| 1 | README.md:13 | "Claude Vision identifies items" | VISION_PROVIDERS chain, Gemini 2.5 primary / Claude fallback (apps/api/src/lib/env.ts:12, ai-client.ts:129) | "AI vision (Gemini 2.5 primary, Claude fallback)" | **FIXED** — README vision line → provider chain (Gemini 2.5 primary), verified env.ts:12 + ai-client.ts:129 |
| 2 | README.md:15 | "eBay, Etsy, and Reverb adapters" | Etsy parked/removed 2026-07-09; MARKETPLACE_TYPES = ['ebay','reverb'] | "eBay and Reverb adapters" | **FIXED** — eBay + Reverb, verified constants.ts MARKETPLACE_TYPES |
| 3 | README.md:33 | "Auth: JWT + refresh tokens, bcrypt" | CF Access IdP + 15-min internal JWT, no passwords (jwt.ts:14, PRs #168–172) | Rewrite stack row | **FIXED** — stack row → CF Access IdP + 15-min internal JWT, verified jwt.ts:14 |
| 4 | README.md:14, :36 | "background removal (WASM)" / "@imgly (WASM)" | Server-side portage-rembg (images.ts:287) | Fix both | **FIXED** — both lines → server-side portage-rembg, verified images.ts:217/:287 |
| 5 | README.md:35 | "AI: Claude Sonnet (vision + tool_use)" | Vision Gemini-primary; Claude = Porter/fallback | Split row | **FIXED** — row split vision-chain vs Porter (Claude Sonnet) |
| 6 | README.md:38 | "eBay (REST), Etsy (REST + PKCE), Reverb (PAT)" | eBay = Trading API Trade-First (PR #133); Etsy gone | "eBay (Trading API), Reverb (PAT)" | **FIXED** — eBay (Trading API, Trade-First), Reverb (PAT) |
| 7 | README.md:87 | Tree comment "eBay + Etsy adapters" | — | "eBay + Reverb adapters" | **FIXED** — tree comment → eBay + Reverb |
| 8 | README.md:125 | "Five-tab … Inventory, Listings, Porter, Orders, More" | Tabs = Home/Inventory/Listings/Porter/Orders (navigation.ts:7-13); More is avatar/menu | Fix list | **FIXED** — canonical 5-tab + Scan phrase, verified navigation.ts:7-18 |
| 9 | website/docs/design/style-guide.md:766-768 | Phantom "BgRemovalPanel" + client-side WASM claim | Component doesn't exist; server-side POST /images/remove-bg; @imgly = dead dep (zero imports) | Replace with server-side flow via use-bg-removal.ts | **FIXED** — replaced with real server flow (useBgRemoval → POST /images/remove-bg); BgRemovalPanel grep-confirmed nonexistent |
| 10 | website/docs/architecture/overview.md:37 | "5-tab (Home, Inventory, Camera FAB, Orders, More)" | Wrong labels, missing Listings/Porter | "(Home, Inventory, Listings, Porter, Orders) + center Scan" | **FIXED** — canonical nav phrase; responsive-shell para + Trade-First decision links added (E7) |
| 11 | website/docs/frontend/app-structure.md:17 (+19-27) | "6-tab" with /more as tab | 5 tabs; /more avatar/menu-reached | Fix count + footnote | **FIXED** — 5-tab + avatar-menu footnote; E4 R0 rewrite (AppShell/Sidebar/TopBar, routes, HIG cite, 2026-07-17 stamp) |
| 12 | website/docs/design/style-guide.md:599-611 | "6 tabs", More in Right column | Same | Same fix (root CLAUDE.md:151 same claim — likely copy source) | **FIXED** — style-guide TabBar table → 5 tabs; root CLAUDE.md:151 copy source fixed in same pass |

## MEDIUM

| # | Location | Defect / fix | Disposition |
|---|---|---|---|
| 13 | api/error-handling.md:34 | 403 FORBIDDEN = cross-user ownership only (items.ts:673,700,752); role/plan = ADMIN_REQUIRED/PRO_REQUIRED (middleware/auth.ts:37,48) | **FIXED** — FORBIDDEN = cross-user ownership; ADMIN_REQUIRED/PRO_REQUIRED noted, verified items.ts + middleware/auth.ts |
| 14 | api/marketplace.md:91 | Etsy publish → Zod enum 400 VALIDATION_ERROR (listings.ts:173), not MARKETPLACE_UNSUPPORTED (legacy-row path only, zero rows) | **FIXED** — Etsy publish → 400 VALIDATION_ERROR (Zod enum listings.ts:173); MARKETPLACE_UNSUPPORTED = legacy-row only |
| 15 | api/porter.md:87 | blocks: ContentBlock[] true for /porter/stream only; /porter/message writes legacy {role,content} (porter.ts:463-482) | **FIXED** — blocks[] documented for /porter/stream only; /porter/message legacy {role,content} (porter.ts:463-482) |
| 16 | frontend/scan-flow.md:59-78 | /scan/refine example fields wrong: estimatedValueLow/High (no median), confidence 0–1, reasoning: string[] (lib/vision.ts:53-75) | **FIXED** — example rewritten to estimatedValueLow/High, confidence 0–1, reasoning: string[] (vision.ts:52-77) |
| 17 | development/code-graph.md:11-12 | Stale counts 2,536/3,819 nodes/edges + 716 articles vs 4,875/6,775/722 today; contradicts refreshed line 22 | **FIXED** — re-derived from disk: 4,875 nodes / 6,775 edges (graph.json), 712 communities (GRAPH_REPORT.md), 722 wiki articles; dated 2026-07-17 |
| 18 | reference/ebay-ato-and-publish-hardening.md:109-110 | Archive path deleted this pass — correct or remove | **FIXED** — archive-path text past-tensed (dir confirmed gone); banner already linked ebay-trade-first + marketplace-adapters |
| 19 | architecture/ai-pipeline.md:61 + features.md:30 | "Porter … Claude Sonnet" → "chat-provider chain (Claude Sonnet in prod)" (CHAT_PROVIDERS, porter.ts:9,361) | **FIXED** — both files → chat-provider chain (CHAT_PROVIDERS, Claude Sonnet in prod), verified env.ts:13 + porter.ts:9/:361 |
| 20 | docs/TODO.md | Header stale (50/52, 2026-07-09); R0 rows :339-374 unchecked though #229/#231 merged; :402-404 repeats Claude-vision + @imgly claims | **FIXED** — header recounted 48/49 (arithmetic in edit-pass log), date + test-suite stamp 2026-07-17, R0 rows checked (#229), R1 in-flight (#237), summary table reconciled, tech-stack AI/BG rows corrected, ports table +7000/+8018 |
| 21 | apps/web/CLAUDE.md:9,15 | (tabs)/ tree lists more/ as bottom-nav page, contradicts own :25 + navigation.ts | **FIXED** — more/ re-annotated as avatar-menu Settings hub, tree consistent with navigation.ts |
| 22 | docs/trade-first-burndown.md:7-11 | Live imperative "next session's FIRST action…" below COMPLETE banner — agent-trap; past-tense it | **FIXED** — imperative rewritten as past-tense historical record; 'nothing below is actionable' added |
| 23 | infra-secrets-path.svg + -dark | REGISTRY_URL listed in env.ts Zod box — not in env.ts (raw read at beta.ts:11). Only defect in all 14 diagrams | **FIXED** — REGISTRY_URL → STRIPE_* (genuinely in env.ts Zod, :43-47) in BOTH SVGs; light/dark label parity re-verified byte-equal |

## LOW (precision/drift)

api/images.md (origin examples, ItemPhoto optionality, `_enhanced` keys) · api/overview.md:9,:70 (CSV/ZIP not JSON; /health liveness-only) · api/authentication.md:118 (accounts wrapper) · api/listings.md:73,:136 (ItemID not SKU; item-columns-win) · api/orders.md:88-96 (errors key) · api/scan.md:22 (image/heif) · api/marketplace.md:70 (Reverb limiter) · environment-variables.md (WEB_PORT missing; compose/dev-only vars unlabeled) · architecture/database.md:83,:125 (schema misquote; sql.raw absolute) · frontend/listing-flow.md:53 (confirmRecognition(index)) · frontend/app-structure.md:82 (R0 shell files missing) · style-guide.md:561 (ScanFab z-index) · PORTAGE_HISTORY.md:5 (present-tense Etsy) · ADMIN_PLAN.md 6 lines (Etsy-as-live; widen banner) · TODO.md:408-416 (ports table missing :8018, :7000) · .env.example APP_URL duplicate (pre-existing, edit-pass Flag 3)

**Disposition (all 16 LOW items): FIXED 2026-07-17**, each verified against the cited code at edit time. Deviations worth noting: environment-variables.md — WEB_PORT verified consumed **nowhere** (compose hard-codes `3002:3000`; dev script passes `--port 3002`), so the row documents it as an .env.example convention rather than inventing a consumer; api/listings.md "item-columns-win" text had drifted to the PATCH section and was fixed there (located by content); style-guide.md:561 — the ScanFab z-index row was **deleted** rather than corrected (scan-fab.tsx has zero imports; the Scan button is inline in TabBar); ADMIN_PLAN.md fixed via widened banner (all 6 Etsy mentions are illustrative plan content); api/orders.md errors-key example was already correct — element shape + no-accounts early-return added for precision.

## Side findings — code, NOT this landing (register deferred)

- porter.ts:26 — system prompt names nonexistent tool `get_value_estimate` (real: search_inventory, get_inventory_stats, suggest_listing) — **NOT TOUCHED (code; registered deferred)**
- apps/web/package.json:17 — @imgly/background-removal dead dep (pairs with audit Q15) — **NOT TOUCHED (code; registered deferred)**
- apps/api/src/lib/env.ts:41 — EASYPOST_API_KEY dead schema key (carrier deleted PR #142) — **NOT TOUCHED (code; registered deferred)**
- Root CLAUDE.md stale ×2 (docs-scope, fixable this landing): portage-rembg IS host-published 7000:7000 (docker-compose.yml:110-111); VISION_PROVIDERS consumed in ai-client.ts, not vision.ts — **FIXED 2026-07-17** (Services table port → 7000; AI section reworded, both verified)

## Deletion-safety verdict: SAFE

Zero inbound references to any of the 14 deleted paths (grep-swept twice, independently). Residuals: (a) 6 leftover untracked PNGs in docs/voice-chat-mockups/screenshots/ marked delete by audit, still on disk — delete — **DONE 2026-07-17** (reference-grep clean, dir removed); (b) 4 orphan ship-log dupes intentionally remain (E28, Q2 workstream) — **ACCEPTED**: still parked on Q2.

## SVG verdict: PASS (one fix — finding 23)

All 14 diagrams label-verified vs compose/infra/schema/workflow; database-er matches all 18 tables 1:1; light/dark parity byte-identical across 7 pairs. Sitemap regen counts exact. Caveats: text-label verification only; sitemap PDF binary not inspected. Flag: 14 verification PNGs (1.6 MB) sit under deployed static/ — disposition per Q4 spirit: move to non-deployed archive — **DONE 2026-07-17**: moved to docs/verification-archive/docs-refresh/ with the Q4 sweep (90 files total moved; inline-edit + photo-tools sets stayed — referenced by development/frontend-e2e-verification.md).

## Coverage

105/107: all 57 modified (2 long superpowers plans banner-verified + pattern-grepped only; audit appendix tail skimmed), all 14 deletions, all deploying untracked content in full. Not reviewed: prompts/completed, research/ (3 files), infra/graph-explore/graph.html (pre-existing, outside program, credential-swept clean). Not verifiable from repo: prod Doppler provider values; /sync-memory internals; history.md 2026-05 PR table (sampled #51; all other cited PRs gh-verified).
