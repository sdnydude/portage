"use client";

import { usePathname } from "next/navigation";
import { isTabRoute } from "@/lib/navigation";
import { TabBar } from "./tab-bar";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";

/**
 * Route-aware responsive shell. Breakpoint switching is CSS-only:
 * mobile chrome and desktop chrome both render; `lg:` classes decide
 * visibility, so SSR/hydration never flickers. Admin keeps its own layout.
 * The dock-slot aside is the reserved Phase R3 Porter-dock mount point;
 * shell-main is the pane-capable Phase R1 region.
 * TabBar mounting: non-tab routes here (compact bar — HIG "never fully
 * absent"); tab routes keep the (tabs)/layout mount until Task 8 unifies
 * ownership in AppShell for all non-admin routes.
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
          <TabBar />
        </div>
      )}
    </div>
  );
}
