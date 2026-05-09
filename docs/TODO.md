# Portage — Roadmap

**Progress: 37/52 complete · 3 partial · 12 remaining**

---

## Phase 1: Foundation (Tasks 1-8) — 8/8

- [x] **Task 1:** Monorepo scaffold — npm workspaces, TypeScript, ESLint, shared package
- [x] **Task 2:** Docker stack — PostgreSQL (5436), Express API (8016), Next.js (3002)
- [x] **Task 3:** Database schema — Drizzle ORM, 10 tables (users, items, images, listings, orders, conversations, notifications, marketplace_accounts, admin_audit_log, app_settings)
- [x] **Task 4:** Express API bootstrap — pino logging, error handling, health route
- [x] **Task 5:** Auth system — bcrypt password hashing, JWT + refresh tokens, register/login/refresh routes, 7 tests
- [x] **Task 6:** Next.js frontend — design system (forest green, Instrument Sans/Plus Jakarta/JetBrains Mono), 5-tab mobile nav, Tailwind v4
- [x] **Task 7:** Image pipeline — R2 storage, Sharp processing, upload/resize/webp, auth + file validation
- [x] **Task 8:** Camera capture — `useCamera` hook, `CaptureSheet`, `CameraCapture`, `ImagePicker` components, scan FAB in tab layout

## Phase 2: Core Intelligence (Tasks 9-11) — 3/3

- [x] **Task 9:** AI scan — Claude Vision API, item identification, value estimation, structured metadata extraction
- [x] **Task 10:** Item detail + edit — photo gallery, condition badges, value breakdown, brand/model fields, dirty tracking
- [x] **Task 11:** Inventory UI — search bar, category filters, grid/list toggle, loading/error/empty states, ItemCard component

## Phase 3: Image Processing (Tasks 12-13) — 2/2

- [x] **Task 12:** Background removal — client-side WASM (@imgly/background-removal), usage credit gating, before/after slider, progress tracking. Accessible from item detail page.
- [x] **Task 13:** Auto-enhance — server-side Sharp pipeline (normalize + sharpen + modulate), enhance endpoint, before/after comparison. *(Minor gap: enhanced photo cannot be saved/persisted — before/after is shown but no "Replace Photo" action exists.)*

## Phase 4: Marketplace (Tasks 14-20) — 6/7

- [x] **Task 14:** Marketplace adapter interface — shared TypeScript interface (create/update/delete listing, orders, categories)
- [x] **Task 15:** eBay OAuth2 — auth code grant, connect/callback/status/disconnect routes
- [x] **Task 16:** eBay adapter — Inventory API (SKU → offer → publish), Fulfillment API (orders), Taxonomy API (categories)
- [x] **Task 17:** Etsy PKCE OAuth2 — code_verifier/challenge, connect/callback/status/disconnect routes
- [x] **Task 18:** Etsy adapter — Listings API (create with photo upload), receipts (orders), taxonomy (categories)
- [~] **Task 19:** Listings UI — status filter pills, listing cards, create listing sheet (from item detail). **GAP: No edit, update, or delete listing from UI (detail page exists).**
- [x] **Task 20:** Orders UI — order list with status filters, sync from marketplaces, tracking/carrier updates

## Phase 5: AI Assistant (Tasks 24-25) — 2/2

- [x] **Task 24:** Porter AI backend — Claude Sonnet tool_use loop, 3 tools (search_inventory, get_inventory_stats, suggest_listing), conversation history in JSONB, free tier 20 msg/day
- [x] **Task 25:** Porter chat UI — message bubbles, typing indicator, suggestion chips, new chat, keyboard enter-to-send

## Phase 6: Auth (Task 33) — 1/1

- [x] **Task 33:** Auth flow — login/register pages, AuthProvider, More tab (user info, setting links, sign out). *(Settings link destinations are Task 32.)*

## Phase 7: Dashboard (Task 27) — 0/1

- [~] **Task 27:** Smart momentum dashboard — Home tab with greeting, portfolio value card, stat cards (active listings, monthly revenue), momentum tips, quick actions, recent items/orders. **GAP: no trends (charts/sparklines), no AI insights as originally scoped. Inventory removed from tab bar creates navigation dead end (no back affordance from /inventory). Dashboard spinner bug (isLoading initializes true before auth hydrates).**

## Phase 8: Admin Panel (Tasks 36-46) — 11/11

- [x] **Task 36:** DB migration — add `role`, `disabled_at`, `disabled_reason` to users; create `admin_audit_log` + `app_settings` tables
- [x] **Task 37:** Auth changes — JWT `role` field, `requireAdmin` middleware, admin seed script
- [x] **Task 38:** Admin API: dashboard stats + activity feed (`/admin/stats`, `/admin/activity`)
- [x] **Task 39:** Admin API: user management — list, detail, update role/tier, disable, delete, reset usage
- [x] **Task 40:** Admin API: inventory + listings + orders browse (all users, paginated, filterable)
- [x] **Task 41:** Admin API: Porter stats + conversation browser, marketplace health
- [x] **Task 42:** Admin API: app settings CRUD + audit log
- [x] **Task 43:** Admin frontend: layout (sidebar nav, top bar, middleware guard, responsive)
- [x] **Task 44:** Admin frontend: dashboard page (KPI cards, charts, activity feed)
- [x] **Task 45:** Admin frontend: user management (list + detail with tabs)
- [x] **Task 46:** Admin frontend: inventory/listings/orders/porter/marketplace/settings/audit pages

## Phase 9: Repo Infrastructure (Tasks 47-49) — 2/3

- [x] **Task 47:** GitHub repo setup — README.md, CLAUDE.md, CI workflow (lint + typecheck + test + build), dependabot, PR/issue templates
- [x] **Task 48:** ESLint fixes — disabled React 19 set-state-in-effect rule, fixed ref-during-render, CI green
- [ ] **Task 49:** Branch protection — CI required on main, no force push *(configured via API, not yet verified with a test PR)*

---

## Remaining Tasks

### Scan & Camera (Task 8 fixed)

- [x] **Task 50:** Scan entry point — FAB in tab layout on all tabs, wires CaptureSheet → image upload → AI scan → review screen → create item → navigate to detail. z-index fix for sheet overlay. *(Requires valid ANTHROPIC_API_KEY in .env for Claude Vision.)*

### Dashboard Fixes (fix Task 27)

- [ ] **Task 51:** Dashboard bug fixes — fix isLoading spinner bug, add inventory back to tab bar (or add back-nav from /inventory), fix pathname matching for Home tab, add 401 error recovery
- [ ] **Task 52:** Dashboard trends & insights — sparkline charts for portfolio value over time, AI-generated selling tips from Porter, category breakdown visualization

### Listings Completion (fix Task 19)

- [x] **Task 53:** Listing detail page — `/listings/[id]` with listing info, edit price, update status, delete listing, link to marketplace

### Shipping & Payments

- [ ] **Task 21:** EasyPost shipping — rate quotes, label generation, tracking integration
- [ ] **Task 23:** Stripe subscription — Free/Pro tier billing, usage limits enforcement

### Notifications

- [ ] **Task 26:** Notification system — push notifications + in-app notification center

### Onboarding & PWA

- [ ] **Task 28:** Onboarding flow — first-launch experience, guided tour
- [~] **Task 29:** PWA manifest — manifest.json created + linked. **GAP: icon-192.png and icon-512.png do not exist. Service worker not implemented.**

### Bulk & Messaging

- [ ] **Task 30:** Bulk operations — multi-select, bulk list, bulk edit, bulk archive
- [ ] **Task 31:** Buyer messaging — view messages, Porter-drafted replies (eBay)

### Settings

- [ ] **Task 32:** Settings pages — marketplace management, profile, subscription details, notification preferences, help. *(More tab links to these but all currently 404.)*

### Production & Testing

- [ ] **Task 34:** Cloudflare tunnel + production Docker config
- [ ] **Task 35:** Integration testing + final polish

---

## Legend

- [x] = Complete and verified
- [~] = Partial — core exists but has documented gaps
- [ ] = Not started

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
| Marketplaces | eBay (REST), Etsy (REST + PKCE) |
| Token encryption | AES-256-GCM |

## Ports

| Service | Port |
|---------|------|
| portage-db | 5436 |
| portage-api | 8016 |
| portage-app | 3002 |

## Demo Account

`demo@portage.app` / `demo1234demo1234` — 5 items seeded
