"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ScanFlow } from "@/components/capture/scan-flow";
import { useUnreadCount } from "@/hooks/use-messages";
import { useAuth } from "@/hooks/use-auth";
import { BAR_TABS, SIDEBAR_SECONDARY } from "@/lib/navigation";

const LABELS: Record<string, string> = {
  "/home": "Home",
  "/inventory": "Inventory",
  "/listings": "Listings",
  "/porter": "Porter",
  "/orders": "Orders",
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
    case "/messages":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
      );
    case "/admin":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z" />
        </svg>
      );
    case "/more":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="1" />
          <circle cx="19" cy="12" r="1" />
          <circle cx="5" cy="12" r="1" />
        </svg>
      );
    default:
      return null;
  }
}

export function Sidebar() {
  const pathname = usePathname() ?? "/";
  const [collapsed, setCollapsed] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const { count: unreadCount } = useUnreadCount();
  const { user } = useAuth();

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

      {/* Main nav — BAR_TABS, the same 5 destinations as the mobile bar */}
      <div className="flex flex-col gap-1 px-3 py-2">
        {BAR_TABS.map((route) => {
          const label = LABELS[route];
          const isActive = pathname.startsWith(route);
          const isPorter = route === "/porter";
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
              <NavIcon route={route} active={isActive} />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </div>

      {/* Divider — HIG: sidebar holds MORE than the bar (secondary destinations below) */}
      <div className="mx-4 my-2 border-t border-border" />

      {/* Secondary nav — SIDEBAR_SECONDARY (Messages w/ unread badge, Settings -> /more)
          + Admin, appended at render time for admin role only */}
      <div className="flex flex-1 flex-col gap-1 px-3 pb-2">
        {SIDEBAR_SECONDARY.map(({ href, label }) => {
          const isActive = pathname.startsWith(href);
          const showBadge = href === "/messages" && unreadCount > 0;
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={`relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--teal)] ${
                isActive
                  ? "bg-muted font-semibold text-text-primary"
                  : "text-text-secondary hover:bg-muted hover:text-text-primary"
              } ${collapsed ? "justify-center px-0" : ""}`}
            >
              <span className="relative">
                <NavIcon route={href} active={isActive} />
                {showBadge && (
                  <span className="absolute -right-1.5 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[var(--surface)] bg-[var(--orange)]" />
                )}
              </span>
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
        {user?.role === "admin" && (
          <Link
            href="/admin"
            title={collapsed ? "Admin" : undefined}
            className={`relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--teal)] ${
              pathname.startsWith("/admin")
                ? "bg-muted font-semibold text-text-primary"
                : "text-text-secondary hover:bg-muted hover:text-text-primary"
            } ${collapsed ? "justify-center px-0" : ""}`}
          >
            <NavIcon route="/admin" active={pathname.startsWith("/admin")} />
            {!collapsed && <span>Admin</span>}
          </Link>
        )}
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
