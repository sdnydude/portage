"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "./use-auth";

export function useAdminApi<T>(path: string, deps: unknown[] = []) {
  const { token } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const depsKey = JSON.stringify(deps);

  const refetch = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await api<T>(`/admin${path}`, { token });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setIsLoading(false);
    }
  }, [token, path, depsKey]);

  useEffect(() => { refetch(); }, [refetch]);

  return { data, isLoading, error, refetch };
}

export function useAdminMutation<TBody = unknown, TResult = { ok: boolean }>(path: string, method: "POST" | "PATCH" | "DELETE" = "POST") {
  const { token } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async (body?: TBody): Promise<TResult | null> => {
    if (!token) return null;
    setIsLoading(true);
    setError(null);
    try {
      const result = await api<TResult>(`/admin${path}`, { method, body: body as unknown, token });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Action failed";
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [token, path, method]);

  return { mutate, isLoading, error };
}
