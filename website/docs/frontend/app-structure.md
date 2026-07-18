---
id: app-structure
title: App Structure
sidebar_position: 1
---

# App Structure

*Last verified: 2026-07-17*

The Portage frontend is a **Next.js 16** app with **React 19**, built as a mobile-first PWA.

For the post-R0 responsive shell (AppShell, Sidebar, TopBar, tab bar), see [Responsive Shell](/docs/frontend/responsive-shell).

## Route Map

### Tab Bar Pages

The mobile shell uses 5 tabs (Home, Inventory, Listings, Porter, Orders) + center Scan button; More via avatar menu. The 5-tab cap follows Apple HIG (iOS 26) guidance, documented in the repo at `docs/research/2026-07-15-apple-hig-ios26-shell-alignment.md`.

| Route | Tab | Description |
|-------|-----|-------------|
| `/home` | Home | Dashboard with portfolio value, pending shipments, recent listings, stats grid |
| `/inventory` | Inventory | Item grid/list with search, filters, bulk select, export |
| `/listings` | Listings | Active and sold listings |
| Scan button | (center) | Opens ScanFlow modal for photo capture and AI scanning |
| `/porter` | Porter | Porter AI assistant (text SSE chat) |
| `/orders` | Orders | Sold-orders list (thumbnail, title, sold date, gross price; Ship It → eBay) |

`/more` is not a tab: it is the Settings hub (profile, marketplace, notifications links), reached via the PageHeader avatar on mobile and the sidebar's secondary "Settings" entry on `lg+`.

### Detail Pages

| Route | Description |
|-------|-------------|
| `/inventory/[id]` | Item detail hub: photo gallery, editing tools, eBay comps, Marketplace Listings cards (price edit, publish w/ recovery, archive/delete, relist, GTC date) |
| `/inventory/[id]/edit` | Edit form for item fields |
| `/inventory/[id]/preview` | Sharable buyer-eye listing preview — renders the share card and captures it as a PNG (native share sheet, download fallback) |
| `/listings/[id]` | Redirect → `/inventory/[itemId]?listing=[id]` — item detail is the canonical page; per-listing actions live on its ListingCards (listing-hub merge, 2026-07) |
| `/orders/[id]` | Order detail: financials, buyer info (shipping labels are handled on eBay — Ship It links out) |
| `/messages` | eBay buyer messaging: conversations list |
| `/messages/[conversationKey]` | Conversation thread with reply |

### Listing Flow

| Route | Description |
|-------|-------------|
| `/list` | Entry point — reads user preference, renders Hybrid/Conversational/Swipe flow |

### Tutorials, Beta & Legal

| Route | Description |
|-------|-------------|
| `/tutorials` | Tutorial hub — topic cards, plus a replay of the onboarding carousel |
| `/tutorials/[topic]` | Step-by-step tutorial for one topic (screenshot + overlay per step) |
| `/beta/report` | Beta feedback form (area, severity, description, screenshot upload) |
| `/legal/privacy` | Privacy policy |
| `/legal/terms` | Terms of service |

### Auth

There are no login or register pages. Cloudflare Access is the identity layer — users authenticate at the CF Access edge before reaching the app, and the frontend exchanges the CF assertion for an internal session via `GET /auth/session`. Logout redirects to the CF Access logout endpoint.

### Settings (outside tab bar)

| Route | Description |
|-------|-------------|
| `/settings/profile` | Display name, address |
| `/settings/marketplace` | eBay/Reverb connection management |
| `/settings/seller-profile` | Return policy, shipping terms |
| `/settings/billing` | Subscription tier, usage, credits, upgrade |
| `/settings/notifications` | Sale alerts, shipping reminders |
| `/settings/help` | FAQ and support |

### Admin Panel

Admin routes use a sidebar layout (collapsible on mobile) and require `role=admin`:

`/admin`, `/admin/users`, `/admin/users/[id]`, `/admin/inventory`, `/admin/listings`, `/admin/orders`, `/admin/porter`, `/admin/marketplace`, `/admin/observability`, `/admin/settings`, `/admin/audit`

## Component Organization

```
src/
  app/              Route pages (Next.js App Router)
    (tabs)/          Tab bar wrapped pages
    admin/           Admin panel (sidebar layout)
    messages/        eBay buyer messaging
    settings/        Settings pages
    tutorials/       Tutorial hub + per-topic step pages
    beta/            Beta feedback report form
    legal/           Privacy policy, terms of service
  components/
    auth/            AuthProvider context
    capture/         Camera, ScanFlow, ImagePicker
    listing-flow/    Hybrid/Conversational/Swipe flows, photo editing
    listing/         Listing cards, bulk bar, comps widget
    inventory/       Item cards, search, bulk actions
    layout/          AppShell, Sidebar, TopBar, PageHeader, TabBar
    image/           Before/after slider
    celebration/     Sold confetti animation
    onboarding/      First-run walkthrough
  hooks/             All custom hooks
  lib/               API client, format helpers
```

The root `app/layout.tsx` wraps everything in [`AppShell`](/docs/frontend/responsive-shell) — the route-aware responsive shell (desktop sidebar + top bar at `lg+`, floating glass tab bar on mobile). `TabBar` mounts once inside `AppShell` for all non-admin routes; `(tabs)/layout.tsx` only adds bottom padding and `PorterProvider`.

## State Management

Portage uses **React Context only** — no Redux, Zustand, or other state libraries.

- **`AuthContext`**: App-wide provider (mounted in `app/layout.tsx`). Manages the internal session token (exchanged from Cloudflare Access), user object, logout, and onboarding state.
- **`PorterProvider`** (`src/hooks/use-porter-context.tsx`): Second provider, mounted by `(tabs)/layout.tsx` — shares Porter assistant state across the tab pages.
- **Page-level state**: Each page manages its own data via custom hooks (`useItems`, `useListings`, `useOrders`, etc.)
- **Listing flow state**: The `useListingFlow` hook is a shared state machine consumed by all three listing interfaces.

## PWA

The app is configured as a Progressive Web App:

- `manifest.json` with Portage branding
- Service worker for offline caching
- Dynamic icons generated via `ImageResponse`
- `ServiceWorkerRegistration` component auto-registers on mount

## Key Architectural Notes

- **Auth model**: Cloudflare Access is the session layer — no passwords. localStorage caches `portage_token` + `portage_user`; on 401 the `api()` wrapper calls `exchangeSession()` (`GET /auth/session` re-verifies the CF assertion) and retries. No route guards in layouts — each page checks `useAuth().isAuthenticated`.
- **Camera access**: Requires HTTPS. Dev mode uses `--experimental-https` with local certs.
- **API client** (`lib/api.ts`): Thin `fetch` wrapper. `API_BASE = NEXT_PUBLIC_API_URL ?? "/backend"` — same-origin `/backend/*` is rewritten by Next to the API container. Automatic session re-exchange on 401 and error handling via `ApiError` class.
