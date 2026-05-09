# Portage — Tasks Completed & TODO

**Last updated:** 2026-05-09
**Overall progress:** ~55 tasks done / ~74 total (~74%)

---

## Completed Tasks — Last Development Round (May 7–9)

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

### D. Code Health & Production Deployment (commit `0567ab8`)

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

---

## TODO — What Remains

### Critical (blocks real usage)

| # | Task | Why | Est |
|---|------|-----|-----|
| 1 | **Dashboard spinner bug** (Task 51) | `isLoading` stuck true before auth hydrates — home page unusable on cold load | 2h |
| 2 | **Dashboard navigation dead end** | Inventory removed from tab bar, no back-nav from `/inventory` | 1h |
| 3 | **Settings pages 404** (Task 32 gap) | Most More tab links (marketplace, profile, notifications, billing, help) return 404 | 4h |

### High Priority (core product gaps)

| # | Task | Scope | Est |
|---|------|-------|-----|
| 4 | **Listings edit/update/delete** (Task 19 gap) | Detail page exists but no CRUD actions on listings from UI | 4h |
| 5 | **Carrier API integration** (Task 21 gap) | Shipping rates + labels are stubs — need EasyPost/Shippo/Pirate Ship | 8h |
| 6 | **Stripe subscription** (Task 23) | Free/Pro tier billing, usage limit enforcement | 8h |
| 7 | **PWA icons + service worker** (Task 29 gap) | Manifest exists but icons missing, no offline support | 4h |

### Medium Priority (feature completeness)

| # | Task | Scope | Est |
|---|------|-------|-----|
| 8 | **Notification system** (Task 26) | Push notifications + in-app center | 8h |
| 9 | **Onboarding flow** (Task 28) | First-launch guided tour | 6h |
| 10 | **Dashboard trends + insights** (Task 52) | Sparkline charts, AI selling tips, category breakdown | 6h |
| 11 | **Bulk operations** (Task 30) | Multi-select, bulk list/edit/archive | 6h |
| 12 | **Buyer messaging** (Task 31) | View messages, Porter-drafted replies | 8h |
| 13 | **Reverb OAuth** | Adapter works for comps but OAuth not connected for selling | 4h |

### Infrastructure

| # | Task | Scope | Est |
|---|------|-------|-----|
| 14 | **Branch protection** (Task 49) | CI required on main, no force push | 1h |
| 15 | **Integration testing** (Task 35) | Most routes lack test coverage | 16h |
| 16 | **Production Cloudflare config** (Task 34) | Tunnel works but config isn't documented/versioned in repo | 2h |
| 17 | **Enhanced photo persistence** (Task 13 gap) | Before/after shown but no "Replace Photo" action | 2h |

### Known Bugs (from code health audit)

| # | Issue | Severity | Est |
|---|-------|----------|-----|
| 18 | `CORS` in production restricts to single origin — blocks API access from non-tunnel paths | Low | 1h |
| 19 | No pagination on listing/item hooks — will degrade with scale | Medium | 4h |
| 20 | Object URL memory leaks in photo capture flows | Low | 2h |
| 21 | No automatic JWT refresh — silent auth expiry | Medium | 3h |
| 22 | Enhanced photo can't be saved (before/after preview only) | Low | 2h |

---

## Summary

| Category | Count |
|----------|-------|
| Completed (this round) | 55 |
| TODO — Critical | 3 |
| TODO — High Priority | 4 |
| TODO — Medium Priority | 6 |
| TODO — Infrastructure | 4 |
| TODO — Known Bugs | 5 |
| **Total remaining** | **22** |
| **Estimated remaining effort** | **~95 hours** |
