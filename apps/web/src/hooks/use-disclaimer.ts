"use client";

import { useState, useEffect, useCallback } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "./use-auth";

interface DisclaimerVersion {
  version: number;
  effectiveDate: string;
}

interface DisclaimerAcceptance {
  id: string;
  userId: string;
  listingId: string;
  disclaimerVersion: number;
  acceptedAt: string;
  ipAddress: string | null;
}

export function useDisclaimer() {
  const { token } = useAuth();
  const [currentVersion, setCurrentVersion] = useState<DisclaimerVersion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVersion = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);

    try {
      const data = await api<DisclaimerVersion>("/shipping/disclaimer/version", { token });
      setCurrentVersion(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load disclaimer version");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchVersion();
  }, [fetchVersion]);

  const acceptTerms = useCallback(async (listingId: string, disclaimerVersion?: number) => {
    if (!token) return null;
    const body: Record<string, unknown> = {};
    if (disclaimerVersion !== undefined) body.disclaimerVersion = disclaimerVersion;

    const data = await api<DisclaimerAcceptance>(
      `/shipping/listings/${listingId}/accept-terms`,
      { method: "POST", body, token },
    );
    return data;
  }, [token]);

  return { currentVersion, isLoading, error, acceptTerms, refetch: fetchVersion };
}
