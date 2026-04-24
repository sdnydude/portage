"use client";

import { useState, useCallback } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "./use-auth";

interface EnhanceResult {
  image: {
    key: string;
    url: string;
    width: number;
    height: number;
    size: number;
  };
}

export function useEnhance() {
  const { token } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<EnhanceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enhance = useCallback(async (imageUrl: string) => {
    if (!token) return;
    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const data = await api<EnhanceResult>("/images/enhance", {
        method: "POST",
        body: { imageUrl },
        token,
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Enhancement failed");
    } finally {
      setIsProcessing(false);
    }
  }, [token]);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { isProcessing, result, error, enhance, reset };
}
