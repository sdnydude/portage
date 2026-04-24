"use client";

import { createContext, useContext } from "react";

interface AuthState {
  token: string | null;
  user: {
    id: string;
    email: string;
    subscriptionTier: "free" | "pro";
    role: "user" | "admin";
  } | null;
  isAuthenticated: boolean;
  login: (token: string, refreshToken: string, user: AuthState["user"]) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthState>({
  token: null,
  user: null,
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}
