"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { api, apiUpload } from "@/lib/api";
import { CameraCapture } from "./camera-capture";
import { ImagePicker } from "./image-picker";
import { useEnhance } from "@/hooks/use-enhance";
import { useBgRemoval } from "@/hooks/use-bg-removal";
import { CropTool } from "@/components/listing-flow/crop-tool";
import { ExposureTool } from "./exposure-tool";
import { ScanReviewActions } from "./scan-review-actions";
import { ScanAspectsSection } from "./scan-aspects-section";
import { useScanAspects } from "@/hooks/use-scan-aspects";
import { resolvePublishPriceWithSource } from "@/lib/price";
import { demandLabel } from "@/lib/demand";
import { PhotoGalleryStrip } from "./photo-gallery-strip";
import { usePhotoDrag } from "@/hooks/use-photo-drag";
import { movePhoto } from "@/lib/photos";
import { MAX_PHOTOS_PER_ITEM } from "@portage/shared";
import { PhotoEditPanel } from "./photo-edit-panel";
import { CreateListingSheet } from "@/components/listing/create-listing-sheet";
import { ShippingFieldsSection, SHIPPING_FIELDS_DEFAULT, type ShippingFieldsValue } from "@/components/listing/shipping-fields-section";
import { WeightDimsInputs, type WeightDimsValue } from "@/components/listing/weight-dims-inputs";
import {
  getAvailablePortageConditions,
  nearestAllowedCondition,
  type PortageCondition,
} from "@/lib/ebay-condition-map";
import type { RecognitionCandidate, CompResult } from "@portage/shared";

// ─── Types ───────────────────────────────────────────────────────────────────

type ScanState = "capture" | "uploading" | "scanning" | "review" | "saving";

interface CapturedPhoto {
  url: string;
  key: string;
  width?: number;
  height?: number;
}

interface RefineResponse {
  identification: RecognitionCandidate;
  detailed: {
    candidates: RecognitionCandidate[];
    reasoning: string[];
  };
}

interface ScanFlowProps {
  // result.warning carries a marketplace draft-fallback reason (e.g. eBay
  // rejected the publish) for the host to surface as a toast.
  onClose: (result?: { warning?: string }) => void;
}

// App-wide cap (eBay 24 / Reverb 25 — ours is the min, from @portage/shared).
const MAX_PHOTOS = MAX_PHOTOS_PER_ITEM;

function mapEbayCondition(ebayCondition: string): "new" | "like_new" | "good" | "fair" | "poor" {
  const lower = ebayCondition.toLowerCase();
  if (lower.includes("new") && !lower.includes("pre") && !lower.includes("open")) return "new";
  if (lower.includes("like new") || lower.includes("open box") || lower.includes("refurbished")) return "like_new";
  if (lower.includes("very good") || lower.includes("good") || lower.includes("pre-owned")) return "good";
  if (lower.includes("acceptable") || lower.includes("fair")) return "fair";
  if (lower.includes("parts") || lower.includes("poor")) return "poor";
  return "good";
}

const conditionOptions = [
  { value: "new", label: "New" },
  { value: "like_new", label: "Like New" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
] as const;

// ─── Main Component ──────────────────────────────────────────────────────────

export function ScanFlow({ onClose }: ScanFlowProps) {
  const { token } = useAuth();
  const [state, setState] = useState<ScanState>("capture");
  const [showCamera, setShowCamera] = useState(false);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // AI results
  const [candidates, setCandidates] = useState<RecognitionCandidate[]>([]);
  const [reasoning, setReasoning] = useState<string[]>([]);
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState(0);
  const [showReasoning, setShowReasoning] = useState(false);

  // Editable fields from selected candidate
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editCondition, setEditCondition] = useState<string>("good");
  // Listing quantity as a raw string so the field can be cleared/retyped freely;
  // coerced to a whole number ≥ 1 on blur and at save. Persisted on the item so
  // the item-detail page reflects it (not hard-coded to 1).
  const [editQuantity, setEditQuantity] = useState("1");
  const [editConditionNotes, setEditConditionNotes] = useState("");
  const [editValueLow, setEditValueLow] = useState("");
  const [editValueHigh, setEditValueHigh] = useState("");
  const [editBrand, setEditBrand] = useState("");
  const [editModel, setEditModel] = useState("");

  // Inline editing tools
  const {
    isProcessing: isEnhancing,
    result: enhanceResult,
    error: enhanceError,
    enhance,
    reset: resetEnhance,
  } = useEnhance();
  const {
    isProcessing: isRemovingBg,
    resultUrl: bgResultUrl,
    error: bgError,
    removeBackground,
    reset: resetBgRemoval,
  } = useBgRemoval();
  const [isRotating, setIsRotating] = useState(false);
  const [comps, setComps] = useState<CompResult | null>(null);
  const [compsLoading, setCompsLoading] = useState(false);
  // P3 (e955f1b9): a comps outage is told, not swallowed — pricing proceeds
  // on the AI estimate alone.
  const [compsError, setCompsError] = useState(false);
  const [expandedCompUrl, setExpandedCompUrl] = useState<string | null>(null);
  const [isListingForSale, setIsListingForSale] = useState(false);
  // F1: after "Save & List" creates the item, open the unified publish-confirm
  // sheet (seeded) instead of posting the listing directly from scan.
  const [publishItemId, setPublishItemId] = useState<string | null>(null);
  const [publishEbayDraft, setPublishEbayDraft] = useState(false);
  const [publishNowSeed, setPublishNowSeed] = useState(false);
  // Per-listing shipping set on the review screen (beta 17be7322) — seeds the
  // publish sheet as touched. Untouched → sheet keeps its own default contract.
  const [reviewShipping, setReviewShipping] = useState<ShippingFieldsValue>(SHIPPING_FIELDS_DEFAULT);
  // State, not a ref: the value gates the sheet's initialShipping prop during
  // render (react-hooks/refs forbids reading refs there).
  const [reviewShippingTouched, setReviewShippingTouched] = useState(false);
  // Seller-set sale price for the review step (null = use the resolved default).
  const [listPrice, setListPrice] = useState<number | null>(null);
  // Packaged weight (decimal lb) + dims, seeded from the AI estimate; manual
  // edits mark the metrics seller-confirmed (weightEstimated false).
  const [weightDims, setWeightDims] = useState<WeightDimsValue>({
    weight: null, dimLength: null, dimWidth: null, dimHeight: null, ebayPackageType: null,
  });
  const [weightEstimated, setWeightEstimated] = useState(false);
  // Override search text for the eBay category control.
  const [categorySearch, setCategorySearch] = useState("");
  const categorySearchInputRef = useRef<HTMLInputElement>(null);
  const [activeTool, setActiveTool] = useState<"none" | "crop" | "exposure">("none");
  // Which photo the full-screen editor overlay is open for (null = closed).
  const [editingPhotoIndex, setEditingPhotoIndex] = useState<number | null>(null);
  const isToolProcessing = isRotating || isEnhancing || isRemovingBg;

  // eBay category + required item specifics, captured at scan time so publish
  // doesn't fail later. All logic lives in the unit-tested use-scan-aspects hook.
  const {
    resolvedCategoryId,
    resolvedCategoryName,
    resolveCategory,
    isCategoryResolving,
    isAspectsLoading,
    aspects,
    aspectValues,
    setAspectValue,
    suggestions,
    aiFilledNames,
    confirmSuggestion,
    missingRequired,
    buildAspects,
    aspectsBlockPublish,
    aspectsError,
    refetchAspects,
    resolveError,
    conditionIds,
    categoryMismatch,
    resolvedVisionCategory,
    dismissCategoryMismatch,
    clearCategoryResolution,
  } = useScanAspects(
    editName,
    `${editName} ${editDescription}`,
    // Phase A AI-filled specifics from the selected candidate → surfaced as [AI] chips.
    candidates[selectedCandidateIndex]?.aspects,
    // Vision coarse category feeds the server-side mismatch guard (advisory banner).
    candidates[selectedCandidateIndex]?.category,
  );

  // Constrain the condition pills to what the resolved eBay category accepts;
  // empty conditionIds (no category / no metadata) fails open to all five.
  // Memoized so the snap effect below runs on real changes, not every render.
  const availableConditions = useMemo(
    () => getAvailablePortageConditions(conditionIds),
    [conditionIds],
  );

  // Seed Brand/Model item specifics from the seller's own fields — a
  // deterministic copy (NOT AI prefill, which Stage 1 deliberately excluded).
  // Only fills empty aspects, so a seller's explicit aspect edit always wins.
  useEffect(() => {
    const fieldSeeds: Array<[string, string]> = [
      ["Brand", editBrand],
      ["Model", editModel],
    ];
    for (const [name, value] of fieldSeeds) {
      // Key presence (not truthiness): an explicit clear leaves "" under the
      // key and must never be re-seeded — only never-touched aspects seed.
      if (value && aspects[name] && !(name in aspectValues)) {
        setAspectValue(name, value);
      }
    }
  }, [aspects, aspectValues, editBrand, editModel, setAspectValue]);

  // If the current condition (AI-suggested or comp-copied) is disallowed for
  // the resolved category, snap to the nearest allowed grade instead of
  // failing later at publish.
  // P3 (62e1061e): the snap still happens, but it is told — the seller sees
  // what changed and why instead of a silently different condition.
  const [conditionNotice, setConditionNotice] = useState<{ from: PortageCondition; to: PortageCondition } | null>(null);
  const conditionLabel = (c: string) => conditionOptions.find((o) => o.value === c)?.label ?? c;
  // Every user-driven condition change goes through here so a stale notice
  // never outlives the choice it described.
  const chooseCondition = (c: string) => {
    setConditionNotice(null);
    setEditCondition(c);
  };
  // A new category starts clean — declared BEFORE the snap effect so a snap
  // the new category causes still lands its own notice in the same commit.
  useEffect(() => { setConditionNotice(null); }, [resolvedCategoryId]);
  useEffect(() => {
    if (availableConditions.length === 0) return;
    if (availableConditions.includes(editCondition as PortageCondition)) return;
    const next = nearestAllowedCondition(editCondition as PortageCondition, availableConditions);
    if (next === editCondition) return;
    setEditCondition(next);
    setConditionNotice({ from: editCondition as PortageCondition, to: next });
  }, [availableConditions, editCondition]);



  // Reset editing hooks when switching photos
  useEffect(() => {
    resetEnhance();
    resetBgRemoval();
  }, [selectedPhotoIndex, resetEnhance, resetBgRemoval]);

  // Accept/discard handlers for enhance preview
  const handleAcceptEnhance = useCallback(() => {
    if (!enhanceResult) return;
    setPhotos((prev) =>
      prev.map((p, i) =>
        i === selectedPhotoIndex
          ? { ...p, url: enhanceResult.image.url, key: enhanceResult.image.key, width: enhanceResult.image.width, height: enhanceResult.image.height }
          : p,
      ),
    );
    resetEnhance();
  }, [enhanceResult, selectedPhotoIndex, resetEnhance]);

  const handleDiscardEnhance = useCallback(() => {
    resetEnhance();
  }, [resetEnhance]);

  useEffect(() => {
    if (enhanceError) {
      setError(enhanceError);
    }
  }, [enhanceError]);

  // Accept/discard handlers for bg removal preview
  const handleAcceptBg = useCallback(() => {
    if (!bgResultUrl) return;
    setPhotos((prev) =>
      prev.map((p, i) => (i === selectedPhotoIndex ? { ...p, url: bgResultUrl } : p)),
    );
    resetBgRemoval();
  }, [bgResultUrl, selectedPhotoIndex, resetBgRemoval]);

  const handleDiscardBg = useCallback(() => {
    resetBgRemoval();
  }, [resetBgRemoval]);

  useEffect(() => {
    if (bgError) {
      setError(bgError);
    }
  }, [bgError]);

  // ─── Upload a file immediately to R2 ────────────────────────────────────────

  const uploadPhoto = useCallback(
    async (file: File): Promise<CapturedPhoto | null> => {
      if (!token) return null;
      try {
        const formData = new FormData();
        formData.append("image", file);

        const data = await apiUpload<{
          image: { url: string; key: string; width: number; height: number };
        }>("/images", formData, { token });
        return {
          url: data.image.url,
          key: data.image.key,
          width: data.image.width,
          height: data.image.height,
        };
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
        return null;
      }
    },
    [token],
  );

  // ─── Capture handlers ──────────────────────────────────────────────────────

  // Multi-shot: the camera stays OPEN across shots (closing per photo forced a
  // new getUserMedia — iOS/macOS Safari re-prompted for camera permission on
  // every 2nd+ photo). Uploads run behind the viewfinder; Done/✕ closes once.
  const handleCameraCapture = useCallback(
    async (file: File) => {
      if (photos.length >= MAX_PHOTOS - 1) setShowCamera(false);
      if (photos.length >= MAX_PHOTOS) return;

      setError(null);
      const photo = await uploadPhoto(file);
      if (photo) {
        setPhotos((prev) => [...prev, photo]);
        setSelectedPhotoIndex(photos.length);
      }
    },
    [photos.length, uploadPhoto],
  );

  const handleGallerySelect = useCallback(
    async (files: File[]) => {
      const remaining = MAX_PHOTOS - photos.length;
      const toUpload = files.slice(0, remaining);
      if (toUpload.length === 0) return;

      setState("uploading");
      setError(null);

      for (const file of toUpload) {
        const photo = await uploadPhoto(file);
        if (photo) {
          setPhotos((prev) => [...prev, photo]);
        }
      }
      setSelectedPhotoIndex(photos.length + toUpload.length - 1);
      setState("capture");
    },
    [photos.length, uploadPhoto],
  );

  // Capture-stage strip drag (pre-AI-scan reorder). The ref swallows the
  // trailing click after a completed drag so it doesn't re-select a thumb.
  const captureDragRef = useRef(false);
  const handleReorderPhotos = useCallback(
    (from: number, to: number) => {
      const selKey = photos[selectedPhotoIndex]?.key;
      const next = movePhoto(photos, from, to);
      setPhotos(next);
      // Keep the big preview showing the same photo the user was on.
      if (selKey) {
        const ni = next.findIndex((p) => p.key === selKey);
        if (ni !== -1) setSelectedPhotoIndex(ni);
      }
    },
    [photos, selectedPhotoIndex],
  );

  const captureDrag = usePhotoDrag({
    onMove: (from, to) => {
      captureDragRef.current = true;
      handleReorderPhotos(from, to);
    },
  });

  const handleRemovePhoto = useCallback(
    (index: number) => {
      setPhotos((prev) => prev.filter((_, i) => i !== index));
      setSelectedPhotoIndex((prev) => Math.min(prev, Math.max(0, photos.length - 2)));
    },
    [photos.length],
  );

  // ─── Scan (sends URLs to /scan/refine) ────────────────────────────────────

  const populateFields = useCallback((candidate: RecognitionCandidate) => {
    setEditName(candidate.name);
    setEditDescription(candidate.description);
    setEditCategory(candidate.category);
    setEditCondition(candidate.condition);
    setEditConditionNotes(candidate.conditionNotes);
    setEditValueLow(String(candidate.estimatedValueLow));
    setEditValueHigh(String(candidate.estimatedValueHigh));
    setEditBrand(candidate.brand ?? "");
    setEditModel(candidate.model ?? "");
    // Seed packaged weight/dims from the AI estimate (oz → decimal lb for the
    // lb+oz inputs); any manual edit flips weightEstimated off.
    setWeightDims({
      weight: candidate.weight && candidate.weight.value > 0 ? candidate.weight.value / 16 : null,
      dimLength: candidate.dimensions?.length ?? null,
      dimWidth: candidate.dimensions?.width ?? null,
      dimHeight: candidate.dimensions?.height ?? null,
      ebayPackageType: candidate.packageType ?? null,
    });
    setWeightEstimated(!!(candidate.weight && candidate.weight.value > 0));
  }, []);

  const runScan = useCallback(async (fallbackState: ScanState) => {
    if (!token || photos.length === 0) return;
    setState("scanning");
    setError(null);

    try {
      const imageUrls = photos.slice(0, 3).map((p) => p.url);

      const data = await api<RefineResponse>("/scan/refine", {
        method: "POST",
        token,
        body: { imageUrls },
      });

      const resultCandidates = data.detailed.candidates;
      if (resultCandidates.length === 0) {
        setError("AI could not identify this item. Try adding more photos or better lighting.");
        setState(fallbackState);
        return;
      }

      setCandidates(resultCandidates);
      setReasoning(data.detailed.reasoning);
      setSelectedCandidateIndex(0);
      populateFields(resultCandidates[0]);
      setState("review");

      setCompsLoading(true);
      setCompsError(false);
      setConditionNotice(null);
      api<CompResult>(`/items/comps/search?q=${encodeURIComponent(resultCandidates[0].name)}`, { token })
        .then((c) => setComps(c))
        .catch(() => setCompsError(true))
        .finally(() => setCompsLoading(false));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
      setState(fallbackState);
    }
  }, [token, photos, populateFields]);

  const handleScan = useCallback(() => runScan("capture"), [runScan]);
  const handleRescan = useCallback(() => runScan("review"), [runScan]);

  const handleSelectCandidate = useCallback(
    (index: number) => {
      setSelectedCandidateIndex(index);
      populateFields(candidates[index]);
    },
    [candidates, populateFields],
  );

  // ─── Photo editing tools ───────────────────────────────────────────────────

  const selectedPhoto = photos[selectedPhotoIndex];

  const handleRotate = useCallback(async () => {
    if (!token || isToolProcessing || !selectedPhoto) return;
    setIsRotating(true);
    setError(null);

    try {
      const data = await api<{ image: { key: string; url: string; width: number; height: number } }>("/images/rotate", {
        method: "POST",
        body: { imageUrl: selectedPhoto.url, degrees: 90 },
        token,
      });
      setPhotos((prev) =>
        prev.map((p, i) =>
          i === selectedPhotoIndex
            ? { ...p, url: data.image.url, key: data.image.key, width: data.image.width, height: data.image.height }
            : p,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rotation failed");
    } finally {
      setIsRotating(false);
    }
  }, [token, isToolProcessing, selectedPhoto, selectedPhotoIndex]);

  const handleEnhance = useCallback(() => {
    if (isToolProcessing || !selectedPhoto) return;
    setError(null);
    enhance(selectedPhoto.url);
  }, [isToolProcessing, enhance, selectedPhoto]);

  const handleBgRemove = useCallback(() => {
    if (isToolProcessing || !selectedPhoto) return;
    setError(null);
    removeBackground(selectedPhoto.url);
  }, [isToolProcessing, removeBackground, selectedPhoto]);

  const handleExposureApply = useCallback(
    async (ev: number) => {
      if (!token || !selectedPhoto) return;
      setError(null);

      try {
        const data = await api<{ image: { key: string; url: string; width: number; height: number } }>("/images/exposure", {
          method: "POST",
          body: { imageUrl: selectedPhoto.url, ev },
          token,
        });
        setPhotos((prev) =>
          prev.map((p, i) =>
            i === selectedPhotoIndex
              ? { ...p, url: data.image.url, key: data.image.key, width: data.image.width, height: data.image.height }
              : p,
          ),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Exposure adjustment failed");
      } finally {
        setActiveTool("none");
      }
    },
    [token, selectedPhoto, selectedPhotoIndex],
  );

  const handleCropApply = useCallback(
    async (crop: { x: number; y: number; width: number; height: number }) => {
      if (!token || !selectedPhoto) return;
      setError(null);

      try {
        const data = await api<{ image: { key: string; url: string; width: number; height: number } }>("/images/crop", {
          method: "POST",
          body: { imageUrl: selectedPhoto.url, crop },
          token,
        });
        setPhotos((prev) =>
          prev.map((p, i) =>
            i === selectedPhotoIndex
              ? { ...p, url: data.image.url, key: data.image.key, width: data.image.width, height: data.image.height }
              : p,
          ),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Crop failed");
      } finally {
        setActiveTool("none");
      }
    },
    [token, selectedPhoto, selectedPhotoIndex],
  );

  // ─── Save to inventory ────────────────────────────────────────────────────

  // Resolve the price shown/used in the review step: the seller's edited value
  // wins, else fall back to comps via the unit-tested helper. The AI value
  // range (editValueLow/High) is retired from the UI (Housekeeping-1) but is
  // still written to the item silently from the candidate.
  const valueLowNum = parseFloat(editValueLow) || 0;
  const valueHighNum = parseFloat(editValueHigh) || 0;
  const recommendedNum = Math.round((valueLowNum + valueHighNum) / 2) || null;
  const { price: reviewPrice, source: reviewPriceSource } = resolvePublishPriceWithSource(
    { price: listPrice },
    comps?.stats,
  );

  // Required fields (Name, Category, Condition, Price) gate Save; each incomplete
  // one shows a red asterisk on its label. eBay item specifics gate Save & List
  // separately via aspectsBlockPublish.
  const nameMissing = editName.trim() === "";
  const categoryMissing = resolvedCategoryId === null;
  const conditionMissing = editCondition.trim() === "";
  const priceMissing = !(reviewPrice != null && reviewPrice > 0);
  const missingRequiredFields = [
    nameMissing && "Name",
    categoryMissing && "Category",
    conditionMissing && "Condition",
    priceMissing && "Price",
  ].filter(Boolean) as string[];
  const requiredComplete = missingRequiredFields.length === 0;
  const saveDisabledReason = requiredComplete
    ? null
    : `Complete required field${missingRequiredFields.length === 1 ? "" : "s"}: ${missingRequiredFields.join(", ")}`;

  const handleSave = useCallback(async () => {
    if (!token || photos.length === 0) return;

    setIsSaving(true);
    setState("saving");

    try {
      const valueLow = parseFloat(editValueLow) || 0;
      const valueHigh = parseFloat(editValueHigh) || 0;
      const valueRecommended = Math.round((valueLow + valueHigh) / 2);

      const itemPhotos = photos.map((p, i) => ({
        url: p.url,
        key: p.key,
        width: p.width,
        height: p.height,
        isPrimary: i === 0,
      }));

      const selectedCandidate = candidates[selectedCandidateIndex];

      await api("/items", {
        method: "POST",
        token,
        body: {
          title: editName,
          description: editDescription,
          // eBay taxonomy is THE category; the AI's internal string only as fallback
          category: resolvedCategoryName ?? editCategory,
          // Cache the resolved eBay LEAF id on the item so a later publish can
          // resolve the category (resolveEbayCategoryId reads marketplaceData.
          // ebay.categoryId) instead of falling back to a title guess.
          ...(resolvedCategoryId
            ? {
              marketplaceData: {
                ebay: { categoryId: resolvedCategoryId, categoryName: resolvedCategoryName },
                // Vision coarse category persists so the edit page and
                // publish-time self-heal can re-run the mismatch guard.
                ...(selectedCandidate?.category ? { scan: { visionCategory: selectedCandidate.category } } : {}),
              },
            }
            : selectedCandidate?.category
              ? { marketplaceData: { scan: { visionCategory: selectedCandidate.category } } }
              : {}),
          condition: ["new", "like_new", "good", "fair", "poor"].includes(editCondition) ? editCondition : "good",
          conditionNotes: editConditionNotes,
          quantity: Math.max(1, Math.floor(Number(editQuantity)) || 1),
          brand: editBrand || undefined,
          model: editModel || undefined,
          features: selectedCandidate?.features ?? [],
          // Persist the eBay item specifics captured at scan so a later publish
          // carries them and the aspect pop-up never re-asks (Phase C carry-through).
          aspects: buildAspects(),
          estimatedValueMin: valueLow,
          estimatedValueMax: valueHigh,
          estimatedValueRecommended: valueRecommended,
          aiConfidenceScore: selectedCandidate?.confidence ?? 0.85,
          photos: itemPhotos,
          // Persist the seller's price so it prefills future publishes (same as Save & List).
          ...(reviewPrice && reviewPrice > 0 ? { price: reviewPrice } : {}),
          // Packaged weight/dims from the review inputs (seeded from the AI
          // estimate; weightEstimated false once the seller edits them).
          ...(weightDims.weight && Math.round(weightDims.weight * 16) > 0
            ? { weightOz: Math.round(weightDims.weight * 16), weightEstimated } : {}),
          ...(weightDims.dimLength ? { lengthIn: weightDims.dimLength } : {}),
          ...(weightDims.dimWidth ? { widthIn: weightDims.dimWidth } : {}),
          ...(weightDims.dimHeight ? { heightIn: weightDims.dimHeight } : {}),
          ...(weightDims.ebayPackageType ? { ebayPackageType: weightDims.ebayPackageType } : {}),
        },
      });

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save item");
      setState("review");
      setIsSaving(false);
    }
  }, [
    token, photos, editName, editDescription, editCategory,
    editCondition, editConditionNotes, editQuantity, editValueLow, editValueHigh,
    editBrand, editModel, candidates, selectedCandidateIndex, onClose, reviewPrice,
    weightDims, weightEstimated, resolvedCategoryName, buildAspects,
  ]);

  const handleSaveAndList = useCallback(async (ebayDraft = false) => {
    if (!token || photos.length === 0 || isListingForSale) return;
    setIsListingForSale(true);
    setState("saving");
    try {
      const itemPhotos = photos.map((p, i) => ({ url: p.url, key: p.key, width: p.width, height: p.height, isPrimary: i === 0 }));
      const selectedCandidate = candidates[selectedCandidateIndex];
      const price = reviewPrice;
      const newItem = await api<{ id: string }>("/items", {
        method: "POST", token,
        body: {
          title: editName, description: editDescription, category: resolvedCategoryName ?? editCategory,
          condition: ["new", "like_new", "good", "fair", "poor"].includes(editCondition) ? editCondition : "good",
          conditionNotes: editConditionNotes, quantity: Math.max(1, Math.floor(Number(editQuantity)) || 1), brand: editBrand || undefined, model: editModel || undefined,
          features: selectedCandidate?.features ?? [],
          // Persist captured eBay specifics on the item too (the listing payload
          // below already carries them) — so a later re-list also has them.
          aspects: buildAspects(),
          estimatedValueMin: valueLowNum, estimatedValueMax: valueHighNum, estimatedValueRecommended: recommendedNum ?? 0,
          aiConfidenceScore: selectedCandidate?.confidence ?? 0.85, photos: itemPhotos,
          // Cache the resolved eBay leaf id on the item too (not just the listing
          // payload) so a re-list from inventory resolves the category.
          ...(resolvedCategoryId
            ? {
              marketplaceData: {
                ebay: { categoryId: resolvedCategoryId, categoryName: resolvedCategoryName },
                ...(selectedCandidate?.category ? { scan: { visionCategory: selectedCandidate.category } } : {}),
              },
            }
            : selectedCandidate?.category
              ? { marketplaceData: { scan: { visionCategory: selectedCandidate.category } } }
              : {}),
          // Persist the seller's price so it prefills future publishes.
          ...(price && price > 0 ? { price } : {}),
          // Packaged weight/dims from the review inputs (seeded from the AI estimate).
          ...(weightDims.weight && Math.round(weightDims.weight * 16) > 0
            ? { weightOz: Math.round(weightDims.weight * 16), weightEstimated } : {}),
          ...(weightDims.dimLength ? { lengthIn: weightDims.dimLength } : {}),
          ...(weightDims.dimWidth ? { widthIn: weightDims.dimWidth } : {}),
          ...(weightDims.dimHeight ? { heightIn: weightDims.dimHeight } : {}),
          ...(weightDims.ebayPackageType ? { ebayPackageType: weightDims.ebayPackageType } : {}),
        },
      });
      // F1: seed the confirm sheet from the seller profile (live -> publish-now
      // on); a failed profile fetch falls back to draft (never an accidental live).
      const profileLive = await api<{ profile: { ebayPublishMode?: "draft" | "live" | null } }>(
        "/seller-profile",
        { token },
      )
        .then((d) => d.profile?.ebayPublishMode === "live")
        .catch(() => false);
      setPublishEbayDraft(ebayDraft);
      // An explicit eBay-draft choice overrides a live profile default (do not go live).
      setPublishNowSeed(profileLive && !ebayDraft);
      setPublishItemId(newItem.id);
      setState("review");
      setIsListingForSale(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setState("review");
      setIsListingForSale(false);
    }
  }, [
    token, photos, isListingForSale, candidates, selectedCandidateIndex, reviewPrice,
    editName, editDescription, editCategory, editCondition, editConditionNotes, editQuantity,
    editBrand, editModel, valueLowNum, valueHighNum, recommendedNum,
    resolvedCategoryId, resolvedCategoryName, buildAspects, onClose, weightDims, weightEstimated,
  ]);

  // ─── Back to capture from review ──────────────────────────────────────────

  const handleBackToCapture = useCallback(() => {
    setState("capture");
    setError(null);
  }, []);

  // ─── Crop tool overlay ────────────────────────────────────────────────────

  if (activeTool === "crop" && selectedPhoto) {
    return (
      <CropTool
        imageUrl={selectedPhoto.url}
        imageWidth={selectedPhoto.width ?? 1024}
        imageHeight={selectedPhoto.height ?? 1024}
        onApply={handleCropApply}
        onCancel={() => setActiveTool("none")}
      />
    );
  }

  // ─── Exposure tool overlay ────────────────────────────────────────────────

  if (activeTool === "exposure" && selectedPhoto) {
    return (
      <ExposureTool
        imageUrl={selectedPhoto.url}
        onApply={handleExposureApply}
        onCancel={() => setActiveTool("none")}
      />
    );
  }

  // ─── Photo editor overlay (all 5 tools; crop/exposure early-returns win) ──

  if (editingPhotoIndex !== null && photos[editingPhotoIndex]) {
    // The before-image is the photo being edited — never the strip selection,
    // even though the two indices are kept in sync on open.
    const beforeUrl = photos[editingPhotoIndex].url;
    const buildPendingPreview = () => {
      if (enhanceResult) {
        return {
          beforeUrl,
          afterUrl: enhanceResult.image.url,
          alt: "Enhanced preview",
          onAccept: handleAcceptEnhance,
          onDiscard: handleDiscardEnhance,
        };
      }
      if (bgResultUrl) {
        return {
          beforeUrl,
          afterUrl: bgResultUrl,
          alt: "Background removed preview",
          onAccept: handleAcceptBg,
          onDiscard: handleDiscardBg,
        };
      }
      return null;
    };
    const pendingPreview = buildPendingPreview();

    return (
      <PhotoEditPanel
        photo={photos[editingPhotoIndex]}
        photoIndex={editingPhotoIndex}
        photoCount={photos.length}
        onClose={() => {
          // Closing with an unaccepted result discards it — nothing pending
          // may silently apply.
          if (enhanceResult) handleDiscardEnhance();
          if (bgResultUrl) handleDiscardBg();
          setEditingPhotoIndex(null);
        }}
        onRotate={handleRotate}
        onCrop={() => !isToolProcessing && setActiveTool("crop")}
        onEnhance={handleEnhance}
        onBgRemove={handleBgRemove}
        onExposure={() => !isToolProcessing && setActiveTool("exposure")}
        isProcessing={isToolProcessing}
        processingLabel={
          isRotating ? "Rotating..." : isEnhancing ? "Enhancing..." : isRemovingBg ? "Removing background..." : null
        }
        error={error}
        pendingPreview={pendingPreview}
      />
    );
  }

  // ─── Camera overlay ───────────────────────────────────────────────────────

  if (showCamera) {
    return (
      <CameraCapture
        onCapture={handleCameraCapture}
        onClose={() => setShowCamera(false)}
      />
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col animate-slide-up-full">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <button
          onClick={state === "review" ? handleBackToCapture : () => onClose()}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
          aria-label={state === "review" ? "Back" : "Close"}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {state === "review" ? (
              <path d="M19 12H5M12 19l-7-7 7-7" />
            ) : (
              <path d="M18 6L6 18M6 6l12 12" />
            )}
          </svg>
        </button>
        <h2
          className="font-[family-name:var(--font-instrument)] font-semibold text-text-primary"
          style={{ fontSize: "var(--text-headline)" }}
        >
          {state === "capture" && "Scan Item"}
          {state === "uploading" && "Uploading..."}
          {state === "scanning" && "Analyzing..."}
          {state === "review" && "Review"}
          {state === "saving" && "Saving..."}
        </h2>
        <div className="w-10" />
      </header>

      {/* ─── CAPTURE STATE ─────────────────────────────────────────────── */}
      {(state === "capture" || state === "uploading") && (
        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
          {error && (
            <div className="mx-4 mt-3 bg-[var(--accent-error-soft)] border border-[var(--accent-error)]/30 rounded-xl p-3 text-sm text-[var(--accent-error)] text-center">
              {error}
            </div>
          )}

          {photos.length === 0 ? (
            /* Empty state — first photo */
            <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
              <div className="w-24 h-24 rounded-3xl bg-[var(--teal-soft)] flex items-center justify-center mb-6">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>

              <h3
                className="font-[family-name:var(--font-instrument)] font-semibold text-text-primary mb-2"
                style={{ fontSize: "var(--text-title)" }}
              >
                Photograph your item
              </h3>
              <p className="text-text-secondary text-center mb-8 max-w-xs" style={{ fontSize: "var(--text-body)" }}>
                Take 2-3 clear photos from different angles. Porter will identify it using all images.
              </p>

              <div className="w-full max-w-sm space-y-3">
                <button
                  onClick={() => setShowCamera(true)}
                  disabled={state === "uploading"}
                  className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-[var(--orange)] text-white font-semibold disabled:opacity-50"
                  style={{ boxShadow: "var(--shadow-elevated)", fontSize: "var(--text-body)" }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  Take Photo
                </button>

                <ImagePicker onSelect={handleGallerySelect} multiple>
                  <div className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-muted text-text-primary font-semibold cursor-pointer hover:bg-[var(--orange-soft)] transition-colors" style={{ fontSize: "var(--text-body)" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="M21 15l-5-5L5 21" />
                    </svg>
                    Choose from Gallery
                  </div>
                </ImagePicker>
              </div>
            </div>
          ) : (
            /* Has photos — show strip + add more + scan button */
            <div className="flex-1 min-h-0 flex flex-col">
              {/* Hero preview of selected photo */}
              <div className="relative flex-1 min-h-0 bg-black flex items-center justify-center overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photos[selectedPhotoIndex]?.url}
                  alt={`Photo ${selectedPhotoIndex + 1}`}
                  className="max-w-full max-h-full object-contain"
                />
                {state === "uploading" && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="w-10 h-10 border-3 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {/* Photo counter */}
                <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm text-white text-xs font-medium">
                  {photos.length}/{MAX_PHOTOS}
                </div>
              </div>

              {/* Horizontal photo strip */}
              <div className="bg-surface border-t border-border">
                <div className="flex gap-2 px-3 py-3 overflow-x-auto scrollbar-hide">
                  {photos.map((photo, i) => (
                    <button
                      key={photo.key}
                      onClick={() => {
                        if (captureDragRef.current) {
                          captureDragRef.current = false;
                          return;
                        }
                        setSelectedPhotoIndex(i);
                      }}
                      className={`photo-drag-tile relative flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-colors ${
                        i === selectedPhotoIndex ? "border-[var(--teal)]" : "border-transparent"
                      }`}
                      style={captureDrag.dragIndex === i ? { opacity: 0.5, transform: "scale(0.95)" } : undefined}
                      {...captureDrag.getItemProps(i)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                      {/* span, not <button>: nesting a button inside the thumb
                          button is invalid HTML and breaks React 19 hydration. */}
                      <span
                        role="button"
                        tabIndex={0}
                        data-photo-drag-ignore
                        onClick={(e) => { e.stopPropagation(); handleRemovePhoto(i); }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.stopPropagation();
                            e.preventDefault();
                            handleRemovePhoto(i);
                          }
                        }}
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-accent-error flex items-center justify-center cursor-pointer"
                        aria-label={`Remove photo ${i + 1}`}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </span>
                    </button>
                  ))}

                  {/* Add photo buttons — camera re-shot AND gallery pick.
                      Gallery vanished after the first photo pre-fix; on
                      desktop that left no way to add more (beta 6337abaf). */}
                  {photos.length < MAX_PHOTOS && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => setShowCamera(true)}
                        disabled={state === "uploading"}
                        className="w-16 h-16 rounded-xl border-2 border-dashed border-border flex items-center justify-center text-text-secondary hover:text-[var(--teal)] hover:border-[var(--teal)] transition-colors disabled:opacity-50"
                        aria-label="Take another photo"
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                          <circle cx="12" cy="13" r="4" />
                        </svg>
                      </button>
                      <ImagePicker onSelect={handleGallerySelect} multiple>
                        <div
                          aria-label="Add from gallery"
                          className="w-16 h-16 rounded-xl border-2 border-dashed border-border flex items-center justify-center text-text-secondary hover:text-[var(--teal)] hover:border-[var(--teal)] transition-colors cursor-pointer"
                        >
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <path d="M21 15l-5-5L5 21" />
                          </svg>
                        </div>
                      </ImagePicker>
                    </div>
                  )}
                </div>

                {/* Recommendation hint */}
                {photos.length === 1 && (
                  <p className="px-4 pb-2 text-text-secondary text-center" style={{ fontSize: "var(--text-caption)" }}>
                    Add 1-2 more angles for better identification
                  </p>
                )}
              </div>

              {/* Scan button */}
              <div
                className="px-4 py-4 bg-surface border-t border-border"
                style={{ paddingBottom: "calc(1rem + var(--safe-area-bottom))" }}
              >
                <button
                  onClick={handleScan}
                  disabled={photos.length === 0 || state === "uploading"}
                  className="w-full py-4 rounded-2xl bg-[var(--orange)] text-white font-semibold disabled:opacity-50 transition-opacity"
                  style={{ boxShadow: "var(--shadow-elevated)", fontSize: "var(--text-body)" }}
                >
                  Scan {photos.length} Photo{photos.length !== 1 ? "s" : ""} with Porter
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── SCANNING STATE ────────────────────────────────────────────── */}
      {state === "scanning" && (
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="relative mb-6">
            {/* Photo thumbnails in a cluster */}
            <div className="flex -space-x-4">
              {photos.slice(0, 3).map((photo, i) => (
                <div
                  key={photo.key}
                  className="w-20 h-20 rounded-xl overflow-hidden border-2 border-background"
                  style={{ transform: `rotate(${(i - 1) * 5}deg)` }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 border-3 border-[var(--teal)] border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
          <p className="text-text-primary font-semibold text-lg">Porter is analyzing...</p>
          <p className="text-text-secondary mt-1" style={{ fontSize: "var(--text-caption)" }}>
            {photos.length > 1
              ? `Cross-referencing ${Math.min(photos.length, 3)} photos`
              : "Identifying item and estimating value"}
          </p>
        </div>
      )}

      {/* ─── REVIEW STATE ──────────────────────────────────────────────── */}
      {state === "review" && photos.length > 0 && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Full-height details panel — the always-on inline editor is gone;
              photos live in the gallery strip above the form, editing happens
              in the full-screen editor overlay. */}
          <div
            className="flex-1 overflow-y-auto bg-background relative z-10"
            // Clear the fixed action bar (price + Rescan/Save/List + safe area);
            // pb-28 was shorter than the bar, hiding the last fields (Description).
            style={{ paddingBottom: "calc(14rem + var(--safe-area-bottom))" }}
          >
            <div className="w-12 h-1 rounded-full bg-border mx-auto mt-3 mb-4" />
            <div className="px-4 space-y-4">
              {error && (
                <div className="bg-[var(--accent-error-soft)] border border-[var(--accent-error)]/30 rounded-xl p-3 text-sm text-[var(--accent-error)]">
                  {error}
                </div>
              )}

              {/* Photo gallery strip — tap a thumb to open the editor */}
              <PhotoGalleryStrip
                photos={photos}
                onEditPhoto={(i) => {
                  setSelectedPhotoIndex(i);
                  setEditingPhotoIndex(i);
                }}
                onAddPhotos={handleGallerySelect}
                maxPhotos={MAX_PHOTOS}
                onReorder={handleReorderPhotos}
                onDelete={handleRemovePhoto}
              />

              {/* Candidate selector */}
              {candidates.length > 1 && (
                <div>
                  <label className="block text-text-secondary mb-1.5" style={{ fontSize: "var(--text-caption)" }}>
                    AI Matches
                  </label>
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                    {candidates.map((c, i) => (
                      <button
                        key={i}
                        onClick={() => handleSelectCandidate(i)}
                        className={`flex-shrink-0 px-3 py-2 rounded-xl text-left transition-colors border ${
                          i === selectedCandidateIndex
                            ? "border-[var(--teal)] bg-[var(--teal-soft)]"
                            : "border-border bg-surface hover:bg-muted"
                        }`}
                      >
                        <p className="text-sm font-medium text-text-primary truncate max-w-[200px]">{c.name}</p>
                        <p className="text-xs text-text-secondary mt-0.5">
                          {Math.round(c.confidence * 100)}% match
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Reasoning collapsible */}
              {reasoning.length > 0 && (
                <button
                  onClick={() => setShowReasoning(!showReasoning)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-[var(--teal-soft)] transition-colors"
                >
                  <span className="text-sm font-medium text-[var(--teal)]">Why this identification?</span>
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round"
                    className={`transition-transform ${showReasoning ? "rotate-180" : ""}`}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
              )}
              {showReasoning && (
                <ul className="px-3 space-y-1.5">
                  {reasoning.map((r, i) => (
                    <li key={i} className="flex gap-2 text-sm text-text-secondary">
                      <span className="text-[var(--teal)] mt-0.5">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Name */}
              <div>
                <label className="block text-text-secondary mb-1" style={{ fontSize: "var(--text-caption)" }}>Item Name{nameMissing && <span className="text-[var(--accent-error)]"> *</span>}</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border text-text-primary focus:border-border-focus focus:outline-none transition-colors"
                />
              </div>

              {/* eBay Comp Price */}
              {compsError && !compsLoading && (
                <p data-testid="comps-error" className="text-xs text-[var(--accent-warning)] px-1">
                  Comps unavailable — using AI estimate only.
                </p>
              )}
              {compsLoading ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface border border-border">
                  <div className="w-4 h-4 border-2 border-[var(--teal)] border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-text-secondary">Checking eBay comps...</span>
                </div>
              ) : comps && comps.stats.sampleSize > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[var(--accent-success-soft)] border border-[var(--accent-success)]/30">
                    <span className="text-xs font-medium text-[var(--accent-success)]">eBay Comp Price</span>
                    <span className="text-sm font-semibold text-[var(--accent-success)]">
                      ${(comps.stats.soldMedian ?? comps.stats.activeMedian ?? 0).toFixed(0)}
                      <span className="text-xs font-normal text-[var(--accent-success)]/70 ml-1">
                        ({comps.stats.sampleSize} sold)
                        {demandLabel(comps.stats.sellThrough) && (
                          <span className="ml-1">
                            · {demandLabel(comps.stats.sellThrough)} demand
                          </span>
                        )}
                      </span>
                    </span>
                  </div>
                  {comps.stats.p25 != null && comps.stats.p50 != null && comps.stats.p75 != null && (
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { key: "Move it", value: comps.stats.p25, pct: "25th pct" },
                        { key: "Market", value: comps.stats.p50, pct: "median" },
                        { key: "Top dollar", value: comps.stats.p75, pct: "75th pct" },
                      ] as const).map(band => (
                        <button
                          key={band.key}
                          onClick={() => setListPrice(band.value)}
                          className={`rounded-xl px-2 py-2 text-left border transition-colors ${
                            listPrice === band.value
                              ? "border-[var(--teal)] bg-[var(--teal-soft)]"
                              : "border-border bg-surface"
                          }`}
                        >
                          <span className="block text-[11px] font-medium text-text-secondary">{band.key}</span>
                          <span className="block text-sm font-bold text-text-primary">${band.value.toFixed(0)}</span>
                          <span className="block text-[10px] text-text-secondary">{band.pct}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {/* Comp Cards */}
              {comps && (comps.sold.length > 0 || comps.active.length > 0) && (
                <div className="space-y-3">
                  {comps.sold.length > 0 && (
                    <div>
                      <h3 className="text-xs font-medium text-text-secondary mb-2">Sold ({comps.sold.length})</h3>
                      <div className="space-y-2">
                        {comps.sold.slice(0, 5).map((comp) => {
                          const isExpanded = expandedCompUrl === comp.listingUrl;
                          return (
                            <div key={comp.listingUrl} className="bg-surface border border-border rounded-xl overflow-hidden">
                              <button
                                onClick={() => setExpandedCompUrl(isExpanded ? null : comp.listingUrl)}
                                className="w-full flex items-center gap-3 p-2.5 text-left"
                              >
                                {comp.imageUrl ? (
                                  <img src={comp.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                                ) : (
                                  <div className="w-12 h-12 rounded-lg bg-muted flex-shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-text-primary truncate">{comp.title}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-xs text-text-secondary">{comp.condition}</span>
                                    {comp.soldDate && (
                                      <span className="text-xs text-text-secondary">
                                        {new Date(comp.soldDate).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <span className="text-sm font-semibold text-[var(--accent-success)] flex-shrink-0">${comp.price.toFixed(0)}</span>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`flex-shrink-0 text-text-secondary transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                                  <path d="M6 9l6 6 6-6" />
                                </svg>
                              </button>
                              {isExpanded && (
                                <div className="px-2.5 pb-2.5 space-y-2 border-t border-border pt-2">
                                  <div className="flex gap-2">
                                    <button onClick={() => setEditName(comp.title)} className="flex-1 py-2 rounded-lg bg-[var(--teal-soft)] text-[var(--teal)] text-xs font-medium">Use Title</button>
                                    <button onClick={() => chooseCondition(mapEbayCondition(comp.condition))} className="flex-1 py-2 rounded-lg bg-[var(--teal-soft)] text-[var(--teal)] text-xs font-medium">Use Condition</button>
                                  </div>
                                  <a href={comp.listingUrl} target="_blank" rel="noopener noreferrer" className="block text-center py-2 rounded-lg border border-border text-xs font-medium text-text-secondary">View on eBay</a>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {comps.active.length > 0 && (
                    <div>
                      <h3 className="text-xs font-medium text-text-secondary mb-2">Active ({comps.active.length})</h3>
                      <div className="space-y-2">
                        {comps.active.slice(0, 3).map((comp) => {
                          const isExpanded = expandedCompUrl === comp.listingUrl;
                          return (
                            <div key={comp.listingUrl} className="bg-surface border border-border rounded-xl overflow-hidden">
                              <button
                                onClick={() => setExpandedCompUrl(isExpanded ? null : comp.listingUrl)}
                                className="w-full flex items-center gap-3 p-2.5 text-left"
                              >
                                {comp.imageUrl ? (
                                  <img src={comp.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                                ) : (
                                  <div className="w-12 h-12 rounded-lg bg-muted flex-shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-text-primary truncate">{comp.title}</p>
                                  <span className="text-xs text-text-secondary">{comp.condition}</span>
                                </div>
                                <span className="text-sm font-semibold text-[var(--accent-success)] flex-shrink-0">${comp.price.toFixed(0)}</span>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`flex-shrink-0 text-text-secondary transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                                  <path d="M6 9l6 6 6-6" />
                                </svg>
                              </button>
                              {isExpanded && (
                                <div className="px-2.5 pb-2.5 space-y-2 border-t border-border pt-2">
                                  <div className="flex gap-2">
                                    <button onClick={() => setEditName(comp.title)} className="flex-1 py-2 rounded-lg bg-[var(--teal-soft)] text-[var(--teal)] text-xs font-medium">Use Title</button>
                                    <button onClick={() => chooseCondition(mapEbayCondition(comp.condition))} className="flex-1 py-2 rounded-lg bg-[var(--teal-soft)] text-[var(--teal)] text-xs font-medium">Use Condition</button>
                                  </div>
                                  <a href={comp.listingUrl} target="_blank" rel="noopener noreferrer" className="block text-center py-2 rounded-lg border border-border text-xs font-medium text-text-secondary">View on eBay</a>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Condition */}
              <div>
                <label className="block text-text-secondary mb-1" style={{ fontSize: "var(--text-caption)" }}>Condition{conditionMissing && <span className="text-[var(--accent-error)]"> *</span>}</label>
                {availableConditions.length === 0 && (
                  <p className="mb-1 text-xs text-text-secondary">
                    This eBay category uses condition grades Portage doesn&apos;t map yet — condition will be captured at listing time.
                  </p>
                )}
                {conditionNotice && (
                  <p data-testid="condition-notice" className="mb-1 text-xs text-[var(--accent-warning)]">
                    {`Condition adjusted to ${conditionLabel(conditionNotice.to)} — ${conditionLabel(conditionNotice.from)} isn't offered in this category.`}
                  </p>
                )}
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {conditionOptions.filter((opt) => availableConditions.includes(opt.value)).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => chooseCondition(opt.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                        editCondition === opt.value
                          ? "bg-[var(--teal)] text-white"
                          : "bg-muted text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Condition Notes */}
              <div>
                <label className="block text-text-secondary mb-1" style={{ fontSize: "var(--text-caption)" }}>Condition Notes</label>
                <textarea
                  value={editConditionNotes}
                  onChange={(e) => setEditConditionNotes(e.target.value)}
                  rows={5}
                  maxLength={2000}
                  placeholder="e.g. Minor scuff on left side"
                  className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border text-text-primary placeholder:text-text-placeholder focus:border-border-focus focus:outline-none transition-colors resize-none"
                />
              </div>

              {/* Packaged weight + dimensions (lb + oz; required for eBay Calculated shipping) */}
              <div>
                <label className="block text-text-secondary mb-1" style={{ fontSize: "var(--text-caption)" }}>Weight &amp; Size</label>
                <WeightDimsInputs
                  value={weightDims}
                  estimated={weightEstimated}
                  onChange={(patch) => {
                    setWeightDims((prev) => ({ ...prev, ...patch }));
                    setWeightEstimated(false);
                  }}
                />
              </div>

              {/* Category — eBay taxonomy is THE category (the old 13-value
                  internal list is deprecated). Auto-resolved from the item
                  name; the search overrides with any eBay leaf category. */}
              <div>
                <label className="block text-text-secondary mb-1" style={{ fontSize: "var(--text-caption)" }}>Category{categoryMissing && <span className="text-[var(--accent-error)]"> *</span>}</label>
                <div className="px-3 py-2.5 rounded-xl bg-surface border border-border text-text-primary text-sm">
                  {isCategoryResolving
                    ? "Resolving eBay category…"
                    : resolvedCategoryId !== null
                      ? (resolvedCategoryName ?? resolvedCategoryId)
                      : "Not matched yet — search below"}
                </div>
                {categoryMismatch && !isCategoryResolving && resolvedCategoryId !== null && (
                  <div className="mt-2 px-3 py-2.5 rounded-xl border border-[var(--accent-warning,#b45309)] bg-[color-mix(in_srgb,var(--accent-warning,#b45309)_10%,transparent)] text-sm text-text-primary">
                    <p>
                      Double-check this category — eBay filed this under{" "}
                      <strong>{resolvedCategoryName ?? resolvedCategoryId}</strong>, which doesn&apos;t
                      look like a match for what was scanned
                      {resolvedVisionCategory ? ` (${resolvedVisionCategory})` : ""}.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={dismissCategoryMismatch}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-text-primary"
                      >
                        Use anyway
                      </button>
                      <button
                        type="button"
                        onClick={() => categorySearchInputRef.current?.focus()}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-text-primary"
                      >
                        Find different category
                      </button>
                      <button
                        type="button"
                        onClick={clearCategoryResolution}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-text-primary"
                      >
                        Don&apos;t use it
                      </button>
                    </div>
                  </div>
                )}
                <div className="mt-2 flex gap-2">
                  <input
                    ref={categorySearchInputRef}
                    type="text"
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    placeholder="Search eBay categories…"
                    aria-label="Search eBay category"
                    className="flex-1 px-3 py-2 rounded-xl bg-surface border border-border text-sm text-text-primary placeholder:text-text-placeholder focus:border-border-focus focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => { if (categorySearch.trim()) void resolveCategory(categorySearch.trim()); }}
                    disabled={isCategoryResolving || categorySearch.trim() === ""}
                    className="px-3 py-2 rounded-xl text-sm font-medium bg-muted text-text-primary disabled:opacity-50"
                  >
                    Find category
                  </button>
                </div>
                {/* P3 truth split (125cbc53 / 2b8aefb1 / a5a2b944) — three
                    independent states, never one ambiguous line:
                    [1] lookup failed (any resolution state, prior one retained)
                    [2] genuinely no match
                    [3] category known, but its required-details schema failed */}
                {resolveError && !isCategoryResolving && (
                  <p data-testid="resolve-error" className="mt-1 text-xs text-[var(--accent-warning)] flex items-center gap-2">
                    <span>Category lookup failed — specifics may be skipped.</span>
                    <button type="button" onClick={() => { void resolveCategory(editName); }} className="underline font-medium">Retry lookup</button>
                  </p>
                )}
                {!isCategoryResolving && !resolveError && resolvedCategoryId === null && (
                  <p className="mt-1 text-xs text-text-secondary">
                    No eBay category matched — specifics captured at listing time.
                  </p>
                )}
                {aspectsError && !isAspectsLoading && (
                  <p data-testid="aspects-error" className="mt-1 text-xs text-[var(--accent-warning)] flex items-center gap-2">
                    <span>eBay category details unavailable — required specifics can&apos;t be checked.</span>
                    <button type="button" onClick={refetchAspects} className="underline font-medium">Retry</button>
                  </p>
                )}
              </div>

              {/* eBay item specifics (required aspects), captured at scan time */}
              <ScanAspectsSection
                aspects={aspects}
                aspectValues={aspectValues}
                setAspectValue={setAspectValue}
                suggestions={suggestions}
                aiFilledNames={aiFilledNames}
                confirmSuggestion={confirmSuggestion}
                missingRequired={missingRequired}
                isCategoryResolving={isCategoryResolving}
                isAspectsLoading={isAspectsLoading}
                categoryResolved={resolvedCategoryId !== null}
                aspectsError={aspectsError}
              />

              {/* Brand & Model */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-secondary mb-1" style={{ fontSize: "var(--text-caption)" }}>Brand</label>
                  <input
                    type="text"
                    value={editBrand}
                    onChange={(e) => setEditBrand(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border text-text-primary focus:border-border-focus focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-text-secondary mb-1" style={{ fontSize: "var(--text-caption)" }}>Model</label>
                  <input
                    type="text"
                    value={editModel}
                    onChange={(e) => setEditModel(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border text-text-primary focus:border-border-focus focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-text-secondary mb-1" style={{ fontSize: "var(--text-caption)" }}>Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={5}
                  className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border text-text-primary resize-y min-h-[7rem] focus:border-border-focus focus:outline-none transition-colors"
                />
              </div>

              {/* eBay shipping ride-along (beta 17be7322): set here, seeds the
                  publish sheet as touched. idPrefix keeps ids unique once the
                  sheet (which renders the same section) is open. */}
              <ShippingFieldsSection
                idPrefix="scan-"
                value={reviewShipping}
                onChange={(v) => { setReviewShippingTouched(true); setReviewShipping(v); }}
              />
            </div>
          </div>

          {/* Fixed bottom: editable price + Rescan + Save + List (extracted).
              Hidden once the publish-confirm sheet is up (below) — both are
              fixed-bottom bars and this one's higher z-index otherwise covers
              the sheet's own Cancel/Publish buttons. */}
          {!publishItemId && (
            <ScanReviewActions
              price={reviewPrice}
              onPriceChange={setListPrice}
              quantity={editQuantity}
              onQuantityChange={setEditQuantity}
              onRescan={handleRescan}
              onSave={handleSave}
              onSaveAndList={handleSaveAndList}
              isSaving={isSaving}
              isListing={isListingForSale}
              canSave={requiredComplete}
              saveDisabledReason={saveDisabledReason}
              priceRequired={priceMissing}
              canList={!aspectsBlockPublish}
              listDisabledReason={
                aspectsBlockPublish
                  ? missingRequired.length > 0
                    ? `Complete ${missingRequired.length} required eBay detail${missingRequired.length === 1 ? "" : "s"} first`
                    : aspectsError
                      ? "eBay category details unavailable — retry before listing"
                      : "Checking eBay requirements…"
                  : null
              }
            />
          )}
        </div>
      )}

      {/* F1: unified publish-confirm sheet, opened after Save & List creates the
          item — seeded with the scan's price/category/aspects + draft/live choice. */}
      {publishItemId && (
        <CreateListingSheet
          itemId={publishItemId}
          suggestedPrice={reviewPrice ?? undefined}
          priceSource={reviewPriceSource ?? undefined}
          categoryId={resolvedCategoryId ?? undefined}
          initialAspects={buildAspects()}
          initialEbayDraft={publishEbayDraft}
          initialShipping={reviewShippingTouched ? reviewShipping : undefined}
          initialPublishNow={publishNowSeed}
          onCreated={() => { setPublishItemId(null); onClose(); }}
          onClose={() => setPublishItemId(null)}
        />
      )}

      {/* ─── SAVING STATE ──────────────────────────────────────────────── */}
      {state === "saving" && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-3 border-[var(--teal)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-text-primary font-semibold">Saving to inventory...</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tool Button ─────────────────────────────────────────────────────────────


