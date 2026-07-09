"use client";

import { useState, useEffect, useCallback } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "./use-auth";

export interface Listing {
  id: string;
  itemId: string;
  userId: string;
  marketplace: "ebay" | "reverb";
  marketplaceListingId: string | null;
  marketplaceSpecificFields: Record<string, unknown> | null;
  status: "draft" | "active" | "sold" | "archived";
  price: number;
  currency: string;
  createdAt: string;
  publishedAt: string | null;
  soldAt: string | null;
  /** Joined from items server-side (GET /listings) — what the listing IS. */
  itemTitle: string | null;
}

interface ListingsResponse {
  listings: Listing[];
  total: number;
  limit: number;
  offset: number;
}

interface UseListingsOptions {
  status?: string;
  marketplace?: string;
  limit?: number;
  offset?: number;
}

export function useListings(options: UseListingsOptions = {}) {
  const { token } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchListings = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (options.status) params.set("status", options.status);
      if (options.marketplace) params.set("marketplace", options.marketplace);
      if (options.limit != null) params.set("limit", String(options.limit));
      if (options.offset != null) params.set("offset", String(options.offset));

      const qs = params.toString();
      const data = await api<ListingsResponse>(`/listings${qs ? `?${qs}` : ""}`, { token });
      setListings(data.listings);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load listings");
    } finally {
      setIsLoading(false);
    }
  }, [token, options.status, options.marketplace, options.limit, options.offset]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const createListing = useCallback(async (body: {
    itemId: string;
    marketplace: "ebay" | "reverb";
    price: number;
    currency?: string;
    publishImmediately?: boolean;
    marketplaceSpecificFields?: Record<string, unknown>;
  }) => {
    if (!token) return null;
    const data = await api<Listing>("/listings", { method: "POST", body, token });
    await fetchListings();
    return data;
  }, [token, fetchListings]);

  const publishListing = useCallback(async (listingId: string) => {
    if (!token) return null;
    const data = await api<Listing>(`/listings/${listingId}/publish`, { method: "POST", token });
    await fetchListings();
    return data;
  }, [token, fetchListings]);

  const updateListing = useCallback(async (listingId: string, body: {
    price?: number;
    status?: "draft" | "active" | "archived";
    marketplaceSpecificFields?: Record<string, unknown>;
  }) => {
    if (!token) return null;
    const data = await api<Listing & { warning?: string }>(`/listings/${listingId}`, { method: "PATCH", body, token });
    await fetchListings();
    return data;
  }, [token, fetchListings]);

  const deleteListing = useCallback(async (listingId: string) => {
    if (!token) return;
    await api(`/listings/${listingId}`, { method: "DELETE", token });
    await fetchListings();
  }, [token, fetchListings]);

  return { listings, total, isLoading, error, refetch: fetchListings, createListing, updateListing, publishListing, deleteListing };
}
