"use client";

import { useState, useEffect, useCallback } from "react";
import { AuthContext } from "@/hooks/use-auth";
import { setOnTokenRefreshed, API_BASE } from "@/lib/api";

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

    // Central auth-loss handler: api.ts fires this when a refresh attempt fails.
    // Storage is already cleared there — clear React state and land on home immediately.
    const onSessionLost = () => {
      setToken(null);
      setUser(null);
      window.location.href = "/home";
    };
    window.addEventListener("auth:session-lost", onSessionLost);

    return () => {
      setOnTokenRefreshed(null);
      window.removeEventListener("auth:session-lost", onSessionLost);
    };
  }, []);

  const login = useCallback((newToken: string, refreshToken: string, newUser: AuthUser | null) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
    if (newUser) localStorage.setItem(USER_KEY, JSON.stringify(newUser));
  }, []);

  const logout = useCallback(async () => {
    // Revoke this device's session server-side before discarding it locally —
    // otherwise the refresh token stays valid on the server until it expires.
    const accessToken = localStorage.getItem(TOKEN_KEY);
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (accessToken && refreshToken) {
      try {
        await fetch(`${API_BASE}/auth/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ refreshToken }),
        });
      } catch {
        // Network failure must not block local logout
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
