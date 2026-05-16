"use client";

import { useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { useAuth } from "./use-auth";
import type { ListingDraft, ListingFlowState } from "@portage/shared";

export function useDrafts() {
  const { token } = useAuth();
  const [drafts, setDrafts] = useState<ListingDraft[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchDrafts = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await api<{ drafts: ListingDraft[] }>('/drafts', { token });
      setDrafts(data.drafts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load drafts');
    }
    setIsLoading(false);
  }, [token]);

  const getDraft = useCallback(async (draftId: string): Promise<ListingDraft | null> => {
    if (!token) return null;
    try {
      return await api<ListingDraft>(`/drafts/${draftId}`, { token });
    } catch {
      return null;
    }
  }, [token]);

  const saveDraft = useCallback(async (
    state: ListingFlowState,
    meta: {
      draftId?: string;
      itemId?: string | null;
      marketplace: 'ebay' | 'etsy' | 'reverb';
      lastStepCompleted?: string;
    }
  ): Promise<ListingDraft | null> => {
    if (!token) return null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await api<ListingDraft>('/drafts', {
          method: 'POST',
          body: {
            id: meta.draftId,
            itemId: meta.itemId ?? null,
            marketplace: meta.marketplace,
            title: state.title || null,
            price: state.price,
            lastStepCompleted: meta.lastStepCompleted,
            flowState: state,
          },
          token,
        });
      } catch {
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, Math.pow(2, attempt + 1) * 1000));
        }
      }
    }
    return null;
  }, [token]);

  const debouncedSave = useCallback((
    state: ListingFlowState,
    meta: Parameters<typeof saveDraft>[1]
  ) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveDraft(state, meta), 2000);
  }, [saveDraft]);

  const deleteDraft = useCallback(async (draftId: string) => {
    if (!token) return;
    try {
      await api(`/drafts/${draftId}`, { method: 'DELETE', token });
      setDrafts(prev => prev.filter(d => d.id !== draftId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete draft');
    }
  }, [token]);

  return { drafts, isLoading, error, fetchDrafts, getDraft, saveDraft, debouncedSave, deleteDraft };
}
