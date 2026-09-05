"use client";

import { useState, useEffect, useCallback } from "react";
import { AuthContext } from "@/hooks/use-auth";
import { setOnSessionExchanged, requestExchange, api, SESSION_LOST_EVENT } from "@/lib/api";

interface AuthUser {
  id: string;
  email: string;
  subscriptionTier: "free" | "pro" | "beta-tester";
  role: "user" | "admin";
  onboardingCompleted?: boolean;
}

const TOKEN_KEY = "portage_token";
const USER_KEY = "portage_user";
// Once per browser session: login-triggered background syncs (orders, GTC).
const LOGIN_SYNC_KEY = "portage_login_sync_done";

const CF_TEAM_DOMAIN = process.env.NEXT_PUBLIC_CF_TEAM_DOMAIN ?? "digitalharmonyai";

// The mount-time session exchange, so logout can wait for it to settle before
// clearing storage — otherwise its late resolution re-stores the token.
let pendingExchange: Promise<unknown> | null = null;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Instant paint from cache while the exchange happens in the background.
    // Without a cache there is nothing correct to paint — "not authenticated
    // yet" and "not authenticated" are different states, and flipping isReady
    // early made /home flash the logged-out hero on every cold load
    // (2026-07-10). Cache miss ⇒ stay on the spinner until the exchange
    // settles (see .finally below).
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedUser = localStorage.getItem(USER_KEY);
    let hasCache = false;
    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
        hasCache = true;
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    }
    if (hasCache) setIsReady(true);

    setOnSessionExchanged((newToken, newUser) => {
      if (!newToken) {
        setToken(null);
        setUser(null);
        return;
      }
      setToken(newToken);
      setUser(newUser as AuthUser);
    });

    // Cloudflare Access is the session layer: the edge already authenticated
    // this request, so exchange the CF identity for an internal token on every
    // mount. The exchange syncs state via the callback above; requestExchange
    // (not a bare exchangeSession) so remount storms hit the success throttle
    // and failure backoff instead of a fresh /auth/session call per page load.
    pendingExchange = requestExchange()
      .then((freshToken) => {
        // First exchange this browser session = a login event. Fire-and-forget
        // background syncs; keepalive survives an immediate navigation. Never
        // block or break the session on a slow/down marketplace API.
        if (!sessionStorage.getItem(LOGIN_SYNC_KEY)) {
          sessionStorage.setItem(LOGIN_SYNC_KEY, "1");
          void api("/orders/sync", { method: "POST", token: freshToken, keepalive: true }).catch(() => {});
          void api("/listings/gtc-sweep", { method: "POST", token: freshToken, keepalive: true }).catch(() => {});
        }
      })
      .catch(() => {
        // Definitive rejections already cleared state + fired SESSION_LOST via
        // exchangeSession; transient failures keep the cached session.
      })
      .finally(() => {
        // Cache-miss cold loads waited on the spinner for this outcome.
        setIsReady(true);
      });

    // Central auth-loss handler: api.ts fires this only on definitive auth
    // rejection — never on network errors or 5xx. Storage is already cleared
    // before the dispatch — clear React state and land on home immediately.
    const onSessionLost = () => {
      setToken(null);
      setUser(null);
      // Already on /home: re-assigning the href reloads the page, and a
      // persistently rejected exchange (e.g. disabled account) then loops
      // reload → remount → exchange → wipe forever, one /auth/session hit
      // per page load. React state above already shows the logged-out hero.
      if (window.location.pathname !== "/home") {
        window.location.href = "/home";
      }
    };
    window.addEventListener(SESSION_LOST_EVENT, onSessionLost);

    return () => {
      setOnSessionExchanged(null);
      window.removeEventListener(SESSION_LOST_EVENT, onSessionLost);
    };
  }, []);

  const logout = useCallback(async () => {
    // CF Access owns the session — ending it means logging out at the edge.
    // Wait for any in-flight exchange to settle so its resolution can't
    // re-store the token after we clear it, then clear and hand off to CF.
    await pendingExchange?.then(() => {}, () => {});
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(LOGIN_SYNC_KEY);
    window.location.href = `https://${CF_TEAM_DOMAIN}.cloudflareaccess.com/cdn-cgi/access/logout`;
  }, []);

  const setOnboardingCompleted = useCallback(() => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, onboardingCompleted: true };
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  if (!isReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-forest-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AuthContext value={{
      token,
      user,
      isAuthenticated: !!token,
      logout,
      setOnboardingCompleted,
    }}>
      {children}
    </AuthContext>
  );
}
