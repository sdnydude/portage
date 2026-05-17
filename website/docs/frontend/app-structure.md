---
id: app-structure
title: App Structure
sidebar_position: 1
---

# App Structure

The Portage frontend is a **Next.js 16** app with **React 19**, built as a mobile-first PWA.

## Route Map

### Tab Bar Pages

The main app shell uses a 5-tab bottom navigation with a center camera FAB:

| Route | Tab | Description |
|-------|-----|-------------|
| `/home` | Home | Dashboard with portfolio value, pending shipments, recent listings, stats grid |
| `/inventory` | Inventory | Item grid/list with search, filters, bulk select, export |
| Camera FAB | (center) | Opens ScanFlow modal for photo capture and AI scanning |
| `/orders` | Orders | "Needs Shipping" and "All Orders" sections with marketplace badges |
| `/more` | More | Settings hub with profile, marketplace, shipping, notifications links |

### Detail Pages

| Route | Description |
|-------|-------------|
| `/inventory/[id]` | Item detail: photo gallery, editing tools, eBay comps, listing actions |
| `/inventory/[id]/edit` | Edit form for item fields |
| `/listings/[id]` | Listing detail: inline editing, marketplace sync, publish/archive/delete |
| `/orders/[id]` | Order detail: financials, shipping timeline, buyer info |
| `/orders/[id]/ship` | Shipping workflow: package config, rate shopping, label purchase |

### Listing Flow

| Route | Description |
|-------|-------------|
| `/list` | Entry point — reads user preference, renders Hybrid/Conversational/Swipe flow |

### Auth

| Route | Description |
|-------|-------------|
| `/login` | Email + password sign-in |
| `/register` | Account creation with validation |

### Settings (outside tab bar)

| Route | Description |
|-------|-------------|
| `/settings/profile` | Display name, address |
| `/settings/marketplace` | eBay/Etsy/Reverb connection management |
| `/settings/seller-profile` | Return policy, shipping terms |
| `/settings/shipping` | Ship-from address, presets, carrier API keys |
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
    settings/        Settings pages
  components/
    auth/            AuthProvider context
    capture/         Camera, ScanFlow, ImagePicker
    listing-flow/    Hybrid/Conversational/Swipe flows, photo editing
    listing/         Listing cards, bulk bar, comps widget
    inventory/       Item cards, search, bulk actions
    layout/          PageHeader, TabBar
    image/           Before/after slider, BG removal
    celebration/     Sold confetti animation
    onboarding/      First-run walkthrough
  hooks/             All custom hooks
  lib/               API client, format helpers
```

## State Management

Portage uses **React Context only** — no Redux, Zustand, or other state libraries.

- **`AuthContext`**: The sole global provider. Manages JWT tokens, user object, login/logout, and onboarding state.
- **Page-level state**: Each page manages its own data via custom hooks (`useItems`, `useListings`, `useOrders`, etc.)
- **Listing flow state**: The `useListingFlow` hook is a shared state machine consumed by all three listing interfaces.

## PWA

The app is configured as a Progressive Web App:

- `manifest.json` with Portage branding
- Service worker for offline caching
- Dynamic icons generated via `ImageResponse`
- `ServiceWorkerRegistration` component auto-registers on mount

## Key Architectural Notes

- **Auth model**: localStorage tokens with automatic silent refresh on 401. No route guards in layouts — each page checks `useAuth().isAuthenticated`.
- **Camera access**: Requires HTTPS. Dev mode uses `--experimental-https` with local certs.
- **API client** (`lib/api.ts`): Thin `fetch` wrapper with automatic JWT refresh and error handling via `ApiError` class.
