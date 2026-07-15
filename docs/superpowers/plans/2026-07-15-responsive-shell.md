# Responsive Shell (Phase R0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desktop sidebar + top bar with Ask Porter, breakpoint-based iPad behavior, floating glass mobile tab bar, persistent Home chip, and a shared content-width system — the shell every later phase (workbench, dock, ingest, QR) plugs into.

**Architecture:** A route-aware client `AppShell` in the root layout renders Sidebar + TopBar + a pane-capable content region at `lg+` and a floating `HomeChip` on non-tab pages below `lg`; the admin tree passes through untouched. `TabBar` becomes a floating inset glass bar hidden at `lg+`. One `AskPorterBar` component mounts in the desktop TopBar and under PageHeader on inventory/listings/orders; submits navigate to `/porter?q=…` which auto-sends once. No API changes.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4 (`globals.css` tokens/keyframes), Vitest + Testing Library (jsdom), Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-07-15-responsive-shell-design.md` (committed 2f5211d).

## Global Constraints

- Branch: `feat/responsive-shell` (already created; spec committed on it).
- **HARD RULE — one tdd-guard test per Write/Edit** (`.claude/rules/tdd-one-test-per-write.md`): every test-adding edit contains EXACTLY ONE new `it`/`test`; new test files start with one test; red first; run with `npm run test -w apps/web -- <file>`; validator hedge on a compliant edit → retry same edit verbatim once. Include this rule verbatim in every subagent prompt that writes tests.
- **Build process:** Sonnet 5 subagent per task; Fable builds Task 3 (AppShell) and reviews every task boundary; escalate a task to Opus 4.8 after two failed reviews.
- Stage explicit paths only — never `git add -u/-A`. No co-author trailers. Subject lines ≤72 chars.
- Breakpoints: Tailwind `md` (768) and `lg` (1024) only — no orientation JS, no UA sniffing.
- Design tokens: existing `globals.css` vars — `--orange`, `--teal`, `--text-primary/secondary/placeholder`, `--background`, `--surface`, `--border`, glass tokens (`glass-nav`, `--glass-*`), `--shadow-elevated`, `--safe-area-bottom`, fonts `--font-instrument` / `--font-plus-jakarta`.
- Glass idiom reference: `photo-edit-panel.tsx:189` — `rounded-[22px]`, hairline border, backdrop blur.
- Admin tree (`/admin*`) is untouched by the shell.
- All URLs `10.0.0.251`, never localhost.
- Deploy = `docker compose up -d --build portage-app` (image-baked, no hot reload).

## File Structure

| File | Responsibility |
|---|---|
| `apps/web/src/lib/navigation.ts` | Create — `TAB_ROUTES`, `isTabRoute()`, `PAGE_TITLES`/`pageTitle()`, `PORTER_PILLS`/`porterPills()` |
| `apps/web/src/lib/navigation.test.ts` | Create |
| `apps/web/src/components/layout/home-chip.tsx` + test | Create — floating glass Home chip |
| `apps/web/src/components/layout/sidebar.tsx` + test | Create — desktop nav rail |
| `apps/web/src/components/layout/top-bar.tsx` + test | Create — desktop header |
| `apps/web/src/components/porter/ask-porter-bar.tsx` + test | Create — focus-expanding Porter input + pills |
| `apps/web/src/components/layout/app-shell.tsx` + test | Create — route-aware shell (Fable builds) |
| `apps/web/src/app/layout.tsx` | Modify — mount AppShell inside AuthProvider |
| `apps/web/src/components/layout/tab-bar.tsx` + test | Modify — floating inset glass bar, `lg:hidden` |
| `apps/web/src/app/(tabs)/layout.tsx` | Modify — bottom padding for floating bar |
| `apps/web/src/app/(tabs)/porter/page.tsx` (+ test file if absent) | Modify — `?q=` auto-send-once |
| `apps/web/src/app/(tabs)/inventory/page.tsx`, `(tabs)/listings/page.tsx`, `(tabs)/orders/page.tsx` | Modify — mount AskPorterBar under PageHeader (`lg:hidden`) |
| `apps/web/src/app/globals.css` | Modify — `.content-container` responsive width utility |
| core pages (home, inventory, listings, orders, more, messages, settings/*, inventory/[id]) | Modify — swap `max-w-lg` for `.content-container`; fluid grids `md+` |

---

### Task 1: Navigation constants module

**Files:**
- Create: `apps/web/src/lib/navigation.ts`
- Test: `apps/web/src/lib/navigation.test.ts`

**Interfaces (later tasks rely on these exact names):**
- `TAB_ROUTES: readonly string[]` — `["/home", "/inventory", "/listings", "/porter", "/orders", "/more"]`
- `isTabRoute(pathname: string): boolean` — true for exact tab route or `/` root; `/inventory/abc` is NOT a tab route (detail page), `/home` IS
- `pageTitle(pathname: string): string` — longest-prefix match over a route→title map; fallback `"Portage"`
- `porterPills(pathname: string): string[]` — pills for inventory/listings/orders prefixes; default set otherwise

- [ ] **Step 1: ONE failing test — isTabRoute**

Create `navigation.test.ts` with exactly one test:

```typescript
import { describe, it, expect } from "vitest";
import { isTabRoute } from "./navigation";

describe("navigation", () => {
  it("isTabRoute: true for exact tab routes and root, false for detail/settings routes", () => {
    for (const r of ["/home", "/inventory", "/listings", "/porter", "/orders", "/more", "/"])
      expect(isTabRoute(r), r).toBe(true);
    for (const r of ["/inventory/abc-123", "/settings/help", "/messages", "/list", "/orders/xyz", "/tutorials"])
      expect(isTabRoute(r), r).toBe(false);
  });
});
```

- [ ] **Step 2: Run — red** (`npm run test -w apps/web -- src/lib/navigation.test.ts` → module not found)

- [ ] **Step 3: Implement `navigation.ts`**

```typescript
// Shared nav/route constants for the responsive shell (AppShell, Sidebar,
// TabBar, HomeChip, TopBar, AskPorterBar). Plain data — no React.

export const TAB_ROUTES = [
  "/home",
  "/inventory",
  "/listings",
  "/porter",
  "/orders",
  "/more",
] as const;

export function isTabRoute(pathname: string): boolean {
  if (pathname === "/") return true;
  return (TAB_ROUTES as readonly string[]).includes(pathname);
}

const PAGE_TITLES: Array<[prefix: string, title: string]> = [
  ["/home", "Home"],
  ["/inventory", "Inventory"],
  ["/listings", "Listings"],
  ["/porter", "Porter"],
  ["/orders", "Orders"],
  ["/more", "Settings"],
  ["/settings/seller-profile", "Seller Profile"],
  ["/settings/marketplace", "Marketplace Accounts"],
  ["/settings/billing", "Billing & Plan"],
  ["/settings/notifications", "Notifications"],
  ["/settings/profile", "Profile"],
  ["/settings/help", "Help & Support"],
  ["/messages", "Messages"],
  ["/list", "New Listing"],
];

export function pageTitle(pathname: string): string {
  let best: string | null = null;
  let bestLen = 0;
  for (const [prefix, title] of PAGE_TITLES) {
    if (pathname.startsWith(prefix) && prefix.length > bestLen) {
      best = title;
      bestLen = prefix.length;
    }
  }
  return best ?? "Portage";
}

const DEFAULT_PILLS = [
  "What should I list next?",
  "How's my inventory doing?",
];

const PILLS: Array<[prefix: string, pills: string[]]> = [
  ["/inventory", ["What's unlisted?", "What's my total inventory value?"]],
  ["/listings", ["Which listings are stale?", "Suggest reprices for slow listings"]],
  ["/orders", ["What needs shipping?", "How much did I make this month?"]],
];

export function porterPills(pathname: string): string[] {
  for (const [prefix, pills] of PILLS) {
    if (pathname.startsWith(prefix)) return pills;
  }
  return DEFAULT_PILLS;
}
```

- [ ] **Step 4: Run — green**
- [ ] **Step 5: Add remaining tests ONE AT A TIME (red→green each):**

Test 2:
```typescript
  it("pageTitle: longest-prefix match with Portage fallback", () => {
    expect(pageTitle("/settings/seller-profile")).toBe("Seller Profile");
    expect(pageTitle("/inventory/abc")).toBe("Inventory");
    expect(pageTitle("/unknown/thing")).toBe("Portage");
  });
```
Test 3:
```typescript
  it("porterPills: page-specific pills with default fallback", () => {
    expect(porterPills("/inventory")).toContain("What's unlisted?");
    expect(porterPills("/orders/xyz")).toContain("What needs shipping?");
    expect(porterPills("/settings/help")).toEqual([
      "What should I list next?",
      "How's my inventory doing?",
    ]);
  });
```
(Extend the import line as needed.)

- [ ] **Step 6: Commit**
```bash
git add apps/web/src/lib/navigation.ts apps/web/src/lib/navigation.test.ts
git commit -m "feat(web): shared navigation constants for responsive shell"
```

---

### Task 2: HomeChip

**Files:**
- Create: `apps/web/src/components/layout/home-chip.tsx`
- Test: `apps/web/src/components/layout/home-chip.test.tsx`

**Interfaces:**
- `HomeChip()` — no props. Fixed bottom-left glass chip linking to `/home`. Visibility (route + breakpoint) is the CALLER's job (AppShell) — the chip itself always renders.

- [ ] **Step 1: ONE failing test**

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HomeChip } from "./home-chip";

describe("HomeChip", () => {
  it("renders a Home link to /home", () => {
    render(<HomeChip />);
    const link = screen.getByRole("link", { name: "Home" });
    expect(link).toHaveAttribute("href", "/home");
  });
});
```

- [ ] **Step 2: Run — red**
- [ ] **Step 3: Implement**

```tsx
"use client";

import Link from "next/link";

/**
 * Persistent Home escape hatch on pages without the tab bar (<lg).
 * Sits at the same x/y the Home tab occupies in the floating tab bar.
 * Same glass idiom as the floating bar (photo-edit-panel toolbar).
 */
export function HomeChip() {
  return (
    <Link
      href="/home"
      aria-label="Home"
      className="fixed left-4 z-50 flex h-12 w-12 items-center justify-center rounded-full glass-nav border shadow-lg active:scale-95 transition-transform"
      style={{
        bottom: "calc(0.75rem + var(--safe-area-bottom))",
        borderColor: "var(--glass-thin-border)",
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
        <path d="M9 21V12h6v9" />
      </svg>
    </Link>
  );
}
```

- [ ] **Step 4: Run — green, commit**
```bash
git add apps/web/src/components/layout/home-chip.tsx apps/web/src/components/layout/home-chip.test.tsx
git commit -m "feat(web): HomeChip - floating glass home link"
```

---

### Task 3: AppShell (FABLE BUILDS THIS TASK)

**Files:**
- Create: `apps/web/src/components/layout/app-shell.tsx`
- Test: `apps/web/src/components/layout/app-shell.test.tsx`
- Modify: `apps/web/src/app/layout.tsx`

**Interfaces:**
- `AppShell({ children }: { children: React.ReactNode })`
- Renders, by route (via `usePathname`) —
  - `/admin*`: children only (passthrough, no chrome).
  - otherwise: a wrapper containing (a) desktop chrome visible only at `lg+`: `<Sidebar />` + `<TopBar />` + `<main data-testid="shell-main">` + `<aside data-testid="dock-slot">` (empty reserve, `hidden` until R3), and (b) `<HomeChip />` rendered only when `!isTabRoute(pathname)`, wrapped in a `lg:hidden` container.
- Breakpoint switching is CSS-only (`hidden lg:flex`, `lg:hidden`) — both mobile children and desktop chrome are in the DOM; media queries decide visibility. No matchMedia JS, no hydration flicker.
- Sidebar/TopBar don't exist until Tasks 4–5: AppShell imports them from day one, so this task creates minimal placeholder exports (see Step 3) that Tasks 4–5 replace. Placeholders render `null` — NOT stub UI.

- [ ] **Step 1: ONE failing test — admin passthrough**

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppShell } from "./app-shell";

const mockPathname = vi.fn(() => "/admin/users");
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

describe("AppShell", () => {
  it("passes the admin tree through with no shell chrome", () => {
    mockPathname.mockReturnValue("/admin/users");
    render(<AppShell><div data-testid="page" /></AppShell>);
    expect(screen.getByTestId("page")).toBeInTheDocument();
    expect(screen.queryByTestId("shell-main")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Home" })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — red**
- [ ] **Step 3: Implement `app-shell.tsx` + placeholder Sidebar/TopBar**

Create `apps/web/src/components/layout/sidebar.tsx`:
```tsx
"use client";

// Placeholder — implemented in the Sidebar task.
export function Sidebar() {
  return null;
}
```

Create `apps/web/src/components/layout/top-bar.tsx`:
```tsx
"use client";

// Placeholder — implemented in the TopBar task.
export function TopBar() {
  return null;
}
```

Create `app-shell.tsx`:
```tsx
"use client";

import { usePathname } from "next/navigation";
import { isTabRoute } from "@/lib/navigation";
import { HomeChip } from "./home-chip";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";

/**
 * Route-aware responsive shell. Breakpoint switching is CSS-only:
 * mobile chrome and desktop chrome both render; `lg:` classes decide
 * visibility, so SSR/hydration never flickers. Admin keeps its own layout.
 * The dock-slot aside is the reserved Phase R3 Porter-dock mount point;
 * shell-main is the pane-capable Phase R1 region.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";

  if (pathname.startsWith("/admin")) return <>{children}</>;

  return (
    <div className="min-h-dvh lg:flex">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="hidden lg:block">
          <TopBar />
        </div>
        <div className="flex min-w-0 flex-1">
          <main data-testid="shell-main" className="min-w-0 flex-1">
            {children}
          </main>
          <aside data-testid="dock-slot" hidden aria-hidden="true" />
        </div>
      </div>
      {!isTabRoute(pathname) && (
        <div className="lg:hidden">
          <HomeChip />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run — green**
- [ ] **Step 5: Remaining tests ONE AT A TIME (red→green each):**

Test 2 — chip on non-tab route:
```typescript
  it("renders the Home chip on non-tab routes", () => {
    mockPathname.mockReturnValue("/settings/help");
    render(<AppShell><div /></AppShell>);
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
  });
```
Test 3 — no chip on tab route:
```typescript
  it("hides the Home chip on tab routes", () => {
    mockPathname.mockReturnValue("/inventory");
    render(<AppShell><div /></AppShell>);
    expect(screen.queryByRole("link", { name: "Home" })).not.toBeInTheDocument();
  });
```
Test 4 — shell structure present:
```typescript
  it("renders shell-main and the reserved dock slot on app routes", () => {
    mockPathname.mockReturnValue("/inventory");
    render(<AppShell><div data-testid="page" /></AppShell>);
    expect(screen.getByTestId("shell-main")).toContainElement(screen.getByTestId("page"));
    expect(screen.getByTestId("dock-slot")).toBeInTheDocument();
  });
```

- [ ] **Step 6: Mount in root layout**

In `apps/web/src/app/layout.tsx`: add `import { AppShell } from "@/components/layout/app-shell";` and change the AuthProvider block to:

```tsx
        <AuthProvider>
          <AppShell>{children}</AppShell>
          <BetaCta />
        </AuthProvider>
```

- [ ] **Step 7: Full gates + commit**

Run: `npm run typecheck && npm run lint && npm run test -w apps/web`

```bash
git add apps/web/src/components/layout/app-shell.tsx apps/web/src/components/layout/app-shell.test.tsx apps/web/src/components/layout/sidebar.tsx apps/web/src/components/layout/top-bar.tsx apps/web/src/app/layout.tsx
git commit -m "feat(web): AppShell - route-aware responsive shell + home chip"
```

---

### Task 4: Sidebar

**Files:**
- Modify: `apps/web/src/components/layout/sidebar.tsx` (replace placeholder)
- Test: `apps/web/src/components/layout/sidebar.test.tsx`

**Interfaces:**
- `Sidebar()` — no props. `localStorage` key `portage_sidebar_collapsed` (`"1"`/absent). Nav set/order identical to TabBar. Opens `ScanFlow` itself (same pattern as TabBar). Uses `useUnreadCount` for the More badge — test must mock `@/hooks/use-messages`.

- [ ] **Step 1: ONE failing test — renders nav + scan**

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "./sidebar";

vi.mock("next/navigation", () => ({ usePathname: () => "/inventory" }));
vi.mock("@/hooks/use-messages", () => ({ useUnreadCount: () => ({ count: 0 }) }));
vi.mock("@/components/capture/scan-flow", () => ({ ScanFlow: () => null }));

describe("Sidebar", () => {
  it("renders all six nav links and the Scan button", () => {
    render(<Sidebar />);
    for (const name of ["Home", "Inventory", "Listings", "Porter", "Orders", "More"])
      expect(screen.getByRole("link", { name: new RegExp(name) })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /scan/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — red** (placeholder renders null)
- [ ] **Step 3: Implement**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ScanFlow } from "@/components/capture/scan-flow";
import { useUnreadCount } from "@/hooks/use-messages";
import { TAB_ROUTES } from "@/lib/navigation";

const LABELS: Record<string, string> = {
  "/home": "Home",
  "/inventory": "Inventory",
  "/listings": "Listings",
  "/porter": "Porter",
  "/orders": "Orders",
  "/more": "More",
};

const COLLAPSE_KEY = "portage_sidebar_collapsed";

function NavIcon({ route, active }: { route: string; active: boolean }) {
  const stroke = active ? 2.5 : 2;
  switch (route) {
    case "/home":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
          <path d="M9 21V12h6v9" />
        </svg>
      );
    case "/inventory":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      );
    case "/listings":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 01-8 0" />
        </svg>
      );
    case "/porter":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a7 7 0 017 7v3a7 7 0 01-14 0V9a7 7 0 017-7z" />
          <circle cx="9" cy="11" r="1" />
          <circle cx="15" cy="11" r="1" />
        </svg>
      );
    case "/orders":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="3" width="15" height="13" rx="2" />
          <path d="M16 8h4l3 3v5a2 2 0 01-2 2h-1" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      );
    default: // "/more"
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="1" />
          <circle cx="19" cy="12" r="1" />
          <circle cx="5" cy="12" r="1" />
        </svg>
      );
  }
}

export function Sidebar() {
  const pathname = usePathname() ?? "/";
  const [collapsed, setCollapsed] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const { count: unreadCount } = useUnreadCount();

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* private mode — default expanded */
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        if (next) localStorage.setItem(COLLAPSE_KEY, "1");
        else localStorage.removeItem(COLLAPSE_KEY);
      } catch {
        /* private mode — session-only */
      }
      return next;
    });
  }, []);

  return (
    <nav
      aria-label="Primary"
      data-collapsed={collapsed ? "1" : "0"}
      className={`sticky top-0 flex h-dvh flex-col border-r border-border bg-surface transition-[width] duration-200 ${collapsed ? "w-[72px]" : "w-60"}`}
    >
      {/* Wordmark */}
      <div className="flex h-16 items-center px-4">
        <span className="font-[family-name:var(--font-instrument)] text-lg font-bold text-text-primary">
          {collapsed ? "P" : "Portage"}
        </span>
      </div>

      {/* Scan */}
      <div className="px-3 pb-2">
        <button
          onClick={() => setShowScan(true)}
          aria-label="Scan item"
          className={`flex h-11 items-center justify-center gap-2 rounded-2xl font-semibold text-white transition-all active:scale-95 ${collapsed ? "w-11" : "w-full"}`}
          style={{ background: "var(--orange)", boxShadow: "var(--shadow-elevated)" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          {!collapsed && <span className="text-sm">Scan</span>}
        </button>
      </div>

      {/* Nav */}
      <div className="flex flex-1 flex-col gap-1 px-3 py-2">
        {TAB_ROUTES.map((route) => {
          const label = LABELS[route];
          const isActive = pathname.startsWith(route);
          const isPorter = route === "/porter";
          const isMore = route === "/more";
          return (
            <Link
              key={route}
              href={route}
              title={collapsed ? label : undefined}
              className={`relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--teal)] ${
                isPorter
                  ? "text-[var(--teal)] font-semibold"
                  : isActive
                    ? "bg-muted font-semibold text-text-primary"
                    : "text-text-secondary hover:bg-muted hover:text-text-primary"
              } ${collapsed ? "justify-center px-0" : ""}`}
            >
              <span className="relative">
                <NavIcon route={route} active={isActive} />
                {isMore && unreadCount > 0 && (
                  <span className="absolute -right-1.5 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[var(--surface)] bg-[var(--orange)]" />
                )}
              </span>
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </div>

      {/* Collapse toggle */}
      <div className="px-3 pb-4">
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-10 w-full items-center justify-center rounded-xl text-text-secondary transition-colors hover:bg-muted hover:text-text-primary"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={collapsed ? "rotate-180" : ""}>
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </div>

      {showScan && <ScanFlow onClose={() => setShowScan(false)} />}
    </nav>
  );
}
```

Note: `ScanFlow`'s `onClose` receives an optional `{ warning?: string }` — the sidebar ignores it in this task (publish-warning surfacing on desktop is TabBar behavior; if review flags parity, copy TabBar's `scanWarning` toast pattern verbatim).

- [ ] **Step 4: Run — green**
- [ ] **Step 5: Remaining tests ONE AT A TIME (red→green each):**

Test 2 — collapse persists:
```typescript
  it("collapse toggle flips width class and persists to localStorage", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    render(<Sidebar />);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(nav.className).toContain("w-60");
    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(nav.className).toContain("w-[72px]");
    expect(localStorage.getItem("portage_sidebar_collapsed")).toBe("1");
  });
```
Test 3 — unread badge:
```typescript
  it("shows the unread dot on More when count > 0", () => {
    vi.mocked(useUnreadCount).mockReturnValue({ count: 3 } as ReturnType<typeof useUnreadCount>);
    render(<Sidebar />);
    const more = screen.getByRole("link", { name: /More/ });
    expect(more.querySelector("span.bg-\\[var\\(--orange\\)\\]")).not.toBeNull();
  });
```
(For test 3 change the mock to `vi.mock("@/hooks/use-messages", () => ({ useUnreadCount: vi.fn(() => ({ count: 0 })) }));` and add `import { useUnreadCount } from "@/hooks/use-messages";`.)

- [ ] **Step 6: Commit**
```bash
git add apps/web/src/components/layout/sidebar.tsx apps/web/src/components/layout/sidebar.test.tsx
git commit -m "feat(web): desktop sidebar - collapsible nav rail + scan"
```

---

### Task 5: TopBar

**Files:**
- Modify: `apps/web/src/components/layout/top-bar.tsx` (replace placeholder)
- Test: `apps/web/src/components/layout/top-bar.test.tsx`

**Interfaces:**
- `TopBar()` — no props. Page title via `pageTitle(usePathname())`. Center: `<AskPorterBar />` (Task 6 — this task imports it; build order is 6 BEFORE 5 for Sonnet agents. If built out of order, stub the import with a placeholder file the same way Task 3 did).
- Right: messages link + unread badge, `<ThemeToggle />` (existing component), avatar menu using `useAuth()` (`user.email`, `logout`).

**Recommended build order note for the orchestrator: dispatch Task 6 (AskPorterBar) before Task 5.**

- [ ] **Step 1: ONE failing test — title renders**

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TopBar } from "./top-bar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/inventory",
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/hooks/use-messages", () => ({ useUnreadCount: () => ({ count: 2 }) }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { email: "s@x.com" }, logout: vi.fn() }),
}));

describe("TopBar", () => {
  it("renders the current page title", () => {
    render(<TopBar />);
    expect(screen.getByRole("heading", { name: "Inventory" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — red**
- [ ] **Step 3: Implement**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { AskPorterBar } from "@/components/porter/ask-porter-bar";
import { useAuth } from "@/hooks/use-auth";
import { useUnreadCount } from "@/hooks/use-messages";
import { pageTitle } from "@/lib/navigation";

export function TopBar() {
  const pathname = usePathname() ?? "/";
  const { user, logout } = useAuth();
  const { count: unreadCount } = useUnreadCount();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-border bg-background/95 px-6 backdrop-blur-md">
      <h1 className="w-48 shrink-0 truncate font-[family-name:var(--font-instrument)] text-lg font-semibold text-text-primary">
        {pageTitle(pathname)}
      </h1>

      <div className="flex min-w-0 flex-1 justify-center">
        <AskPorterBar />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/messages"
          aria-label={unreadCount > 0 ? `Messages, ${unreadCount} unread` : "Messages"}
          className="relative flex h-10 w-10 items-center justify-center rounded-xl text-text-secondary transition-colors hover:bg-muted hover:text-text-primary"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--background)] bg-[var(--orange)]" />
          )}
        </Link>

        <ThemeToggle />

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Account menu"
            aria-expanded={menuOpen}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--teal)] font-bold text-white"
          >
            {user?.email?.charAt(0).toUpperCase() ?? "?"}
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-border bg-surface py-2 shadow-lg" role="menu">
              <p className="truncate px-4 py-2 text-xs text-text-secondary">{user?.email}</p>
              <Link href="/settings/profile" role="menuitem" onClick={() => setMenuOpen(false)} className="block px-4 py-2 text-sm text-text-primary hover:bg-muted">
                Profile
              </Link>
              <Link href="/more" role="menuitem" onClick={() => setMenuOpen(false)} className="block px-4 py-2 text-sm text-text-primary hover:bg-muted">
                Settings
              </Link>
              <button role="menuitem" onClick={logout} className="block w-full px-4 py-2 text-left text-sm text-accent-error hover:bg-muted">
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Run — green**
- [ ] **Step 5: Remaining tests ONE AT A TIME:**

Test 2 — unread badge + messages link:
```typescript
  it("links to messages with an unread indicator", () => {
    render(<TopBar />);
    expect(screen.getByRole("link", { name: /Messages, 2 unread/ })).toHaveAttribute("href", "/messages");
  });
```
Test 3 — avatar menu:
```typescript
  it("opens the account menu with profile, settings, log out", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    render(<TopBar />);
    await user.click(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.getByRole("menuitem", { name: "Profile" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Log out" })).toBeInTheDocument();
  });
```

- [ ] **Step 6: Commit**
```bash
git add apps/web/src/components/layout/top-bar.tsx apps/web/src/components/layout/top-bar.test.tsx
git commit -m "feat(web): desktop top bar - title, Ask Porter, account menu"
```

---

### Task 6: AskPorterBar (build BEFORE Task 5)

**Files:**
- Create: `apps/web/src/components/porter/ask-porter-bar.tsx`
- Test: `apps/web/src/components/porter/ask-porter-bar.test.tsx`

**Interfaces:**
- `AskPorterBar()` — no props. Pills from `porterPills(usePathname())`. Collapsed: 1-row textarea. Focused: 3 rows + pills. Submit (Enter without Shift, send button, or pill click) → `router.push("/porter?q=" + encodeURIComponent(text))`; whitespace-only submit is a no-op. Blur with empty value collapses.

- [ ] **Step 1: ONE failing test — collapsed input renders**

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AskPorterBar } from "./ask-porter-bar";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/inventory",
  useRouter: () => ({ push }),
}));

describe("AskPorterBar", () => {
  it("renders a collapsed one-row Ask Porter input", () => {
    render(<AskPorterBar />);
    const input = screen.getByRole("textbox", { name: "Ask Porter" });
    expect(input).toHaveAttribute("rows", "1");
  });
});
```

- [ ] **Step 2: Run — red**
- [ ] **Step 3: Implement**

```tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { porterPills } from "@/lib/navigation";

/**
 * Focus-expanding Ask Porter input. One component, two mounts:
 * desktop TopBar center, and under PageHeader on inventory/listings/orders
 * below lg. Collapsed ~44px; focus grows it to 3 rows and reveals
 * page-specific pills. Submit routes to /porter?q=… (auto-send there).
 */
export function AskPorterBar() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);

  const expanded = focused || value.length > 0;
  const pills = porterPills(pathname);

  const submit = (text: string) => {
    const q = text.trim();
    if (!q) return;
    setValue("");
    setFocused(false);
    router.push(`/porter?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="w-full max-w-xl">
      <div
        className="flex items-end gap-2 rounded-2xl border bg-surface px-3 py-1.5"
        style={{ borderColor: expanded ? "var(--teal)" : "var(--border)" }}
      >
        <svg className="mb-2 shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 2a7 7 0 017 7v3a7 7 0 01-14 0V9a7 7 0 017-7z" />
          <circle cx="9" cy="11" r="1" />
          <circle cx="15" cy="11" r="1" />
        </svg>
        <textarea
          aria-label="Ask Porter"
          placeholder="Ask Porter…"
          rows={expanded ? 3 : 1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(value);
            }
          }}
          className="min-w-0 flex-1 resize-none bg-transparent py-1.5 text-sm text-text-primary placeholder:text-text-placeholder focus:outline-none"
        />
        {expanded && (
          <button
            onMouseDown={(e) => e.preventDefault()} // keep textarea focus through the click
            onClick={() => submit(value)}
            aria-label="Send to Porter"
            className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white disabled:opacity-40"
            style={{ background: "var(--teal)" }}
            disabled={!value.trim()}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        )}
      </div>
      {expanded && (
        <div className="mt-2 flex flex-wrap gap-2">
          {pills.map((pill) => (
            <button
              key={pill}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => submit(pill)}
              className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-[var(--teal)] hover:text-text-primary"
            >
              {pill}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run — green**
- [ ] **Step 5: Remaining tests ONE AT A TIME:**

Test 2 — focus expands + page pills:
```typescript
  it("expands to 3 rows on focus and shows inventory pills", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    render(<AskPorterBar />);
    await user.click(screen.getByRole("textbox", { name: "Ask Porter" }));
    expect(screen.getByRole("textbox", { name: "Ask Porter" })).toHaveAttribute("rows", "3");
    expect(screen.getByRole("button", { name: "What's unlisted?" })).toBeInTheDocument();
  });
```
Test 3 — submit navigates:
```typescript
  it("Enter submits to /porter?q=…", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    render(<AskPorterBar />);
    await user.type(screen.getByRole("textbox", { name: "Ask Porter" }), "what sold today{Enter}");
    expect(push).toHaveBeenCalledWith("/porter?q=what%20sold%20today");
  });
```
Test 4 — empty no-op:
```typescript
  it("whitespace-only submit does not navigate", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    push.mockClear();
    render(<AskPorterBar />);
    await user.type(screen.getByRole("textbox", { name: "Ask Porter" }), "   {Enter}");
    expect(push).not.toHaveBeenCalled();
  });
```
Test 5 — pill submits its text:
```typescript
  it("pill click submits the pill text", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    push.mockClear();
    render(<AskPorterBar />);
    await user.click(screen.getByRole("textbox", { name: "Ask Porter" }));
    await user.click(screen.getByRole("button", { name: "What's unlisted?" }));
    expect(push).toHaveBeenCalledWith(`/porter?q=${encodeURIComponent("What's unlisted?")}`);
  });
```

- [ ] **Step 6: Commit**
```bash
git add apps/web/src/components/porter/ask-porter-bar.tsx apps/web/src/components/porter/ask-porter-bar.test.tsx
git commit -m "feat(web): AskPorterBar - focus-expanding input + page pills"
```

---

### Task 7: Porter page `?q=` auto-send

**Files:**
- Modify: `apps/web/src/app/(tabs)/porter/page.tsx`
- Test: colocated test file (create `apps/web/src/app/(tabs)/porter/porter-q-autosend.test.tsx` if the page has no test; otherwise extend the existing one)

**Interfaces:**
- On mount, read `q` from `window.location.search` (NOT `useSearchParams` — avoids the Next Suspense-boundary requirement on a client page). If non-blank: `porter.sendMessage(q)` ONCE (ref guard), then `history.replaceState` to strip the param.

- [ ] **Step 1: ONE failing test**

The page pulls the whole Porter context; test the extracted hook instead. Create `apps/web/src/hooks/use-porter-autosend.ts` + test:

```typescript
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePorterAutosend } from "./use-porter-autosend";

describe("usePorterAutosend", () => {
  it("sends the q param once and strips it from the URL", () => {
    const send = vi.fn();
    window.history.replaceState(null, "", "/porter?q=hello%20there");
    const { rerender } = renderHook(() => usePorterAutosend(send));
    rerender();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("hello there");
    expect(window.location.search).toBe("");
  });
});
```

- [ ] **Step 2: Run — red**
- [ ] **Step 3: Implement hook**

```typescript
"use client";

import { useEffect, useRef } from "react";

/**
 * Auto-send the ?q= message once when landing on /porter from an
 * AskPorterBar submit, then strip the param so back-nav/re-render
 * can't re-send. Reads window.location (not useSearchParams) to avoid
 * the client-page Suspense requirement.
 */
export function usePorterAutosend(send: (text: string) => void): void {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q")?.trim();
    if (!q) return;
    fired.current = true;
    params.delete("q");
    const rest = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : ""));
    send(q);
  }, [send]);
}
```

- [ ] **Step 4: Run — green**
- [ ] **Step 5: Add second test (empty q no-op) — ONE test:**

```typescript
  it("does nothing without a q param", () => {
    const send = vi.fn();
    window.history.replaceState(null, "", "/porter");
    renderHook(() => usePorterAutosend(send));
    expect(send).not.toHaveBeenCalled();
  });
```

- [ ] **Step 6: Wire into the porter page**

In `(tabs)/porter/page.tsx`, after `const porter = usePorter();` add:

```tsx
  usePorterAutosend(porter.sendMessage);
```

with `import { usePorterAutosend } from "@/hooks/use-porter-autosend";`. (`porter.sendMessage` identity: if it isn't memoized in context, the `fired` ref already guards re-fires.)

- [ ] **Step 7: Gates + commit**
```bash
git add apps/web/src/hooks/use-porter-autosend.ts apps/web/src/hooks/use-porter-autosend.test.ts "apps/web/src/app/(tabs)/porter/page.tsx"
git commit -m "feat(web): /porter?q= auto-send once via usePorterAutosend"
```

---

### Task 8: Floating glass TabBar

**Files:**
- Modify: `apps/web/src/components/layout/tab-bar.tsx`
- Modify: `apps/web/src/app/(tabs)/layout.tsx`
- Test: `apps/web/src/components/layout/tab-bar.test.tsx` (create if absent)

**Interfaces:** visual restyle only — tab set, ScanFlow wiring, warning toast, unread dot all UNCHANGED.

- [ ] **Step 1: ONE failing test — floating classes**

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TabBar } from "./tab-bar";

vi.mock("next/navigation", () => ({ usePathname: () => "/home" }));
vi.mock("@/hooks/use-messages", () => ({ useUnreadCount: () => ({ count: 0 }) }));
vi.mock("@/components/capture/scan-flow", () => ({ ScanFlow: () => null }));

describe("TabBar", () => {
  it("floats inset with rounded glass styling and hides at lg", () => {
    render(<TabBar />);
    const nav = screen.getByRole("navigation");
    expect(nav.className).toContain("rounded-[22px]");
    expect(nav.className).toContain("lg:hidden");
    expect(nav.className).not.toContain("bottom-0 left-0 right-0");
  });
});
```

- [ ] **Step 2: Run — red**
- [ ] **Step 3: Restyle the `<nav>`** (only the outer chrome changes)

Replace the current nav element:

```tsx
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t glass-nav glass-fallback"
        style={{ paddingBottom: "var(--safe-area-bottom)" }}
      >
```

with:

```tsx
      <nav
        className="fixed left-3 right-3 z-50 mx-auto max-w-lg rounded-[22px] border glass-nav glass-fallback lg:hidden"
        style={{
          bottom: "calc(0.5rem + var(--safe-area-bottom))",
          borderColor: "var(--glass-thin-border)",
          boxShadow: "var(--shadow-elevated)",
        }}
      >
```

And the fade gradient wrapper (`bottom-16` → clears the floated bar) becomes:

```tsx
      <div
        className="fixed left-0 right-0 z-40 h-8 pointer-events-none lg:hidden"
        style={{
          bottom: "calc(4.5rem + var(--safe-area-bottom))",
          background: "linear-gradient(to bottom, transparent, var(--background))",
        }}
      />
```

Everything inside the nav (tabs row, Scan FAB, More dot) stays byte-identical.

- [ ] **Step 4: `(tabs)/layout.tsx` padding** — floating bar footprint is bar height (64px) + lift (8px) + inset: change `pb-20` to `pb-24`.

- [ ] **Step 5: Run — green; run FULL web suite** (`npm run test -w apps/web`) — pre-existing TabBar-dependent tests must stay green.

- [ ] **Step 6: Commit**
```bash
git add apps/web/src/components/layout/tab-bar.tsx apps/web/src/components/layout/tab-bar.test.tsx "apps/web/src/app/(tabs)/layout.tsx"
git commit -m "feat(web): floating inset glass tab bar, hidden at lg"
```

---

### Task 9: AskPorterBar rows on inventory/listings/orders (mobile)

**Files:**
- Modify: `apps/web/src/app/(tabs)/inventory/page.tsx`, `apps/web/src/app/(tabs)/listings/page.tsx`, `apps/web/src/app/(tabs)/orders/page.tsx`

Each page: directly under its `<PageHeader …/>`, insert:

```tsx
      <div className="lg:hidden px-4 pt-3 max-w-lg mx-auto w-full">
        <AskPorterBar />
      </div>
```

with `import { AskPorterBar } from "@/components/porter/ask-porter-bar";`.

`lg:hidden` because desktop already has the TopBar mount — never two bars on one screen.

- [ ] **Step 1: Insert on all three pages** (declarative mounts; AskPorterBar's own tests cover behavior — if tdd-guard blocks, add ONE smoke test per page asserting the textbox renders, with the page's data hooks mocked)
- [ ] **Step 2: `npm run typecheck && npm run lint && npm run test -w apps/web`** — green
- [ ] **Step 3: Commit**
```bash
git add "apps/web/src/app/(tabs)/inventory/page.tsx" "apps/web/src/app/(tabs)/listings/page.tsx" "apps/web/src/app/(tabs)/orders/page.tsx"
git commit -m "feat(web): Ask Porter row on inventory/listings/orders (mobile)"
```

---

### Task 10: Content width system

**Files:**
- Modify: `apps/web/src/app/globals.css`
- Modify: core pages — home, inventory, listings, orders, more, messages list, settings/* (6 pages), `inventory/[id]`

- [ ] **Step 1: Add the utility to `globals.css`** (after the glass utilities):

```css
/* Responsive content container — replaces scattered per-page max-w-lg.
   Phone: max-w-lg · tablet portrait: max-w-2xl · desktop: fluid to max-w-5xl. */
.content-container {
  width: 100%;
  margin-inline: auto;
  max-width: 32rem; /* max-w-lg */
}
@media (min-width: 768px) {
  .content-container { max-width: 42rem; } /* max-w-2xl */
}
@media (min-width: 1024px) {
  .content-container { max-width: 64rem; } /* max-w-5xl */
}
```

- [ ] **Step 2: Swap per-page wrappers.** On each core page, replace the content wrapper's `max-w-lg mx-auto` with `content-container` (grep per page: `grep -n "max-w-lg" <file>`). Do NOT touch `PageHeader`'s internal `max-w-lg` yet — headers swap in the same edit per page so title and content stay aligned (PageHeader takes the class via its own wrapper: update `page-header.tsx`'s inner div from `max-w-lg mx-auto` to `content-container`).
- [ ] **Step 3: Inventory + listings grids fluid at `md+`.** In the grid container of each, extend the grid classes with `md:grid-cols-3 xl:grid-cols-4` (exact existing class lists vary — verify with a Read; keep phone columns untouched).
- [ ] **Step 4: Gates:** `npm run typecheck && npm run lint && npm run test -w apps/web` — some tests pin `max-w-lg` (e.g. onboarding card — that one is the CARD, not page container: leave it). Fix only tests that pinned page-container classes, one edit each.
- [ ] **Step 5: Commit**
```bash
git add apps/web/src/app/globals.css apps/web/src/components/layout/page-header.tsx <each touched page>
git commit -m "feat(web): responsive content-container width system"
```

---

### Task 11: Gates, deploy, three-viewport DoD walk, PR

This is the **Definition of Done** task — frontend-verification skill at execution time.

- [ ] **Step 1: Full gates:** `npm run typecheck && npm run lint && npm run test -w apps/web && npm run test:api` — all green.
- [ ] **Step 2: Deploy:** `docker compose up -d --build portage-app`
- [ ] **Step 3: e2e:** `npm run test:e2e` — suite green. e2e runs Desktop Chrome (1280×720): the shell now renders sidebar+topbar there — specs that asserted tab-bar navigation may need their nav path updated (sidebar links have identical hrefs; adjust selectors only where they targeted the bottom bar explicitly).
- [ ] **Step 4: Live walk + screenshots (light AND dark at each):**
  - **390×844 (phone):** floating glass bar on the 6 tab pages, orange FAB scans; Home chip on `/settings/help`, `/inventory/<id>`, `/messages` and absent on tab pages; Ask Porter row on inventory/listings/orders — focus expands, pill submit lands in `/porter` and auto-sends exactly once.
  - **820×1180 (iPad portrait):** mobile chrome + `max-w-2xl` content + 3-col inventory grid.
  - **1440×900 (desktop):** sidebar expand/collapse persists across reload; top bar title tracks route; Ask Porter in top bar (no duplicate row on list pages); avatar menu; messages badge; NO bottom bar/chip; scan from sidebar works; existing flows (scan→save, listing edit, publish path) intact.
- [ ] **Step 5: PR**
```bash
git push -u origin feat/responsive-shell
gh pr create --title "feat: responsive shell - desktop sidebar, iPad, glass tab bar" --body "<summary + DoD screenshots at 3 breakpoints>"
```
CodeRabbit is a required check; merge with `--merge`.

---

## Task dispatch order (orchestrator)

1 → 2 → **3 (Fable)** → 6 → 5 → 4 → 7 → 8 → 9 → 10 → 11 (Fable). Sonnet 5 for 1–2, 4–10; two failed reviews on a task → redo with Opus 4.8. Fable reviews at every boundary: spec-compliance + code-quality, verify commit landed, run the file-scoped tests.

## Self-Review (performed at write time)

- **Spec coverage:** breakpoints/CSS-only switching (T3), sidebar incl. collapse persistence + badge + Scan (T4), top bar incl. title/theme/avatar/unread (T5), AskPorterBar + pills + `?q=` contract (T6), auto-send-once + strip (T7), floating glass bar + `(tabs)` padding + `lg:hidden` (T8), mobile Porter rows (T9), content-width system + fluid grids + dock-slot/pane reserves (T3, T10), error handling (localStorage guards T4, empty-q T6/T7, title fallback T1), testing section mapped 1:1, DoD (T11). Gap: none found.
- **Placeholder scan:** all code steps carry full code; Task 10's per-page grid classes flagged as verify-with-Read (page-specific, listed as such — not a placeholder).
- **Type consistency:** `isTabRoute`/`pageTitle`/`porterPills` (T1) consumed by name in T3/T5/T6; `AskPorterBar` no-props in T5/T6/T9; placeholder-then-replace pattern for Sidebar/TopBar declared in T3 and honored in T4/T5; `usePorterAutosend(send)` signature consistent T7.
