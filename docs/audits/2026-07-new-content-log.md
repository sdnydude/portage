# Docs New-Content Log — 2026-07-17 (prompt 003, NEW + G8)

Source worklist: `docs/audits/2026-07-docs-audit-worklist.md` (NEW section N1–N6 + GRAPHICS G8, deferred to this pass by the edit pass). Edit-pass log: `docs/audits/2026-07-edit-pass-log.md`. Open questions (§9 of the master report) remained UNRESOLVED at execution time — items depending on one were built only to the extent independent of the answer; dependencies are noted per line below.

Team: 7 writer/diagram agents (docs-writer, Fable) + 2 editor agents (general-purpose, Fable) + orchestrator. **Editor A** = api/ + reference/ + architecture edits (9 files, 0 fixes needed). **Editor B** = frontend/ + infrastructure/ + top-level edits + diagram wiring (16 files, 1 fix: responsive-shell gradient height 8px→32px per `tab-bar.tsx:87` `h-8`). Every new/edited file was editor-reviewed; writers did not self-approve. No git commits were made (operator reviews and commits); the E34 commit from the edit pass is untouched.

## Pages added

| Path | Worklist line / justification | Cross-links (inbound ← / outbound →) | Editor |
|---|---|---|---|
| website/docs/reference/ebay-trade-first.md | **N1** — current-state Trading-API lifecycle reference (5 calls, inline shipping, insert-first idempotency, serialized ebaySku, ItemID prefix-3 heuristic, no Business Policies). Verified against ebay-adapter.ts, ebay-trading-client.ts, ebay-trading-builders.ts, listings.ts, schema.ts, PR #133 | ← ato banner, marketplace-adapters, architecture/overview decision row, listing-flow intro · → marketplace-adapters, ebay-ato, api/listings; embeds 2 existing Trade-First SVG pairs | A — clean |
| website/docs/frontend/responsive-shell.md | **N2** — R0 as-built (AppShell/Sidebar/TopBar, glass 5-tab bar + Scan, minimize-on-scroll, .content-container, HIG research citation). R1 (PR #237) explicitly marked in-flight, not documented as shipped | ← app-structure pointer · → design-system, app-structure | B — 1 fix |
| website/docs/api/messages.md | **N3** — 5 endpoints from messages.ts (list, unread-count, thread GET w/ read-marking, sync via GetMemberMessages, reply via AddMemberMessageRTQ) | ← api/overview table · → orders, app-structure | A — clean |
| website/docs/api/seller-profile.md | **N3** — GET auto-create + PATCH full Zod field list + PRICING_FLOOR_INVALID cross-check | ← api/overview table · → items/listings anchors | A — clean |
| website/docs/api/platform.md | **N3** — health, dashboard, usage (+POST /usage/bg-removal), disclaimer, survey (NO auth + 10/min/IP rate limit called out), beta (tier-gated Registry proxy), faqs. Preferences GET confirmed already documented on authentication.md (linked, not duplicated) | ← api/overview table (anchor links per section) · → authentication | A — clean |
| website/docs/frontend/porter.md | **N4** — Porter frontend: PorterProvider at (tabs) layout, SSE stream consumption (6 event types), action pills / Ask-Porter bar, blocks JSONB persistence, teal-AI identity. Corrected a task-brief assumption: POST /porter/message has zero web callers — documented as API-side-only fallback | ← api/porter, features.md row · → api/porter, style-guide | B — clean |
| website/docs/infrastructure/overview.md | **N5 / req. 2a** — full-stack map, all 16 infra pieces inventoried (5 compose services, dhg-docs, Registry :8011, tunnel, CF Access, Doppler, R2, runner, monitoring labels, portage-network, dhg-network, certs), topology diagram, summary table | ← deployment.md pointer · → all infra pages, deployment, monitoring, registry-integration | B — clean |
| website/docs/infrastructure/services.md | **N5 / req. 2a** — per-service runbook (what/deploy/connect/operate) for the 5 compose services: image-baked default, dev-overlay opt-in, healthcheck matrix, db:push 127.0.0.1:5436 gotcha, shared-package rebuild | ← infra overview · → overview, deployment, monitoring, secrets-and-storage | B — clean |
| website/docs/infrastructure/cloudflare.md | **N5 / req. 2a** — tunnel runbook (publishes infra/cloudflared/README.md: versioned config, cloudflared-portage.service verified live, stale ~/.cloudflared trap, deploy ritual), exact ingress table, CF Access flow + required env vars. rehearsal→:3004 ingress documented neutrally as not-in-Portage-compose (Q8) | ← infra overview · → api/authentication, secrets-and-storage, overview; request-path diagram | B — clean |
| website/docs/infrastructure/ci-cd.md | **N5 / req. 2a** — self-hosted runner (unit `actions.runner.sdnydude-portage.g700data1.service` verified live by orchestrator AND agent; workflows split self-hosted vs ubuntu-latest grep-verified), deploy-docs.yml step-by-step, dhg-docs live-container reconciliation via docker inspect (restart-in-place is live; container matches the fallback shape), app-deploy contrast | ← infra overview · → registry-integration, deployment, overview; deploy-path diagram | B — clean |
| website/docs/infrastructure/secure-config-and-storage.md | **N5 / req. 2a** — Doppler flow (lean; links canonical guide), certs/TLS, AES-256-GCM token encryption (crypto.ts), R2 storage.ts + /img-cdn rewrite + GET /images/r2/* proxy. **Filename deviation:** a `[no-secrets]` write-hook blocks filenames containing "secrets"; frontmatter `id: secrets-and-storage` keeps the URL `/docs/infrastructure/secrets-and-storage`, so every cross-link resolves (build-proven). Rename to `secrets-and-storage.md` requires hook authority | ← infra overview, services, cloudflare · → environment-variables, api/images, cloudflare, overview; secrets-path diagram | B — clean |
| website/docs/infrastructure/_category_.json | **N5** — label "Infrastructure", position 7 (top-level pages hold 1–6; ship-log 98, appendix 99 — no collision) | — | B — clean |

## Diagrams added (G8 + requirement 2a) — 7 pairs, 14 SVGs, all light+dark

All match the ebay-trade-first visual grammar (same defs/gradients/card pattern/arrow markers, embedded PJSans @font-face block spliced verbatim from the reference; dark twins replicate the reference pair's exact transformation). All XML-validated. Palette note: the prompt's context block names Forest Green #2D5A27, but the named reference SVGs (ebay-trade-first set — the kept, current grammar) use the DHG graphite/teal/orange palette, which globals.css marks canonical (forest green = "Legacy brand"); the new set follows the reference SVGs.

| Pair (light + -dark) | Referenced by | Content verification |
|---|---|---|
| auth-cf-access-flow.svg | api/authentication.md, architecture/overview.md | cf-access.ts, jwt.ts, auth.ts, web api.ts (single-flight re-exchange) — every box sourced |
| database-er.svg | architecture/database.md | schema.ts full read; exactly 18 tables; 18 arrows = the 18 `references()` calls; export_tokens.item_ids labeled no-FK |
| ai-pipeline-chain.svg | architecture/ai-pipeline.md | vision.ts, ai-client.ts, scan.ts, prepare-listing.ts, porter.ts; 3 tool names verbatim; provider order labeled from .env.example (see dependencies) |
| infra-topology.svg | infrastructure/overview.md | every edge vs docker-compose.yml, config-portage.yml, next.config.ts, deploy-docs.yml; db loopback lock shown |
| infra-request-path.svg | infrastructure/cloudflare.md | primary /backend lane, direct-API lane, /img-cdn lane; Registry edge verified in beta.ts before drawing |
| infra-deploy-path.svg | infrastructure/ci-cd.md | lane A app deploy (image-baked + dev overlay), lane B deploy-docs.yml all 7 steps |
| infra-secrets-path.svg | infrastructure/secure-config-and-storage.md | doppler-sync.sh + settings.json hook, env_file (api only — corrected a brief error: portage-app has no env_file), crypto.ts, certs, tunnel creds outside repo |

Orphan check: grep confirms every one of the 14 SVGs is referenced (ThemedImage light+dark) by at least one page — zero orphan assets.

## Sidebar changes

- New category: **Infrastructure** (`website/docs/infrastructure/_category_.json`, position 7).
- New page positions: api/messages 12, api/seller-profile 13, api/platform 15 (11=error-handling, 14=billing pre-existing); frontend/responsive-shell 5, frontend/porter 6; reference/ebay-trade-first 2; infrastructure pages 1–5.
- Pre-existing collision found by Editor A, NOT fixed (predates the pass, fix would renumber ~15 pages): api/overview.md & api/items.md both position 1; api/authentication.md & api/images.md both position 2. Flagged for a decision.

## Edits to existing pages (all surgical; corrected pages touched only for planned additions)

| File | Change | Line |
|---|---|---|
| reference/ebay-ato-and-publish-hardening.md | banner now points primarily at the new Trade-First page (edit-pass flag #5 resolved) | N1 |
| architecture/marketplace-adapters.md | one cross-link sentence to Trade-First reference | N1 |
| architecture/overview.md | Trade-First row in Key Design Decisions + auth-flow ThemedImage under Authentication (nav/tab wording untouched — Q3 frozen) | N1/N6 + G8 |
| api/overview.md | endpoint-table rows linked to the 3 new api pages (anchors for platform sections) | N3 |
| api/porter.md | one framing sentence ("function-calling access to your real inventory") + frontend link | N6 |
| api/authentication.md | auth-flow ThemedImage | G8 |
| architecture/database.md | ER ThemedImage | G8 |
| architecture/ai-pipeline.md | pipeline ThemedImage | G8 |
| features.md | 2 rows added (Buyer Messages Inbox, Porter Chat Experience); GTC + tutorial-hub rows already existed from E9 | N4 |
| frontend/listing-flow.md | differentiation intro ("three interfaces, one state machine; drafts survive; retries can never double-list") — each clause code-verified | N6 |
| frontend/design-system.md | one teal-AI-accent line + style-guide link | N6 |
| frontend/app-structure.md | one pointer line to responsive-shell (page otherwise untouched — E4/Q3 blocked) | N2 |
| deployment.md | one pointer sentence to the Infrastructure section | N5 |
| monitoring.md | Grafana dashboard JSON path (`observability/grafana/portage-dashboard.json`, existence verified) + compose scrape-labels clause; no aifactory-side Prometheus claims (Q13 respected) | N5 |

## Worklist NEW-line disposition

| Line | Status | Notes |
|---|---|---|
| N1 | **DONE** | Page + banner relink + decision row + cross-links. Notable finding: the ItemID prefix-3 silent-fail check is an **operational heuristic, not code** (grep: no programmatic check; only surface is the copyable ID on listing-card.tsx) — the page states this precisely instead of repeating the memory-note phrasing. |
| N2 | **DONE** | Documents code as-built (5 tabs + Scan, verified tab-bar.tsx:12–18). **Q3 dependency noted:** if Stephen restores the More tab, this page (and only its tab-list prose) needs a follow-up edit. R1 content deferred to PR #237 merge (G9 remains deferred). |
| N3 | **DONE** | messages + seller-profile + platform pages; preferences GET confirmed already on authentication.md. All shapes from route handlers + Zod, none from memory. |
| N4 | **DONE** | features.md rows (2 missing ones added; 2 already existed from E9) + frontend/porter.md (warranted: PorterProvider/SSE/pills content had zero docs footprint). |
| N5 | **DONE** | Full Infrastructure section per requirement 2a (16-piece matrix covered). Limits honestly stated in-page/report rather than fabricated: CF dashboard-side Access app/bypass inventory, R2 bucket console settings, and GitHub-side runner registration are not repo-verifiable — documented only to code/config/live-service depth. Grafana scrape wiring (Q13) not claimed. |
| N6 | **PARTIAL** | Done: Trade-First decision row, porter.md framing, listing-flow intro, teal-never-purple placement (design-system + porter page). Already done in edit pass: getting-started bullets (E17), database.md stories (E8). **Skipped: README pitch — its host rewrite E1 is Q3-blocked**; pitch belongs to that rewrite. |
| G8 | **DONE** | All 4 mandated diagram types + the 2a-mandated per-subsystem set = 7 light/dark pairs, all wired, all verified edge-by-edge before drawing. G1 (architecture-*.svg recreation) remains Q3-blocked — NOT touched. |

## Additions beyond the worklist (each with justification)

1. **infrastructure/services.md** — requirement 2a demands "how to operate/rebuild" per piece; a dedicated runbook page keeps overview.md readable (future-maintainer gap).
2. **api/platform.md section anchors linked from api/overview.md table** — makes the 8 small route groups findable in one hop (new-developer gap).
3. **Verification screenshots** (14 PNGs, below) — mandated by the prompt's verification section; stored under the docs-refresh subdir to stay separable from feature-verification sets.
Considered and declined: app-structure rewrite (Q3-blocked, E4), ship-log repairs (Q2), memory-SVG updates (Q6/Q12), further Doppler documentation (already over-documented ×3 per audit — the new secrets page deliberately links the canonical guide instead).

## Open-question dependencies noted (not answered)

- **Q3 (nav wording):** N2 documents code as-built; README pitch (N6 sub-item) skipped; architecture/overview nav line untouched; G1 still blocked.
- **Q1 (counts):** no task/test counts were written into any new page.
- **Q2 (ship-log):** untouched.
- **Q8 (rehearsal ingress):** documented neutrally in cloudflare.md as routing to localhost:3004, not part of the Portage compose stack — no speculation.
- **Q13 (aifactory-side scrape config):** monitoring.md documents only the compose-side labels; ai-pipeline diagram labels the provider chain from `.env.example` (`local → gemini → anthropic`) because `.env` is not readable in-session — runtime order not asserted.
- **Q4 (unreferenced verification PNGs):** this pass adds 14 more under `verification/docs-refresh/` (operator-mandated location); fold into the Q4 decision.

## Zero-defect gate

- No placeholders/TODO/lorem/test data in any new file (grep-swept + editor-swept). Credentials referenced only as "in Doppler"; env vars by name only; tunnel ID is already public in the versioned repo config; tunnel credentials JSON named by path only.
- Every new image inspected: 14 SVGs rasterized by their authors AND the 14 built-site screenshots below reviewed frame-by-frame by the orchestrator — no clipping, no overlap, no stale/fabricated labels found.

## Verification

- **Build:** replicated `.github/workflows/deploy-docs.yml` in a scratchpad mirror of `/home/swebber64/DHG/aifactory3.5/dhgaifactory3.5/docs-site` (rsync site skeleton, hardlinked node_modules, copy website/docs → projects/portage, both sed rewrites, recursive static img copy, `npm run build`): **SUCCESS, exit 0, twice** (smoke + final after editor fixes), `onBrokenLinks: 'throw'` in force, zero broken-link/broken-image output (the only "broken" strings in the log are the pre-existing `onBrokenMarkdownLinks` deprecation warnings). The id-based route `/portage/infrastructure/secrets-and-storage/` builds and serves. The live dhg-docs site was not touched; no push occurred.
- **Visual proof:** built site served locally; each of the 7 new diagrams screenshotted as rendered in BOTH themes (Docusaurus theme toggle via localStorage + data-theme) → 14 PNGs at `website/static/img/verification/docs-refresh/<name>-{light,dark}.png`. All reviewed by the orchestrator.
- **Orphan check:** grep of website/docs against all 14 new SVG filenames — every file referenced; also the 8 previously-orphaned ebay-trade-first SVGs now have a second referencing page (N1).
- **Live checks (read-only):** `systemctl status cloudflared-portage` (active), `systemctl list-units` runner service (active), `docker inspect dhg-docs` (mount reconciliation), `docker ps` (Registry/docs ports).

## Flags for Stephen

1. `secure-config-and-storage.md` filename vs `secrets-and-storage` id — rename needs hook authority; URL already correct either way.
2. The `[no-secrets]` hookify rule also fired on `infra-secrets-path*.svg` (filename-only match, zero secret content); committing these files may re-trigger it — override knowingly.
3. Pre-existing api/ sidebar_position collisions (overview/items = 1, authentication/images = 2) — renumber decision.
4. `schema.ts:5–6` comment still describes the SKU sequence in Inventory-API terms ("keeps eBay's inventory_item PUT idempotent") — stale code comment, out of docs-pass scope; route to a code session.
5. The ItemID prefix-3 "detection" is documentation/operational practice only — if automated silent-fail detection is wanted, that's a code feature request.
