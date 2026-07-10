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
- **Auth** (`src/lib/cf-access.ts`, `src/lib/jwt.ts`): Cloudflare Access identity verification + short-lived internal JWT
- **Marketplace adapters** (`src/marketplace/`): eBay, Reverb (Etsy parked 2026-07-09 pending API key approval)
- **AI** (`src/lib/vision.ts`, `src/lib/ai-client.ts`): item scanning via a configurable vision provider chain (Gemini 2.5 primary, Claude fallback)
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
5. The vision provider chain (Gemini 2.5 primary, Claude fallback) analyzes images, returns candidate identifications
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
2. Each adapter's `getOrders()` returns `MarketplaceOrderResult[]`
3. Orders match to listings via `marketplaceListingId`
4. Shipping address stored as JSONB column
5. Order lifecycle: payment_received → shipped → delivered (canceled terminal state)

## Authentication

Cloudflare Access is the identity provider — there are no local passwords:

- **Login**: `GET /auth/session` verifies the `Cf-Access-Jwt-Assertion` header against the team JWKS, auto-provisions the user row on first login, and mints a short-lived (15-minute) internal JWT
- **Internal JWT**: Sent as `Authorization: Bearer` header on every API request
- **Expiry handling**: When the internal JWT expires, the client re-exchanges via CF Access — no refresh tokens

See [Authentication](/docs/api/authentication) for the full API reference.

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| ORM | Drizzle (schema-push) | Type-safe SQL without migration files during rapid development |
| State management | React Context only | Single global provider (`AuthContext`) is sufficient; no Redux/Zustand overhead |
| Image storage | Cloudflare R2 | S3-compatible, no egress fees, CDN-backed with custom domain |
| Secrets | Doppler | Hosted SaaS — self-hosted secrets rot when CEO is the operator |
| AI provider | Provider chain via `VISION_PROVIDERS` | Gemini 2.5 primary for vision (accuracy + cost), Claude fallback; 5-provider chain available |
| Listing UX | Three interfaces | Different mental models for different users; shared state machine underneath |
