---
id: overview
title: Architecture Overview
sidebar_position: 1
---

# Architecture Overview

Portage is an npm workspaces monorepo with three packages communicating through a PostgreSQL database and REST API.

## System Diagram

<img src="/portage/img/architecture-system-overview.svg" alt="Portage System Architecture" />

## Data Flow Wiring

<img src="/portage/img/architecture-data-flow.svg" alt="Portage Data Flow Wiring Diagram" />

## Packages

### `apps/api` — Express 5 Backend

The API server handles authentication, CRUD operations, marketplace integrations, and AI pipelines. Key areas:

- **Routes** (`src/routes/`): 20+ route files, 80+ endpoints
- **Auth** (`src/lib/jwt.ts`, `src/lib/password.ts`): JWT access/refresh tokens, bcrypt hashing
- **Marketplace adapters** (`src/marketplace/`): eBay, Etsy, Reverb
- **AI** (`src/lib/vision.ts`): Claude Vision for item scanning
- **Database** (`src/db/`): Drizzle ORM with schema-push workflow

### `apps/web` — Next.js 16 Frontend

Mobile-first PWA with React 19 and Tailwind v4. Features:

- 5-tab bottom navigation (Home, Inventory, Camera FAB, Orders, More)
- Three listing flow interfaces (Conversational, Swipe, Hybrid)
- Admin panel with observability dashboard
- Glass morphism design system with dark mode

### `packages/shared` — Shared Types

TypeScript types, constants, and marketplace interfaces consumed by both `api` and `web`. Must be rebuilt after changes:

```bash
npm run build -w packages/shared
```

## Data Flow

### Item Scanning

1. User captures photo(s) via camera or gallery
2. Photos upload immediately to Cloudflare R2 (`POST /images`)
3. Frontend sends R2 URLs to `POST /scan/refine`
4. API validates URLs against `R2_PUBLIC_URL` prefix (SSRF protection)
5. Claude Vision analyzes images, returns candidate identifications
6. User selects/edits the best candidate
7. Item saves to database with photos and AI metadata

### Listing Creation

1. User enters listing flow (Hybrid, Conversational, or Swipe mode)
2. AI prepares listing fields from item data and eBay comps
3. User configures pricing strategy, shipping, and marketplace
4. Draft auto-saves every 2 seconds via `useDrafts` hook
5. On publish, marketplace adapter creates the remote listing
6. Listing record links to both item and marketplace listing ID

### Order Sync

1. `POST /orders/sync` pulls orders from all connected marketplaces
2. Each adapter's `syncOrders()` returns `MarketplaceOrderResult[]`
3. Orders match to listings via `marketplaceListingId`
4. Shipping address stored as JSONB column
5. Order lifecycle: awaiting_shipment → shipped → delivered

## Authentication

JWT-based with automatic silent refresh:

- **Access token**: Short-lived, sent as `Authorization: Bearer` header
- **Refresh token**: Longer-lived, used to obtain new access tokens
- **401 handling**: `api.ts` client intercepts 401s, deduplicates refresh calls via promise singleton, retries the original request

See [Authentication](/docs/api/authentication) for the full API reference.

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| ORM | Drizzle (schema-push) | Type-safe SQL without migration files during rapid development |
| State management | React Context only | Single global provider (`AuthContext`) is sufficient; no Redux/Zustand overhead |
| Image storage | Cloudflare R2 | S3-compatible, no egress fees, CDN-backed with custom domain |
| Secrets | Doppler | Hosted SaaS — self-hosted secrets rot when CEO is the operator |
| AI provider | Claude Vision (primary) | Best vision model for item identification; 5-provider fallback chain available |
| Listing UX | Three interfaces | Different mental models for different users; shared state machine underneath |
