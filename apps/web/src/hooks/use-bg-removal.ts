"use client";

import { useState, useCallback } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "./use-auth";

interface BgRemovalState {
  isProcessing: boolean;
  progress: number;
  result: Blob | null;
  resultUrl: string | null;
  error: string | null;
}

export function useBgRemoval() {
  const { token } = useAuth();
  const [state, setState] = useState<BgRemovalState>({
    isProcessing: false,
    progress: 0,
    result: null,
    resultUrl: null,
    error: null,
  });

  const removeBackground = useCallback(async (imageUrl: string) => {
    if (!token) return;

    setState({ isProcessing: true, progress: 0, result: null, resultUrl: null, error: null });

    try {
      await api("/usage/bg-removal", { method: "POST", token });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to check usage";
      setState((s) => ({ ...s, isProcessing: false, error: message }));
      return;
    }

    try {
      const { removeBackground: removeBg } = await import("@imgly/background-removal");

      const blob = await removeBg(imageUrl, {
        progress: (_key: string, current: number, total: number) => {
          if (total > 0) {
            setState((s) => ({ ...s, progress: Math.round((current / total) * 100) }));
          }
        },
      });

      const url = URL.createObjectURL(blob);
      setState({ isProcessing: false, progress: 100, result: blob, resultUrl: url, error: null });
    } catch (err) {
      setState((s) => ({
        ...s,
        isProcessing: false,
        error: err instanceof Error ? err.message : "Background removal failed",
      }));
    }
  }, [token]);

  const reset = useCallback(() => {
    if (state.resultUrl) {
      URL.revokeObjectURL(state.resultUrl);
    }
    setState({ isProcessing: false, progress: 0, result: null, resultUrl: null, error: null });
  }, [state.resultUrl]);

  return { ...state, removeBackground, reset };
}
