"use client";

import { useState, useEffect, useCallback } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "./use-auth";
import type { Item } from "./use-items";

export function useItem(id: string) {
  const { token } = useAuth();
  const [item, setItem] = useState<Item | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItem = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);

    try {
      const data = await api<Item>(`/items/${id}`, { token });
      setItem(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load item");
    } finally {
      setIsLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    fetchItem();
  }, [fetchItem]);

  const updateItem = useCallback(async (updates: Partial<Item>) => {
    if (!token) return null;

    try {
      const data = await api<Item>(`/items/${id}`, {
        method: "PATCH",
        body: updates,
        token,
      });
      setItem(data);
      return data;
    } catch (err) {
      throw err instanceof ApiError ? err : new Error("Failed to update item");
    }
  }, [token, id]);

  const deleteItem = useCallback(async () => {
    if (!token) return;

    try {
      await api(`/items/${id}`, { method: "DELETE", token });
    } catch (err) {
      throw err instanceof ApiError ? err : new Error("Failed to delete item");
    }
  }, [token, id]);

  return { item, isLoading, error, refetch: fetchItem, updateItem, deleteItem };
}
