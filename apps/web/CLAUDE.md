# apps/web

Next.js 16 frontend. See root CLAUDE.md for architecture overview.

## App Router Structure

```
src/app/
├── (tabs)/          # Bottom nav pages (wrapped with TabBar)
│   ├── home/        # Dashboard
│   ├── inventory/   # Item grid/list
│   ├── listings/    # Active/sold
│   ├── orders/      # Fulfillment
│   ├── porter/      # AI assistant
│   └── more/        # Settings/profile
├── admin/           # Separate layout tree (sidebar nav)
├── inventory/[id]/  # Item detail + edit
├── listings/[id]/   # Listing detail
├── list/            # Create listing entry
├── login/           # Auth
├── register/        # Auth
└── mockups/         # Dev-only UI previews
```

The `(tabs)/layout.tsx` wraps children with bottom padding (`pb-20`) and the `TabBar` component. Routes outside `(tabs)/` don't get the tab bar.

## Component Organization

Directories mirror feature areas, not component types:

| Directory | Contents |
|-----------|----------|
| `capture/` | ScanFlow, ScanFab, CameraCapture, ImagePicker |
| `listing-flow/` | HybridFlow, ConversationalFlow, SwipeFlow, PhotoCaptureFlow, PhotoEditor |
| `listing/` | ListingPreviewCard, CompsPricingWidget, CreateListingSheet |
| `inventory/` | ItemCard, SearchBar, ViewControls |
| `layout/` | PageHeader (sticky top), TabBar (bottom nav + scan FAB) |
| `image/` | BeforeAfterSlider, BgRemovalPanel |
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

localStorage-based (`portage_token`, `portage_refresh`, `portage_user`). No automatic token refresh. No route guards in layout — pages check auth ad-hoc via `useAuth()`.

## Hook Contract

All data hooks return `{ isLoading: boolean, error: string | null, ...data }`. Key hooks:

| Hook | Purpose |
|------|---------|
| `useListingFlow` | Shared state across all three listing modes |
| `useUserPreferences` | Listing UI mode preference (conversational/swipe/hybrid) |
| `useComps` | Comparable listings for pricing |
| `usePrepareListing` | AI field generation |
| `useDrafts` | Draft persistence |
| `useShipping` | Presets, rates, label purchase |
| `useBgRemoval` | @imgly background removal (in-browser) |

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
- **Animations:** `slide-up`, `spring-in`, `shimmer`, `confetti-fall`, `check-draw`
- **Fonts:** `--font-instrument` (display), `--font-plus-jakarta` (body), `--font-jetbrains` (mono)

Glass morphism has `@supports` fallback for browsers without `backdrop-filter`.

## State Management

React Context only — no Zustand/Jotai/Redux. `AuthContext` is the only provider. All other state lives in hooks or component-local `useState`.

## Gotchas

- **HTTPS required for camera:** `getUserMedia` needs secure context. Dev server runs with `--experimental-https` and certs from `../../certs/`
- **Photos in memory:** Captured as `File` objects, previewed via `URL.createObjectURL()`. Large files = memory pressure. No cleanup of object URLs in some flows.
- **Modal z-index:** ScanFlow renders at `z-[60]`. Photo editor overlays inside it.
- **No pagination:** Listing/item hooks load all records at once.
- **Polling HMR:** `WATCHPACK_POLLING=true` required for reliable hot reload over network.
