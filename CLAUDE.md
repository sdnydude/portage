# Portage

AI-powered personal effects inventory and multi-marketplace seller app. Standalone project — not part of the DHG AI Factory stack.

**Server:** g700data1 (10.0.0.251), Ubuntu 24.04, 64GB RAM.

**Repo:** https://github.com/sdnydude/portage.git — Branch: main.

---

## Architecture

npm workspaces monorepo with three packages:

| Package | Purpose |
|---------|---------|
| `apps/api` | Express 5 backend — routes, auth, marketplace adapters, AI |
| `apps/web` | Next.js 16 frontend — React 19, Tailwind v4, mobile-first PWA |
| `packages/shared` | TypeScript types, constants, marketplace interfaces |

### Services

| Service | Port | Technology |
|---------|------|-----------|
| portage-db | 5436 | PostgreSQL 15 |
| portage-api | 8016 | Express 5 + TypeScript + pino |
| portage-app | 3002 | Next.js 16 (standalone mode) |
| portage-rembg | 7000 | background-removal container (`REMBG_URL`) |
| dhg-docs | 8017 | nginx serving Docusaurus build (runs outside docker-compose.yml — separate nginx) |
| portage-graph | 8018 | nginx serving graphify-out/ code knowledge graph |

### Database

Drizzle ORM, schema-push workflow (no migration files). 21 tables (items.status enum added 2026-08-23):

users, items, listings, orders, conversations, notifications, marketplace_accounts, admin_audit_log, app_settings, design_survey_responses, design_review_comments, disclaimer_acceptances, listing_drafts, seller_profiles, stripe_events, ebay_messages, faqs, export_tokens, marketplace_sync_log, sync_jobs, ebay_deleted_identities

Notable JSONB columns: `items.photos`, `items.marketplaceData` (eBay category/title cache), `orders.shippingAddress`.

### Auth

Cloudflare Access is the identity provider — no password. `GET /auth/session` verifies the `Cf-Access-Jwt-Assertion` header against the team JWKS, auto-provisions the user row on first login, then mints a short-lived (15m) internal JWT the API consumes for the rest of the session; the client just re-exchanges via CF Access when it expires. Role column on users (`user` | `admin`). Admin middleware checks `req.user.role`. Promote via `npx tsx apps/api/src/scripts/promote-admin.ts <email>`.

### Marketplace Adapters

Shared TypeScript interface in `packages/shared/src/marketplace.ts`. Three adapters:
- **eBay:** OAuth2 auth code grant. Listing lifecycle runs on the **Trading API** (Trade-First, PR #133, live-proven): AddFixedPriceItem / ReviseFixedPriceItem / ReviseInventoryStatus / EndFixedPriceItem / GetItem, inline shipping terms — no Business Policies, no Inventory-API offers (`ebayOfferId` removed from the adapter interface; DB column inert). Insert-first idempotency on publish (`listings.idempotency_key`). Fulfillment API for orders, Taxonomy API for categories/aspects. **Marketplace Account Deletion** compliance endpoint (public `/marketplace/ebay/account-deletion`, challenge + ECDSA-SHA1 signature verify, synchronous anonymization, HMAC-keyed `ebay_deleted_identities` re-population guard — `apps/api/src/routes/marketplace/ebay-deletion.ts`)
- **Etsy:** PARKED 2026-07-09 (tag `etsy-parked-2026-07`) pending API key approval — adapter/auth routes/UI removed; DB enum value remains, inert
- **Reverb:** Publish path shipped + live-proven (PRs #173-#177, 2026-07-08): per-user PAT token auth, comps search, create/update listing — listings live and sold on the real shop since 2026-07-13

Marketplace tokens encrypted at rest with AES-256-GCM.

### Listing Flow

Three-interface listing creation: Conversational, Swipe, and Hybrid modes. `useListingFlow` hook with auto-draft persistence. Components in `apps/web/src/components/listing-flow/`.

### AI

- **Item scanning:** configurable provider chain defined by the `VISION_PROVIDERS` env var, consumed in `apps/api/src/lib/ai-client.ts` (`apps/api/src/lib/vision.ts` holds the vision prompt/schema logic) — Gemini 2.5 primary, Claude fallback in prod
- **Porter assistant:** local-first chat chain (`CHAT_PROVIDERS=local:granite4.1:8b,gemini` — granite via Ollama, gemini-2.5-flash fallback; model eval + switch 2026-08-13, PR #303) with SSE streaming, 3 tools (search_inventory, get_inventory_stats, suggest_listing), runtime grounding validation (post-tool-loop item check, buffer-after-first-tool streaming, 3-attempt retry w/ gemini force, 45s budget — `apps/api/src/lib/porter-grounding.ts`), action pills, JSONB conversation in `blocks: ContentBlock[]` format. Routes: `POST /porter/stream` (SSE), `POST /porter/message` (non-streaming fallback)
- **Voice (STT/TTS):** REMOVED 2026-07-01 (parked for a future release) — pre-removal code preserved at git tag `voice-parked-2026-07`
- **Background removal:** Server-side via portage-rembg container (`POST /images/remove-bg`, `REMBG_URL`), billing-gated per tier
- **Auto-enhance:** Server-side Sharp pipeline, billing-gated per tier
- **Photo tools:** Rotate, crop, enhance, BG-remove with before/after preview slider
- **Prepare listing:** AI field generation (title, description, pricing from comps) via `apps/api/src/routes/prepare-listing.ts`

### Documentation & CI/CD

- **Docs site:** Docusaurus 3.10.1 served by nginx (dhg-docs container, port 8017) at `10.0.0.251:8017`
- **Registry search:** 319 doc chunks indexed in DHG Registry `doc_pages` table with pgvector embeddings + FTS, hybrid RRF search via `POST /api/doc-pages/search`
- **CI/CD:** GitHub Actions self-hosted runner on g700data1. Push to `website/**` triggers: copy docs → build Docusaurus → restart nginx → ingest to registry → verify
- **Workflow:** `.github/workflows/deploy-docs.yml`

---

## Key File Locations

| Purpose | Path |
|---------|------|
| API entry | apps/api/src/index.ts |
| DB schema | apps/api/src/db/schema.ts |
| Auth (JWT, CF Access) | apps/api/src/lib/jwt.ts, apps/api/src/lib/cf-access.ts |
| All API routes | apps/api/src/routes/ |
| Admin endpoints | apps/api/src/routes/admin.ts |
| Marketplace adapters | apps/api/src/marketplace/ |
| Frontend pages | apps/web/src/app/ |
| Admin pages | apps/web/src/app/admin/ |
| Components | apps/web/src/components/ |
| Hooks | apps/web/src/hooks/ |
| API client | apps/web/src/lib/api.ts |
| Listing flow components | apps/web/src/components/listing-flow/ |
| Listing flow hook | apps/web/src/hooks/use-listing-flow.ts |
| Prepare-listing route | apps/api/src/routes/prepare-listing.ts |
| Seller profile route | apps/api/src/routes/seller-profile.ts |
| Drafts route | apps/api/src/routes/drafts.ts |
| Disclaimer routes | apps/api/src/routes/disclaimer.ts |
| Seller profile settings | apps/web/src/app/settings/seller-profile/page.tsx |
| Billing settings | apps/web/src/app/settings/billing/page.tsx |
| Billing routes | apps/api/src/routes/billing.ts |
| Reverb adapter | apps/api/src/marketplace/reverb-adapter.ts |
| Reverb auth | apps/api/src/routes/marketplace/reverb-auth.ts |
| Scan flow | apps/web/src/components/capture/scan-flow.tsx |
| Messages routes | apps/api/src/routes/messages.ts |
| Trading API client | apps/api/src/marketplace/ebay-trading-client.ts |
| eBay account-deletion endpoint | apps/api/src/routes/marketplace/ebay-deletion.ts (+ marketplace/ebay-notification-verify.ts, ebay-deletion-anonymize.ts) |
| Prod boot guard | apps/api/src/lib/prod-env-guard.ts |
| Messages hooks | apps/web/src/hooks/use-messages.ts |
| Conversations list | apps/web/src/app/messages/page.tsx |
| Conversation thread | apps/web/src/app/messages/[conversationKey]/page.tsx |
| Shared types | packages/shared/src/types.ts |
| Docker config | docker-compose.yml (+ opt-in docker-compose.dev.yml) |
| Environment template | .env.example |
| Docs CI/CD workflow | .github/workflows/deploy-docs.yml |
| Docs source | website/docs/ |

---

## Build & Run Commands

```bash
# Docker (full stack)
docker compose up -d
docker compose ps
docker compose logs -f portage-api

# Manual dev
npm run dev:api          # Express on :8016
npm run dev:web          # Next.js on :3002

# Quality gates
npm run typecheck        # All workspaces
npm run lint             # ESLint (web)
npm run test:api         # Vitest

# Database
npm run db:push          # Push Drizzle schema
npm run db:studio        # Drizzle Studio GUI

# Admin
npx tsx apps/api/src/scripts/promote-admin.ts <email>
```

---

## Design System

| Token | Value |
|-------|-------|
| Primary | Forest Green #2D5A27 |
| Display font | Instrument Sans |
| Body font | Plus Jakarta Sans |
| Mono font | JetBrains Mono |
| Layout | Mobile-first; 4 tabs (Home, Inventory, Porter, Orders) + center Scan button; Listings reached from Home/Inventory (dropped from the bar 2026-07-17, PR #240); More via avatar menu |

---

## Dev Environment Notes

- All URLs use **10.0.0.251** not localhost (server IP)
- next.config.ts: `allowedDevOrigins: ["10.0.0.251"]`
- Secrets managed via Doppler — `.env` auto-synced by SessionStart hook. Never
  commit secrets (.env, API keys, passwords, demo credentials)
- WATCHPACK_POLLING + HTTPS-cert details: see apps/web/CLAUDE.md Gotchas
- Shared package must be rebuilt after changes: `npm run build -w packages/shared`
- Both containers are image-baked (no bind-mounts): deploy = `docker compose up -d --build <service>`. Hot-reload dev is explicit opt-in only: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build portage-api`

---

## Decision Log

Record architectural and implementation choices as `decision_*.md` files in auto-memory when all three criteria are met:

1. An alternative was explicitly considered and rejected
2. A future session could plausibly make the opposite choice
3. The reasoning is non-obvious from the code alone

Format: `decision_{domain}_{slug}.md` with frontmatter (name, description, type: decision, domain, supersedes) and body (choice, **Over:** rejected alternatives, **Because:** reasoning, **Context:** when/where). Save silently — no need to announce. Update `decisions_index.md` and MEMORY.md count.

Domain values: `api`, `web`, `shared`, `infra`, `registry`, `ops`.

---

## Progress

Original roadmap essentially complete — a 2026-07-17 recount found the docs/TODO.md ledger lists 49 numbered task lines (task #53 reused twice; #22, #26, #28–#31 never on the ledger): 48 complete, 1 superseded (carrier APIs); the old 50/52-vs-51/52 figures used a 52-task denominator the ledger doesn't support. Integration testing, tunnel-config versioning, and Reverb OAuth resolution closed 2026-07-09. A separate Responsive UI Program (R0-R4, approved 2026-07-15) was added after this count and isn't folded into it — R0 shipped (PR #229), R1 desktop workbench shipped (PR #237, merged 2026-07-17, 15-finding adversarial fix round), R2 (desktop drag-drop ingest) + R3 (Porter dock) shipped (PR #252, merged 2026-07-21) — docs/TODO.md checkboxes for R2/R3 lag the actual merged state. See `docs/TODO.md` for the live backlog and in-flight branches.

**Done:** see docs/TODO.md and website/docs/ship-log/ for the full change
history. Highlights: eBay Trade-First lifecycle (PR #133), CF Access auth
(PRs #168-172), Reverb publish live-proven (PRs #173-177), listing-hub merge
(PRs #207-213), responsive shell R0-R3 (PRs #229, #237, #252), Reverb audit
batch (PR #251), Langfuse LLM tracing (PR #253), DB loopback-bind hardening
(PR #256), dependency audit pass (PR #257, 15 vulns/5 high → 8 moderate/0 high),
beta bug batch + auth-exchange hardening (PRs #262-263), accept-offers +
advertising toggles (PRs #264-265), TabBar overlay fix + audit gate (PR #266),
Trust Gates enforcement docs + proof-before-push hook (PRs #267-268),
CF_ACCESS_AUD login-outage fix + boot guard (PR #269), Langfuse Porter
agent-observation typing (PR #270), per-listing shipping controls + local
pickup (PRs #274/#276/#278), Reverb category cascade + review batch (PR #280),
marketplace sync refactor — durable log, outbox worker, UI truth surface
(PR #283), sync audit fix batch (PR #287), Best Offer redesign — PR #285's
DeletedField hotfix caused a config-deletion crisis, rebuilt ground-up with
typed errors + conflict-time heal + never-delete semantics (PRs #288-289),
Reverb Bump-bid range validation + publish-retry photo-ingestion race fix,
vision provider schema-drift coercion + fail-over, beta-blocker UI batch —
pickup seed/save, Best Offer guided fix w/ healed flag, Reverb cascade (PR #295).
Marketplace-truth sync shipped (PR #299, 08-10): periodic status sweep +
Reverb order sync/backfill, 10-finding review batch, Reverb blank-model 422
publish fix (omit make/model when absent) — live-verified.
Ship-program Phase 3a shipped (PR #303, 08-13): Porter reliability
(blank-reply fix, AI_UNAVAILABLE guard, Langfuse per-purpose names,
chatModel override), runtime grounding validation, granite4.1:8b model
switch (125-prompt eval, 0 fabrications, ~1s turns; supersedes gemma4:12b
rec and qwen3:14b), search_inventory recall merge + photos-strip fix —
live-proven with DB-verified screenshots.
Category-mismatch guard shipped (PR #304, 08-13): eBay suggestion
plausibility check (ancestor-root table + rich-vision token overlap),
advisory banner in scan review + edit page (Use anyway / Find different /
Don't use it, per-category dismissal memory), Tier-2 persisted
visionCategory + publish-time self-heal warn-log — caught the live
Baseball Jackets recurrence in scan-flow during PoD.
Deferral program P1 (compliance/security) shipped 2026-08-19: eBay Marketplace
Account Deletion endpoint (c683b4bc), self-hosted-runner fork-PR refusal in
e2e.yml + claude-review.yml (223b0419), prod boot-guard widening to 14 requirements
(73dd1664) — see docs/deferral-plan-2026-08-15.md for P2–P8.
Deferral P2 (capture-pipeline integrity) shipped 2026-08-22 across 3 repos
(dhg-memreg#1, dhgaifactory3.5#26, portage#313): registry write-auth ENFORCE
live (bearer token, ~/.claude/secrets/registry-write-token; reads + */search
stay open), landing-verified captures (2xx-without-id dead-letters; idempotency
rides natural-key upserts, no new column), DLQ sibling-lockfile + atomic-replace
durability with 5-min timed replay, capture-guarantee landing-diff via
GET /api/captures/lookup as a user-level Stop hook, stale portage capture-script
copies deleted (canonical = ~/.claude/scripts symlinks to dhg-memreg). Ship-log
057. NOTE: LangGraph retired going forward — Pydantic AI + Langfuse (e038a72a).
Deferral P3 (beta UX truth) shipped 2026-08-22 (PR #315, 734ae42): Best Offer
conflicts carry structured details from every adapter throw, the post-save
PATCH catch heals from live and rethrows 422 instead of a 200+warning, and
ListingCard renders a guided fix (Adjust to fit price / Turn off offers) —
live-proven on a real listing; swipe flow photo-first with Retry; scan review
surfaces comps/category/aspect outages with retries, condition-snap notice,
"Unavailable" instead of a false "Complete"; mobile ?item= deep link no longer
mounts the hidden pane. Ship-log 058; proof page 2026-08-22-p3-beta-ux-truth.
Housekeeping batch 1 shipped 2026-08-23 (PR #317, 2607211): items.price ⇄
listings.price one value both directions; aspect null-delete on items PATCH +
listing-row strip in one transaction; estimated-value range retired from every
surface (columns kept); items.status enum (unlisted|asset|sold|archived) with
derived displayStatus + ?status= filter + detail/edit control; shared
StatusChip/MarketplaceChip on --chip-* tokens (≥6.3:1 both themes);
data-driven category chips (GET /items/categories) + case-insensitive filter
+ lowercase-trim writes; 5-row/2000-char
condition notes. Live-proven (e2e/housekeeping-1.spec.ts, E2E_EBAY_LIVE=1);
the live run caught a drizzle array-param bug the mocked tests could not.
Ship-log 059; proof page 2026-08-23-housekeeping-1.
Deferral P4 (docs & observability truth) shipped 2026-08-23 (PR #319, efdf4bd):
ship-log generator revived as an additive, tested tool
(`.claude/scripts/shiplog/gen.py`; wrapper `generate-ship-log.sh`): every
page carries `registry_id:`, hand-written pages are never regenerated, and
`deploy-docs.yml` runs `--check` as a drift gate — **git is the source of
truth for `website/docs/ship-log`, the registry for sessions**; a session
with no committed page fails the docs deploy (run the generator locally and
commit). /ship Phase 7 hand-written pages must include `registry_id:`.
Backfilled 74 sessions (135 pages = 134 registry sessions + 1 hand-written). Also: /about page (+ links on avatar
menu, sidebar, More), `rsync --delete` for static images, tutorials
re-captured on the 4-tab app with a CI gate (`npm run check:tutorials`),
`docs/api/ebay.md`; deploy-docs now has a pre-restart smoke gate and auto-opens
a GitHub issue on failure (drill: `gh workflow run deploy-docs.yml -f drill=true`).
Ship-log 134; proof page 2026-08-23-p4-docs-truth.
Test suite: 1033 API / 701 web / 27 generator as of 2026-08-23 (P4).
Deferral P5 (log program) SPEC approved 2026-08-23 (PR #323, ship-log 135):
docs/log-program-architecture-2026-08-23.md rev 3 — keep-all retention (operator
directive: no automatic deletion, operator-only), 2-layer redaction (pino
redact + promtail stages), SecretLeakDetected/LokiStoreGrowth alerts, dashboard
v2, local-only log-chat + web panel (B9). Build B0–B9 is the next /ship
(stopped at Phase 1 on 2026-08-23; resume Phase 2).

Note: `feat/ai-specifics-and-publish-result` is NOT in flight — it merged as
PR #132 on 2026-06-23. Stale journal syncs can misreport it as open.

**Superseded:** Carrier API integration (EasyPost/Shippo) — replaced by redirect-to-eBay for labels (decision 2026-07-01); the stubbed carrier subsystem was deleted in PR #142. W2 Fulfillment sync-back and W5 ebay-api SDK were dropped with it.

**Parked:** Voice feature (Whisper STT + Chatterbox TTS, Porter voice UI) — removed 2026-07-01 (Execution Phase 2) for a future release; the hardened pre-removal code (A1–A8 fixes included) is preserved at git tag `voice-parked-2026-07`. Etsy marketplace (PKCE OAuth2 adapter, auth routes, UI) — removed 2026-07-09 pending Etsy API key approval; pre-removal code at git tag `etsy-parked-2026-07`; zero etsy DB rows existed at park time, enum value remains inert.

**Remaining:** notification system, dashboard trends + AI insights, enhanced-photo persistence, pagination on listing/item hooks. Closed 2026-07-09: integration testing (Task 35, PR #184 +43 route tests), tunnel config versioned (PR #182), prod CORS single-origin (PR #189), Reverb OAuth code-grant declared obsolete (PAT selling live-proven). See docs/TODO.md Phases 5–7.

**Demo account:** credentials live in Doppler, not in this file.
