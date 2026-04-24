"use client";

import { useState, useEffect, useCallback } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "./use-auth";

export interface Listing {
  id: string;
  itemId: string;
  userId: string;
  marketplace: "ebay" | "etsy";
  marketplaceListingId: string | null;
  marketplaceSpecificFields: Record<string, unknown> | null;
  status: "draft" | "active" | "sold" | "archived";
  price: number;
  currency: string;
  createdAt: string;
  publishedAt: string | null;
  soldAt: string | null;
}

interface ListingsResponse {
  listings: Listing[];
}

interface UseListingsOptions {
  status?: string;
  marketplace?: string;
}

export function useListings(options: UseListingsOptions = {}) {
  const { token } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
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

      const qs = params.toString();
      const data = await api<ListingsResponse>(`/listings${qs ? `?${qs}` : ""}`, { token });
      setListings(data.listings);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load listings");
    } finally {
      setIsLoading(false);
    }
  }, [token, options.status, options.marketplace]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const createListing = useCallback(async (body: {
    itemId: string;
    marketplace: "ebay" | "etsy";
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

  const deleteListing = useCallback(async (listingId: string) => {
    if (!token) return;
    await api(`/listings/${listingId}`, { method: "DELETE", token });
    await fetchListings();
  }, [token, fetchListings]);

  return { listings, isLoading, error, refetch: fetchListings, createListing, publishListing, deleteListing };
}
