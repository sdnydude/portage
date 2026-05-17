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

### Database

Drizzle ORM, schema-push workflow (no migration files). 17 tables:

users, items, listings, orders, conversations, notifications, marketplace_accounts, admin_audit_log, app_settings, shipping_presets, shipping_providers, design_survey_responses, design_review_comments, disclaimer_acceptances, listing_drafts, seller_profiles, stripe_events

Notable JSONB columns: `items.photos`, `items.marketplaceData` (eBay category/title cache), `orders.shippingAddress`.

### Auth

JWT access + refresh tokens. bcrypt password hashing. Role column on users (`user` | `admin`). Admin middleware checks `req.user.role`. Promote via `npx tsx apps/api/src/scripts/promote-admin.ts <email>`.

### Marketplace Adapters

Shared TypeScript interface in `packages/shared/src/marketplace.ts`. Three adapters:
- **eBay:** OAuth2 auth code grant, Inventory API (SKU/offer/publish), Fulfillment API, Taxonomy API
- **Etsy:** PKCE OAuth2, Listings API with photo upload, Receipts API, Taxonomy API
- **Reverb:** Adapter implemented (269 lines), comps search working, token-paste auth shipped (Personal Access Token validated against live API)

Marketplace tokens encrypted at rest with AES-256-GCM.

### Listing Flow

Three-interface listing creation: Conversational, Swipe, and Hybrid modes. `useListingFlow` hook with auto-draft persistence. Components in `apps/web/src/components/listing-flow/`.

### AI

- **Item scanning:** Claude Vision API via `apps/api/src/lib/vision.ts`
- **Porter assistant:** Claude Sonnet tool_use loop with 3 tools (search_inventory, get_inventory_stats, suggest_listing)
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
| Shipping routes | apps/api/src/routes/shipping.ts |
| Shipping hooks | apps/web/src/hooks/use-shipping.ts, use-shipping-provider.ts |
| Ship order page | apps/web/src/app/orders/[id]/ship/page.tsx |
| Seller profile settings | apps/web/src/app/settings/seller-profile/page.tsx |
| Shipping settings | apps/web/src/app/settings/shipping/page.tsx |
| Billing settings | apps/web/src/app/settings/billing/page.tsx |
| Billing routes | apps/api/src/routes/billing.ts |
| Reverb adapter | apps/api/src/marketplace/reverb-adapter.ts |
| Reverb auth | apps/api/src/routes/marketplace/reverb-auth.ts |
| Scan flow | apps/web/src/components/capture/scan-flow.tsx |
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

41/52 tasks complete, 3 partial, 8 remaining. See `docs/TODO.md` for full roadmap.

**Done:** Foundation (8/8), AI scanning, image pipeline, marketplace adapters (eBay + Etsy + Reverb comps), Porter AI, auth, admin panel (11/11), repo infra (2/3), scan entry point, orders UI, three-interface listing flow, smart-listing prepare (seller profiles, prepare-listing endpoint, PhotoCaptureFlow, comps/preview), listing detail page, dashboard (spinner fix + TabBar restructure), settings (8 pages: profile, marketplace, seller profile, shipping, notifications, help, admin, billing), listings CRUD (edit/update/delete + marketplace sync), security fixes (C1-C4: order sync matching, XSS elimination, SQL injection, encryption key decoupling), JWT auto-refresh, object URL leak fixes, test infra + 141 tests, auth middleware next(err), TOCTOU race fix, shared logger (28 files), AI SDK singletons, shippingAddress column, pagination, shared format helpers, listing flow component extraction, PWA (icons + favicon + service worker), admin observability (Prometheus + Grafana), bulk operations (select/delete/archive/activate/export), eBay CSV export (Seller Hub Reports draft format), onboarding flow (5-step carousel), Stripe billing (subscriptions + credits + enforcement gates), Reverb token-paste auth, photo tools UX (crop/rotate/enhance/BG-remove with before-after preview).

**Partial:** Shipping (full UI + 16-endpoint API built, rates/labels stubbed — no real carrier API calls).

**Remaining:** Buyer messaging, carrier API integration (EasyPost/Shippo), Reverb OAuth code-grant (token-paste auth is shipped).

**Demo account:** demo@portage.app / demo1234demo1234
