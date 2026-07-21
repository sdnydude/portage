"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "./use-auth";

export interface PorterConversationSummary {
  id: string;
  preview: string;
  createdAt?: string;
  updatedAt: string;
}

/**
 * Porter conversation history (Phase R3). Distinct from useConversations
 * (eBay buyer threads). Feeds the dock's history list; resume loads a past
 * conversation via GET /porter/conversations/:id.
 */
export function usePorterConversations() {
  const { token } = useAuth();
  const [conversations, setConversations] = useState<
    PorterConversationSummary[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await api<{ conversations: PorterConversationSummary[] }>(
        "/porter/conversations",
        { token },
      );
      setConversations(data.conversations);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load conversations");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { conversations, isLoading, error, refetch };
}
