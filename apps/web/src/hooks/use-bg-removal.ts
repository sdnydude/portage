"use client";

import { useState, useCallback } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "./use-auth";

interface BgRemovalResult {
  image: { key: string; url: string; size: number };
}

interface BgRemovalState {
  isProcessing: boolean;
  resultUrl: string | null;
  error: string | null;
}

export function useBgRemoval() {
  const { token } = useAuth();
  const [state, setState] = useState<BgRemovalState>({
    isProcessing: false,
    resultUrl: null,
    error: null,
  });

  const removeBackground = useCallback(async (imageUrl: string) => {
    if (!token) return;

    setState({ isProcessing: true, resultUrl: null, error: null });

    try {
      await api("/usage/bg-removal", { method: "POST", token });

      const result = await api<BgRemovalResult>("/images/remove-bg", {
        method: "POST",
        body: { imageUrl },
        token,
      });

      setState({ isProcessing: false, resultUrl: result.image.url, error: null });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Background removal failed";
      setState({ isProcessing: false, resultUrl: null, error: message });
    }
  }, [token]);

  const reset = useCallback(() => {
    setState({ isProcessing: false, resultUrl: null, error: null });
  }, []);

  return { ...state, removeBackground, reset };
}
