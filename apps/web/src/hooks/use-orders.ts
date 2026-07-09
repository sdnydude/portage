"use client";

import { useState, useEffect, useCallback } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "./use-auth";

export interface Order {
  id: string;
  listingId: string;
  itemId: string;
  userId: string;
  marketplace: "ebay" | "reverb";
  marketplaceOrderId: string;
  buyerUsername: string;
  salePrice: number;
  shippingCost: number;
  marketplaceFees: number;
  currency: string;
  status: "payment_received" | "label_purchased" | "shipped" | "delivered" | "canceled";
  trackingNumber: string | null;
  carrier: string | null;
  shippingLabelUrl: string | null;
  soldAt: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  /** eBay ItemID (listings.marketplaceListingId) — used to link Ship-It to the eBay item page. */
  ebayItemId: string | null;
  /** Item title + photos (items join) — the sold list renders thumbnail/title rows from these. */
  itemTitle: string | null;
  itemPhotos: Array<{ url: string; isPrimary?: boolean }> | null;
}

interface OrdersResponse {
  orders: Order[];
}

export function useOrders(status?: string) {
  const { token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);

    try {
      const qs = status ? `?status=${status}` : "";
      const data = await api<OrdersResponse>(`/orders${qs}`, { token });
      setOrders(data.orders);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load orders");
    } finally {
      setIsLoading(false);
    }
  }, [token, status]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const syncOrders = useCallback(async () => {
    if (!token) return;
    setSyncError(null);
    setIsSyncing(true);
    try {
      const data = await api<{
        synced: number;
        newOrders: string[];
        errors?: { marketplace: string; message: string }[];
      }>("/orders/sync", { method: "POST", token });
      if (data.errors && data.errors.length > 0) {
        setSyncError(data.errors.map((e) => e.message).join("; "));
      }
      await fetchOrders();
    } catch (err) {
      setSyncError(err instanceof ApiError ? err.message : "Failed to sync orders");
    } finally {
      setIsSyncing(false);
    }
  }, [token, fetchOrders]);

  return { orders, isLoading, error, syncError, isSyncing, refetch: fetchOrders, syncOrders };
}
