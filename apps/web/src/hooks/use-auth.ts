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
  logout: () => Promise<void>;
  setOnboardingCompleted: () => void;
}

export const AuthContext = createContext<AuthState>({
  token: null,
  user: null,
  isAuthenticated: false,
  logout: async () => {},
  setOnboardingCompleted: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}
