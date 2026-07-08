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
      className="fixed top-[calc(env(safe-area-inset-top)+8px)] right-3 z-[70] flex items-center gap-1.5 rounded-full bg-[var(--color-primary)] text-white text-xs font-semibold pl-2.5 pr-3 py-1.5 shadow-lg hover:opacity-90 transition-opacity"
      aria-label="Report a beta issue"
    >
      <span aria-hidden>🧪</span>
      Beta
    </Link>
  );
}
