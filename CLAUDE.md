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

Drizzle ORM, schema-push workflow (no migration files). 20 tables:

users, items, listings, orders, conversations, notifications, marketplace_accounts, admin_audit_log, app_settings, design_survey_responses, design_review_comments, disclaimer_acceptances, listing_drafts, seller_profiles, stripe_events, ebay_messages, faqs, export_tokens, marketplace_sync_log, sync_jobs

Notable JSONB columns: `items.photos`, `items.marketplaceData` (eBay category/title cache), `orders.shippingAddress`.

### Auth

Cloudflare Access is the identity provider — no password. `GET /auth/session` verifies the `Cf-Access-Jwt-Assertion` header against the team JWKS, auto-provisions the user row on first login, then mints a short-lived (15m) internal JWT the API consumes for the rest of the session; the client just re-exchanges via CF Access when it expires. Role column on users (`user` | `admin`). Admin middleware checks `req.user.role`. Promote via `npx tsx apps/api/src/scripts/promote-admin.ts <email>`.

### Marketplace Adapters

Shared TypeScript interface in `packages/shared/src/marketplace.ts`. Three adapters:
- **eBay:** OAuth2 auth code grant. Listing lifecycle runs on the **Trading API** (Trade-First, PR #133, live-proven): AddFixedPriceItem / ReviseFixedPriceItem / ReviseInventoryStatus / EndFixedPriceItem / GetItem, inline shipping terms — no Business Policies, no Inventory-API offers (`ebayOfferId` removed from the adapter interface; DB column inert). Insert-first idempotency on publish (`listings.idempotency_key`). Fulfillment API for orders, Taxonomy API for categories/aspects
- **Etsy:** PARKED 2026-07-09 (tag `etsy-parked-2026-07`) pending API key approval — adapter/auth routes/UI removed; DB enum value remains, inert
- **Reverb:** Publish path shipped + live-proven (PRs #173-#177, 2026-07-08): per-user PAT token auth, comps search, create/update listing — listings live and sold on the real shop since 2026-07-13

Marketplace tokens encrypted at rest with AES-256-GCM.

### Listing Flow

Three-interface listing creation: Conversational, Swipe, and Hybrid modes. `useListingFlow` hook with auto-draft persistence. Components in `apps/web/src/components/listing-flow/`.

### AI

- **Item scanning:** configurable provider chain defined by the `VISION_PROVIDERS` env var, consumed in `apps/api/src/lib/ai-client.ts` (`apps/api/src/lib/vision.ts` holds the vision prompt/schema logic) — Gemini 2.5 primary, Claude fallback in prod
- **Porter assistant:** Claude Sonnet SSE streaming via `client.messages.stream()`, 3 tools (search_inventory, get_inventory_stats, suggest_listing), action pills, JSONB conversation in `blocks: ContentBlock[]` format. Routes: `POST /porter/stream` (SSE), `POST /porter/message` (non-streaming fallback)
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
Test suite: 909 API / 631 web as of 2026-08-10.

Note: `feat/ai-specifics-and-publish-result` is NOT in flight — it merged as
PR #132 on 2026-06-23. Stale journal syncs can misreport it as open.

**Superseded:** Carrier API integration (EasyPost/Shippo) — replaced by redirect-to-eBay for labels (decision 2026-07-01); the stubbed carrier subsystem was deleted in PR #142. W2 Fulfillment sync-back and W5 ebay-api SDK were dropped with it.

**Parked:** Voice feature (Whisper STT + Chatterbox TTS, Porter voice UI) — removed 2026-07-01 (Execution Phase 2) for a future release; the hardened pre-removal code (A1–A8 fixes included) is preserved at git tag `voice-parked-2026-07`. Etsy marketplace (PKCE OAuth2 adapter, auth routes, UI) — removed 2026-07-09 pending Etsy API key approval; pre-removal code at git tag `etsy-parked-2026-07`; zero etsy DB rows existed at park time, enum value remains inert.

**Remaining:** notification system, dashboard trends + AI insights, enhanced-photo persistence, pagination on listing/item hooks. Closed 2026-07-09: integration testing (Task 35, PR #184 +43 route tests), tunnel config versioned (PR #182), prod CORS single-origin (PR #189), Reverb OAuth code-grant declared obsolete (PAT selling live-proven). See docs/TODO.md Phases 5–7.

**Demo account:** credentials live in Doppler, not in this file.
