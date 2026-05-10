"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";

export function useOnboarding() {
  const { user, token, isAuthenticated, setOnboardingCompleted } = useAuth();
  const [isCompleting, setIsCompleting] = useState(false);

  const shouldShowOnboarding =
    isAuthenticated && user?.onboardingCompleted === false;

  const completeOnboarding = useCallback(async (): Promise<void> => {
    if (!token || isCompleting) return;
    setIsCompleting(true);
    try {
      await api<{ onboardingCompleted: boolean }>("/users/me/onboarding", {
        method: "PATCH",
        body: { completed: true },
        token,
      });
      setOnboardingCompleted();
    } finally {
      setIsCompleting(false);
    }
  }, [token, isCompleting, setOnboardingCompleted]);

  return {
    shouldShowOnboarding,
    completeOnboarding,
    isCompleting,
  };
}
