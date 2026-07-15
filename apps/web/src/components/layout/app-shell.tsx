"use client";

import { usePathname } from "next/navigation";
import { TabBar } from "./tab-bar";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";
import { UnreadCountProvider } from "@/hooks/use-unread-count";

/**
 * Route-aware responsive shell. Breakpoint switching is CSS-only:
 * mobile chrome and desktop chrome both render; `lg:` classes decide
 * visibility, so SSR/hydration never flickers. Admin keeps its own layout.
 * The dock-slot aside is the reserved Phase R3 Porter-dock mount point;
 * shell-main is the pane-capable Phase R1 region.
 * TabBar mounting: unified in AppShell (Task 8) for every non-admin route —
 * TabBar decides full vs. compact state internally via `isTabRoute`.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";

  if (pathname.startsWith("/admin")) return <>{children}</>;

  return (
    <UnreadCountProvider>
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
      <div className="lg:hidden">
        <TabBar />
      </div>
    </div>
    </UnreadCountProvider>
  );
}
