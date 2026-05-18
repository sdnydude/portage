# Portage

AI-powered personal effects inventory and multi-marketplace seller app.

[![CI](https://github.com/sdnydude/portage/actions/workflows/ci.yml/badge.svg)](https://github.com/sdnydude/portage/actions/workflows/ci.yml)
![Node](https://img.shields.io/badge/node-20-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)

Portage helps you catalog what you own, get AI-powered valuations, and sell across eBay and Etsy from a single mobile-first interface. Point your camera at an item, let Claude Vision identify it, then list it on multiple marketplaces with one tap.

## Features

- **AI Item Scanning** — Claude Vision identifies items, estimates value, extracts metadata
- **Photo Pipeline** — Camera capture, R2 cloud storage, auto-enhance, background removal (WASM), crop, rotate, before/after preview
- **Multi-Marketplace** — eBay, Etsy, and Reverb adapters with OAuth2/token auth, listing CRUD, order sync
- **Listing Flow** — Three UX modes (Hybrid, Conversational, Swipe) with AI-generated titles, descriptions, and pricing from comps
- **Porter AI Assistant** — Conversational AI that searches your inventory and suggests listings
- **Billing** — Stripe subscriptions (Free/Pro tiers), credit packs, usage-gated AI tools
- **Bulk Operations** — Multi-select, bulk delete/archive/activate, eBay Seller Hub CSV export
- **Admin Panel** — Dashboard, user management, settings, audit log, Prometheus observability
- **Mobile-First PWA** — 5-tab navigation, designed for phone-in-hand workflows

See the full [Features Reference](https://10.0.0.251:8017/docs/features) for detailed capabilities, unique differentiators, and competitive advantages.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | npm workspaces |
| API | Express 5, TypeScript, pino |
| Frontend | Next.js 16, React 19, Tailwind v4 |
| Database | PostgreSQL 15, Drizzle ORM |
| Auth | JWT + refresh tokens, bcrypt |
| Images | Cloudflare R2, Sharp |
| AI | Claude Sonnet (vision + tool_use) |
| BG Removal | @imgly/background-removal (WASM) |
| Billing | Stripe (subscriptions, webhooks, credits) |
| Marketplaces | eBay (REST), Etsy (REST + PKCE), Reverb (PAT) |
| Encryption | AES-256-GCM (marketplace tokens) |
| Docs | Docusaurus 3.10, nginx, GitHub Actions CI/CD |

## Quick Start (Docker)

```bash
git clone https://github.com/sdnydude/portage.git
cd portage
cp .env.example .env
# Fill in your API keys in .env
docker compose up -d
```

Services will be available at:

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3002 |
| API | http://localhost:8016 |
| Database | localhost:5436 |

## Manual Setup

```bash
# Prerequisites: Node 20, PostgreSQL 15
nvm use
npm install

# Start database (or use Docker for just the DB)
docker compose up -d portage-db

# Push schema
npm run db:push

# Start dev servers
npm run dev:api   # Express on :8016
npm run dev:web   # Next.js on :3002
```

## Project Structure

```
portage/
├── apps/
│   ├── api/          # Express 5 backend
│   │   ├── src/
│   │   │   ├── db/           # Drizzle schema + connection
│   │   │   ├── lib/          # JWT, crypto, storage, vision
│   │   │   ├── marketplace/  # eBay + Etsy adapters
│   │   │   ├── middleware/    # Auth, error handling
│   │   │   ├── routes/       # All API routes
│   │   │   └── scripts/      # Admin promotion
│   │   └── Dockerfile
│   └── web/          # Next.js 16 frontend
│       ├── src/
│       │   ├── app/          # Pages (tabs, admin, auth)
│       │   ├── components/   # UI components
│       │   ├── hooks/        # React hooks
│       │   └── lib/          # API client
│       └── Dockerfile
├── packages/
│   └── shared/       # Types, constants, marketplace interfaces
├── website/          # Docusaurus docs site (deployed via CI)
├── docs/             # TODO roadmap, admin plan
├── docker-compose.yml
└── docker-compose.override.yml  # Dev volume mounts
```

## Scripts

```bash
npm run dev           # All workspaces in dev mode
npm run build         # Production build
npm run typecheck     # TypeScript check (all workspaces)
npm run lint          # ESLint (web)
npm run test:api      # API tests (vitest)
npm run db:push       # Push Drizzle schema to database
npm run db:studio     # Open Drizzle Studio
```

## Demo Account

After starting the app, a demo account is available:

```
Email: demo@portage.app
Password: demo1234demo1234
```

## Design

Forest green (#2D5A27) primary, mobile-first with Instrument Sans display font, Plus Jakarta Sans body, JetBrains Mono for code. Five-tab bottom navigation: Inventory, Listings, Porter, Orders, More.
