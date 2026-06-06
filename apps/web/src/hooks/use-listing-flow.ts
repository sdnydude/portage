"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { api, ApiError, API_BASE } from "@/lib/api";
import { useAuth } from "./use-auth";
import { useDrafts } from "./use-drafts";
import type {
  ListingFlowState,
  CompResult,
  RecognitionResult,
  PricingStrategy,
  EbayPreparedFields,
  PreparedListingData,
} from "@portage/shared";
import type { AspectRequirement } from "@/components/listing/aspect-fill-sheet";

const INITIAL_STATE: ListingFlowState = {
  photos: [],
  primaryPhotoIndex: 0,
  recognition: {
    status: 'idle',
    candidates: [],
    selectedIndex: 0,
    reasoning: [],
    confidence: 0,
  },
  title: '',
  description: '',
  category: '',
  categoryPath: [],
  condition: 'good',
  brand: '',
  model: '',
  features: [],
  quantity: 1,
  price: null,
  pricingStrategy: 'market',
  acceptOffers: true,
  minimumOfferPrice: null,
  comps: null,
  compsStatus: 'idle',
  marketplace: 'ebay',
  shippingMethod: 'calculated',
  shippingCost: null,
  packageSize: 'medium',
  weight: null,
  draftId: null,
  publishStatus: 'idle',
  listingId: null,
  inventoryItemId: null,
};

function revokeLocalUrls(photos: ListingFlowState['photos']) {
  for (const p of photos) {
    if (p.url.startsWith('blob:')) URL.revokeObjectURL(p.url);
  }
}

export function useListingFlow() {
  const { token } = useAuth();
  const { debouncedSave, saveDraft, deleteDraft, getDraft } = useDrafts();
  const [state, setState] = useState<ListingFlowState>(INITIAL_STATE);
  const [lastStep, setLastStep] = useState<string>('idle');
  const [error, setError] = useState<string | null>(null);
  const [saveWarning, setSaveWarning] = useState(false);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const triggerAutoSave = useCallback((newState: ListingFlowState, step?: string) => {
    const s = step ?? lastStep;
    debouncedSave(newState, {
      draftId: newState.draftId ?? undefined,
      itemId: newState.inventoryItemId,
      marketplace: newState.marketplace,
      lastStepCompleted: s,
    });
  }, [debouncedSave, lastStep]);

  const setField = useCallback(<K extends keyof ListingFlowState>(key: K, value: ListingFlowState[K]) => {
    setState(prev => {
      const next = { ...prev, [key]: value };
      triggerAutoSave(next);
      return next;
    });
  }, [triggerAutoSave]);

  const startFromPhoto = useCallback(async (photos: ListingFlowState['photos']) => {
    if (!token) return;
    setError(null);
    const newState: ListingFlowState = {
      ...INITIAL_STATE,
      photos,
      recognition: { ...INITIAL_STATE.recognition, status: 'recognizing' },
    };
    setState(newState);
    setLastStep('recognizing');

    try {
      const formData = new FormData();
      const photoUrl = photos[0]?.url;
      if (photoUrl) {
        const response = await fetch(photoUrl);
        const blob = await response.blob();
        formData.append('image', blob, 'photo.jpg');
      }

      const result = await fetch(`${API_BASE}/scan?detail=full`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!result.ok) throw new Error('Scan failed');
      const data = await result.json();

      const detailed = data.detailed as RecognitionResult | undefined;
      const candidates = detailed?.candidates ?? [{
        ...data.identification,
        confidence: 0.8,
      }];
      const reasoning = detailed?.reasoning ?? [];

      setState(prev => {
        if (data.image) revokeLocalUrls(prev.photos);
        return {
          ...prev,
          recognition: {
            status: 'complete',
            candidates,
            selectedIndex: 0,
            reasoning,
            confidence: candidates[0]?.confidence ?? 0,
          },
          photos: data.image ? [{
            url: data.image.url,
            key: data.image.key,
            width: data.image.width,
            height: data.image.height,
            isPrimary: true,
          }] : prev.photos,
        };
      });
      setLastStep('recognition');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Recognition failed';
      setError(msg);
      setState(prev => ({
        ...prev,
        recognition: { ...prev.recognition, status: 'failed' },
      }));
      setLastStep('recognition-failed');
    }
  }, [token]);

  const startFromItem = useCallback(async (itemId: string) => {
    if (!token) return;
    setError(null);
    try {
      const item = await api<{
        id: string; title: string; description: string; category: string;
        condition: string; brand: string; model: string; features: string[];
        quantity: number;
        photos: ListingFlowState['photos'];
        estimatedValueRecommended: number | null;
      }>(`/items/${itemId}`, { token });

      setState({
        ...INITIAL_STATE,
        inventoryItemId: item.id,
        title: item.title,
        description: item.description,
        category: item.category,
        condition: item.condition,
        brand: item.brand ?? '',
        model: item.model ?? '',
        features: (item.features ?? []) as string[],
        quantity: item.quantity ?? 1,
        photos: item.photos ?? [],
        price: item.estimatedValueRecommended ?? null,
        recognition: {
          status: 'complete',
          candidates: [],
          selectedIndex: 0,
          reasoning: [],
          confidence: 1,
        },
      });
      setLastStep('details');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load item');
      setState(INITIAL_STATE);
    }
  }, [token]);

  const resumeDraft = useCallback(async (draftId: string) => {
    const draft = await getDraft(draftId);
    if (!draft) return;
    setState({ ...INITIAL_STATE, ...draft.flowState, draftId: draft.id });
    setLastStep(draft.lastStepCompleted ?? 'idle');
  }, [getDraft]);

  const confirmRecognition = useCallback((index: number) => {
    setState(prev => {
      const candidate = prev.recognition.candidates[index];
      if (!candidate) return prev;

      const next: ListingFlowState = {
        ...prev,
        recognition: { ...prev.recognition, selectedIndex: index },
        title: candidate.name,
        description: candidate.description,
        category: candidate.category,
        condition: candidate.condition,
        brand: candidate.brand ?? '',
        model: candidate.model ?? '',
        features: candidate.features ?? [],
      };
      triggerAutoSave(next, 'confirmed');
      return next;
    });
    setLastStep('confirmed');
  }, [triggerAutoSave]);

  const fetchComps = useCallback(async () => {
    if (!token) {
      setState(prev => ({ ...prev, compsStatus: 'failed' }));
      return;
    }
    setState(prev => ({ ...prev, compsStatus: 'loading' }));
    try {
      let comps: CompResult;
      if (stateRef.current.inventoryItemId) {
        comps = await api<CompResult>(
          `/items/${stateRef.current.inventoryItemId}/comps`,
          { token }
        );
      } else {
        const q = stateRef.current.title;
        if (!q) {
          setState(prev => ({ ...prev, compsStatus: 'failed' }));
          return;
        }
        const params = new URLSearchParams({ q });
        if (stateRef.current.category) params.set('category', stateRef.current.category);
        comps = await api<CompResult>(
          `/items/comps/search?${params}`,
          { token }
        );
      }
      setState(prev => ({ ...prev, comps, compsStatus: 'loaded' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch comparables');
      setState(prev => ({ ...prev, compsStatus: 'failed' }));
    }
  }, [token]);

  const applyPricingStrategy = useCallback((strategy: PricingStrategy) => {
    setState(prev => {
      if (!prev.comps?.stats.soldMedian) {
        return { ...prev, pricingStrategy: strategy };
      }
      const median = prev.comps.stats.soldMedian;
      let price: number;
      switch (strategy) {
        case 'fast': price = Math.round(median * 0.85); break;
        case 'max': price = Math.round(median * 1.2); break;
        case 'market':
        default: price = Math.round(median); break;
      }
      const next = { ...prev, price, pricingStrategy: strategy };
      triggerAutoSave(next, 'pricing');
      return next;
    });
    setLastStep('pricing');
  }, [triggerAutoSave]);

  const addPhotos = useCallback((photos: ListingFlowState['photos']) => {
    setState(prev => {
      const next = { ...prev, photos: [...prev.photos, ...photos] };
      triggerAutoSave(next);
      return next;
    });
  }, [triggerAutoSave]);

  const publish = useCallback(async (
    options?: { ebayPreparedFields?: EbayPreparedFields | null; publishMode?: 'draft' | 'live'; aspects?: Record<string, string[]> },
  ): Promise<{ success: boolean; listingId?: string; error?: string; aspectsRequired?: AspectRequirement[] }> => {
    if (!token) return { success: false, error: 'Not authenticated' };

    const s = stateRef.current;
    if (!s.title) return { success: false, error: 'Title is required' };
    if (!s.price) return { success: false, error: 'Price is required' };
    if (s.photos.length === 0) return { success: false, error: 'At least one photo is required' };

    setState(prev => ({ ...prev, publishStatus: 'publishing' }));

    try {
      let itemId = s.inventoryItemId;

      if (!itemId) {
        const item = await api<{ id: string }>('/items', {
          method: 'POST',
          body: {
            title: s.title,
            description: s.description,
            category: s.category,
            condition: s.condition,
            brand: s.brand,
            model: s.model,
            features: s.features,
            quantity: s.quantity,
            photos: s.photos,
            estimatedValueRecommended: s.price,
            aiConfidenceScore: s.recognition.confidence,
          },
          token,
        });
        itemId = item.id;
        setState(prev => ({ ...prev, inventoryItemId: itemId }));
      }

      let ebayPreparedFields = options?.ebayPreparedFields;
      const publishMode = options?.publishMode;

      if (s.marketplace === 'ebay' && !ebayPreparedFields && itemId) {
        try {
          const prepared = await api<PreparedListingData>(
            `/items/${itemId}/prepare-listing`,
            { method: 'POST', body: { targetMarketplaces: ['ebay'] }, token },
          );
          ebayPreparedFields = prepared.ebay ?? null;
        } catch {
          // prepare-listing failure is non-fatal — publish continues with no eBay-specific fields
        }
      }

      // Merge user-supplied item specifics (from the aspect sheet on a prior
      // EBAY_ASPECTS_REQUIRED) into the prepared fields before publishing.
      if (options?.aspects && ebayPreparedFields) {
        ebayPreparedFields = {
          ...ebayPreparedFields,
          aspects: { ...(ebayPreparedFields.aspects ?? {}), ...options.aspects },
        };
      }

      const marketplaceSpecificFields =
        s.marketplace === 'ebay' && ebayPreparedFields
          ? { ...ebayPreparedFields }
          : s.marketplace === 'reverb'
            ? {
                make: s.brand,
                model: s.model,
                acceptOffers: s.acceptOffers,
                ...(s.minimumOfferPrice && { minimumOfferPrice: s.minimumOfferPrice }),
              }
            : undefined;

      const listing = await api<{ id: string; status: string }>('/listings', {
        method: 'POST',
        body: {
          itemId,
          marketplace: s.marketplace,
          price: s.price,
          // publishMode takes precedence; publishImmediately retained for backward compat
          ...(publishMode ? { publishMode } : { publishImmediately: true }),
          marketplaceSpecificFields,
        },
        token,
      });

      if (s.draftId) {
        await deleteDraft(s.draftId);
      }

      setState(prev => ({
        ...prev,
        publishStatus: 'published',
        listingId: listing.id,
        inventoryItemId: itemId,
      }));
      setLastStep('published');

      return { success: true, listingId: listing.id };
    } catch (err) {
      // eBay needs category-required item specifics — surface them so the flow
      // can collect the values and retry. No listing row was created (the gate
      // throws before insert), so re-publishing won't duplicate.
      if (err instanceof ApiError && err.code === 'EBAY_ASPECTS_REQUIRED') {
        setState(prev => ({ ...prev, publishStatus: 'idle' }));
        // Include `error` so a flow that doesn't render the aspect sheet still
        // shows eBay's human-readable "needs these item specifics" message.
        return { success: false, error: err.message, aspectsRequired: (err.details as unknown as AspectRequirement[]) ?? [] };
      }
      const msg = err instanceof ApiError ? err.message : 'Publishing failed';
      await saveDraft(stateRef.current, {
        draftId: s.draftId ?? undefined,
        itemId: s.inventoryItemId,
        marketplace: s.marketplace,
        lastStepCompleted: 'publish-failed',
      });
      setState(prev => ({ ...prev, publishStatus: 'failed' }));
      return { success: false, error: msg };
    }
  }, [token, deleteDraft, saveDraft]);

  const cancel = useCallback(async () => {
    await saveDraft(stateRef.current, {
      draftId: stateRef.current.draftId ?? undefined,
      itemId: stateRef.current.inventoryItemId,
      marketplace: stateRef.current.marketplace,
      lastStepCompleted: lastStep,
    });
  }, [saveDraft, lastStep]);

  const reset = useCallback(() => {
    revokeLocalUrls(stateRef.current.photos);
    setState(INITIAL_STATE);
    setLastStep('idle');
    setSaveWarning(false);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    state,
    lastStep,
    error,
    clearError,
    saveWarning,
    setField,
    startFromPhoto,
    startFromItem,
    resumeDraft,
    confirmRecognition,
    fetchComps,
    applyPricingStrategy,
    addPhotos,
    publish,
    cancel,
    reset,
  };
}
