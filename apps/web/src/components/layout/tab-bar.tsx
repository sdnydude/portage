"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useCallback } from "react";
import { ScanFlow } from "@/components/capture/scan-flow";

const tabs = [
  { name: "Home", href: "/home", icon: HomeIcon, position: "left" as const },
  { name: "Inventory", href: "/inventory", icon: InventoryIcon, position: "left" as const },
  { name: "Porter", href: "/porter", icon: PorterIcon, position: "left" as const },
  { name: "Orders", href: "/orders", icon: OrdersIcon, position: "right" as const },
  { name: "More", href: "/more", icon: MoreIcon, position: "right" as const },
] as const;

export function TabBar() {
  const pathname = usePathname();
  const [showScan, setShowScan] = useState(false);

  const handleScanOpen = useCallback(() => {
    setShowScan(true);
  }, []);

  const handleScanClose = useCallback(() => {
    setShowScan(false);
  }, []);

  const leftTabs = tabs.filter((t) => t.position === "left");
  const rightTabs = tabs.filter((t) => t.position === "right");

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
        className="fixed bottom-0 left-0 right-0 z-50 border-t glass-regular glass-fallback"
        style={{ paddingBottom: "var(--safe-area-bottom)" }}
      >
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2 relative">
          {/* Left tabs */}
          {leftTabs.map((tab) => {
            const isActive = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-colors ${
                  isActive
                    ? "text-forest-green"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
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

          {/* Center SCAN button */}
          <div className="flex flex-col items-center justify-center flex-1">
            <button
              onClick={handleScanOpen}
              className="relative -mt-7 w-14 h-14 rounded-full bg-forest-green flex items-center justify-center active:scale-95 transition-transform animate-spring-in"
              style={{
                boxShadow: "var(--shadow-elevated), 0 0 0 3px var(--background)",
              }}
              aria-label="Scan item"
            >
              <ScanIcon />
            </button>
            <span className="text-[10px] leading-tight font-semibold text-forest-green mt-0.5">
              Scan
            </span>
          </div>

          {/* Right tabs */}
          {rightTabs.map((tab) => {
            const isActive = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-colors ${
                  isActive
                    ? "text-forest-green"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
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
        </div>
      </nav>

      {/* Scan flow modal */}
      {showScan && <ScanFlow onClose={handleScanClose} />}
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
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
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
      <circle cx="12" cy="5" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="19" r="1.5" fill="currentColor" />
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
