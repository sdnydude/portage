"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "./use-auth";

interface UnreadCountValue {
  count: number;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const UnreadCountContext = createContext<UnreadCountValue | null>(null);

/**
 * Unread-badge source. The shell mounts 3-4 badge consumers simultaneously
 * (TopBar, Sidebar, PageHeader, More page); each used to fire its own
 * /messages/unread-count fetch on mount. UnreadCountProvider (mounted once in
 * AppShell) runs the fetch/refresh logic a single time and shares it; the
 * hook falls back to standalone fetching when no provider is above it, so
 * isolated mounts and unit tests keep working.
 */
export function useUnreadCount(): UnreadCountValue {
  const shared = useContext(UnreadCountContext);
  // Hooks must run unconditionally — `enabled` gates the fetch, not the hook.
  const standalone = useUnreadCountSource(shared === null);
  return shared ?? standalone;
}

export function UnreadCountProvider({ children }: { children: React.ReactNode }) {
  const value = useUnreadCountSource(true);
  return <UnreadCountContext.Provider value={value}>{children}</UnreadCountContext.Provider>;
}

function useUnreadCountSource(enabled: boolean): UnreadCountValue {
  const { token } = useAuth();
  const pathname = usePathname();
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [prevPathname, setPrevPathname] = useState(pathname);

  const load = useCallback(async () => {
    // Skipped fetches must still resolve loading, or tokenless/disabled
    // consumers would report isLoading=true forever.
    if (!enabled || !token) {
      setIsLoading(false);
      return;
    }
    try {
      const data = await api<{ count: number }>("/messages/unread-count", { token });
      setCount(data.count);
    } catch (err) {
      if (err instanceof ApiError) {
        console.error("Unread count error:", err.status, err.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [enabled, token]);

  useEffect(() => {
    load();
  }, [load]);

  // Leaving /messages means threads may have been read — refresh the badge.
  useEffect(() => {
    if (prevPathname.startsWith("/messages") && !pathname.startsWith("/messages")) {
      load();
    }
    setPrevPathname(pathname);
  }, [pathname, prevPathname, load]);

  return { count, isLoading, refetch: load };
}
