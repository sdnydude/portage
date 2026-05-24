# Portage — Roadmap

**Progress: 47/52 tasks complete · 2 partial · 3 remaining · 10 TODO items (~44h est)**
**Last updated:** 2026-05-24

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
- [x] **Task 19:** Listings UI — status filter pills, listing cards, create listing sheet, detail page with edit/update/delete + marketplace sync (PR #27)
- [x] **Task 20:** Orders UI — order list with status filters, sync from marketplaces, tracking/carrier updates

## Phase 5: AI Assistant (Tasks 24-25) — 2/2

- [x] **Task 24:** Porter AI backend — Claude Sonnet tool_use loop, 3 tools (search_inventory, get_inventory_stats, suggest_listing), conversation history in JSONB, free tier 20 msg/day. Fixed Zod validation bug rejecting null conversationId (9f8db4e).
- [x] **Task 25:** Porter chat UI — message bubbles, typing indicator, suggestion chips, new chat, keyboard enter-to-send

## Phase 6: Auth (Task 33) — 1/1

- [x] **Task 33:** Auth flow — login/register pages, AuthProvider, More tab (user info, setting links, sign out). *(Settings link destinations are Task 32.)*

## Phase 7: Dashboard (Task 27) — 1/1

- [x] **Task 27:** Smart momentum dashboard — Home tab with greeting, portfolio value card, stat cards (active listings, monthly revenue), momentum tips, quick actions, recent items/orders. Spinner bug fixed (949a8dd). TabBar restructured to 5 tabs: Home/Inventory/Scan/Orders/More (84ba9ee). **GAP: no trends (charts/sparklines), no AI insights as originally scoped.**

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

## Phase 9: Repo Infrastructure (Tasks 47-49) — 3/3 ✓

- [x] **Task 47:** GitHub repo setup — README.md, CLAUDE.md, CI workflow (lint + typecheck + test + build), dependabot, PR/issue templates
- [x] **Task 48:** ESLint fixes — disabled React 19 set-state-in-effect rule, fixed ref-during-render, CI green
- [x] **Task 49:** Branch protection — CI required on main, no force push *(verified: PR #69 shows all 3 checks required and passing)*

---

## Remaining Tasks

### Scan & Camera (Task 8 fixed)

- [x] **Task 50:** Scan entry point — FAB in tab layout on all tabs, wires CaptureSheet → image upload → AI scan → review screen → create item → navigate to detail. z-index fix for sheet overlay. *(Requires valid ANTHROPIC_API_KEY in .env for Claude Vision.)*

### Listings Completion (fix Task 19)

- [x] **Task 53:** Listing detail page — `/listings/[id]` with listing info, edit price, update status, delete listing, link to marketplace

### Shipping & Payments

- [~] **Task 21:** Shipping system — presets CRUD, provider config, rate quotes, label purchase, ship flow, shipping settings page (638-line API, 822-line ship page). **GAP: Rates and labels return hardcoded stub data. No actual EasyPost/Shippo/Pirate Ship API calls — provider config validated but external APIs never invoked. Stub label purchase no longer mutates order state (fixed 0567ab8).**
- [x] **Task 23:** Stripe subscription — Free/Pro tier billing ($39/mo, $390/yr), 7-day trial, credit packs, usage limits enforcement (marketplace count, bg-removal, AI listings, Porter exchanges). PRs #73, #74.

### Settings

- [x] **Task 32:** Settings pages — 7 settings pages live: profile (with GET/PATCH /users/me API), marketplace accounts (connect/disconnect), seller profile, shipping, notifications (toggle switches), help (FAQ accordion), admin panel (admin-only). More page expanded with full navigation (ad03728). Only remaining gap: subscription/billing page (depends on Stripe — Task 23).

### Production & Testing

- [~] **Task 34:** Cloudflare tunnel + production Docker config — tunnel live (`portage.digitalharmonyai.com`, `portage-api.digitalharmonyai.com`), Docker production mode working with HTTPS cert mount. **GAP: config not versioned in repo.**
- [ ] **Task 35:** Integration testing + final polish

---

## TODO — Prioritized

### Critical (blocks real usage)

All critical items resolved (2026-05-09):
- ~~Dashboard spinner bug~~ — Fixed (949a8dd)
- ~~Dashboard navigation dead end~~ — TabBar restructured to 5 tabs (84ba9ee)
- ~~Settings pages 404~~ — 5 new pages + expanded More hub (ad03728→b5f0f33)
- ~~Porter chat broken~~ — Fixed Zod null validation (9f8db4e)

### High Priority (core product gaps)

| # | Task | Scope | Est |
|---|------|-------|-----|
| 4 | ~~Listings edit/update/delete~~ (Task 19 gap) | ✅ Done (PR #27) | — |
| 5 | **Carrier API integration** (Task 21 gap) | Shipping rates + labels are stubs — need EasyPost/Shippo/Pirate Ship | 8h |
| 6 | ~~Stripe subscription~~ (Task 23) | ✅ Done (PRs #73, #74) | — |
| 7 | ~~PWA icons + service worker~~ (Task 29 gap) | ✅ Done (PR #46) | — |

### Medium Priority (feature completeness)

| # | Task | Scope | Est |
|---|------|-------|-----|
| 8 | **Notification system** (Task 26) | Push notifications + in-app center | 8h |
| 9 | ~~Onboarding flow~~ (Task 28) | ✅ Done (PR #50) | — |
| 10 | **Dashboard trends + insights** (Task 52) | Sparkline charts, AI selling tips, category breakdown | 6h |
| 11 | ~~Bulk operations~~ (Task 30) | ✅ Done (PR #48) | — |
| 12 | ~~Buyer messaging~~ (Task 31) | ✅ Done (PR #84) | — |
| 13 | **Reverb OAuth** | Token-paste auth shipped (PR #79); full OAuth code-grant still needed for selling | 4h |

### Infrastructure

| # | Task | Scope | Est |
|---|------|-------|-----|
| 14 | ~~Branch protection~~ (Task 49) | ✅ Done (PR #69) | — |
| 15 | **Integration testing** (Task 35) | 238 tests exist but many routes still uncovered | 12h |
| 16 | **Version tunnel config** (Task 34 gap) | Tunnel works but config isn't in the repo | 2h |
| 17 | **Enhanced photo persistence** (Task 13 gap) | Before/after shown but no "Replace Photo" action | 2h |

### Known Bugs (from code health audit — 2026-05-09)

| # | Issue | Severity | Est |
|---|-------|----------|-----|
| 18 | `CORS` in production restricts to single origin — blocks API access from non-tunnel paths | Low | 1h |
| 19 | No pagination on listing/item hooks — will degrade with scale | Medium | 4h |
| 20 | ~~Object URL memory leaks in photo capture flows~~ | ✅ Fixed | — |
| 21 | ~~No automatic JWT refresh — silent auth expiry~~ | ✅ Fixed (auto-refresh on 401) | — |
| 22 | Enhanced photo can't be saved (before/after preview only) | Low | 2h |

---

## Completed Work — May 7–9 Development Round

### A. Three-Interface Listing Flow (PR #25 — 25 commits)

| # | Task | Commit |
|---|------|--------|
| 1 | Listing flow mockup demos (AI scanning, comps, shipping, post-publish) | `b7586d3` |
| 2 | Security: fix 3 HIGH + 1 MEDIUM CVEs | `8b99a10` |
| 3 | API endpoint hardening from code review | `894f839` |
| 4 | Design spec + review iterations | `de4853f`, `18233ce` |
| 5 | Implementation plan | `95e3838` |
| 6 | Schema: `listing_drafts` table, user prefs columns, reverb marketplace type | `d3b3e58` |
| 7 | Shared: fix MarketplaceType union to include reverb | `4661f3c` |
| 8 | API: Drafts CRUD route with upsert + stale cleanup | `14b561b` |
| 9 | API: User preferences GET/PATCH route | `c2eab2b` |
| 10 | Scan: `detail=full` multi-candidate recognition with reasoning | `c318de4` |
| 11 | API: mount drafts/preferences routes, add reverb to adapter factory | `4d7be8d` |
| 12 | Review fixes: unique constraint on drafts, type alignment | `5698a77` |
| 13 | Web: `useUserPreferences` hook | `7bfce44` |
| 14 | Web: `useDrafts` hook with debounced auto-save + retry | `dbe9fd2` |
| 15 | Web: `useListingFlow` shared state hook | `8c7e022` |
| 16 | Web: `RecognitionFork` component (smart-default item identification) | `ef6cb07` |
| 17 | Web: `FeeEstimate` + `PublishSuccess` shared components | `4a0485a` |
| 18 | Web: **HybridFlow** — Interface C (chat + inline cards + compact form) | `c3f86b7` |
| 19 | Web: **ConversationalFlow** — Interface A (Porter chat + pill actions) | `44f3817` |
| 20 | Web: **SwipeFlow** — Interface B (full-screen cards, speed-first) | `3a25087` |
| 21 | Web: `/list` page with conditional interface rendering | `6f58fc2` |
| 22 | Web: Listing detail page (status, inline edit, cross-list nudge) | `d42a90d` |
| 23 | Web: Photo FAB on home, empty state update, List for Sale button | `34ddc6b` |
| 24 | Web: `PhotoCapture` component (camera, upload, theme adaptation) | `4e37cb7` |
| 25 | Wire PhotoCapture into all three interfaces + comps search | `5ef6285`, `6c0ba14` |

### B. Smart Listing Prepare (13 commits)

| # | Task | Commit |
|---|------|--------|
| 26 | Shared types: `PreparedListingData`, `SellerProfile`, pricing types | `5e56f34` |
| 27 | DB: `seller_profiles` table for marketplace account settings | `a36b6d9` |
| 28 | API: rotate + crop image endpoints | `fed3df0` |
| 29 | API: seller profile route with eBay policies fetch | `ac8099d` |
| 30 | API: **Reverb marketplace adapter** (264 lines, comps search) | `7541356` |
| 31 | API: eBay category suggestion, aspects, full inventory fields | `a6ab9b8` |
| 32 | API: **prepare-listing endpoint** — AI field gen + comps pricing | `f693219` |
| 33 | Web: listing flow components (CompsWidget, PreviewCard) + seller profile page | `27c1ca2` |
| 34 | Web: `usePrepareListing` hook | `621fc26` |
| 35 | Web: wire PhotoCaptureFlow + ListingPreviewCard into all listing flows | `3918f32` |

### C. Developer Infrastructure (12 commits)

| # | Task | Commit |
|---|------|--------|
| 36 | Root + package-specific CLAUDE.md files | `f63cb62` |
| 37 | Resolve all 8 Dependabot vulnerabilities (bcrypt@6, npm overrides) | `b738bbb` |
| 38 | `/sync-memory` command + session-end hook + daily cron | `afe6300` |
| 39 | Session capture hook to AI Factory registry | `ea29360` |
| 40 | Decision log memory type with 5 seed decisions | `de22232` |
| 41 | SessionStart briefing hook (cold-start context injection) | `3cd4a0a` |
| 42 | Memory intelligence design spec + implementation | `a1cfb0a`→`abb4c9f` |
| 43 | Memory intelligence review — 6 findings fixed | `81d12ae` |
| 44 | Stop hook fixes (SIGPIPE, hanging) | `a2dfc21`, `7d5dd70` |
| 45 | Documentation sync (TODO.md, CLAUDE.md, architecture diagrams) | `4a3fccc`, `24f617c` |

### D. Code Health & Production Deployment (`0567ab8`)

| # | Task | Files |
|---|------|-------|
| 46 | ILIKE wildcard escape — admin.ts (2 locations) | `apps/api/src/routes/admin.ts` |
| 47 | ILIKE escape — porter.ts (AI tool input) | `apps/api/src/routes/porter.ts` |
| 48 | ILIKE backslash escape fix — items.ts | `apps/api/src/routes/items.ts` |
| 49 | AI tool-use loop iteration cap (MAX_TOOL_ITERATIONS=10) | `apps/api/src/lib/ai-client.ts` |
| 50 | Stub shipping label — stops mutating real order state | `apps/api/src/routes/shipping.ts` |
| 51 | Frontend: conditional label URL rendering (no `href="null"`) | `apps/web/src/app/orders/[id]/ship/page.tsx` |
| 52 | `LabelResponse` interface update (nullable URL, isStub flag) | `apps/web/src/hooks/use-shipping.ts` |
| 53 | Dockerfile fixes — `tsconfig.base.json` copy (×4 files) | `apps/api/Dockerfile`, `.dev`, `apps/web/Dockerfile`, `.dev` |
| 54 | Docker production: cert volume mount + HTTPS healthcheck | `docker-compose.yml` |
| 55 | Production deployment — full stack running with HTTPS via Cloudflare tunnel | (runtime) |

### E. Critical 3+ Ship (11 commits — 949a8dd→9f8db4e)

| # | Task | Commit |
|---|------|--------|
| 56 | Fix dashboard infinite spinner on cold load | `949a8dd` |
| 57 | Restructure TabBar: Home/Inventory/Scan/Orders/More | `84ba9ee` |
| 58 | Expand More page with 7 settings links + admin-only gate | `ad03728` |
| 59 | API: GET/PATCH `/users/me` + GET `/users/me/marketplace-accounts` | `aac0eac` |
| 60 | Profile settings page (display name, email, address) | `f86fe1b` |
| 61 | Marketplace accounts settings page (connect/disconnect) | `cad02be` |
| 62 | Help & Support page (FAQ accordion, contact) | `1fbbe74` |
| 63 | Notification preferences page (5 toggle switches) | `404be55` |
| 64 | Review fixes: error states, aria labels, address dirty tracking | `b5f0f33` |
| 65 | Fix toggle race condition in notification preferences | `922eabd` |
| 66 | Fix Porter chat: Zod `.optional()` → `.nullish()` for null conversationId | `9f8db4e` |

### F. eBay Buyer Messaging (PR #84 — 4 commits)

| # | Task | Commit |
|---|------|--------|
| 67 | API: eBay Trading API client (XML), message sync, conversation grouping, reply endpoint, 20 tests | `911eb3b` |
| 68 | Web: conversations list, thread view, reply composer, unread badge | `5534173` |
| 69 | Fix: 18 advisor review findings (auth gates, error display, fetch rename, Re: dedup) | `3a60fdd` |
| 70 | Fix: 11 PR findings + 5 wiring issues (non-XML guard, per-msg errors, conversationKey validation) | `fd8c825` |

---

## Summary

| Category | Count |
|----------|-------|
| Completed (all time) | 47 roadmap tasks + 70 subtasks |
| Partial | 2 (shipping stubs, CF tunnel config) |
| TODO — Critical | 0 (all resolved) |
| TODO — High Priority | 1 (carrier API) |
| TODO — Medium Priority | 3 (notifications, dashboard trends, Reverb OAuth) |
| TODO — Infrastructure | 3 (integration testing, tunnel config, photo persistence) |
| TODO — Known Bugs | 3 (CORS, pagination, photo save) |
| **Total remaining items** | **10** |
| **Estimated remaining effort** | **~44 hours** |

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
| Marketplaces | eBay (REST), Etsy (REST + PKCE), Reverb (REST, OAuth pending) |
| Token encryption | AES-256-GCM |

## Ports

| Service | Port |
|---------|------|
| portage-db | 5436 |
| portage-api | 8016 |
| portage-app | 3002 |

## Demo Account

`demo@portage.app` / `demo1234demo1234` — 16 items, Pro tier (promoted 2026-05-09, all limits removed)
