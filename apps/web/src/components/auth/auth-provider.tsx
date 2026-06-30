"use client";

import { useState, useEffect, useCallback } from "react";
import { AuthContext } from "@/hooks/use-auth";
import { setOnTokenRefreshed, api, SESSION_LOST_EVENT } from "@/lib/api";

interface AuthUser {
  id: string;
  email: string;
  subscriptionTier: "free" | "pro";
  role: "user" | "admin";
  onboardingCompleted?: boolean;
}

const TOKEN_KEY = "portage_token";
const REFRESH_KEY = "portage_refresh";
const USER_KEY = "portage_user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedUser = localStorage.getItem(USER_KEY);

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
        localStorage.removeItem(USER_KEY);
      }
    }
    setIsReady(true);

    setOnTokenRefreshed((newToken, _refreshToken, newUser) => {
      if (!newToken) {
        setToken(null);
        setUser(null);
        return;
      }
      setToken(newToken);
      setUser(newUser as AuthUser);
    });

    // Central auth-loss handler: api.ts fires this only on definitive auth
    // rejection (refresh 401/403, or no refresh token) — never on network
    // errors or 5xx. Storage is already cleared before the dispatch — clear
    // React state and land on home immediately.
    const onSessionLost = () => {
      setToken(null);
      setUser(null);
      window.location.href = "/home";
    };
    window.addEventListener(SESSION_LOST_EVENT, onSessionLost);

    return () => {
      setOnTokenRefreshed(null);
      window.removeEventListener(SESSION_LOST_EVENT, onSessionLost);
    };
  }, []);

  const login = useCallback((newToken: string, refreshToken: string, newUser: AuthUser | null) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
    if (newUser) localStorage.setItem(USER_KEY, JSON.stringify(newUser));

    // Fire-and-forget: pull marketplace orders in the background so the Orders
    // tab is fresh by the time the user navigates there. Never block or break
    // login on a slow/down marketplace API — swallow all failures here (the
    // manual Sync button surfaces errors on demand).
    void api("/orders/sync", { method: "POST", token: newToken }).catch(() => {});
  }, []);

  const logout = useCallback(async () => {
    // Revoke this device's session server-side before discarding it locally —
    // otherwise the refresh token stays valid on the server until it expires.
    // api() auto-refreshes an expired access token and retries, so revocation
    // works even after >15min idle (a raw fetch would silently 401 there).
    const accessToken = localStorage.getItem(TOKEN_KEY);
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (accessToken && refreshToken) {
      try {
        await api("/auth/logout", {
          method: "POST",
          body: { refreshToken },
          token: accessToken,
          signal: AbortSignal.timeout(5000),
        });
      } catch (err) {
        // Any failure (network, timeout, or HTTP error) must not block local
        // logout — but it means the server-side session may still be alive.
        console.warn("Server-side session revocation failed; token remains valid until expiry", err);
      }
    }
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = "/login";
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
      login,
      logout,
      setOnboardingCompleted,
    }}>
      {children}
    </AuthContext>
  );
}
