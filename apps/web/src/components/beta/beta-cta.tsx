"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

// Floating beta pill shown on every page for beta-tester accounts — links to
// the DHG Beta Tester Reporting tool with the current page prefilled.
export function BetaCta() {
  const { user } = useAuth();
  const pathname = usePathname();

  if (user?.subscriptionTier !== "beta-tester") return null;
  // Don't stack the pill on top of the report form itself.
  if (pathname?.startsWith("/beta/report")) return null;

  return (
    <Link
      href={`/beta/report?from=${encodeURIComponent(pathname ?? "/")}`}
      // Bottom-right, clear of the 64px tab bar — top-right sat exactly on
      // PageHeader's action slot (e.g. the orders Sync button) on every page.
      // z-40: BELOW the full-screen overlay layer (ScanFlow z-60, camera and
      // photo editors z-70, crop/exposure z-80, bulk bars z-55) so overlays
      // cover the pill instead of the pill covering their controls — at z-70
      // it painted over the camera's Done button (2026-07-10). Same spot on
      // every normal page; hidden whenever a full-screen surface is up.
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+76px)] right-3 z-40 flex items-center gap-1.5 rounded-full bg-[var(--color-primary)] text-white text-xs font-semibold pl-2.5 pr-3 py-1.5 shadow-lg hover:opacity-90 transition-opacity"
      aria-label="Report a beta issue"
    >
      <span aria-hidden>🧪</span>
      Beta
    </Link>
  );
}
