"use client";

import { createContext, useContext } from "react";

interface AuthState {
  token: string | null;
  user: {
    id: string;
    email: string;
    subscriptionTier: "free" | "pro";
    role: "user" | "admin";
    onboardingCompleted?: boolean;
  } | null;
  isAuthenticated: boolean;
  login: (token: string, refreshToken: string, user: AuthState["user"]) => void;
  logout: () => Promise<void>;
  setOnboardingCompleted: () => void;
}

export const AuthContext = createContext<AuthState>({
  token: null,
  user: null,
  isAuthenticated: false,
  login: () => {},
  logout: async () => {},
  setOnboardingCompleted: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}
