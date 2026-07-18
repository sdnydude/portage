"use client";

import { TabBar } from "./tab-bar";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";
import { UnreadCountProvider } from "@/hooks/use-unread-count";

/**
 * Responsive shell. Breakpoint switching is CSS-only:
 * mobile chrome and desktop chrome both render; `lg:` classes decide
 * visibility, so SSR/hydration never flickers.
 * The dock-slot aside is the reserved Phase R3 Porter-dock mount point;
 * shell-main is the pane-capable Phase R1 region.
 * TabBar mounting: unified in AppShell (Task 8) for every route — admin
 * included since 2026-07-17 (carve-out removed; admin/layout.tsx nests its
 * own sub-nav inside shell-main). TabBar decides full vs. compact state
 * internally via `isTabRoute`.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <UnreadCountProvider>
    <div className="min-h-dvh lg:flex">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Sticky lives on the wrapper: TopBar's own `sticky top-0` is a no-op
            because this wrapper is its containing block and exactly its height
            (zero travel). Pre-existing since R0; surfaced when the admin header
            began stacking below the bar (lg:top-16). */}
        <div className="hidden lg:block sticky top-0 z-40">
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
