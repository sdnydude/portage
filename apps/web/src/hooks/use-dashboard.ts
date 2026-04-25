"use client";

import { useState, useEffect, useCallback } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "./use-auth";

interface DashboardItemPhoto {
  url: string;
  key: string;
  isPrimary?: boolean;
}

interface RecentItem {
  id: string;
  title: string;
  category: string;
  photos: DashboardItemPhoto[];
  estimatedValueRecommended: number | null;
  createdAt: string;
}

interface RecentOrder {
  id: string;
  salePrice: number;
  marketplace: string;
  buyerUsername: string;
  status: string;
  soldAt: string;
}

export interface DashboardData {
  portfolio: {
    totalItems: number;
    estimatedValue: {
      low: number;
      high: number;
      recommended: number;
    };
  };
  listings: {
    active: number;
    drafts: number;
    sold: number;
    activeValue: number;
  };
  sales: {
    ordersThisMonth: number;
    revenueThisMonth: number;
    feesThisMonth: number;
    netRevenueThisMonth: number;
  };
  recentItems: RecentItem[];
  recentOrders: RecentOrder[];
  momentum: {
    unlistedItems: number;
    connectedMarketplaces: string[];
  };
}

export function useDashboard() {
  const { token } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);

    try {
      const result = await api<DashboardData>("/dashboard", { token });
      setData(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load dashboard");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return { data, isLoading, error, refetch: fetchDashboard };
}
