"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { api, apiUpload, ApiError } from "@/lib/api";
import { useAuth } from "./use-auth";
import { useDrafts } from "./use-drafts";
import type {
  ListingFlowState,
  CompResult,
  RecognitionResult,
  RecognitionCandidate,
  PricingStrategy,
  EbayPreparedFields,
  PreparedListingData,
} from "@portage/shared";
import type { AspectRequirement } from "@/components/listing/aspect-fill-sheet";
import { movePhoto, removePhotoAt, normalizePhotoOrder } from "@/lib/photos";
import { resolvePublishPrice } from "@/lib/price";
import { scopedPublishIdempotencyKey } from "@/lib/publish-idempotency";

export interface PublishOptions {
  ebayPreparedFields?: EbayPreparedFields | null;
  publishMode?: 'draft' | 'live';
  aspects?: Record<string, string[]>;
  // Weight/dims supplied by the fill sheet on a retry after EBAY_WEIGHT_REQUIRED;
  // overrides flow state so persistence isn't subject to a setState race.
  weightDims?: {
    weight: number | null;
    dimLength: number | null;
    dimWidth: number | null;
    dimHeight: number | null;
    ebayPackageType: string | null;
  };
}

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
  comps: null,
  compsStatus: 'idle',
  marketplace: 'ebay',
  shippingMethod: 'calculated',
  shippingCost: null,
  packageSize: 'medium',
  weight: null,
  dimLength: null,
  dimWidth: null,
  dimHeight: null,
  ebayPackageType: null,
  weightEstimated: false,
  draftId: null,
  publishStatus: 'idle',
  listingId: null,
  inventoryItemId: null,
  publishWarning: null,
  publishIdempotencyKey: null,
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

  // Manual weight/dimension edits: merge the patch and clear the AI-estimated
  // flag in one update so the persisted item records seller-confirmed metrics.
  const updateWeightDims = useCallback((patch: Partial<Pick<ListingFlowState,
    'weight' | 'dimLength' | 'dimWidth' | 'dimHeight' | 'ebayPackageType'>>) => {
    setState(prev => {
      const next = { ...prev, ...patch, weightEstimated: false };
      triggerAutoSave(next);
      return next;
    });
  }, [triggerAutoSave]);

  // AI-estimate prefill: populate weight/dims from a prepare result, marking
  // them estimated. Only fills when the seller hasn't already entered a weight,
  // so it never clobbers confirmed values.
  const applyEstimatedWeightDims = useCallback((est: {
    weight?: number | null; dimLength?: number | null;
    dimWidth?: number | null; dimHeight?: number | null; ebayPackageType?: string | null;
  }) => {
    setState(prev => {
      if (prev.weight != null) return prev;
      return {
        ...prev,
        weight: est.weight ?? null,
        dimLength: est.dimLength ?? null,
        dimWidth: est.dimWidth ?? null,
        dimHeight: est.dimHeight ?? null,
        ebayPackageType: est.ebayPackageType ?? null,
        weightEstimated: true,
      };
    });
  }, []);

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

      const data = await apiUpload<{
        detailed?: RecognitionResult;
        identification?: Omit<RecognitionCandidate, 'confidence'>;
        image?: { url: string; key: string; width: number; height: number };
      }>('/scan?detail=full', formData, { token: token ?? undefined });

      const detailed = data.detailed as RecognitionResult | undefined;
      const candidates = detailed?.candidates ?? [{
        ...data.identification,
        confidence: 0.8,
      } as RecognitionCandidate];
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
        price: number | null;
        weightOz: number | null;
        lengthIn: number | null;
        widthIn: number | null;
        heightIn: number | null;
        ebayPackageType: string | null;
        weightEstimated: boolean;
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
        // Prefill from the seller's set price first, then the AI estimate (no
        // comps at seed time). resolvePublishPrice is unit-tested.
        price: resolvePublishPrice(item),
        // weight column is ounces; flow state carries decimal pounds.
        weight: item.weightOz != null ? item.weightOz / 16 : null,
        dimLength: item.lengthIn ?? null,
        dimWidth: item.widthIn ?? null,
        dimHeight: item.heightIn ?? null,
        ebayPackageType: item.ebayPackageType ?? null,
        weightEstimated: item.weightEstimated ?? false,
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
    // Computed from the ref (not a functional updater) and synced back to it
    // EAGERLY: the confirm-pill handlers call ensureItemCreated() in the same
    // tick, before React commits — the useEffect ref sync is one render late.
    const prev = stateRef.current;
    const candidate = prev.recognition.candidates[index];
    if (!candidate) return;

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
    stateRef.current = next;
    setState(next);
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

  // Drag-reorder (F1): live moves splice flow state; drafts persist the order
  // via autosave. Marketplace/item persistence happens at commitPhotoOrder.
  const reorderPhotos = useCallback((from: number, to: number) => {
    setState(prev => {
      const next = { ...prev, photos: movePhoto(prev.photos, from, to) };
      triggerAutoSave(next);
      return next;
    });
  }, [triggerAutoSave]);

  // Commit point for a finished drag (strip onReorderEnd): one PATCH lands
  // the whole reordered array on the item row when it exists. Publish reads
  // items.photos, so without this the marketplace would get the old order.
  const commitPhotoOrder = useCallback(async () => {
    const s = stateRef.current;
    if (!s.inventoryItemId || !token || s.photos.length === 0) return;
    try {
      await api(`/items/${s.inventoryItemId}`, {
        method: 'PATCH',
        body: { photos: normalizePhotoOrder(s.photos) },
        token,
      });
    } catch {
      // Draft still holds the order; the publish-time PATCH is the backstop.
    }
  }, [token]);

  // Delete a photo. Flow state + draft update immediately; when the item row
  // already exists the new array PATCHes through so publish (which reads
  // items.photos, not flow state) can never resurrect a deleted photo.
  const removePhoto = useCallback(async (index: number) => {
    const next = removePhotoAt(stateRef.current.photos, index);
    setState(prev => {
      const nextState = { ...prev, photos: removePhotoAt(prev.photos, index) };
      triggerAutoSave(nextState);
      return nextState;
    });
    const itemId = stateRef.current.inventoryItemId;
    if (itemId && token) {
      try {
        await api(`/items/${itemId}`, { method: 'PATCH', body: { photos: next }, token });
      } catch {
        // Draft still holds the new order; the publish-time PATCH is the backstop.
      }
    }
  }, [token, triggerAutoSave]);

  // Photo-edit tools (rotate/crop/enhance/bg-remove) persist their result here.
  // Throws on a vanished index (photo deleted mid-edit) so usePhotoEdit's
  // catch surfaces it as a tool error instead of silently dropping the result.
  const updatePhoto = useCallback((index: number, patch: Partial<ListingFlowState['photos'][number]> & { url: string }) => {
    if (!stateRef.current.photos[index]) {
      throw new Error(`Photo ${index + 1} no longer exists — it may have been removed while editing.`);
    }
    setState(prev => {
      if (!prev.photos[index]) return prev;
      const next = {
        ...prev,
        photos: prev.photos.map((p, i) => (i === index ? { ...p, ...patch } : p)),
      };
      triggerAutoSave(next);
      return next;
    });
  }, [triggerAutoSave]);

  // Create the inventory item from current flow state exactly once. Fired at
  // recognition-confirm (fresh scans) so prepare() has an itemId to run against;
  // publish() reuses it as the single POST /items shape (no drift).
  const ensureItemCreated = useCallback(async (): Promise<string | null> => {
    if (!token) return null;
    const s = stateRef.current;
    if (s.inventoryItemId) return s.inventoryItemId;
    if (!s.title) return null;

    // weight column is ounces; flow state carries decimal pounds (often still
    // null at confirm-time — the shipping step runs later and publish PATCHes).
    const rawOz = s.weight != null ? Math.round(s.weight * 16) : 0;
    const weightOz = rawOz > 0 ? rawOz : null;

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
        estimatedValueRecommended: s.price ?? undefined,
        aiConfidenceScore: s.recognition.confidence,
        ...(weightOz != null && {
          weightOz,
          // route schema is positive().optional() — send undefined, never null.
          lengthIn: s.dimLength ?? undefined,
          widthIn: s.dimWidth ?? undefined,
          heightIn: s.dimHeight ?? undefined,
          ebayPackageType: s.ebayPackageType ?? undefined,
          weightEstimated: s.weightEstimated,
        }),
      },
      token,
    });
    // Eager ref sync: publish() may run before the next commit and must not
    // re-create the item.
    stateRef.current = { ...stateRef.current, inventoryItemId: item.id };
    setState(prev => ({ ...prev, inventoryItemId: item.id }));
    return item.id;
  }, [token]);

  const publish = useCallback(async (
    options?: PublishOptions,
  ): Promise<{ success: boolean; listingId?: string; error?: string; warning?: string; aspectsRequired?: AspectRequirement[]; weightRequired?: boolean }> => {
    if (!token) return { success: false, error: 'Not authenticated' };

    const s = stateRef.current;
    if (!s.title) return { success: false, error: 'Title is required' };
    if (!s.price) return { success: false, error: 'Price is required' };
    if (s.photos.length === 0) {
      // Flow state can be stale: photos added on the item page after this
      // flow was seeded never reach s.photos (live 2026-07-10). The listings
      // route publishes from items.photos (the DB row), so the server item is
      // the authority — only refuse when IT has no photos either.
      let serverHasPhotos = false;
      if (s.inventoryItemId) {
        try {
          const item = await api<{ photos?: unknown[] }>(`/items/${s.inventoryItemId}`, { token });
          serverHasPhotos = (item.photos?.length ?? 0) > 0;
        } catch {
          // Unreachable item — fall through to the photo guard error.
        }
      }
      if (!serverHasPhotos) return { success: false, error: 'At least one photo is required' };
    }

    setState(prev => ({ ...prev, publishStatus: 'publishing' }));

    try {
      let itemId = s.inventoryItemId;

      // weight column is ounces; flow state carries decimal pounds. The route
      // requires a positive weightOz, so sub-half-ounce values resolve to null.
      // A fill-sheet retry supplies values via options.weightDims (seller-confirmed).
      const wd = options?.weightDims;
      const weightLbs = wd ? wd.weight : s.weight;
      const dimL = wd ? wd.dimLength : s.dimLength;
      const dimW = wd ? wd.dimWidth : s.dimWidth;
      const dimH = wd ? wd.dimHeight : s.dimHeight;
      const pkgType = wd ? wd.ebayPackageType : s.ebayPackageType;
      const estimated = wd ? false : s.weightEstimated;
      const rawOz = weightLbs != null ? Math.round(weightLbs * 16) : 0;
      const weightOz = rawOz > 0 ? rawOz : null;

      if (!itemId) {
        // Single creation shape lives in ensureItemCreated (also fired at
        // recognition-confirm on fresh scans, where it usually already ran).
        itemId = await ensureItemCreated();
        if (!itemId) {
          setState(prev => ({ ...prev, publishStatus: 'failed' }));
          return { success: false, error: 'Could not save the item' };
        }
      }

      // Persist the flow's quantity (item.quantity is the single source of
      // truth — publish reads it) and, when present, weight/dims so the
      // publish-time merge (listings route) can emit packageWeightAndSize.
      // Runs for confirm-created items too — they were created before the
      // shipping step, so this PATCH is what lands their weight/dims.
      await api(`/items/${itemId}`, {
        method: 'PATCH',
        body: {
          quantity: s.quantity,
          // Photo-order backstop: publish reads items.photos, and drafts are
          // the only place a flow reorder/delete is guaranteed to have landed.
          ...(s.photos.length > 0 && { photos: normalizePhotoOrder(s.photos) }),
          ...(weightOz != null && {
            weightOz,
            // route schema is positive().optional() — send undefined, never null.
            lengthIn: dimL ?? undefined,
            widthIn: dimW ?? undefined,
            heightIn: dimH ?? undefined,
            ebayPackageType: pkgType ?? undefined,
            weightEstimated: estimated,
          }),
        },
        token,
      });

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

      // Build the eBay specifics as a record (not strict EbayPreparedFields) so
      // user-supplied aspects from the aspect sheet (a retry after
      // EBAY_ASPECTS_REQUIRED) survive even when prepare-listing yielded nothing
      // — otherwise they were silently dropped and the publish re-demanded them.
      // categoryId is self-healed server-side from item.marketplaceData.
      const ebaySpecific: Record<string, unknown> = ebayPreparedFields ? { ...ebayPreparedFields } : {};
      if (options?.aspects) {
        ebaySpecific.aspects = {
          ...((ebaySpecific.aspects as Record<string, string[]> | undefined) ?? {}),
          ...options.aspects,
        };
      }

      const marketplaceSpecificFields =
        s.marketplace === 'ebay' && Object.keys(ebaySpecific).length > 0
          ? ebaySpecific
          : s.marketplace === 'reverb'
            ? {
                // Offers/shipping/category are enriched server-side (seller
                // profile + prepare cache own them). acceptOffers here was a
                // hardcoded default, never user intent — sending it would
                // permanently override the profile's reverbOffersEnabled.
                make: s.brand,
                model: s.model,
              }
            : undefined;

      // Dedup key scoped to this item+marketplace: reused verbatim on retry so the
      // server collides on (userId, idempotencyKey) and resumes the stuck draft row
      // instead of inserting an orphan per attempt. Written to stateRef immediately
      // so the failure-path saveDraft below persists it for cross-session retries.
      const idempotencyKey = scopedPublishIdempotencyKey(itemId, s.marketplace, s.publishIdempotencyKey);
      if (idempotencyKey !== s.publishIdempotencyKey) {
        stateRef.current = { ...stateRef.current, publishIdempotencyKey: idempotencyKey };
        setState(prev => ({ ...prev, publishIdempotencyKey: idempotencyKey }));
      }

      const listing = await api<{ id: string; status: string; warning?: string }>('/listings', {
        method: 'POST',
        body: {
          itemId,
          marketplace: s.marketplace,
          price: s.price,
          // publishMode takes precedence; publishImmediately retained for backward compat
          ...(publishMode ? { publishMode } : { publishImmediately: true }),
          marketplaceSpecificFields,
          idempotencyKey,
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
        publishWarning: listing.warning ?? null,
        // Attempt complete — the next publish (e.g. relisting the same item) is a
        // new intent and must not replay this listing.
        publishIdempotencyKey: null,
      }));
      setLastStep('published');

      return { success: true, listingId: listing.id, warning: listing.warning };
    } catch (err) {
      // eBay needs category-required item specifics — surface them so the flow
      // can collect the values and retry. The gate throws from the adapter AFTER
      // the insert-first row exists; the retry reuses publishIdempotencyKey, so
      // the server resumes that row instead of inserting a duplicate.
      if (err instanceof ApiError && err.code === 'EBAY_ASPECTS_REQUIRED') {
        setState(prev => ({ ...prev, publishStatus: 'idle' }));
        // Include `error` so a flow that doesn't render the aspect sheet still
        // shows eBay's human-readable "needs these item specifics" message.
        return { success: false, error: err.message, aspectsRequired: (err.details as unknown as AspectRequirement[]) ?? [] };
      }
      // Calculated-shipping publish missing package weight/dims — surface so the
      // flow can collect them and retry. Like the aspects gate, the insert-first
      // row already exists; the shared idempotencyKey makes the retry resume it.
      if (err instanceof ApiError && err.code === 'EBAY_WEIGHT_REQUIRED') {
        setState(prev => ({ ...prev, publishStatus: 'idle' }));
        return { success: false, error: err.message, weightRequired: true };
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
  }, [token, deleteDraft, saveDraft, ensureItemCreated]);

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
    updateWeightDims,
    applyEstimatedWeightDims,
    startFromPhoto,
    startFromItem,
    resumeDraft,
    confirmRecognition,
    fetchComps,
    applyPricingStrategy,
    addPhotos,
    updatePhoto,
    reorderPhotos,
    removePhoto,
    commitPhotoOrder,
    ensureItemCreated,
    publish,
    cancel,
    reset,
  };
}
