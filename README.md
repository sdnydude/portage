# Portage

AI-powered personal effects inventory and multi-marketplace seller app.

[![CI](https://github.com/sdnydude/portage/actions/workflows/ci.yml/badge.svg)](https://github.com/sdnydude/portage/actions/workflows/ci.yml)
![Node](https://img.shields.io/badge/node-20-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)

Portage helps you catalog what you own, get AI-powered valuations, and sell across eBay and Reverb from a single responsive, mobile-first interface. Point your camera at an item, let AI vision identify it (Gemini 2.5 primary, Claude fallback), then prepare AI-generated listings and publish to each marketplace with an explicit confirm.

## Features

- **AI Item Scanning** — AI vision provider chain (Gemini 2.5 primary, Claude fallback in prod) identifies items, estimates value, extracts metadata
- **Photo Pipeline** — Camera capture, R2 cloud storage, auto-enhance, background removal (server-side portage-rembg), crop, rotate, before/after preview
- **Multi-Marketplace** — eBay and Reverb adapters with OAuth2/PAT auth, listing CRUD, order sync
- **Listing Flow** — Three UX modes (Hybrid, Conversational, Swipe) with AI-generated titles, descriptions, and pricing from comps
- **Porter AI Assistant** — Conversational AI that searches your inventory and suggests listings
- **Billing** — Stripe subscriptions (Free/Pro tiers), credit packs, usage-gated AI tools
- **Bulk Operations** — Multi-select, bulk delete/archive/activate, eBay Seller Hub CSV export
- **Admin Panel** — Dashboard, user management, settings, audit log, Prometheus observability
- **Responsive PWA** — mobile-first, designed for phone-in-hand workflows with a desktop sidebar layout; 5 tabs (Home, Inventory, Listings, Porter, Orders) + center Scan button; More via avatar menu

See the full [Features Reference](http://10.0.0.251:8017/portage/features/) (LAN-only docs site) for detailed capabilities, unique differentiators, and competitive advantages. New to the project? Start with [ONBOARDING.md](./ONBOARDING.md).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | npm workspaces |
| API | Express 5, TypeScript, pino |
| Frontend | Next.js 16, React 19, Tailwind v4 |
| Database | PostgreSQL 15, Drizzle ORM |
| Auth | Cloudflare Access (IdP, no passwords, JWKS-verified) + short-lived internal JWT (15 min) |
| Images | Cloudflare R2, Sharp |
| AI | Vision: provider chain (Gemini 2.5 primary, Claude fallback); Porter assistant: Claude Sonnet (tool_use + SSE streaming) |
| BG Removal | portage-rembg container (server-side, `POST /images/remove-bg`) |
| Billing | Stripe (subscriptions, webhooks, credits) |
| Marketplaces | eBay (Trading API, Trade-First), Reverb (PAT) |
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
│   │   │   ├── marketplace/  # eBay + Reverb adapters
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
└── docker-compose.dev.yml  # Opt-in hot-reload dev overlay (never auto-loaded)
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

Demo credentials live in Doppler (never committed).

## Design

Forest green (#2D5A27) primary, mobile-first with Instrument Sans display font, Plus Jakarta Sans body, JetBrains Mono for code. Bottom navigation: 5 tabs (Home, Inventory, Listings, Porter, Orders) + center Scan button; More via avatar menu.
