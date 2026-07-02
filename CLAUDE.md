# Portage

AI-powered personal effects inventory and multi-marketplace seller app. Standalone project — not part of the DHG AI Factory stack.

**Owner:** Stephen Webber — CEO/Founder, Digital Harmony Group. Bills at $600/hour. Expects Fortune 500 execution quality.

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
| dhg-docs | 8017 | nginx serving Docusaurus build |

### Database

Drizzle ORM, schema-push workflow (no migration files). 16 tables:

users, items, listings, orders, conversations, notifications, marketplace_accounts, admin_audit_log, app_settings, design_survey_responses, design_review_comments, disclaimer_acceptances, listing_drafts, seller_profiles, stripe_events, ebay_messages

Notable JSONB columns: `items.photos`, `items.marketplaceData` (eBay category/title cache), `orders.shippingAddress`.

### Auth

JWT access + refresh tokens. bcrypt password hashing. Role column on users (`user` | `admin`). Admin middleware checks `req.user.role`. Promote via `npx tsx apps/api/src/scripts/promote-admin.ts <email>`.

### Marketplace Adapters

Shared TypeScript interface in `packages/shared/src/marketplace.ts`. Three adapters:
- **eBay:** OAuth2 auth code grant. Listing lifecycle runs on the **Trading API** (Trade-First, PR #133, live-proven): AddFixedPriceItem / ReviseFixedPriceItem / ReviseInventoryStatus / EndFixedPriceItem / GetItem, inline shipping terms — no Business Policies, no Inventory-API offers (`ebayOfferId` removed from the adapter interface; DB column inert). Insert-first idempotency on publish (`listings.idempotency_key`). Fulfillment API for orders, Taxonomy API for categories/aspects
- **Etsy:** PKCE OAuth2, Listings API with photo upload, Receipts API, Taxonomy API
- **Reverb:** Adapter implemented (269 lines), comps search working, token-paste auth shipped (Personal Access Token validated against live API)

Marketplace tokens encrypted at rest with AES-256-GCM.

### Listing Flow

Three-interface listing creation: Conversational, Swipe, and Hybrid modes. `useListingFlow` hook with auto-draft persistence. Components in `apps/web/src/components/listing-flow/`.

### AI

- **Item scanning:** Claude Vision API via `apps/api/src/lib/vision.ts`
- **Porter assistant:** Claude Sonnet SSE streaming via `client.messages.stream()`, 3 tools (search_inventory, get_inventory_stats, suggest_listing), action pills, JSONB conversation in `blocks: ContentBlock[]` format. Routes: `POST /porter/stream` (SSE), `POST /porter/message` (non-streaming fallback)
- **Voice (STT/TTS):** REMOVED 2026-07-01 (parked for a future release) — pre-removal code preserved at git tag `voice-parked-2026-07`
- **Background removal:** Client-side WASM (@imgly/background-removal), billing-gated per tier
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
| Auth (JWT, bcrypt) | apps/api/src/lib/jwt.ts, apps/api/src/lib/password.ts |
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
| Docker config | docker-compose.yml + docker-compose.override.yml |
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
| Layout | Mobile-first, 5-tab bottom nav |

---

## Dev Environment Notes

- All URLs use **10.0.0.251** not localhost (server IP)
- Next.js dev: polling mode (`WATCHPACK_POLLING=true`) for reliable HMR over network
- next.config.ts: `allowedDevOrigins: ["10.0.0.251"]`
- HTTPS dev mode requires certs at `certs/key.pem` + `certs/cert.pem` (Next.js uses `--experimental-https`)
- Secrets managed via Doppler — `.env` auto-synced by SessionStart hook
- Shared package must be rebuilt after changes: `npm run build -w packages/shared`

---

## Production Rules

1. No placeholders, TODOs, or provisional logic. Every file works on first deploy.
2. View files before editing. State what you're changing and why.
3. Run verification after any change. Show proof.
4. One fix per hypothesis when debugging.
5. Planning and building are separate phases.
6. Never commit secrets (.env, API keys, passwords).
7. Quality over speed. Always.

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

As of 2026-07-01: roadmap essentially complete — 48/52 tasks done, 1 superseded (carrier APIs), 1 partial (tunnel config not versioned), 2 open (integration testing, Reverb OAuth). See `docs/TODO.md` for the live backlog and in-flight branches.

**Done:** Foundation (8/8), AI scanning, image pipeline, marketplace adapters (eBay + Etsy + Reverb comps), Porter AI, auth, admin panel (11/11), repo infra (2/3), scan entry point, orders UI, three-interface listing flow, smart-listing prepare (seller profiles, prepare-listing endpoint, PhotoCaptureFlow, comps/preview), listing detail page, dashboard (spinner fix + TabBar restructure), settings (8 pages: profile, marketplace, seller profile, shipping, notifications, help, admin, billing), listings CRUD (edit/update/delete + marketplace sync), security fixes (C1-C4: order sync matching, XSS elimination, SQL injection, encryption key decoupling), JWT auto-refresh, object URL leak fixes, test infra (557 API + 230 web tests as of 2026-07-01), auth middleware next(err), TOCTOU race fix, shared logger (28 files), AI SDK singletons, shippingAddress column, pagination, shared format helpers, listing flow component extraction, PWA (icons + favicon + service worker), admin observability (Prometheus + Grafana), bulk operations (select/delete/archive/activate/export), eBay CSV export (Seller Hub Reports draft format), onboarding flow (5-step carousel), Stripe billing (subscriptions + credits + enforcement gates), Reverb token-paste auth, photo tools UX (crop/rotate/enhance/BG-remove with before-after preview), eBay buyer messaging (inbox sync + conversation threads + reply via Trading API, 20 tests), eBay orders sync (login-triggered + manual Sync button with visible errors; GetItem backfill ingests external eBay sales as one item+listing per ItemID — proven live importing 11 real orders, PR #139), eBay Trade-First migration (PR #133, 52 commits: full eBay listing lifecycle moved from Inventory API to Trading API with inline terms, no Business Policies; insert-first idempotency; live-proven publish/revise/end on real eBay ItemIDs 307034606520 + 307034773471), AI-specifics scan→publish (PR #132: scan-time aspect prefill, inline [AI] auto-fill + chips, quantity capture, MPN "Does Not Apply" sentinel, malformed-aspect guard + enum validation), orders Phase-1 rebuild (PR #142, merged + live-verified 2026-07-01: sold-date fix, Ship-It→eBay, simplified sold-orders panel with thumbnail/title/date/gross-price rows, soldAt heal on re-sync — 11 live orders healed from stamped 06-30 to real dates 06-02…06-23, and full carrier-subsystem deletion −2,474 lines with the disclaimer flow relocated to /disclaimer), Phase 3 AI-specifics follow-through (PR #147: aspect-pick Type auto-pick live-proven + thinking-model token-starvation fix, camera-scan-save e2e via canvas-stream getUserMedia polyfill, SKU Custom-label GetItem proof), Phase 4 repo hygiene (2026-07-01: Dependabot triage via single lockfile PR #148 — alerts 23→1; capture-guarantee Stop hook wired PR #149; anthropic-sdk 0.109.1 + sharp 0.35.3 PR #150; open PRs 27→6 deliberate defers), GTC auto-end (PR #151: opt-in gtc_auto_end toggle, login-triggered /listings/gtc-sweep ends eBay listings via EndFixedPriceItem 2 days before the monthly GTC renewal anniversary, archives + notifies, no auto-relist; Auto-ends date on listing detail; error path live-proven).


Note: `feat/ai-specifics-and-publish-result` is NOT in flight — it merged as PR #132 on 2026-06-23 (scan-time eBay aspect prefill, inline [AI] auto-fill + chips, quantity capture, MPN sentinel, malformed-aspect guard). Stale journal syncs can misreport it as open.

**Superseded:** Carrier API integration (EasyPost/Shippo) — replaced by redirect-to-eBay for labels (decision 2026-07-01); the stubbed carrier subsystem was deleted in PR #142. W2 Fulfillment sync-back and W5 ebay-api SDK were dropped with it.

**Parked:** Voice feature (Whisper STT + Chatterbox TTS, Porter voice UI) — removed 2026-07-01 (Execution Phase 2) for a future release; the hardened pre-removal code (A1–A8 fixes included) is preserved at git tag `voice-parked-2026-07`.

**Remaining:** Reverb OAuth code-grant (token-paste auth is shipped), integration testing (Task 35), version tunnel config into repo. See docs/TODO.md Phases 2–7.

**Demo account:** demo@portage.app / demo1234demo1234
