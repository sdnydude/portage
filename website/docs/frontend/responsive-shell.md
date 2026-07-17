---
id: responsive-shell
title: Responsive Shell
sidebar_position: 5
---

# Responsive Shell

The responsive shell (Phase R0, shipped in PR #229 on 2026-07-15) replaces the phone-only layout with a real desktop / iPad / phone shell. One component tree renders the right chrome for every width: a floating glass tab bar on mobile, a collapsible sidebar plus top bar on desktop.

Design decisions follow the Apple HIG (iOS 26 / Liquid Glass) research documented in the repo at `docs/research/2026-07-15-apple-hig-ios26-shell-alignment.md` — floating tab bar, five-tab maximum, minimize-on-scroll, sidebar-holds-more-than-the-bar, and reduced-transparency behavior all trace to that document.

## Composition

`AppShell` (`apps/web/src/components/layout/app-shell.tsx`) mounts once in the root layout (`apps/web/src/app/layout.tsx`), inside `AuthProvider`, wrapping every page. It composes four pieces from `apps/web/src/components/layout/`:

| Component | File | Role |
|-----------|------|------|
| `AppShell` | `app-shell.tsx` | Route-aware frame; decides which chrome renders |
| `Sidebar` | `sidebar.tsx` | Desktop/iPad collapsible nav rail (`lg+` only) |
| `TopBar` | `top-bar.tsx` | Desktop header (`lg+` only) |
| `TabBar` | `tab-bar.tsx` | Mobile floating glass bottom nav (below `lg`) |
| `PageHeader` | `page-header.tsx` | Sticky per-page header (rendered by pages, not by `AppShell`) |

Key behaviors of the frame itself:

- **Admin passthrough** — routes starting with `/admin` bypass the shell entirely and keep their own layout (`if (pathname.startsWith("/admin")) return <>{children}</>`).
- **CSS-only breakpoints** — mobile chrome and desktop chrome both render; `lg:` visibility classes decide which shows. SSR/hydration never flickers because no JavaScript measurement is involved.
- **Single TabBar mount** — `TabBar` mounts once inside `AppShell` for every non-admin route (not per-layout); the bar decides its full vs. compact state internally via `isTabRoute`.
- **Reserved regions** — `<main data-testid="shell-main">` is the pane-capable Phase R1 region, and a hidden `<aside data-testid="dock-slot">` is the reserved Phase R3 Porter-dock mount point. Both exist in R0 but carry no R1/R3 behavior yet.
- The whole shell is wrapped in `UnreadCountProvider` so the sidebar, top bar, and page headers share one unread-messages count.

## Navigation Model

Nav and route constants live in `apps/web/src/lib/navigation.ts` — plain data, no React:

- `BAR_TABS` — the five primary destinations: `/home`, `/inventory`, `/listings`, `/porter`, `/orders`. Both the mobile bar and the sidebar's main section render from this list.
- `SIDEBAR_SECONDARY` — Messages (`/messages`) and Settings (`/more`), sidebar-only.
- `isTabRoute(pathname)` — true for `/` and the five bar tabs; drives the tab bar's full vs. compact state.
- `pageTitle(pathname)` — longest-prefix route-to-title lookup used by `TopBar`.
- `porterPills(pathname)` — page-contextual Ask Porter suggestion pills (inventory, listings, and orders each get their own pair; everything else gets defaults).

There is no More tab in the bar. Per the HIG alignment research (five tabs max), Settings moved out of the bar: on mobile it is reached through the `PageHeader` avatar (links to `/more`, with an unread-messages badge dot), on `lg+` through the sidebar's secondary section and the top-bar account menu.

## Mobile (below `lg`)

### Floating glass tab bar

`TabBar` renders a floating inset pill — `fixed left-3 right-3`, `max-w-lg`, `rounded-[22px]`, positioned `calc(0.5rem + var(--safe-area-bottom))` from the bottom — using the `.glass-nav` material with `.glass-fallback` for browsers without `backdrop-filter`. It holds the five `BAR_TABS` (Home, Inventory, Listings on the left; Porter, Orders on the right) around a center orange **Scan** button. Porter is tinted teal as the AI accent. A 32px-tall fade gradient sits above the bar so content dissolves into it rather than clipping.

The Scan button opens the [Scan Flow](/docs/frontend/scan-flow) modal. If a scan's publish attempt falls back to a draft, the bar shows a persistent dismissible warning banner (the old 8-second auto-hide was missed on mobile, so a failed publish read as silent success).

### Full vs. compact, and minimize-on-scroll

The bar has two states:

- **Full** (64px): icons + 10px labels, Scan as a 56px FAB that breaks the bar's top edge (`-mt-7`).
- **Compact** (48px): icon-only with `aria-label`s, Scan as a 40px inline FAB, no breakout.

State logic (`const compact = !onTabRoute || minimized`):

- On **non-tab routes** (settings, detail pages, messages) the bar is permanently compact — per the HIG guidance that the bar is "never fully absent."
- On **tab routes** it starts full and minimizes after scrolling down more than a 24px threshold (`SCROLL_MINIMIZE_THRESHOLD`); scrolling up past the threshold, or reaching the top, restores it. Tab-to-tab navigation resets the bar to full.
- With `prefers-reduced-motion: reduce`, the full/compact transition becomes a pure opacity fade — never translate/scale.

Non-tab routes below `lg` clear the compact bar with the `.compact-bar-clearance` utility (`padding-bottom: calc(4rem + var(--safe-area-bottom))`, scoped to `max-width: 1023.98px` so it never erases desktop padding).

### PageHeader

Pages render `PageHeader` themselves (sticky, `z-40`, blurred `bg-background/95`): title, optional subtitle, an optional page action, and — with `showAvatar` — the avatar link to `/more` that replaces the removed More tab. The action and avatar coexist; a page action (e.g. Orders' Sync) never suppresses the avatar.

## Desktop and iPad (`lg+`, ≥1024px)

The bottom bar is hidden (`lg:hidden`) and the shell becomes a sidebar + column layout (`min-h-dvh lg:flex`).

### Sidebar

A sticky full-height nav rail (`h-dvh`, right border) with:

- **Wordmark** ("Portage", or "P" when collapsed).
- **Scan CTA** — the same orange scan action as mobile, opening the ScanFlow modal. The modal mounts *outside* the sticky `<nav>` because `position: sticky` creates a stacking context that would trap the fixed `z-[60]` overlay beneath the `z-40` top bar.
- **Main nav** — the same five `BAR_TABS` destinations as the mobile bar, Porter tinted teal.
- **Secondary nav** below a divider (the sidebar holds *more* than the bar, per HIG): Messages with an unread badge dot, Settings (`/more`), and — appended at render time for admin-role users only — Admin.
- **Collapse toggle** — collapses from `w-60` to `w-[72px]` (icon-only, `title` tooltips); the choice persists in `localStorage` under `portage_sidebar_collapsed`, degrading to session-only in private mode.

### TopBar

A sticky 64px header: route title from `pageTitle()` on the left, a centered `AskPorterBar` (the focus-expanding Ask Porter input), and on the right a Messages link with unread badge, the theme toggle, and an avatar button opening the account menu (email, Profile, Settings, Log out) with full keyboard support — Escape closes and refocuses the trigger, Arrow Up/Down cycle menu items.

## Content Width System

`.content-container` (defined in `apps/web/src/app/globals.css`) replaces the scattered per-page `max-w-lg` wrappers with one centered, responsive width scale:

| Breakpoint | Max width |
|------------|-----------|
| Phone (default) | `32rem` (max-w-lg) |
| `min-width: 768px` (tablet portrait) | `42rem` (max-w-2xl) |
| `min-width: 1024px` (desktop) | `64rem` (max-w-5xl) |

## Accessibility and Transparency

- **`prefers-reduced-transparency: reduce`** — `.glass-nav` falls back to an opaque `var(--surface)` background with `backdrop-filter` removed; `.glass-control` (the glass card on the dark Porter hero) falls back to opaque `var(--charcoal)` so light-on-dark text stays legible.
- **No `backdrop-filter` support** — the `@supports not (backdrop-filter: blur(1px))` block makes `.glass-fallback` surfaces near-opaque (`var(--surface)`, opacity 0.98).
- **`prefers-reduced-motion: reduce`** — shell animations are disabled globally in CSS, and the tab bar additionally switches its state transition to opacity-only in JS.
- **Focus and labels** — tabs and sidebar links carry `focus-visible` teal ring styles; compact icon-only tabs get `aria-label`s; the scan buttons, account menu (`aria-haspopup` / `aria-expanded`), and unread badges all have explicit accessible labels.
- **Safe areas** — the bar's bottom offset, its fade gradient, and `.compact-bar-clearance` all incorporate `var(--safe-area-bottom)` (`env(safe-area-inset-bottom)`) for notch/home-indicator devices.

The glass material itself is themed: `--glass-nav-bg` is warm-stone `rgba(245, 242, 235, 0.72)` in light mode and `rgba(26, 22, 18, 0.72)` in dark mode, rendered with `blur(22px) saturate(175%)`. See [Design System](/docs/frontend/design-system) for the broader token set.

## R1 and Beyond

This page covers **R0 only**. The Responsive UI Program continues:

- **R1 — desktop workbench** (master-detail inventory/listings) is in flight as PR #237, **unmerged** as of 2026-07-17. The `shell-main` region in `AppShell` is its designated pane-capable mount point; no R1 behavior is live.
- **R3 — Porter dock** has only its reserved `dock-slot` placeholder in the shell today.

For the route map and page-level structure, see [App Structure](/docs/frontend/app-structure).
