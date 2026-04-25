"use client";

import { useState, useEffect, useCallback } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "./use-auth";

export interface ShippingProviderInfo {
  id: string;
  provider: "shippo" | "easypost" | "pirate_ship";
  isActive: boolean;
  createdAt: string;
  hasApiKey: boolean;
}

export interface ShippingSettings {
  shipFromAddress: {
    name: string;
    street1: string;
    street2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  } | null;
  shippingAutoMark: boolean;
}

export function useShippingProvider() {
  const { token } = useAuth();
  const [provider, setProvider] = useState<ShippingProviderInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProvider = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);

    try {
      const data = await api<{ provider: ShippingProviderInfo | null }>("/shipping/provider", { token });
      setProvider(data.provider);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load provider");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchProvider();
  }, [fetchProvider]);

  const setProviderConfig = useCallback(async (body: {
    provider: "shippo" | "easypost" | "pirate_ship";
    apiKey: string;
    isActive?: boolean;
  }) => {
    if (!token) return null;
    const data = await api<{ provider: ShippingProviderInfo }>("/shipping/provider", {
      method: "PUT",
      body,
      token,
    });
    setProvider(data.provider);
    return data.provider;
  }, [token]);

  const testConnection = useCallback(async () => {
    if (!token) return null;
    const data = await api<{ provider: string; formatValid: boolean; message: string }>(
      "/shipping/provider/test",
      { method: "POST", token },
    );
    return data;
  }, [token]);

  return { provider, isLoading, error, refetch: fetchProvider, setProviderConfig, testConnection };
}

export function useShippingSettings() {
  const { token } = useAuth();
  const [settings, setSettings] = useState<ShippingSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);

    try {
      const data = await api<ShippingSettings>("/shipping/settings", { token });
      setSettings(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load settings");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = useCallback(async (body: Partial<ShippingSettings>) => {
    if (!token) return null;
    const data = await api<ShippingSettings>("/shipping/settings", {
      method: "PUT",
      body,
      token,
    });
    setSettings(data);
    return data;
  }, [token]);

  return { settings, isLoading, error, refetch: fetchSettings, updateSettings };
}
