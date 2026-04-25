"use client";

import { useState, useEffect, useCallback } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "./use-auth";

interface RecentListing {
  id: string;
  itemId: string;
  marketplace: "ebay" | "etsy";
  status: "draft" | "active" | "sold" | "archived";
  price: number;
  currency: string;
  createdAt: string;
  publishedAt: string | null;
  itemTitle: string;
  itemPhotoUrl: string | null;
}

interface PendingShipment {
  id: string;
  marketplace: "ebay" | "etsy";
  buyerUsername: string;
  salePrice: number;
  currency: string;
  status: string;
  soldAt: string;
  itemTitle: string;
}

interface DashboardStats {
  activeListings: number;
  draftListings: number;
  soldListings: number;
  totalOrders: number;
  totalRevenue: number;
}

interface Portfolio {
  totalItems: number;
  totalValueLow: number;
  totalValueHigh: number;
  totalValueRecommended: number;
}

export interface DashboardData {
  displayName: string;
  portfolio: Portfolio;
  recentListings: RecentListing[];
  pendingShipments: PendingShipment[];
  stats: DashboardStats;
}

export function useDashboard() {
  const { token } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);

    try {
      const result = await api<DashboardData>("/dashboard", { token });
      setData(result);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load dashboard"
      );
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return { data, isLoading, error, refetch: fetchDashboard };
}
