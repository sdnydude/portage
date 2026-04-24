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

Drizzle ORM, schema-push workflow (no migration files). 10 tables:

users, items, images, listings, orders, conversations, notifications, marketplace_accounts, admin_audit_log, app_settings

### Auth

JWT access + refresh tokens. bcrypt password hashing. Role column on users (`user` | `admin`). Admin middleware checks `req.user.role`. Promote via `npx tsx apps/api/src/scripts/promote-admin.ts <email>`.

### Marketplace Adapters

Shared TypeScript interface in `packages/shared/src/marketplace.ts`. Two adapters:
- **eBay:** OAuth2 auth code grant, Inventory API (SKU/offer/publish), Fulfillment API, Taxonomy API
- **Etsy:** PKCE OAuth2, Listings API with photo upload, Receipts API, Taxonomy API

Marketplace tokens encrypted at rest with AES-256-GCM.

### AI

- **Item scanning:** Claude Vision API via `apps/api/src/lib/vision.ts`
- **Porter assistant:** Claude Sonnet tool_use loop with 3 tools (search_inventory, get_inventory_stats, suggest_listing)
- **Background removal:** Client-side WASM (@imgly/background-removal)
- **Auto-enhance:** Server-side Sharp pipeline

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
| Shared types | packages/shared/src/types.ts |
| Docker config | docker-compose.yml + docker-compose.override.yml |
| Environment template | .env.example |

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

## Progress

31/46 tasks complete. See `docs/TODO.md` for full roadmap.

**Done:** Foundation, AI scanning, image pipeline, marketplace adapters (eBay + Etsy), Porter AI, auth, admin panel (17 endpoints, 9 pages).

**Remaining:** Shipping (EasyPost), payments (Stripe), notifications, dashboard, onboarding, PWA service worker, bulk operations, buyer messaging, settings pages, production config, testing.

**Demo account:** demo@portage.app / demo1234demo1234
