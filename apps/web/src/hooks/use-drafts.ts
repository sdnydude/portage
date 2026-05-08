"use client";

import { useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { useAuth } from "./use-auth";
import type { ListingDraft, ListingFlowState } from "@portage/shared";

export function useDrafts() {
  const { token } = useAuth();
  const [drafts, setDrafts] = useState<ListingDraft[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);

  const fetchDrafts = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const data = await api<{ drafts: ListingDraft[] }>('/drafts', { token });
      setDrafts(data.drafts);
    } catch { /* offline */ }
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
    try {
      const draft = await api<ListingDraft>('/drafts', {
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
      retryCountRef.current = 0;
      return draft;
    } catch {
      retryCountRef.current++;
      if (retryCountRef.current < 3) {
        const delay = Math.pow(2, retryCountRef.current) * 1000;
        return new Promise((resolve) => {
          setTimeout(async () => {
            resolve(await saveDraft(state, meta));
          }, delay);
        });
      }
      return null;
    }
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
    } catch { /* ignore */ }
  }, [token]);

  return { drafts, isLoading, fetchDrafts, getDraft, saveDraft, debouncedSave, deleteDraft };
}
