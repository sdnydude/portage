"use client";

import { useState, useCallback, useEffect } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "./use-auth";
import type { UserPreferences } from "@portage/shared";

const DEFAULT_PREFS: UserPreferences = {
  listingInterface: 'hybrid',
  listingForkPref: 'ask',
  listingForkCount: 0,
  listingCompactMode: false,
};

export function useUserPreferences() {
  const { token } = useAuth();
  const [prefs, setPrefs] = useState<UserPreferences>({ ...DEFAULT_PREFS, disclaimerSuppressed: false });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    api<UserPreferences>('/users/me/preferences', { token })
      .then(setPrefs)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [token]);

  const updatePrefs = useCallback(async (updates: Partial<Pick<UserPreferences, 'listingInterface' | 'listingForkPref' | 'listingCompactMode'>>) => {
    if (!token) return;
    try {
      const updated = await api<UserPreferences>('/users/me/preferences', {
        method: 'PATCH',
        body: updates,
        token,
      });
      setPrefs(updated);
    } catch (err) {
      console.error('Failed to update preferences:', err instanceof ApiError ? err.message : err);
    }
  }, [token]);

  return {
    preference: prefs.listingInterface,
    forkPref: prefs.listingForkPref,
    forkCount: prefs.listingForkCount,
    compactMode: prefs.listingCompactMode,
    disclaimerSuppressed: prefs.disclaimerSuppressed ?? false,
    isLoading,
    updatePrefs,
  };
}
