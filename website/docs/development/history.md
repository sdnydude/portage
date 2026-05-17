---
id: history
title: Development History
sidebar_position: 1
---

# Development History

Portage has been built iteratively through a structured AI-assisted development workflow. This page documents the major milestones, PR history, and evolution of the platform.

## Project Timeline

### Week of 2026-04-20 — Foundation

- UX redesign complete (5-tab nav, 14 screens, WCAG compliance)
- Backend architecture finalized via /ship workflow
- eBay comps integrated (Browse API scoped)
- AI stack finalized (5-provider fallback chain)
- Infisical → Doppler migration (154 secrets, 8 projects)
- HTTPS and React 19 bugs fixed

### Week of 2026-04-28 — Infrastructure

- Cloudflare Tunnel (2 subdomains) + R2 infra (CORS, custom domain)
- Auth + scan end-to-end operational
- Fixed 5 bugs: SSL, camera/JSON, validation coercion, CF edge cache, zombie processes
- Rembg Docker service integrated
- UI redesign standards established (Apple minimalist)

### Week of 2026-05-05 — Feature Build

- Security audit: 19 issues fixed (SSRF, auth bypass, races, injection)
- Three-interface listing flow shipped (Conversational/Swipe/Hybrid, 20 commits, PR #25)
- 4 mockup pages deployed
- Production eBay Browse API live ($178 median verified comps)
- PhotoCapture wired to all flows

### 2026-05-09 — Stabilization

- CLAUDE.md audit + package-specific files
- Fixed 8 Dependabot vulnerabilities
- Smart-listing feature (18 tasks)
- Architecture docs (4 SVGs + narrative)
- Code health audit: 6 critical bugs fixed
- Docker production live (SSL, HTTPS, Cloudflare Tunnel)
- Shipped Critical 3+: dashboard, TabBar, settings pages, Porter chat

### 2026-05-10 — Hardening Sprint (25 PRs)

Shipped 25 PRs (#28-52) in a single day:

| PR | Type | Description |
|----|------|-------------|
| #28 | fix | Order sync — marketplaceListingId matching |
| #29 | fix | XSS — dangerouslySetInnerHTML → React component |
| #30 | fix | SQL injection — sql.raw() → parameterized Drizzle |
| #31 | fix | Encryption key decoupled from JWT_SECRET |
| #32 | feat | JWT auto-refresh (401 intercept, singleton dedup) |
| #33 | fix | Object URL memory leaks (revokeObjectURL) |
| #34 | feat | Test infrastructure (vitest, helpers, factories) |
| #35 | feat | P0 unit tests (crypto, jwt, password, auth, errors) |
| #36 | feat | P0 route tests (auth routes, pricing functions) |
| #37 | fix | Auth middleware next(err) instead of throw |
| #38 | fix | Shipping preset TOCTOU race (db.transaction) |
| #39 | refactor | Shared logger (26 pino instances → child loggers) |
| #40 | refactor | AI SDK client singletons (Map-cached) |
| #41 | feat | Order shippingAddress column (JSONB) |
| #42 | feat | Pagination (listings + items, limit/offset/total) |
| #43 | refactor | Shared format helpers (7 duplicates consolidated) |
| #44 | refactor | Listing flow component extraction (3 components) |
| #45 | feat | P1 tests (vision, token-manager, items CRUD) |
| #46 | feat | PWA (dynamic icons, service worker, manifest) |
| #47 | feat | Admin observability (Prometheus + Grafana) |
| #48 | feat | Bulk operations (select/delete/archive/activate) |
| #49 | feat | eBay CSV data export (File Exchange format) |
| #50 | feat | Onboarding flow (5-step carousel) |
| #52 | feat | Unified photo flow (multi-photo ScanFlow rewrite) |

## Test Coverage

93 tests across 12 files:

| Area | Tests | Files |
|------|-------|-------|
| Crypto | 5 | crypto.test.ts |
| JWT | 6 | jwt.test.ts |
| Password | 4 | password.test.ts |
| Auth middleware | 6 | auth.test.ts |
| Error handler | 6 | error-handler.test.ts |
| Auth routes | 7 | auth.routes.test.ts |
| Pricing functions | 8 | prepare-listing.test.ts |
| Vision | 10 | vision.test.ts |
| Token manager | 8 | token-manager.test.ts |
| Items routes | 16 | items.routes.test.ts |
| Scan routes | 12 | scan.routes.test.ts |
| Misc | 5 | various |

### 2026-05-14 — Registry & Code Health

- DHG Registry KB expanded to 835+ records across 9 sources
- Code health assessment: 62 findings fixed, 44 tests added (93→137→141)
- Memory infrastructure audit (6 files repaired, 4 pattern libraries)
- WebP→JPEG marketplace compatibility (PR #63)
- Feedback loops (cron, journal aging, corrections/bug-fix surfacing)

### 2026-05-17 — Billing & Marketplace Polish

| PR | Type | Description |
|----|------|-------------|
| #73 | feat | Stripe billing (subscriptions + credits + webhooks + `stripe_events` table) |
| #74 | feat | Billing enforcement gates (scan/enhance/BG-removal usage limits per tier) |
| #75 | feat | Reverb token-paste auth (PAT validated against live API) |
| #76 | feat | eBay CSV export rewrite (Seller Hub Reports draft format + `marketplaceData` JSONB) |
| #77 | fix | Photo tools UX (iOS aspect-ratio bug, before/after slider, error handling) |

## Test Coverage

141 tests across 14 files:

| Area | Tests | Files |
|------|-------|-------|
| Crypto | 5 | crypto.test.ts |
| JWT | 6 | jwt.test.ts |
| Password | 4 | password.test.ts |
| Auth middleware | 6 | auth.test.ts |
| Error handler | 6 | error-handler.test.ts |
| Auth routes | 7 | auth.routes.test.ts |
| Pricing functions | 8 | prepare-listing.test.ts |
| Vision | 10 | vision.test.ts |
| Token manager | 8 | token-manager.test.ts |
| Items routes | 16 | items.routes.test.ts |
| Scan routes | 12 | scan.routes.test.ts |
| Billing | 12 | billing.test.ts |
| eBay CSV | 20 | ebay-csv.test.ts |
| Admin & misc | 21 | various |

## Current Status

**41/52 tasks complete**, 3 partial, 8 remaining.

### Remaining

- Buyer messaging
- Carrier API integration (EasyPost/Shippo for real rates/labels)
- Reverb OAuth code-grant (token-paste auth is shipped)
