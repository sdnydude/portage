# apps/web

Next.js 16 frontend. See root CLAUDE.md for architecture overview.

## App Router Structure

```
src/app/
├── (tabs)/          # 4 tabs (Home, Inventory, Porter, Orders) + center Scan button; Listings reached via Home/Inventory; More via avatar menu
│   ├── home/        # Dashboard
│   ├── inventory/   # Item grid/list
│   ├── listings/    # Active/sold
│   ├── orders/      # Sold list (thumbnail/title/date/price; Ship-It → eBay)
│   ├── porter/      # AI assistant
│   └── more/        # Settings hub — reached via avatar menu, not a bottom-nav tab
├── admin/           # Separate layout tree (sidebar nav)
├── inventory/[id]/  # Item detail + edit + Marketplace Listings section (ListingCard) + /preview PNG-share subroute
├── listings/[id]/   # Redirect → /inventory/[itemId]?listing=[id] (hub)
├── list/            # Create listing entry
├── orders/[id]/     # Order detail
├── messages/        # eBay buyer messaging (conversations list + thread view)
└── settings/        # 7 settings pages (profile, marketplace, seller-profile, billing, notifications, help, sync-log)
```

The root `app/layout.tsx` wraps everything in `AppShell` (route-aware responsive shell: desktop sidebar, iPad breakpoints, mobile floating glass `TabBar`). `(tabs)/layout.tsx` only adds bottom padding (`pb-24`) and `PorterProvider` — `TabBar` mounts once inside `AppShell` for all non-admin routes, not per-layout.

## Component Organization

Directories mirror feature areas, not component types:

| Directory | Contents |
|-----------|----------|
| `capture/` | ScanFlow, ScanFab, CameraCapture, CaptureSheet, ImagePicker |
| `listing-flow/` | HybridFlow, ConversationalFlow, SwipeFlow, PhotoCaptureFlow, PhotoEditor, CropTool, PhotoGrid, PricingStrategyPicker |
| `listing/` | ListingCard, ListingPreviewCard, CompsPricingWidget, CreateListingSheet, BulkListingBar |
| `inventory/` | ItemCard, SearchBar, ViewControls, BulkActionBar |
| `layout/` | AppShell (route-aware responsive shell), Sidebar (desktop/iPad collapsible nav rail), TopBar (desktop header), PageHeader (sticky top, mobile), TabBar (floating glass bottom nav + scan FAB) |
| `workbench/` | R2 desktop drag-drop ingest — DesktopIngestPanel, DropZone, IngestQueue |
| `porter/` | R3 Porter dock — PorterDock, conversation-history UI |
| `image/` | BeforeAfterSlider |
| `onboarding/` | OnboardingFlow (5-step first-run carousel) |
| `celebration/` | SoldCelebration |
| `auth/` | AuthProvider |

All components are `"use client"`.

## API Client

`src/lib/api.ts` — thin fetch wrapper, not axios.

```typescript
const data = await api<MyType>('/path', {
  method: 'POST',
  body: { ... },
  token: authToken,
});
```

- Bearer token passed per-call (no global interceptor)
- Throws `ApiError` with `status`, `code`, `details[]` on 4xx/5xx
- Base URL: `NEXT_PUBLIC_API_URL` env var, falls back to prod domain

## Auth

Cloudflare Access is the identity/session layer — no password, no refresh token. localStorage caches `portage_token` + `portage_user`. On 401, `api()` calls `exchangeSession()` (`GET /auth/session`, re-verifies the CF Access assertion) for a fresh internal token, retries the request, and syncs React state through the `setOnSessionExchanged` callback. No route guards in layout — pages check auth ad-hoc via `useAuth()`. Logout redirects to the CF Access logout endpoint.

## Hook Contract

All data hooks return `{ isLoading: boolean, error: string | null, ...data }` — except the scan-aspects pair, which expose typed error *signals* instead of a string (`isError` / `aspectsError` / `resolveError`) because the UI branches on them. Key hooks:

| Hook | Purpose |
|------|---------|
| `useAuth` | Auth state, token, login/logout |
| `useListingFlow` | Shared state across all three listing modes |
| `useUserPreferences` | Listing UI mode preference (conversational/swipe/hybrid) |
| `useComps` | Comparable listings for pricing |
| `usePrepareListing` | AI field generation |
| `useDrafts` | Draft persistence |
| `useBgRemoval` | Background removal via API (`POST /images/remove-bg`, server-side rembg) |
| `useEnhance` | AI photo enhancement (server-side Sharp) |
| `useConversations` | eBay message conversation list |
| `useConversationMessages` | Messages in a single thread |
| `useReply` | Send reply to eBay buyer |
| `useSync` | Trigger eBay message sync |
| `useUnreadCount` | Unread message count for badges |
| `useItems` | Item list with pagination |
| `useItem` | Single item fetch/update/delete |
| `useListings` | Listing list + CRUD (create, update, publish, delete) |
| `useOrders` | Orders list + sync |
| `useOnboarding` | Onboarding completion state |
| `useExport` | Data export (CSV download) |
| `useBulkSelect` | Multi-select state for bulk actions |
| `usePhotoDrag` | Touch-capable long-press drag reorder for photo grids/strips |
| `useDesktopIngest` | R2 desktop drag-drop file ingest + queue state |
| `useSyncStatus` | Marketplace sync status polling + retry (sync-log badges, settings screen) |
| `useRequiredAspects` | eBay category aspect schema: `{ aspects, isLoading, isError, refetch }` — `isError` means "unknown", never "nothing required" (P3) |
| `useScanAspects` | Scan-time category resolution + aspect values; exposes `aspectsError`, `refetchAspects`, `resolveError` (seq-guarded, prior resolution retained) and `aspectsBlockPublish` (includes the error) |

## Listing Flow Modes

Three UX paths, one backend. User preference stored via `useUserPreferences()`:

- **Hybrid** (default) — chat guidance + inline cards + photo hero
- **Conversational** — Porter-guided Q&A, step by step
- **Swipe** — card stack for rapid entry

Common path: photos → metadata → marketplace → publish → confetti.

## Styling

Tailwind v4 via CSS `@theme` in `globals.css` (not a config file). Key patterns:

- **Glass morphism:** `.glass-thick`, `.glass-regular`, `.glass-thin` (backdrop-filter + rgba bg)
- **Dark mode:** CSS `prefers-color-scheme` media query on `:root` variables
- **Safe area:** `env(safe-area-inset-bottom)` on tab bar and modals (notch devices)
- **Animations:** `slide-up`, `slide-up-full`, `spring-in`, `shimmer`, `confetti-fall`, `check-draw`, `fade-in`
- **Fonts:** `--font-instrument` (display), `--font-plus-jakarta` (body), `--font-jetbrains` (mono)

Glass morphism has `@supports` fallback for browsers without `backdrop-filter`.

## State Management

React Context only — no Zustand/Jotai/Redux. Two providers: `AuthProvider` (app-wide, in app/layout.tsx) and `PorterProvider` (src/hooks/use-porter-context.tsx, Porter feature scope). All other state lives in hooks or component-local `useState`.

## Gotchas

- **HTTPS required for camera:** `getUserMedia` needs secure context. Dev server runs with `--experimental-https` and certs from `../../certs/`
- **Photos in memory:** Captured as `File` objects, previewed via `URL.createObjectURL()`. Large files = memory pressure. No cleanup of object URLs in some flows.
- **Modal z-index:** ScanFlow renders at `z-[60]`. Photo editor overlays inside it.
- **Polling HMR:** `WATCHPACK_POLLING=true` required for reliable hot reload over network.
- **iOS aspect-ratio collapse:** Never use `aspect-ratio` (Tailwind `aspect-square`) inside flex + overflow-hidden containers — iOS WebKit collapses to 0px. Use `paddingBottom: "100%"` percentage trick instead (see `BeforeAfterSlider`).
- **Docker no hot-reload:** Production containers don't reflect code changes without `docker compose up -d --build portage-app`.
- **Tutorial screenshots rot:** `/tutorials` pages render PNGs from `public/tutorials/**` captured by `npm run capture:tutorials` (needs the app running; not in CI). After any visible UI change to home, inventory, listings, orders, settings, porter, or messages screens, re-run the capture and commit the updated PNGs — overlay coords live in `src/lib/tutorials/*` next to each topic's capture manifest. After recapturing, verify overlay placement with `node scripts/render-tutorial-steps.mjs [topic ...]` (renders every step via a dev server and screenshots them for visual review).
