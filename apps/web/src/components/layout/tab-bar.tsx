"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useCallback } from "react";
import { ScanFlow } from "@/components/capture/scan-flow";
import { useUnreadCount } from "@/hooks/use-messages";

const tabs = [
  { name: "Home", href: "/home", icon: HomeIcon, position: "left" as const },
  { name: "Inventory", href: "/inventory", icon: InventoryIcon, position: "left" as const },
  { name: "Listings", href: "/listings", icon: ListingsIcon, position: "left" as const },
  { name: "Porter", href: "/porter", icon: PorterIcon, position: "right" as const },
  { name: "Orders", href: "/orders", icon: OrdersIcon, position: "right" as const },
  { name: "More", href: "/more", icon: MoreIcon, position: "right" as const },
] as const;

export function TabBar() {
  const pathname = usePathname();
  const [showScan, setShowScan] = useState(false);
  const [scanWarning, setScanWarning] = useState<string | null>(null);
  const { count: unreadCount } = useUnreadCount();

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

  const leftTabs = tabs.filter((t) => t.position === "left");
  const rightTabs = tabs.filter((t) => t.position === "right" && t.name !== "More");

  return (
    <>
      {/* Content fade gradient */}
      <div
        className="fixed bottom-16 left-0 right-0 z-40 h-8 pointer-events-none"
        style={{
          background: "linear-gradient(to bottom, transparent, var(--background))",
          paddingBottom: "var(--safe-area-bottom)",
        }}
      />

      {/* Tab bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t glass-nav glass-fallback"
        style={{ paddingBottom: "var(--safe-area-bottom)" }}
      >
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-1 relative">
          {/* Left tabs */}
          {leftTabs.map((tab) => {
            const isActive = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-colors rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--teal)] ${
                  isActive
                    ? "text-[var(--text-primary)]"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {isActive && <span aria-hidden className="absolute top-0.5 h-1 w-1 rounded-full bg-current" />}
                <tab.icon active={isActive} />
                <span
                  className={`text-[10px] leading-tight ${
                    isActive ? "font-semibold" : "font-normal"
                  }`}
                >
                  {tab.name}
                </span>
              </Link>
            );
          })}

          {/* Center SCAN button — all tabs */}
          <div className="flex flex-col items-center justify-center flex-1">
            <button
              onClick={handleScanOpen}
              className="relative -mt-7 w-14 h-14 rounded-full bg-[var(--orange)] flex items-center justify-center active:scale-95 transition-transform animate-spring-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--orange-dark)] focus-visible:ring-offset-[var(--background)]"
              style={{
                boxShadow: "var(--shadow-elevated), 0 0 0 3px var(--background)",
              }}
              aria-label="Scan item"
            >
              <ScanIcon />
            </button>
            <span className="text-[10px] leading-tight font-semibold text-[var(--orange-dark)] mt-0.5">
              Scan
            </span>
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
                className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-colors rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--teal)] ${colorClass}`}
              >
                {isActive && <span aria-hidden className="absolute top-0.5 h-1 w-1 rounded-full bg-current" />}
                <tab.icon active={isActive} />
                <span
                  className={`text-[10px] leading-tight ${
                    isActive || isPorter ? "font-semibold" : "font-normal"
                  }`}
                >
                  {tab.name}
                </span>
              </Link>
            );
          })}

          {/* More tab — rendered separately for unread dot */}
          {(() => {
            const isActive = pathname.startsWith("/more");
            return (
              <Link
                href="/more"
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-colors relative rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--teal)] ${
                  isActive
                    ? "text-[var(--text-primary)]"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {isActive && <span aria-hidden className="absolute top-0.5 h-1 w-1 rounded-full bg-current" />}
                <div className="relative">
                  <MoreIcon active={isActive} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 rounded-full bg-[var(--orange)] border-2 border-[var(--background)]" />
                  )}
                </div>
                <span
                  className={`text-[10px] leading-tight ${
                    isActive ? "font-semibold" : "font-normal"
                  }`}
                >
                  More
                </span>
              </Link>
            );
          })()}
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

function ListingsIcon({ active }: { active: boolean }) {
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
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z" />
      <circle cx="7" cy="7" r="1.3" fill="currentColor" />
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

function MoreIcon({ active }: { active: boolean }) {
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
      <circle cx="5" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" />
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
