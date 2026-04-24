# Portage — 35-Task Roadmap

**Progress: 31/46 complete**

---

## Phase 1: Foundation (Tasks 1-8)

- [x] **Task 1:** Monorepo scaffold — npm workspaces, TypeScript, ESLint, shared package
- [x] **Task 2:** Docker stack — PostgreSQL (5436), Express API (8016), Next.js (3002)
- [x] **Task 3:** Database schema — Drizzle ORM, 7 tables (users, items, images, listings, orders, conversations, notifications, marketplace_accounts)
- [x] **Task 4:** Express API bootstrap — pino logging, error handling, health route
- [x] **Task 5:** Auth system — bcrypt password hashing, JWT + refresh tokens, register/login/refresh routes, 7 tests
- [x] **Task 6:** Next.js frontend — design system (forest green, Instrument Sans/Plus Jakarta/JetBrains Mono), 5-tab mobile nav, Tailwind v4
- [x] **Task 7:** Image pipeline — R2 storage, Sharp processing, upload/resize/webp, auth + file validation
- [x] **Task 8:** Camera capture — device camera access, gallery picker, upload flow

## Phase 2: Core Intelligence (Tasks 9-11)

- [x] **Task 9:** AI scan — Claude vision API, item identification, value estimation, structured metadata extraction
- [x] **Task 10:** Item detail + edit — photo gallery, condition badges, value breakdown, brand/model fields, dirty tracking
- [x] **Task 11:** Inventory UI — search bar, category filters, grid/list toggle, loading/error/empty states, ItemCard component

## Phase 3: Image Processing (Tasks 12-13)

- [x] **Task 12:** Background removal — client-side WASM (@imgly/background-removal), usage credit gating, before/after slider, progress tracking
- [x] **Task 13:** Auto-enhance — server-side Sharp pipeline (normalize + sharpen + modulate), enhance endpoint, before/after comparison

## Phase 4: Marketplace (Tasks 14-20)

- [x] **Task 14:** Marketplace adapter interface — shared TypeScript interface (create/update/delete listing, orders, categories)
- [x] **Task 15:** eBay OAuth2 — auth code grant, connect/callback/status/disconnect routes
- [x] **Task 16:** eBay adapter — Inventory API (SKU → offer → publish), Fulfillment API (orders), Taxonomy API (categories)
- [x] **Task 17:** Etsy PKCE OAuth2 — code_verifier/challenge, connect/callback/status/disconnect routes
- [x] **Task 18:** Etsy adapter — Listings API (create with photo upload), receipts (orders), taxonomy (categories)
- [x] **Task 19:** Listings UI — CRUD + publish, status filter pills (All/Active/Drafts/Sold), create listing sheet, marketplace selector
- [x] **Task 20:** Orders UI — order list with status filters, sync from marketplaces, tracking/carrier updates

## Phase 5: AI Assistant (Tasks 24-25)

- [x] **Task 24:** Porter AI backend — Claude Sonnet tool_use loop, 3 tools (search_inventory, get_inventory_stats, suggest_listing), conversation history in JSONB, free tier 20 msg/day
- [x] **Task 25:** Porter chat UI — message bubbles, typing indicator, suggestion chips, new chat, keyboard enter-to-send

## Phase 6: Auth & Settings (Task 33)

- [x] **Task 33:** Auth flow + settings — login/register pages, AuthProvider, More tab (user info, marketplace/subscription/notification/help links, sign out)

---

## Remaining Tasks

### Shipping & Payments

- [ ] **Task 21:** EasyPost shipping — rate quotes, label generation, tracking integration
- [ ] **Task 23:** Stripe subscription — Free/Pro tier billing, usage limits enforcement

### Notifications & Dashboard

- [ ] **Task 26:** Notification system — push notifications + in-app notification center
- [ ] **Task 27:** Smart momentum dashboard — portfolio value, trends, AI insights

### Onboarding & PWA

- [ ] **Task 28:** Onboarding flow — first-launch experience, guided tour
- [x] **Task 29:** PWA manifest ~~+ service worker + installability~~ *(manifest created; icons + service worker still needed)*

### Bulk & Messaging

- [ ] **Task 30:** Bulk operations — multi-select, bulk list, bulk edit, bulk archive
- [ ] **Task 31:** Buyer messaging — view messages, Porter-drafted replies (eBay)
- [ ] **Task 32:** Settings pages — marketplace management, profile, subscription details

### Admin Panel (Tasks 36-46)

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

### Production & Testing

- [ ] **Task 34:** Cloudflare tunnel + production Docker config
- [ ] **Task 35:** Integration testing + final polish

---

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
