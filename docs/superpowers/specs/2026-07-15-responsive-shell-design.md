# Responsive Shell — Phase R0 Design

**Date:** 2026-07-15
**Status:** Approved (brainstorm 2026-07-15; Stephen approved phasing + design sections + build-on-new-branch)
**Branch:** `feat/responsive-shell`
**Sequencing:** Precedes the onboarding-expansion build (plan `docs/superpowers/plans/2026-07-14-onboarding-expansion.md`, spec PR #228) — tutorial screenshots must capture this shell. Onboarding capture/coords re-verify after R0 ships.

## Context

Portage is mobile-first: every page is a `max-w-lg` phone column; nav is a full-width bottom tab bar rendered only inside `(tabs)/`; pages outside `(tabs)/` (settings/*, inventory/[id], /messages, /list, orders/[id]) have no persistent nav at all. Stephen's directive: fully responsive — desktop, iPad, and a mobile polish pass — done BEFORE the onboarding tutorial hub so its screenshots capture the final shell.

Product insight anchoring the desktop design: the phone is the **capture device** (camera intake), the desktop is the **throughput device** (typing, bulk management, big screen). The shell must serve that split, and structurally reserve space for the phased desktop features that follow (R1 workbench panes, R3 Porter dock).

## Approved decisions

1. **Desktop nav = persistent collapsible sidebar** (over hidden drawer / hover rail).
2. **Tablet = breakpoint-based, not orientation JS:** iPad portrait (`md`) gets mobile chrome + wider content; iPad landscape (≥1024, `lg`) gets the full desktop shell. Matches iPadOS sidebar-in-landscape convention.
3. **Persistent Home = floating glass chip** on tab-bar-less pages (over full-tab-bar-everywhere / header button).
4. **Top-bar input = Ask Porter, not a search field.** Porter already has `search_inventory`; no new search API. Focus-expanding (1 line → 3 lines + page-specific pills) — Stephen's per-page Porter idea, minus the always-on 3-line content tax.
5. **Porter conversation history UI → Phase R3** (backend endpoints exist and are unused: `GET /porter/conversations`, `GET /porter/conversations/:id` — `apps/api/src/routes/porter.ts:231,251`).
6. **Build process:** Sonnet 5 subagents build (one per plan task), Fable builds the AppShell task and reviews every task boundary; escalate a task to Opus after two failed reviews. HARD RULE: one tdd-guard test per Write/Edit (`.claude/rules/tdd-one-test-per-write.md`) — include verbatim in every test-writing subagent prompt.
7. **HIG alignment package (2026-07-15, from `docs/research/2026-07-15-apple-hig-ios26-shell-alignment.md`):**
   - **Mobile bar = 5 tabs** (Home · Inventory · Listings · Porter · Orders) — HIG "five or fewer". **More leaves the bar**; `/more` reached via an avatar button top-right in the PageHeader of tab pages (iOS profile-button idiom).
   - **Center Scan FAB kept as a documented deliberate deviation** — no Apple center-button pattern exists; scan is the product's core action.
   - **Minimized-bar replaces the Home chip:** on tab-bar-less pages (and on scroll-down on tab pages — `TabBarMinimizeBehavior` analog) the bar renders compact: icon-only, no labels, same glass pill, direct-tap navigation. The bar is never fully absent; scroll-up/tap restores the full bar on tab pages.
   - **Desktop/iPad sidebar holds MORE than the bar:** main 5 + secondary section (Messages with unread badge, Settings→/more; Tutorials joins when the onboarding hub ships) + Admin item for admin role. Sidebars are Apple's many-destinations surface.
   - **Glass semantics:** Regular-variant treatment (blur + luminosity) for chrome only — tab bar, sidebar, top bar. NEVER glass on content cards/rows (HIG hard rule).
   - **Accessibility render paths:** `prefers-reduced-transparency` (solid chrome fallback), `prefers-contrast` (stronger borders/text), `prefers-reduced-motion` (bar minimize/expand becomes a fade, no motion).
   - **Touch targets:** 44px default (28px absolute floor), ≥12px spacing between bar items.
   - **Accessory shelf reserved** (future): live status surface — scan-upload/publish progress, Porter streaming mini-bar. Not used in R0.
   - **Native-port note:** iOS 26 system apps anchor primary search at the bottom — supports bottom-area Ask Porter placement on the native app.

## Breakpoints

| Range | Name | Chrome | Content |
|---|---|---|---|
| `<768` | mobile | floating glass tab bar (tabs pages) / Home chip (others) | `max-w-lg` column |
| `768–1023` (`md`) | tablet portrait | same mobile chrome | wider: 3–4-col grids, `max-w-2xl` detail |
| `≥1024` (`lg`) | desktop | sidebar + top bar, no bottom chrome | fluid to `max-w-5xl`, pane-capable |

Tailwind-native (`md:`/`lg:`), no orientation listeners, no UA sniffing. Rotating an iPad re-lays-out cleanly across the 1024 line.

## Architecture

### A. AppShell — `apps/web/src/components/layout/app-shell.tsx`
Client component mounted in the root layout (inside AuthProvider), wrapping all pages EXCEPT the admin tree (`pathname.startsWith("/admin")` renders children untouched — admin keeps its own sidebar layout).

- `lg+`: renders `Sidebar` (left) + `TopBar` (top) + content region. Content region is a flex row: `<main>` (pane-capable, R1) + an empty right-dock slot (R3) — structure only, no feature code.
- `<lg`: renders children as-is, plus the floating `HomeChip` when the route is NOT a tab route (tab routes: `/home`, `/inventory` exact, `/listings` exact, `/porter`, `/orders` exact, `/more`) and not the root `/`.
- Route awareness via `usePathname`. Tab-route list exported as a constant shared with TabBar.

### B. Sidebar — `apps/web/src/components/layout/sidebar.tsx` (`lg+` only)
- 240px expanded ↔ 72px icon rail; toggle at bottom; state persisted in `localStorage` (`portage_sidebar_collapsed`).
- Top→bottom: wordmark (icon-only when collapsed), orange **Scan** button (opens existing `ScanFlow` — desktop webcam + gallery both already work), **main section** (Home, Inventory, Listings, Porter, Orders), divider, **secondary section** (Messages with unread badge, Settings → `/more`; Tutorials joins when the onboarding hub ships; Admin item when `user.role === "admin"`), collapse toggle.
- Nav items: icon + label (icon-only + tooltip when collapsed), active state from `usePathname`, Porter keeps the teal accent.
- User menu is NOT here (lives in TopBar) — no duplication.

### C. TopBar — `apps/web/src/components/layout/top-bar.tsx` (`lg+` only)
- Left: current page title (derived from route map).
- Center: `AskPorterBar` (shared component, below).
- Right: messages icon + unread badge (→ `/messages`), theme toggle (reuse existing `ThemeToggle`), avatar menu (profile, settings, log out — reuses `useAuth`).
- Glass idiom consistent with the design system; sticky top.

### D. AskPorterBar — `apps/web/src/components/porter/ask-porter-bar.tsx`
One component, two mounts:
- Desktop: TopBar center.
- Mobile/tablet portrait: under `PageHeader` on inventory, listings, orders pages ONLY.

Behavior:
- Collapsed: single-line input (~44px), placeholder "Ask Porter…".
- Focus: expands to 3 lines; page-specific pills appear below (from a `PORTER_PILLS` route map — inventory: "What's unlisted?" / "What's my total inventory value?" · listings: "Which listings are stale?" · orders: "What needs shipping?" · default set elsewhere).
- Submit (or pill tap): navigate to `/porter?q=<encoded>`; the Porter page reads `q`, auto-sends it into the thread once, and strips the param. Blur with empty input collapses back.
- No new API. Existing Porter SSE stream handles the message.

### E. Mobile tab bar redesign — modify `apps/web/src/components/layout/tab-bar.tsx`
- From full-width edge-to-edge to a **floating inset glass bar**: `mx-3`, lifted above the safe area, `rounded-[22px]`, photo-editor toolbar idiom (`photo-edit-panel.tsx:189`): backdrop-blur-xl + glass-nav tokens + hairline border + elevated shadow.
- **5 tabs** (Home, Inventory, Listings, Porter, Orders) + center orange Scan FAB (documented HIG deviation) breaking the top edge; active dots, Porter teal, content fade gradient beneath, safe-area handling. More/unread move out (header avatar / minimized-bar badge).
- **Minimize-on-scroll** (tab pages): scroll-down collapses to the compact state (icon-only pill, ~48px, labels hidden, FAB shrinks inline); scroll-up or tab tap restores. Under `prefers-reduced-motion` the transition is a fade, no translate/scale.
- Hidden at `lg+` (sidebar replaces it). Bar stays `max-w-lg` centered on tablet portrait.
- `(tabs)/layout.tsx` bottom padding adjusts to the floating bar's new footprint.

### F. Minimized bar on tab-bar-less pages (replaces the earlier Home-chip concept)
- On non-tab routes (`<lg`): the SAME TabBar renders permanently in its compact state — icon-only glass pill, 5 tabs + small Scan FAB, direct-tap navigation, unread dot on the pill edge. The bar is never fully absent (HIG model).
- Rendered by AppShell; hidden at `lg+`. Full-screen overlays (ScanFlow z-60) naturally cover it (bar sits at z-50).
- Mobile More access: avatar button (user initial, 44px target) top-right in `PageHeader` on tab pages → `/more`.

### G. Content width system
- Shared container utility (CSS class or small component): mobile `max-w-lg` → `md` `max-w-2xl` → `lg` fluid `max-w-5xl`.
- Applied to core pages this ship: home, inventory, listings, orders, porter, more, messages, settings pages, inventory/[id]. Remaining pages inherit later without shell changes.
- Inventory/listings grids: fluid columns at `md+` (CSS grid `minmax`), replacing the fixed phone grid.

## Error handling

- `localStorage` unavailable (private mode): sidebar defaults to expanded, no crash — guard reads/writes in try/catch.
- `/porter?q=` with empty/whitespace query: ignored, no auto-send.
- Auto-send fires ONCE per navigation (ref guard) — no re-send on re-render or back-nav.
- Unknown route in page-title map: falls back to "Portage", never throws.

## Testing (Vitest, apps/web — ONE test per Write/Edit, tdd-guard hard rule)

- AppShell: admin passthrough; tab-route vs non-tab chip logic; dock-slot/main structure present at `lg` (matchMedia mock).
- Sidebar: renders 6 items + Scan; collapse toggles width class and persists; badge renders.
- TopBar: title from route; avatar menu opens; unread badge.
- AskPorterBar: collapsed→focus expansion; pills per route map; submit navigates to `/porter?q=…`; empty submit no-op.
- Porter page: `q` param auto-sends once and strips.
- TabBar: floating classes pin (rounded-[22px], inset), hidden at lg (class assertion), 5 tabs exactly, compact-state rendering (icon-only, no labels), minimize-on-scroll state transitions, reduced-motion fade path, existing behavior tests keep passing.
- Minimized bar on non-tab routes: compact bar present, direct-tap navigation, absent at lg.
- PageHeader avatar: renders on tab pages, links `/more`, 44px hit target.

## Verification (Definition of Done)

1. `npm run typecheck && npm run lint && npm run test -w apps/web && npm run test:api` green.
2. `docker compose up -d --build portage-app`; walk live at three viewports: 390×844 (phone), 820×1180 (iPad portrait), 1440×900 (desktop):
   - Phone: floating glass bar on tab pages; Home chip on settings/item-detail/messages; scan FAB works.
   - iPad portrait: mobile chrome + 3–4-col inventory grid, wider detail.
   - Desktop: sidebar (expand/collapse persists across reload), top bar, Ask Porter expand + pills + submit-to-thread, no bottom chrome; existing flows (scan, listing edit, publish) intact.
3. Screenshot proof at all three breakpoints, light + dark.
4. e2e suite (`npm run test:e2e`) still green (specs run desktop-Chrome viewport — the shell must not break them; adjust storage-state/selectors only if the shell legitimately moved chrome).

## Out of scope (later phases — structure reserved, zero feature code)

R1 master-detail workbench panes · R2 drag-and-drop ingest · R3 Porter dock + conversation history UI · R4 QR phone-camera handoff · keyboard shortcuts · table views / hover row-actions · global search API.
