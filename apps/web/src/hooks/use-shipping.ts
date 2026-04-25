"use client";

import { useState, useEffect, useCallback } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "./use-auth";

// ─── Types ─────────────────────────────────────────────────

export interface ShippingPreset {
  id: string;
  userId: string;
  name: string;
  packageType: "box" | "envelope" | "poly_mailer";
  length: number;
  width: number;
  height: number;
  weightLbs: number;
  weightOz: number;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ShippingRate {
  rateId: string;
  carrier: string;
  service: string;
  price: number;
  currency: string;
  estimatedDays: number;
  source: "marketplace" | "shippo" | "easypost" | "pirate_ship";
}

export interface RatesResponse {
  orderId: string;
  rates: ShippingRate[];
  isStub: boolean;
}

export interface LabelResponse {
  orderId: string;
  trackingNumber: string;
  carrier: string;
  shippingLabelUrl: string;
  status: string;
  isStub: boolean;
}

interface PackageDimensions {
  packageType?: "box" | "envelope" | "poly_mailer";
  length?: number;
  width?: number;
  height?: number;
  weightLbs?: number;
  weightOz?: number;
}

// ─── useShippingPresets ────────────────────────────────────

export function useShippingPresets() {
  const { token } = useAuth();
  const [presets, setPresets] = useState<ShippingPreset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPresets = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);

    try {
      const data = await api<{ presets: ShippingPreset[] }>("/shipping/presets", { token });
      setPresets(data.presets);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load presets");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchPresets();
  }, [fetchPresets]);

  const createPreset = useCallback(async (body: Omit<ShippingPreset, "id" | "userId" | "createdAt" | "updatedAt">) => {
    if (!token) return null;
    const data = await api<ShippingPreset>("/shipping/presets", { method: "POST", body, token });
    await fetchPresets();
    return data;
  }, [token, fetchPresets]);

  const updatePreset = useCallback(async (id: string, body: Partial<Omit<ShippingPreset, "id" | "userId" | "createdAt" | "updatedAt">>) => {
    if (!token) return null;
    const data = await api<ShippingPreset>(`/shipping/presets/${id}`, { method: "PUT", body, token });
    await fetchPresets();
    return data;
  }, [token, fetchPresets]);

  const deletePreset = useCallback(async (id: string) => {
    if (!token) return;
    await api(`/shipping/presets/${id}`, { method: "DELETE", token });
    await fetchPresets();
  }, [token, fetchPresets]);

  return { presets, isLoading, error, refetch: fetchPresets, createPreset, updatePreset, deletePreset };
}

// ─── useShippingRates ─────────────────────────────────────

export function useShippingRates(orderId: string, dimensions?: PackageDimensions) {
  const { token } = useAuth();
  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRates = useCallback(async () => {
    if (!token || !orderId) return;
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ orderId });
      if (dimensions?.packageType) params.set("packageType", dimensions.packageType);
      if (dimensions?.length) params.set("length", String(dimensions.length));
      if (dimensions?.width) params.set("width", String(dimensions.width));
      if (dimensions?.height) params.set("height", String(dimensions.height));
      if (dimensions?.weightLbs !== undefined) params.set("weightLbs", String(dimensions.weightLbs));
      if (dimensions?.weightOz !== undefined) params.set("weightOz", String(dimensions.weightOz));

      const data = await api<RatesResponse>(`/shipping/rates?${params.toString()}`, { token });
      setRates(data.rates);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load rates");
    } finally {
      setIsLoading(false);
    }
  }, [token, orderId, dimensions]);

  return { rates, isLoading, error, fetchRates };
}

// ─── useShippingLabel ─────────────────────────────────────

export function useShippingLabel() {
  const { token } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const purchaseLabel = useCallback(async (body: {
    orderId: string;
    rateId: string;
    packageType?: "box" | "envelope" | "poly_mailer";
    length?: number;
    width?: number;
    height?: number;
    weightLbs?: number;
    weightOz?: number;
  }) => {
    if (!token) return null;
    setIsLoading(true);
    setError(null);

    try {
      const data = await api<LabelResponse>("/shipping/labels", { method: "POST", body, token });
      return data;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to purchase label";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const getLabel = useCallback(async (orderId: string) => {
    if (!token) return null;
    const data = await api<LabelResponse>(`/shipping/labels/${orderId}`, { token });
    return data;
  }, [token]);

  const markShipped = useCallback(async (orderId: string) => {
    if (!token) return null;
    const data = await api<Record<string, unknown>>(`/shipping/orders/${orderId}/ship`, { method: "POST", token });
    return data;
  }, [token]);

  return { purchaseLabel, getLabel, markShipped, isLoading, error };
}
