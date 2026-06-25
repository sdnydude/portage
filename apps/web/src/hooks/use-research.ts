"use client";

import { useState, useEffect, useCallback } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "./use-auth";

export interface ResearchFilledAspect {
  name: string;
  required: boolean;
  values: string[];
}

export interface ResearchMissingAspect {
  name: string;
  required: boolean;
  suggestedValues: string[] | null;
  cardinality: string;
}

export interface ResearchDemand {
  soldMedian: number | null;
  soldAvg: number | null;
  activeMedian: number | null;
  activeAvg: number | null;
  sampleSize: number;
  sellThrough: number | null;
  soldCount: number;
  activeCount: number;
}

export interface ResearchTraffic {
  listingId: string;
  impressions: number | null;
  clickThroughRate: number | null;
  views: number | null;
  transactions: number | null;
  salesConversionRate: number | null;
  range: { from: string; to: string };
}

export interface ItemResearch {
  category: { categoryId: string; categoryName: string } | null;
  aspects: { filled: ResearchFilledAspect[]; missing: ResearchMissingAspect[] };
  demand: ResearchDemand | null;
  traffic: ResearchTraffic | null;
}

export function useResearch(id: string) {
  const { token } = useAuth();
  const [research, setResearch] = useState<ItemResearch | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResearch = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await api<ItemResearch>(`/items/${id}/research`, { token });
      setResearch(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load research");
    } finally {
      setIsLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    fetchResearch();
  }, [fetchResearch]);

  return { research, isLoading, error, refetch: fetchResearch };
}
