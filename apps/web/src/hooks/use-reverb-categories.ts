"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

export interface ReverbCategory {
  uuid: string;
  fullName: string;
}

/**
 * Reverb's flat category list (~320 entries, served by the API from a 24h
 * server-side cache). The only valid source of Reverb category uuids — used by
 * the publish-sheet picker for items the AI could not place.
 */
export function useReverbCategories() {
  const { token } = useAuth();
  const [categories, setCategories] = useState<ReverbCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api<{ categories: ReverbCategory[] }>("/marketplace/reverb/categories", { token })
      .then(data => {
        if (!cancelled) setCategories(data.categories ?? []);
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load Reverb categories");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [token]);

  return { categories, isLoading, error };
}
