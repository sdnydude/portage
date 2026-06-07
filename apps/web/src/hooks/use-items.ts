"use client";

import { useState, useEffect, useCallback } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "./use-auth";

interface ItemPhoto {
  url: string;
  key: string;
  width?: number;
  height?: number;
  isPrimary?: boolean;
}

export interface Item {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: string;
  condition: string;
  conditionNotes: string;
  brand: string;
  model: string;
  features: string[];
  photos: ItemPhoto[];
  estimatedValueMin: number | null;
  estimatedValueMax: number | null;
  estimatedValueRecommended: number | null;
  aiConfidenceScore: number;
  quantity: number;
  // eBay Calculated shipping: weight in ounces, dimensions in inches.
  // weightEstimated marks AI-populated values vs seller-confirmed.
  weightOz?: number | null;
  lengthIn?: number | null;
  widthIn?: number | null;
  heightIn?: number | null;
  ebayPackageType?: string | null;
  weightEstimated?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ItemsResponse {
  items: Item[];
  total: number;
  limit: number;
  offset: number;
}

interface UseItemsOptions {
  search?: string;
  category?: string;
  condition?: string;
  limit?: number;
  offset?: number;
}

export function useItems(options: UseItemsOptions = {}) {
  const { token } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (options.search) params.set("search", options.search);
      if (options.category) params.set("category", options.category);
      if (options.condition) params.set("condition", options.condition);
      if (options.limit != null) params.set("limit", String(options.limit));
      if (options.offset != null) params.set("offset", String(options.offset));

      const qs = params.toString();
      const data = await api<ItemsResponse>(`/items${qs ? `?${qs}` : ""}`, { token });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load items");
    } finally {
      setIsLoading(false);
    }
  }, [token, options.search, options.category, options.condition, options.limit, options.offset]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return { items, total, isLoading, error, refetch: fetchItems };
}
