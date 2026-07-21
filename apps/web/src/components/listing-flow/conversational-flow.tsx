"use client";

import { MAX_PHOTOS_PER_ITEM } from "@portage/shared";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useListingFlow, type PublishOptions as PublishOpts } from "@/hooks/use-listing-flow";
import { formatPrice, formatCondition } from "@/lib/format";
import { ebayEstimateToWeightDims } from "@/lib/weight";
import { FeeEstimate } from "./fee-estimate";
import { PublishSuccess } from "./publish-success";
import { PhotoCaptureOverlay } from "./photo-capture-overlay";
import { ListingPreviewCard } from "../listing/listing-preview-card";
import { PhotoGalleryStrip } from "../capture/photo-gallery-strip";
import { PhotoEditOverlay } from "../capture/photo-edit-overlay";
import { usePhotoEdit } from "@/hooks/use-photo-edit";
import { WeightDimsInputs, type WeightDimsChange } from "../listing/weight-dims-inputs";
import { AspectFillSheet, type AspectRequirement } from "../listing/aspect-fill-sheet";
import { WeightFillSheet } from "../listing/weight-fill-sheet";
import { usePrepareListing } from "@/hooks/use-prepare-listing";
import type { ListingFlowState } from "@portage/shared";

// ─── Types ───────────────────────────────────────────────────────────────────

type PillVariant = "primary" | "outline";

interface Pill {
  label: string;
  action: () => void;
  variant?: PillVariant;
}

interface FlowMessage {
  id: string;
  role: "porter" | "user";
  content: string;
  pills?: Pill[];
  card?: React.ReactNode;
}

export interface ConversationalFlowProps {
  itemId?: string;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 mb-3">
      <PorterAvatar />
      <div
        className="flex items-center gap-1.5 px-4 py-3"
        style={{
          background: "#F0EDE6",
          borderRadius: "18px 18px 18px 4px",
          minHeight: "44px",
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="block w-2 h-2 rounded-full"
            style={{
              background: "#2D5A27",
              opacity: 0.5,
              animation: `porterBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function PorterAvatar() {
  return (
    <div
      className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold"
      style={{ background: "#2D5A27", fontFamily: "'DM Serif Display', Georgia, serif" }}
    >
      P
    </div>
  );
}

function PorterBubble({
  message,
  showTyping,
  onPillClick,
}: {
  message: FlowMessage;
  showTyping: boolean;
  onPillClick?: (pill: Pill) => void;
}) {
  const activePills = message.pills?.filter((p) => p.variant === "primary") ?? [];
  const outlinePills = message.pills?.filter((p) => p.variant !== "primary") ?? [];
  const allPills = [...activePills, ...outlinePills];

  return (
    <div className="flex items-end gap-2 mb-3">
      <PorterAvatar />
      <div className="flex flex-col gap-2 max-w-[75%]">
        {showTyping ? (
          <TypingIndicator />
        ) : (
          <div
            className="px-4 py-3 text-[13px] leading-relaxed"
            style={{
              background: "#F0EDE6",
              borderRadius: "18px 18px 18px 4px",
              color: "#1A1A1A",
            }}
          >
            <FormatBold text={message.content} />
          </div>
        )}
        {message.card && !showTyping && (
          <div className="mt-1">{message.card}</div>
        )}
        {allPills.length > 0 && !showTyping && (
          <div className="flex flex-wrap gap-2 mt-1">
            {allPills.map((pill) => (
              <button
                key={pill.label}
                onClick={() => onPillClick?.(pill)}
                className="px-3 py-1.5 text-[11px] font-medium transition-all active:scale-[0.95]"
                style={
                  pill.variant === "primary"
                    ? {
                        background: "#2D5A27",
                        color: "#fff",
                        borderRadius: "20px",
                        border: "1px solid #2D5A27",
                        letterSpacing: "0.01em",
                      }
                    : {
                        background: "#fff",
                        color: "#2D5A27",
                        borderRadius: "20px",
                        border: "1px solid #D4D0C8",
                        letterSpacing: "0.01em",
                      }
                }
              >
                {pill.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end mb-3">
      <div
        className="px-4 py-3 text-[13px] leading-relaxed max-w-[75%]"
        style={{
          background: "#2D5A27",
          borderRadius: "18px 18px 4px 18px",
          color: "#fff",
        }}
      >
        {content}
      </div>
    </div>
  );
}

function InlineInput({
  label,
  value,
  multiline,
  onSave,
  onCancel,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  onSave: (v: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(value);

  const handleKey = (e: React.KeyboardEvent) => {
    if (!multiline && e.key === "Enter") {
      e.preventDefault();
      onSave(draft);
    }
    if (e.key === "Escape") onCancel();
  };

  return (
    <div
      className="p-3 rounded-2xl"
      style={{ background: "#F0EDE6", border: "1px solid #E8E5DE" }}
    >
      <p
        className="text-[10px] uppercase font-mono mb-2"
        style={{ color: "#2D5A27", letterSpacing: "0.05em" }}
      >
        {label}
      </p>
      {multiline ? (
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          rows={4}
          className="w-full bg-transparent text-[13px] leading-relaxed resize-none focus:outline-none"
          style={{ color: "#1A1A1A" }}
        />
      ) : (
        <input
          autoFocus
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          className="w-full bg-transparent text-[13px] leading-relaxed focus:outline-none"
          style={{ color: "#1A1A1A" }}
        />
      )}
      <div className="flex gap-2 mt-2 justify-end">
        <button
          onClick={onCancel}
          className="text-[12px] px-3 py-1 rounded-full border"
          style={{ color: "#1A1A1A", borderColor: "#D4D0C8", opacity: 0.6 }}
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(draft)}
          className="text-[12px] px-3 py-1 rounded-full text-white"
          style={{ background: "#2D5A27" }}
        >
          Save
        </button>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function FormatBold({ text }: { text: string }) {
  const parts = text.split(/(\*\*.+?\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        const bold = part.match(/^\*\*(.+)\*\*$/);
        return bold ? <strong key={i}>{bold[1]}</strong> : part;
      })}
    </>
  );
}


function shippingLabel(method: string, size: string): string {
  const sizeMap: Record<string, string> = {
    small: "Small box / envelope",
    medium: "Standard box",
    large: "Large box",
    custom: "Custom dimensions",
  };
  const methodMap: Record<string, string> = {
    calculated: "Calculated at checkout",
    flat: "Flat rate",
    free: "Free shipping",
  };
  return `${sizeMap[size] ?? size} · ${methodMap[method] ?? method}`;
}


// ─── Message derivation ───────────────────────────────────────────────────────

function deriveMessages(
  state: ListingFlowState,
  lastStep: string,
  handlers: {
    onConfirmRecognition: (i: number) => void;
    onDenyRecognition: () => void;
    onApplyStrategy: (s: "fast" | "market" | "max") => void;
    onEditTitle: () => void;
    onEditDescription: () => void;
    onSetShippingSize: (s: string) => void;
    onSetShippingMethod: (m: string) => void;
    onWeightDimsChange: WeightDimsChange;
    onSetMarketplace: (m: "ebay" | "reverb") => void;
    onPublish: () => void;
    onConfirmDetails: () => void;
    onConfirmShipping: () => void;
    onAddPhoto: () => void;
    onEditPhoto: (index: number) => void;
    onReorderPhotos: (from: number, to: number) => void;
    onReorderEnd: () => void;
    onDeletePhoto: (index: number) => void;
  }
): FlowMessage[] {
  const msgs: FlowMessage[] = [];

  const candidate = state.recognition.candidates[state.recognition.selectedIndex];
  const hasConfirmed = lastStep === "confirmed" || lastStep === "pricing" || lastStep === "details" || lastStep === "shipping" || lastStep === "review" || lastStep === "published";

  // 1. Idle / intro
  msgs.push({
    id: "intro",
    role: "porter",
    content: "Hey! I'm Porter, your listing assistant. Take a photo of your item and I'll do the rest.",
  });

  if (state.recognition.status === "idle" && lastStep === "idle") {
    msgs[0].pills = [
      { label: "Add a photo", action: handlers.onAddPhoto, variant: "primary" as PillVariant },
    ];
    return msgs;
  }

  // 2. Recognizing
  if (state.recognition.status === "recognizing") {
    msgs.push({
      id: "recognizing",
      role: "porter",
      content: "...",
    });
    return msgs;
  }

  // 3. Recognition failed
  if (state.recognition.status === "failed") {
    msgs.push({
      id: "recog-failed",
      role: "porter",
      content: "Hmm, I couldn't quite make that out. Want to try another photo?",
      pills: [
        { label: "Try again", action: handlers.onAddPhoto, variant: "primary" as PillVariant },
      ],
    });
    return msgs;
  }

  // 4. Recognition complete
  if (state.recognition.status === "complete" && candidate) {
    const conf = Math.round(state.recognition.confidence * 100);
    const priceRange =
      candidate.estimatedValueLow && candidate.estimatedValueHigh
        ? ` I'd estimate it's worth **$${candidate.estimatedValueLow}–$${candidate.estimatedValueHigh}**.`
        : "";

    const reasoningBullets =
      state.recognition.reasoning.length > 0
        ? `<ul style="margin-top:6px;padding-left:16px;opacity:0.7;font-size:12px">${state.recognition.reasoning
            .slice(0, 3)
            .map((r) => `<li>${r}</li>`)
            .join("")}</ul>`
        : "";

    msgs.push({
      id: "recognition",
      role: "porter",
      content: `Got it! This looks like a **${candidate.name}**${candidate.brand ? ` by **${candidate.brand}**` : ""}. Condition: **${formatCondition(candidate.condition)}**.${priceRange} (${conf}% confidence)${reasoningBullets}`,
      pills: !hasConfirmed
        ? [
            {
              label: "Looks right ✓",
              action: () => handlers.onConfirmRecognition(state.recognition.selectedIndex),
              variant: "primary",
            },
            {
              label: "Not quite",
              action: handlers.onDenyRecognition,
              variant: "outline",
            },
          ]
        : undefined,
    });
  }

  if (state.recognition.status === "complete" && !candidate && lastStep === "details") {
    // Came in from startFromItem — skip recognition display
  }

  if (!hasConfirmed && state.recognition.status === "complete") {
    return msgs;
  }

  // 5. User confirmed
  msgs.push({
    id: "user-confirmed",
    role: "user",
    content: "Looks right ✓",
  });

  // 6. Comps / pricing bridge
  const hasComps = state.compsStatus === "loaded" && state.comps?.stats.soldMedian;
  const compMin = state.comps?.stats.soldMedian
    ? formatPrice(Math.round(state.comps.stats.soldMedian * 0.85))
    : null;
  const compMax = state.comps?.stats.soldMedian
    ? formatPrice(Math.round(state.comps.stats.soldMedian * 1.2))
    : null;

  const pricingReached =
    lastStep === "pricing" || lastStep === "details" || lastStep === "shipping" || lastStep === "review" || lastStep === "published";

  if (hasComps && compMin && compMax) {
    msgs.push({
      id: "comps-found",
      role: "porter",
      content: `Nice! Similar items have sold for **${compMin}–${compMax}** recently. Where do you want to price yours?`,
      pills: !pricingReached
        ? [
            {
              label: `${compMin} · Sell fast`,
              action: () => handlers.onApplyStrategy("fast"),
              variant: "outline",
            },
            {
              label: `${formatPrice(state.comps?.stats.soldMedian ?? null)} · Market`,
              action: () => handlers.onApplyStrategy("market"),
              variant: "primary",
            },
            {
              label: `${compMax} · Max`,
              action: () => handlers.onApplyStrategy("max"),
              variant: "outline",
            },
          ]
        : undefined,
    });
  } else if (state.compsStatus === "loading") {
    msgs.push({
      id: "comps-loading",
      role: "porter",
      content: "Let me check what similar items have sold for...",
    });
    return msgs;
  } else {
    // No comps — ask for price directly
    msgs.push({
      id: "comps-none",
      role: "porter",
      content: "I didn't find recent comps, but no worries — where do you want to price this?",
      pills: !pricingReached
        ? [
            {
              label: "Set a price",
              action: () => handlers.onApplyStrategy("market"),
              variant: "primary",
            },
          ]
        : undefined,
    });
  }

  if (!pricingReached) return msgs;

  // 7. User picks price
  const strategyLabel: Record<string, string> = {
    fast: "Sell fast",
    market: "Market price",
    max: "Max out",
    custom: "Custom",
  };
  msgs.push({
    id: "user-price",
    role: "user",
    content: `${formatPrice(state.price)} · ${strategyLabel[state.pricingStrategy] ?? state.pricingStrategy}`,
  });

  // 8. Details
  const detailsReached =
    lastStep === "details" || lastStep === "shipping" || lastStep === "review" || lastStep === "published";

  msgs.push({
    id: "pricing-done",
    role: "porter",
    content: "Good choice. Want to tweak anything before we set up shipping?",
    pills: !detailsReached
      ? [
          { label: "Edit title", action: handlers.onEditTitle, variant: "outline" },
          { label: "Edit description", action: handlers.onEditDescription, variant: "outline" },
          { label: "Looks good →", action: handlers.onConfirmDetails, variant: "primary" },
        ]
      : undefined,
  });

  if (!detailsReached) return msgs;

  // 9. User confirmed details
  msgs.push({
    id: "user-details",
    role: "user",
    content: "Looks good →",
  });

  // 10. Shipping
  const shippingReached =
    lastStep === "shipping" || lastStep === "review" || lastStep === "published";

  msgs.push({
    id: "shipping-q",
    role: "porter",
    content: "How should we ship this? Pick a package size, then a method.",
    card: !shippingReached ? (
      <div className="rounded-2xl p-4" style={{ background: "#FAF8F5", border: "1px solid #E8E5DE" }}>
        <WeightDimsInputs
          value={{
            weight: state.weight,
            dimLength: state.dimLength,
            dimWidth: state.dimWidth,
            dimHeight: state.dimHeight,
            ebayPackageType: state.ebayPackageType,
          }}
          onChange={handlers.onWeightDimsChange}
          estimated={state.weightEstimated}
        />
      </div>
    ) : undefined,
    pills: !shippingReached
      ? [
          { label: "Small", action: () => handlers.onSetShippingSize("small"), variant: state.packageSize === "small" ? "primary" : "outline" },
          { label: "Medium", action: () => handlers.onSetShippingSize("medium"), variant: state.packageSize === "medium" ? "primary" : "outline" },
          { label: "Large", action: () => handlers.onSetShippingSize("large"), variant: state.packageSize === "large" ? "primary" : "outline" },
          { label: "Calculated", action: () => handlers.onSetShippingMethod("calculated"), variant: state.shippingMethod === "calculated" ? "primary" : "outline" },
          { label: "Flat rate", action: () => handlers.onSetShippingMethod("flat"), variant: state.shippingMethod === "flat" ? "primary" : "outline" },
          { label: "Free shipping", action: () => handlers.onSetShippingMethod("free"), variant: state.shippingMethod === "free" ? "primary" : "outline" },
          { label: "That works →", action: handlers.onConfirmShipping, variant: "primary" },
        ]
      : undefined,
  });

  if (!shippingReached) return msgs;

  // 11. User shipping choice
  msgs.push({
    id: "user-shipping",
    role: "user",
    content: shippingLabel(state.shippingMethod, state.packageSize),
  });

  // 12. Review
  const reviewReached = lastStep === "review" || lastStep === "published";

  if (state.price !== null) {
    msgs.push({
      id: "review",
      role: "porter",
      content: `Here's your listing — looking good. Ready to publish on **${state.marketplace === "ebay" ? "eBay" : "Reverb"}**?`,
      card: (
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #f0ede6 0%, #FAF8F5 100%)",
            border: "1px solid #E8E5DE",
          }}
        >
          {state.photos[0]?.url && (
            <div className="w-full h-36 overflow-hidden bg-black/5">
              <img
                src={state.photos[0].url}
                alt={state.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          {state.photos.length > 0 && (
            <div className="px-3 pt-3">
              <PhotoGalleryStrip
                photos={state.photos.map((p) => ({ key: p.key, url: p.url, editable: !p.url.startsWith("blob:") }))}
                onEditPhoto={handlers.onEditPhoto}
                onReorder={handlers.onReorderPhotos}
                onReorderEnd={handlers.onReorderEnd}
                onDelete={handlers.onDeletePhoto}
                maxPhotos={MAX_PHOTOS_PER_ITEM}
              />
            </div>
          )}
          <div className="p-4">
            <p
              className="text-[11px] uppercase font-mono mb-1"
              style={{ color: "#2D5A27", letterSpacing: "0.05em" }}
            >
              {state.marketplace}
            </p>
            <p className="font-semibold text-[14px] mb-0.5" style={{ color: "#1A1A1A" }}>
              {state.title || "Untitled listing"}
            </p>
            <p className="text-[20px] font-bold mb-3" style={{ color: "#2D5A27" }}>
              {formatPrice(state.price)}
            </p>
            <FeeEstimate price={state.price} marketplace={state.marketplace} />
          </div>
        </div>
      ),
      pills: !reviewReached
        ? [
            { label: "eBay", action: () => handlers.onSetMarketplace("ebay"), variant: state.marketplace === "ebay" ? "primary" : "outline" },
            { label: "Reverb", action: () => handlers.onSetMarketplace("reverb"), variant: state.marketplace === "reverb" ? "primary" : "outline" },
            { label: "🚀 Publish", action: handlers.onPublish, variant: "primary" },
          ]
        : undefined,
    });
  }

  return msgs;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ConversationalFlow({ itemId }: ConversationalFlowProps) {
  const flow = useListingFlow();
  const prepareListing = usePrepareListing();
  const { state, lastStep } = flow;
  const photoEdit = usePhotoEdit(state.photos, flow.updatePhoto);

  const scrollRef = useRef<HTMLDivElement>(null);

  // All state declarations first
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  // Inline edit state: null = not editing, 'title' | 'description'
  const [editing, setEditing] = useState<"title" | "description" | null>(null);
  // Local step advancement flags (hook's lastStep only advances on hook-driven actions)
  const [detailsConfirmed, setDetailsConfirmed] = useState(false);
  const [shippingConfirmed, setShippingConfirmed] = useState(false);
  const [showCapture, setShowCapture] = useState(false);

  // Kick off startFromItem if itemId is provided
  useEffect(() => {
    if (itemId && lastStep === "idle") {
      flow.startFromItem(itemId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lastStep, state.recognition.status, state.compsStatus, state.publishStatus, isPublishing]);

  // Pre-fill weight/dims from the AI estimate (guarded — never clobbers a weight
  // the seller already entered).
  useEffect(() => {
    const ebay = prepareListing.data?.ebay;
    if (ebay) flow.applyEstimatedWeightDims(ebayEstimateToWeightDims(ebay));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepareListing.data]);

  // ── handlers ──

  const handleConfirmRecognition = useCallback(
    (i: number) => {
      flow.confirmRecognition(i);
      flow.fetchComps();
      // Fresh scans have no inventoryItemId yet — create the item now so
      // prepare() (AI fields + comps pricing + preview card) runs on every
      // path, not just start-from-item. Creation failure degrades to the old
      // manual flow; prepare failures surface via prepareListing.error.
      void flow.ensureItemCreated()
        .then((id) => { if (id) prepareListing.prepare(id, ['ebay']); })
        .catch(() => {});
    },
    [flow, prepareListing]
  );

  const handleDenyRecognition = useCallback(() => {
    flow.reset();
  }, [flow]);

  const handleApplyStrategy = useCallback(
    (s: "fast" | "market" | "max") => {
      flow.applyPricingStrategy(s);
    },
    [flow]
  );

  const handleConfirmDetails = useCallback(() => {
    setDetailsConfirmed(true);
  }, []);

  const handleSetShippingSize = useCallback(
    (s: string) => {
      flow.setField("packageSize", s as ListingFlowState["packageSize"]);
    },
    [flow]
  );

  const handleSetShippingMethod = useCallback(
    (m: string) => {
      flow.setField("shippingMethod", m as ListingFlowState["shippingMethod"]);
    },
    [flow]
  );

  const handleSetMarketplace = useCallback(
    (m: "ebay" | "reverb") => {
      flow.setField("marketplace", m);
    },
    [flow]
  );

  const handleConfirmShipping = useCallback(() => {
    setShippingConfirmed(true);
  }, []);

  const [aspectsNeeded, setAspectsNeeded] = useState<AspectRequirement[] | null>(null);
  const [aspectSaving, setAspectSaving] = useState(false);
  const [aspectError, setAspectError] = useState<string | null>(null);
  const [weightNeeded, setWeightNeeded] = useState(false);
  const [weightSaving, setWeightSaving] = useState(false);
  const [weightError, setWeightError] = useState<string | null>(null);
  const [pendingPublishOpts, setPendingPublishOpts] = useState<PublishOpts | undefined>(undefined);

  const runPublish = useCallback(async (opts?: PublishOpts) => {
    const fillingAspects = !!opts?.aspects;
    const fillingWeight = !!opts?.weightDims;
    setPublishError(null);
    setAspectError(null);
    setWeightError(null);
    if (fillingAspects) setAspectSaving(true);
    else if (fillingWeight) setWeightSaving(true);
    else setIsPublishing(true);

    const result = await flow.publish(opts);

    if (fillingAspects) setAspectSaving(false);
    else if (fillingWeight) setWeightSaving(false);
    else setIsPublishing(false);

    if (result.success) {
      setAspectsNeeded(null);
      setWeightNeeded(false);
    } else if (result.aspectsRequired) {
      setPendingPublishOpts(opts);
      setAspectsNeeded(result.aspectsRequired);
      if (fillingAspects) setAspectError("eBay needs a few more details to publish.");
    } else if (result.weightRequired) {
      setPendingPublishOpts(opts);
      setWeightNeeded(true);
      if (fillingWeight) setWeightError("Add the package weight and dimensions to continue.");
    } else if (fillingAspects) {
      setAspectError(result.error ?? "Publishing failed");
    } else if (fillingWeight) {
      setWeightError(result.error ?? "Publishing failed");
    } else {
      setPublishError(result.error ?? "Publishing failed");
    }
  }, [flow]);

  // Chat "Publish" pill (primary CTA) + Review fallback. Pass eBay prepared
  // fields + publishMode so they aren't dropped on this path; no draft/live
  // toggle here, so live is the intended mode (matches prior behavior).
  const handlePublish = useCallback(
    () => runPublish({ ebayPreparedFields: prepareListing.data?.ebay ?? null, publishMode: "live" }),
    [runPublish, prepareListing.data],
  );

  // Derive the effective lastStep (merging hook's lastStep with local flags)
  const effectiveLastStep = useMemo(() => {
    if (state.publishStatus === "published") return "published";
    if (state.publishStatus === "publishing") return "review";
    if (shippingConfirmed) return "review";
    if (detailsConfirmed) return "shipping";
    return lastStep;
  }, [lastStep, detailsConfirmed, shippingConfirmed, state.publishStatus]);

  // Build messages
  const messages = useMemo(
    () =>
      deriveMessages(state, effectiveLastStep, {
        onConfirmRecognition: handleConfirmRecognition,
        onDenyRecognition: handleDenyRecognition,
        onApplyStrategy: handleApplyStrategy,
        onEditTitle: () => setEditing("title"),
        onEditDescription: () => setEditing("description"),
        onConfirmDetails: handleConfirmDetails,
        onSetShippingSize: handleSetShippingSize,
        onSetShippingMethod: handleSetShippingMethod,
        onWeightDimsChange: flow.updateWeightDims,
        onSetMarketplace: handleSetMarketplace,
        onPublish: handlePublish,
        onConfirmShipping: handleConfirmShipping,
        onAddPhoto: () => setShowCapture(true),
        // Blob (still-uploading) photos render without an edit affordance in
        // the strip, so this only fires for editable photos.
        onEditPhoto: photoEdit.openEditor,
        onReorderPhotos: flow.reorderPhotos,
        onReorderEnd: flow.commitPhotoOrder,
        onDeletePhoto: flow.removePhoto,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, effectiveLastStep]
  );

  // Show typing indicator when recognizing
  const showTypingForId = state.recognition.status === "recognizing" ? "recognizing" : null;

  const handlePillClick = useCallback((pill: Pill) => {
    pill.action();
  }, []);

  // Published state
  if (state.publishStatus === "published" && state.listingId) {
    return (
      <div
        className="flex flex-col h-full"
        style={
          {
            background: "#FAF8F5",
            "--flow-bg": "#FAF8F5",
            "--flow-text": "#1A1A1A",
            "--flow-accent": "#2D5A27",
          } as React.CSSProperties
        }
      >
        <ChatHeader />
        <div className="flex-1 overflow-auto">
          <PublishSuccess
            listingId={state.listingId}
            itemId={state.inventoryItemId}
            warning={state.publishWarning ?? undefined}
            marketplace={state.marketplace}
            title={state.title}
            price={state.price ?? 0}
            photoUrl={state.photos[0]?.url ?? null}
            isFirstListing={false}
            onListAnother={flow.reset}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full"
      style={
        {
          background: "#FAF8F5",
          "--flow-bg": "#FAF8F5",
          "--flow-text": "#1A1A1A",
          "--flow-accent": "#2D5A27",
        } as React.CSSProperties
      }
    >
      {/* Bounce keyframe injection */}
      <style>{`
        @keyframes porterBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>

      <ChatHeader />

      {/* Message list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4"
        style={{ scrollBehavior: "smooth" }}
      >
        {messages.map((msg) => {
          if (msg.role === "porter") {
            const isTypingMsg = msg.id === "recognizing";
            return (
              <PorterBubble
                key={msg.id}
                message={msg}
                showTyping={isTypingMsg && showTypingForId === "recognizing"}
                onPillClick={handlePillClick}
              />
            );
          }
          return <UserBubble key={msg.id} content={msg.content} />;
        })}

        {/* Prepared listing preview */}
        {prepareListing.isLoading && (
          <div className="flex items-end gap-2 mb-3">
            <PorterAvatar />
            <div
              className="px-4 py-3 text-[13px] italic"
              style={{
                background: "#F0EDE6",
                borderRadius: "18px 18px 18px 4px",
                color: "#1A1A1A",
                opacity: 0.7,
              }}
            >
              Preparing your optimized listing...
            </div>
          </div>
        )}

        {/* Prepare failed: the item is already saved (confirm-time creation),
            so surface the failure and offer a retry instead of a silent stall. */}
        {prepareListing.error && !prepareListing.data && !prepareListing.isLoading && (
          <div className="flex items-end gap-2 mb-3">
            <PorterAvatar />
            <div
              className="px-4 py-3 text-[13px]"
              style={{
                background: "#F0EDE6",
                borderRadius: "18px 18px 18px 4px",
                color: "#1A1A1A",
              }}
            >
              <p className="mb-2">I couldn&apos;t prepare the listing automatically — your item is saved, and you can keep going manually.</p>
              <button
                type="button"
                onClick={() => {
                  void flow.ensureItemCreated()
                    .then((id) => { if (id) prepareListing.prepare(id, ['ebay']); })
                    .catch(() => {});
                }}
                className="px-4 py-1.5 rounded-full text-[13px] font-semibold text-white"
                style={{ background: "#2D5A27" }}
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {prepareListing.data && (
          <div className="mb-3">
            <div className="flex items-end gap-2 mb-2">
              <PorterAvatar />
              <div
                className="px-4 py-3 text-[13px] leading-relaxed max-w-[75%]"
                style={{
                  background: "#F0EDE6",
                  borderRadius: "18px 18px 18px 4px",
                  color: "#1A1A1A",
                }}
              >
                Here&apos;s your optimized listing. Tap any field to edit.
              </div>
            </div>
            <div className="ml-9">
              <ListingPreviewCard
                data={prepareListing.data}
                photos={state.photos}
                quantity={state.quantity}
                onFieldChange={(field, value) => flow.setField(field as keyof typeof state, value as never)}
                onPriceChange={(price) => flow.setField("price", price)}
                onQuantityChange={(q) => flow.setField("quantity", q)}
                onPublish={(marketplace, publishMode, aspects, reverbCategoryUuid) => {
                  flow.setField("marketplace", marketplace);
                  runPublish({ ebayPreparedFields: prepareListing.data?.ebay ?? null, publishMode, aspects, reverbCategoryUuid });
                }}
                isPublishing={state.publishStatus === "publishing"}
                sellerProfileComplete={!prepareListing.data.warnings.some(w => w.includes("Seller profile incomplete"))}
                onPhotoUpdated={flow.updatePhoto}
              />
            </div>
          </div>
        )}

        {/* Publishing indicator */}
        {isPublishing && (
          <div className="flex items-end gap-2 mb-3">
            <PorterAvatar />
            <div
              className="px-4 py-3 text-[13px] italic"
              style={{
                background: "#F0EDE6",
                borderRadius: "18px 18px 18px 4px",
                color: "#1A1A1A",
                opacity: 0.7,
              }}
            >
              Publishing your listing...
            </div>
          </div>
        )}

        {/* Publish error */}
        {publishError && (
          <div className="flex items-end gap-2 mb-3">
            <PorterAvatar />
            <div
              className="px-4 py-3 text-[13px]"
              style={{
                background: "#F0EDE6",
                borderRadius: "18px 18px 18px 4px",
                color: "#c0392b",
              }}
            >
              {`Oops — ${publishError}. Want to try again?`}
              <div className="mt-2">
                <button
                  onClick={handlePublish}
                  className="text-[11px] font-medium px-3 py-1 rounded-full text-white"
                  style={{ background: "#2D5A27" }}
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="h-4" />
      </div>

      {/* Inline edit overlay at bottom */}
      {editing && (
        <div
          className="px-4 pb-4 pt-2"
          style={{ borderTop: "1px solid #E8E5DE", background: "#FAF8F5" }}
        >
          <InlineInput
            label={editing === "title" ? "Edit title" : "Edit description"}
            value={editing === "title" ? state.title : state.description}
            multiline={editing === "description"}
            onSave={(v) => {
              flow.setField(editing, v);
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}

      <PhotoCaptureOverlay
        show={showCapture}
        onPhotos={(photos) => flow.startFromPhoto(photos)}
        onCancel={() => setShowCapture(false)}
      />

      <PhotoEditOverlay photoEdit={photoEdit} photoCount={state.photos.length} alt={state.title || "Photo preview"} />

      {aspectsNeeded && (
        <AspectFillSheet
          missing={aspectsNeeded}
          initial={{
            ...(state.brand ? { Brand: [state.brand] } : {}),
            ...(state.model ? { Model: [state.model] } : {}),
          }}
          saving={aspectSaving}
          error={aspectError}
          onCancel={() => {
            setAspectsNeeded(null);
            setAspectError(null);
          }}
          onSave={(aspects) => runPublish({ ...pendingPublishOpts, aspects })}
        />
      )}

      {weightNeeded && (
        <WeightFillSheet
          initial={{
            weight: state.weight,
            dimLength: state.dimLength,
            dimWidth: state.dimWidth,
            dimHeight: state.dimHeight,
            ebayPackageType: state.ebayPackageType,
          }}
          saving={weightSaving}
          error={weightError}
          onCancel={() => {
            setWeightNeeded(false);
            setWeightError(null);
          }}
          onSave={(value) => runPublish({ ...pendingPublishOpts, weightDims: value })}
        />
      )}
    </div>
  );
}

// ─── Chat header ─────────────────────────────────────────────────────────────

function ChatHeader() {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
      style={{
        background: "linear-gradient(135deg, #f0ede6 0%, #FAF8F5 100%)",
        borderBottom: "1px solid #E8E5DE",
      }}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-[15px]"
        style={{
          background: "#2D5A27",
          fontFamily: "'DM Serif Display', Georgia, serif",
          boxShadow: "0 2px 8px rgba(45,90,39,0.25)",
        }}
      >
        P
      </div>
      <div>
        <p
          className="text-[15px] font-semibold leading-none"
          style={{
            color: "#1A1A1A",
            fontFamily: "'DM Serif Display', Georgia, serif",
          }}
        >
          Porter
        </p>
        <p
          className="text-[10px] uppercase font-mono mt-0.5"
          style={{ color: "#2D5A27", letterSpacing: "0.05em" }}
        >
          Listing Assistant
        </p>
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ background: "#2D5A27" }}
        />
        <span className="text-[11px]" style={{ color: "#2D5A27", opacity: 0.7 }}>
          Online
        </span>
      </div>
    </div>
  );
}
