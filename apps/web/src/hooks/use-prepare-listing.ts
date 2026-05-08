"use client";

import { useState, useCallback } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "./use-auth";
import type { PreparedListingData } from "@portage/shared";

interface UsePrepareListingReturn {
  data: PreparedListingData | null;
  isLoading: boolean;
  error: string | null;
  prepare: (itemId: string, targetMarketplaces: ("ebay" | "reverb")[]) => Promise<void>;
  reset: () => void;
}

export function usePrepareListing(): UsePrepareListingReturn {
  const { token } = useAuth();
  const [data, setData] = useState<PreparedListingData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prepare = useCallback(async (itemId: string, targetMarketplaces: ("ebay" | "reverb")[]) => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    setData(null);

    try {
      const result = await api<PreparedListingData>(
        `/items/${itemId}/prepare-listing`,
        {
          method: "POST",
          body: { targetMarketplaces },
          token,
        },
      );
      setData(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to prepare listing");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return { data, isLoading, error, prepare, reset };
}
