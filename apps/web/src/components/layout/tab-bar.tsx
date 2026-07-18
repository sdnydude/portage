"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import { ScanFlow } from "@/components/capture/scan-flow";
import { isTabRoute } from "@/lib/navigation";

// Scroll delta (px) before the bar reacts — avoids jitter on small bounces.
const SCROLL_MINIMIZE_THRESHOLD = 24;

// 4 tabs, balanced 2 | Scan | 2 — Listings left the bar 2026-07-17; the
// /listings route stays reachable from Home modules and inventory links.
const tabs = [
  { name: "Home", href: "/home", icon: HomeIcon, position: "left" as const },
  { name: "Inventory", href: "/inventory", icon: InventoryIcon, position: "left" as const },
  { name: "Porter", href: "/porter", icon: PorterIcon, position: "right" as const },
  { name: "Orders", href: "/orders", icon: OrdersIcon, position: "right" as const },
] as const;

export function TabBar() {
  const pathname = usePathname() ?? "/";
  const onTabRoute = isTabRoute(pathname);
  const [showScan, setShowScan] = useState(false);
  const [scanWarning, setScanWarning] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const handleScanOpen = useCallback(() => {
    setShowScan(true);
  }, []);

  const handleScanClose = useCallback((result?: { warning?: string }) => {
    setShowScan(false);
    // Publish-failure / draft-fallback reason (e.g. eBay rejected the publish).
    // Persists until the seller dismisses it — the old 8s auto-hide was missed on
    // mobile after the modal closed, so a failed publish read as a silent success.
    if (result?.warning) setScanWarning(result.warning);
  }, []);

  // prefers-reduced-motion: full<->compact becomes a fade, never translate/scale.
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return; // jsdom test env has no matchMedia unless stubbed
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Minimize-on-scroll applies only on tab routes — non-tab routes are always
  // compact regardless of scroll (see `compact` below), so no listener there.
  useEffect(() => {
    if (!onTabRoute) return;
    setMinimized(false); // (re-)entering a tab route always starts full
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY;
      if (delta > SCROLL_MINIMIZE_THRESHOLD) {
        setMinimized(true);
        lastY = y;
      } else if (delta < -SCROLL_MINIMIZE_THRESHOLD || y <= 0) {
        setMinimized(false);
        lastY = y;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
    // pathname dep: tab-to-tab navigation must re-fire this effect so the bar
    // resets to full and lastY re-anchors (onTabRoute alone stays true across
    // all 5 tab routes and would never re-run).
  }, [onTabRoute, pathname]);

  // Compact (icon-only, no labels) is permanent off tab routes (HIG "never
  // fully absent") and transient on tab routes once scrolled past threshold.
  const compact = !onTabRoute || minimized;
  const transitionClass = reducedMotion ? "transition-opacity duration-150" : "transition-all duration-200";

  const leftTabs = tabs.filter((t) => t.position === "left");
  const rightTabs = tabs.filter((t) => t.position === "right");

  return (
    <>
      {/* Content fade gradient — tracks the bar's height: 48px compact bar +
          8px lift = 3.5rem; 64px full bar + 8px = 4.5rem */}
      <div
        className={`fixed left-0 right-0 z-40 h-8 pointer-events-none lg:hidden ${transitionClass}`}
        style={{
          bottom: `calc(${compact ? "3.5rem" : "4.5rem"} + var(--safe-area-bottom))`,
          background: "linear-gradient(to bottom, transparent, var(--background))",
        }}
      />

      {/* Tab bar — floating inset glass pill */}
      <nav
        className={`fixed left-3 right-3 z-50 mx-auto max-w-lg rounded-[22px] border glass-nav glass-fallback lg:hidden ${transitionClass}`}
        style={{
          bottom: "calc(0.5rem + var(--safe-area-bottom))",
          borderColor: "var(--glass-thin-border)",
          boxShadow: "var(--shadow-elevated)",
        }}
      >
        <div className={`flex items-center justify-around ${compact ? "h-12" : "h-16"} max-w-lg mx-auto px-1 relative`}>
          {/* Left tabs */}
          {leftTabs.map((tab) => {
            const isActive = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.name}
                href={tab.href}
                aria-label={compact ? tab.name : undefined}
                className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-colors rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--teal)] ${
                  isActive
                    ? "text-[var(--text-primary)]"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {isActive && <span aria-hidden className="absolute top-0.5 h-1 w-1 rounded-full bg-current" />}
                <tab.icon active={isActive} />
                {!compact && (
                  <span className={`text-[10px] leading-tight ${isActive ? "font-semibold" : "font-normal"}`}>
                    {tab.name}
                  </span>
                )}
              </Link>
            );
          })}

          {/* Center SCAN button — full state breaks the top edge (-mt-7);
              compact state is a small inline FAB, no breakout */}
          <div className="flex flex-col items-center justify-center flex-1">
            <button
              onClick={handleScanOpen}
              className={
                compact
                  ? "relative w-10 h-10 rounded-full bg-[var(--orange)] flex items-center justify-center active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--orange-dark)] focus-visible:ring-offset-[var(--background)]"
                  : "relative -mt-7 w-14 h-14 rounded-full bg-[var(--orange)] flex items-center justify-center active:scale-95 transition-transform animate-spring-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--orange-dark)] focus-visible:ring-offset-[var(--background)]"
              }
              style={{ boxShadow: "var(--shadow-elevated), 0 0 0 3px var(--background)" }}
              aria-label="Scan item"
            >
              <ScanIcon />
            </button>
            {!compact && (
              <span className="text-[10px] leading-tight font-semibold text-[var(--orange-dark)] mt-0.5">Scan</span>
            )}
          </div>

          {/* Right tabs (Porter tinted teal as the AI accent) */}
          {rightTabs.map((tab) => {
            const isActive = pathname.startsWith(tab.href);
            const isPorter = tab.name === "Porter";
            const colorClass = isPorter
              ? "text-[var(--teal)]"
              : isActive
                ? "text-[var(--text-primary)]"
                : "text-text-secondary hover:text-text-primary";
            return (
              <Link
                key={tab.name}
                href={tab.href}
                aria-label={compact ? tab.name : undefined}
                className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-colors rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--teal)] ${colorClass}`}
              >
                {isActive && <span aria-hidden className="absolute top-0.5 h-1 w-1 rounded-full bg-current" />}
                <tab.icon active={isActive} />
                {!compact && (
                  <span className={`text-[10px] leading-tight ${isActive || isPorter ? "font-semibold" : "font-normal"}`}>
                    {tab.name}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Scan flow modal */}
      {showScan && <ScanFlow onClose={handleScanClose} />}

      {/* Save & List publish-failure / draft-fallback (marketplace's actual reason).
          Persists until dismissed — a failed publish must never read as a silent success. */}
      {scanWarning && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-24 left-4 right-4 z-50 mx-auto max-w-md px-4 py-3 rounded-xl text-sm font-medium shadow-lg border border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/90 dark:border-amber-800 dark:text-amber-200 animate-in fade-in slide-in-from-bottom-2 duration-200 flex items-start gap-3"
        >
          <span className="flex-1">{scanWarning}</span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setScanWarning(null)}
            className="shrink-0 -mr-1 -mt-0.5 p-1 rounded-md hover:bg-amber-100 dark:hover:bg-amber-900/50"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={active ? 0 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
      {!active && <path d="M9 21V12h6v9" />}
      {active && <rect x="9" y="12" width="6" height="9" fill="var(--background)" />}
    </svg>
  );
}

function InventoryIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.5 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

function PorterIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={active ? 0 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2.5l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9z" />
    </svg>
  );
}

function OrdersIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={active ? 0 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="1" y="3" width="15" height="13" rx="2" />
      <path d="M16 8h4l3 3v5a2 2 0 01-2 2h-1" strokeWidth="2" stroke="currentColor" fill="none" />
      <circle cx="5.5" cy="18.5" r="2.5" fill={active ? "var(--background)" : "none"} stroke="currentColor" strokeWidth="2" />
      <circle cx="18.5" cy="18.5" r="2.5" fill={active ? "var(--background)" : "none"} stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function ScanIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
