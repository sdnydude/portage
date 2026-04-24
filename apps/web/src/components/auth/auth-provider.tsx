"use client";

import { useState, useEffect, useCallback } from "react";
import { AuthContext } from "@/hooks/use-auth";

interface AuthUser {
  id: string;
  email: string;
  subscriptionTier: "free" | "pro";
  role: "user" | "admin";
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
  }, []);

  const login = useCallback((newToken: string, refreshToken: string, newUser: AuthUser | null) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
    if (newUser) localStorage.setItem(USER_KEY, JSON.stringify(newUser));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
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
    }}>
      {children}
    </AuthContext>
  );
}
