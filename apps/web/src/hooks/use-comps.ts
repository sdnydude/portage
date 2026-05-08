"use client";

import { useState, useCallback, useRef } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "./use-auth";
import type { CompResult } from "@portage/shared";

export function useComps(itemId: string) {
  const { token } = useAuth();
  const [comps, setComps] = useState<CompResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const fetchComps = useCallback(async () => {
    if (!token) {
      setError("Please sign in to check comps");
      return;
    }
    if (loadingRef.current) return;
    loadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const data = await api<CompResult>(`/items/${itemId}/comps`, { token });
      setComps(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load comps");
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  }, [token, itemId]);

  return { comps, isLoading, error, fetchComps };
}
