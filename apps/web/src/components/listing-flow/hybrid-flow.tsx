"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useListingFlow } from "@/hooks/use-listing-flow";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { formatPrice } from "@/lib/format";
import { FeeEstimate } from "./fee-estimate";
import { PublishSuccess } from "./publish-success";
import { ListingPreviewCard } from "../listing/listing-preview-card";
import { AspectFillSheet, type AspectRequirement } from "../listing/aspect-fill-sheet";
import type { EbayPreparedFields } from "@portage/shared";
import { usePrepareListing } from "@/hooks/use-prepare-listing";
import { ShippingConfigCard } from "./shipping-config-card";
import { PricingStrategyPicker } from "./pricing-strategy-picker";
import { PhotoCaptureOverlay } from "./photo-capture-overlay";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface HybridFlowProps {
  itemId?: string;
}

type Marketplace = "ebay" | "etsy" | "reverb";

// ─── Design tokens ─────────────────────────────────────────────────────────

const BG = "#F5F3EF";
const TEXT = "#18191C";
const ACCENT = "#0047AB";
const SECONDARY = "#666";
const CARD_BG = "#FFFFFF";
const CARD_BORDER = "#E8E5DE";

// ─── Porter Avatar ──────────────────────────────────────────────────────────

function PorterAvatar() {
  return (
    <div
      style={{
        width: 24,
        height: 24,
        borderRadius: 6,
        background: ACCENT,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span
        style={{
          color: "#fff",
          fontSize: 11,
          fontWeight: 700,
          lineHeight: 1,
          fontFamily: "monospace",
        }}
      >
        P
      </span>
    </div>
  );
}

// ─── Porter message row ─────────────────────────────────────────────────────

function PorterMessage({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <PorterAvatar />
      <div style={{ fontSize: 13, color: TEXT, lineHeight: "1.55", paddingTop: 3 }}>
        {children}
      </div>
    </div>
  );
}

// ─── Inline card shell ───────────────────────────────────────────────────────

function InlineCard({
  title,
  badge,
  badgeColor,
  children,
}: {
  title: string;
  badge?: string;
  badgeColor?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          borderBottom: `1px solid ${CARD_BORDER}`,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            fontFamily: "var(--font-instrument)",
            letterSpacing: "-0.01em",
            color: TEXT,
          }}
        >
          {title}
        </span>
        {badge && (
          <span
            style={{
              fontSize: 9,
              fontFamily: "monospace",
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: badgeColor ?? ACCENT,
              background: badgeColor ? `${badgeColor}18` : `${ACCENT}14`,
              padding: "2px 7px",
              borderRadius: 4,
              fontWeight: 700,
            }}
          >
            {badge}
          </span>
        )}
      </div>
      <div style={{ padding: "10px 14px" }}>{children}</div>
    </div>
  );
}

// ─── KV row ─────────────────────────────────────────────────────────────────

function KVRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        fontSize: 12,
        padding: "5px 0",
        borderBottom: `1px solid ${CARD_BORDER}`,
        gap: 8,
      }}
    >
      <span style={{ color: SECONDARY, flexShrink: 0 }}>{label}</span>
      <span style={{ color: TEXT, fontWeight: 500, textAlign: "right" }}>{value ?? "—"}</span>
    </div>
  );
}

// ─── Action pill button ─────────────────────────────────────────────────────

function Pill({
  children,
  primary,
  outline,
  active,
  onClick,
  disabled,
  small,
}: {
  children: React.ReactNode;
  primary?: boolean;
  outline?: boolean;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  small?: boolean;
}) {
  const pad = small ? "5px 12px" : "8px 18px";
  const fontSize = small ? 12 : 13;

  if (primary) {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        style={{
          background: disabled ? "#aaa" : ACCENT,
          color: "#fff",
          border: "none",
          borderRadius: 8,
          padding: pad,
          fontSize,
          fontWeight: 600,
          cursor: disabled ? "not-allowed" : "pointer",
          transition: "opacity 0.15s",
          opacity: disabled ? 0.7 : 1,
        }}
      >
        {children}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: outline ? "transparent" : active ? `${ACCENT}14` : CARD_BG,
        color: outline || active ? ACCENT : TEXT,
        border: `1px solid ${outline || active ? ACCENT : CARD_BORDER}`,
        borderRadius: 8,
        padding: pad,
        fontSize,
        fontWeight: active ? 600 : 500,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.15s",
      }}
    >
      {children}
    </button>
  );
}

// ─── Skeleton shimmer ────────────────────────────────────────────────────────

function Skeleton({ w = "100%", h = 16 }: { w?: string | number; h?: number }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 6,
        background: `linear-gradient(90deg, ${CARD_BORDER} 0%, #EDE9E1 50%, ${CARD_BORDER} 100%)`,
        backgroundSize: "200% 100%",
        animation: "shimmer 1.4s infinite linear",
      }}
    />
  );
}

// ─── Styled input ────────────────────────────────────────────────────────────

function StyledInput({
  value,
  onChange,
  placeholder,
  large,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  large?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%",
        fontSize: large ? 16 : 13,
        fontWeight: large ? 700 : 400,
        color: TEXT,
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 8,
        padding: large ? "10px 14px" : "8px 12px",
        outline: "none",
        boxSizing: "border-box",
        fontFamily: large ? "var(--font-instrument)" : "inherit",
        letterSpacing: large ? "-0.01em" : "normal",
      }}
    />
  );
}

// ─── Styled textarea ─────────────────────────────────────────────────────────

function StyledTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        width: "100%",
        fontSize: 13,
        color: TEXT,
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 8,
        padding: "8px 12px",
        outline: "none",
        resize: "vertical",
        boxSizing: "border-box",
        lineHeight: 1.55,
        fontFamily: "inherit",
      }}
    />
  );
}

// ─── Mode toggle button ──────────────────────────────────────────────────────

function ModeToggle({ compact, onToggle }: { compact: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      title={compact ? "Switch to chat mode" : "Switch to compact mode"}
      style={{
        position: "absolute",
        top: 14,
        right: 14,
        width: 32,
        height: 32,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 8,
        cursor: "pointer",
        zIndex: 10,
        color: SECONDARY,
        flexShrink: 0,
      }}
    >
      {compact ? (
        // Chat icon
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ) : (
        // Grid icon
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
      )}
    </button>
  );
}

// ─── Confidence badge color ───────────────────────────────────────────────────

function confidenceColor(c: number): string {
  if (c >= 0.85) return "#16A34A";
  if (c >= 0.65) return "#D97706";
  return "#DC2626";
}

function confidenceLabel(c: number): string {
  if (c >= 0.85) return `${Math.round(c * 100)}% confidence`;
  if (c >= 0.65) return `${Math.round(c * 100)}% — review`;
  return `${Math.round(c * 100)}% — low`;
}

// ─── CHAT MODE ───────────────────────────────────────────────────────────────

function ChatMode({
  flow,
  onPublish,
  onShowCapture,
  prepareListing,
}: {
  flow: ReturnType<typeof useListingFlow>;
  onPublish: () => void;
  onShowCapture: () => void;
  prepareListing: ReturnType<typeof usePrepareListing>;
}) {
  const { state, lastStep, setField, confirmRecognition, fetchComps, applyPricingStrategy } = flow;
  const bottomRef = useRef<HTMLDivElement>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lastStep, state.recognition.status]);

  const handlePhotoSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (!files.length) return;
      state.photos.forEach((p) => {
        if (p.url.startsWith("blob:")) URL.revokeObjectURL(p.url);
      });
      const photos = files.map((f) => ({
        url: URL.createObjectURL(f),
        key: `local-${Date.now()}-${f.name}`,
      }));
      flow.startFromPhoto(photos);
    },
    [flow, state.photos]
  );

  const [aspectsNeeded, setAspectsNeeded] = useState<AspectRequirement[] | null>(null);
  const [aspectSaving, setAspectSaving] = useState(false);
  const [aspectError, setAspectError] = useState<string | null>(null);
  const pendingPublishOpts = useRef<{ ebayPreparedFields?: EbayPreparedFields | null; publishMode?: "draft" | "live" } | undefined>(undefined);

  const runPublish = async (
    opts?: { ebayPreparedFields?: EbayPreparedFields | null; publishMode?: "draft" | "live"; aspects?: Record<string, string[]> },
  ) => {
    const fillingAspects = !!opts?.aspects;
    setPublishError(null);
    setAspectError(null);
    if (fillingAspects) setAspectSaving(true);
    else setIsPublishing(true);

    const result = await flow.publish(opts);

    if (fillingAspects) setAspectSaving(false);
    else setIsPublishing(false);

    if (result.success) {
      setAspectsNeeded(null);
      onPublish();
    } else if (result.aspectsRequired) {
      pendingPublishOpts.current = opts;
      setAspectsNeeded(result.aspectsRequired);
      if (fillingAspects) setAspectError("eBay needs a few more details to publish.");
    } else if (fillingAspects) {
      setAspectError(result.error ?? "Publishing failed");
    } else {
      setPublishError(result.error ?? "Publishing failed");
    }
  };

  const handlePublish = () => runPublish();

  const candidate = state.recognition.candidates[state.recognition.selectedIndex];
  const primaryPhoto = state.photos[state.primaryPhotoIndex];

  const showIdle = lastStep === "idle";
  const showRecognizing = state.recognition.status === "recognizing";
  const showRecognition = state.recognition.status === "complete" && lastStep === "recognition";
  const showRecognitionFailed = state.recognition.status === "failed";
  const showConfirmed = ["confirmed", "details"].includes(lastStep) && state.recognition.status !== "idle";
  const showPricing = ["pricing", "shipping", "review"].includes(lastStep) || lastStep === "confirmed";
  const showShipping = ["shipping", "review"].includes(lastStep);
  const showReview = lastStep === "review" || (state.price !== null && state.title !== "");
  const showPublished = state.publishStatus === "published" && state.listingId;

  if (showPublished && state.listingId) {
    return (
      <PublishSuccess
        listingId={state.listingId}
        marketplace={state.marketplace}
        title={state.title}
        price={state.price ?? 0}
        photoUrl={primaryPhoto?.url ?? null}
        isFirstListing={false}
        onListAnother={flow.reset}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, paddingBottom: 24 }}>
      <style>{`@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }`}</style>

      {/* ── Idle prompt ── */}
      {showIdle && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <PorterMessage>
            <strong style={{ fontFamily: "var(--font-instrument)", fontSize: 14 }}>
              Let&apos;s get your item listed.
            </strong>
            <br />
            Add a photo and I&apos;ll identify it and fill in the details.
          </PorterMessage>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handlePhotoSelect}
          />
          <div
            onClick={() => onShowCapture()}
            style={{
              border: `2px dashed ${CARD_BORDER}`,
              borderRadius: 12,
              padding: "28px 20px",
              textAlign: "center",
              cursor: "pointer",
              background: CARD_BG,
              transition: "border-color 0.15s",
            }}
          >
            <div style={{ marginBottom: 10 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={SECONDARY} strokeWidth="1.5" strokeLinecap="round" style={{ margin: "0 auto" }}>
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            </div>
            <p style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 4 }}>Add a photo</p>
            <p style={{ fontSize: 12, color: SECONDARY }}>Tap to choose from your library</p>
          </div>
        </div>
      )}

      {/* ── Recognizing skeleton ── */}
      {showRecognizing && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <PorterMessage>Analyzing your item...</PorterMessage>
          <InlineCard title="Identifying">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Skeleton h={14} />
              <Skeleton w="70%" h={12} />
              <Skeleton w="55%" h={12} />
              <Skeleton w="80%" h={12} />
            </div>
          </InlineCard>
        </div>
      )}

      {/* ── Recognition failed ── */}
      {showRecognitionFailed && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <PorterMessage>
            I couldn&apos;t identify the item clearly. Try a photo with better lighting, or describe it manually below.
          </PorterMessage>
          <InlineCard title="Item Details">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <StyledInput value={state.title} onChange={(v) => setField("title", v)} placeholder="Item name" large />
              <StyledTextarea value={state.description} onChange={(v) => setField("description", v)} placeholder="Describe the item..." />
            </div>
          </InlineCard>
        </div>
      )}

      {/* ── Recognition complete ── */}
      {showRecognition && candidate && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <PorterMessage>
            I found a match. Does this look right?
          </PorterMessage>
          <InlineCard
            title={candidate.name}
            badge={confidenceLabel(state.recognition.confidence)}
            badgeColor={confidenceColor(state.recognition.confidence)}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {state.recognition.reasoning.length > 0 && (
                <ul style={{ margin: "0 0 10px 0", paddingLeft: 16, display: "flex", flexDirection: "column", gap: 3 }}>
                  {state.recognition.reasoning.map((r, i) => (
                    <li key={i} style={{ fontSize: 12, color: SECONDARY, lineHeight: 1.4 }}>{r}</li>
                  ))}
                </ul>
              )}
              <KVRow label="Category" value={candidate.category} />
              <KVRow label="Condition" value={candidate.condition} />
              {candidate.brand && <KVRow label="Brand" value={candidate.brand} />}
              <KVRow label="Est. value" value={`$${candidate.estimatedValueLow}–$${candidate.estimatedValueHigh}`} />
            </div>
          </InlineCard>

          <div style={{ display: "flex", gap: 10, marginLeft: 34 }}>
            <Pill primary onClick={() => {
              confirmRecognition(state.recognition.selectedIndex);
              fetchComps();
              if (state.inventoryItemId) {
                prepareListing.prepare(state.inventoryItemId, ['ebay']);
              }
            }}>
              Looks right
            </Pill>
            <Pill outline onClick={() => flow.reset()}>
              Not quite
            </Pill>
          </div>
        </div>
      )}

      {/* ── Confirmed: editable details ── */}
      {showConfirmed && state.recognition.status === "complete" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <PorterMessage>Great. Review and edit the details below.</PorterMessage>
          <InlineCard title="Item Details">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: SECONDARY, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Title</p>
                <StyledInput value={state.title} onChange={(v) => setField("title", v)} placeholder="Item title" large />
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: SECONDARY, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Description</p>
                <StyledTextarea value={state.description} onChange={(v) => setField("description", v)} rows={4} placeholder="Item description..." />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: SECONDARY, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Category</p>
                  <div style={{ fontSize: 12, color: TEXT, background: BG, borderRadius: 6, padding: "7px 10px", border: `1px solid ${CARD_BORDER}` }}>{state.category || "—"}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: SECONDARY, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Condition</p>
                  <div style={{ fontSize: 12, color: TEXT, background: BG, borderRadius: 6, padding: "7px 10px", border: `1px solid ${CARD_BORDER}`, textTransform: "capitalize" }}>{state.condition || "—"}</div>
                </div>
              </div>
            </div>
          </InlineCard>
        </div>
      )}

      {/* ── Pricing ── */}
      {showPricing && state.title && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <PorterMessage>Set a price. I can suggest one based on what similar items sold for.</PorterMessage>
          <InlineCard title="Pricing">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: SECONDARY, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Price</p>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 20, fontWeight: 700, color: SECONDARY, fontFamily: "var(--font-instrument)" }}>$</span>
                  <input
                    type="number"
                    min={0}
                    value={state.price ?? ""}
                    onChange={(e) => setField("price", parseFloat(e.target.value) || null)}
                    placeholder="0.00"
                    style={{
                      flex: 1,
                      fontSize: 24,
                      fontWeight: 700,
                      color: TEXT,
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      fontFamily: "var(--font-instrument)",
                      letterSpacing: "-0.02em",
                    }}
                  />
                </div>
              </div>

              <PricingStrategyPicker
                active={state.pricingStrategy}
                onSelect={applyPricingStrategy}
                Pill={Pill}
                tokens={{ secondary: SECONDARY }}
              />

              {state.compsStatus === "loading" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <Skeleton h={12} />
                  <Skeleton w="60%" h={12} />
                </div>
              )}

              {state.price !== null && state.price > 0 && (
                <FeeEstimate price={state.price} marketplace={state.marketplace} />
              )}
            </div>
          </InlineCard>
        </div>
      )}

      {/* ── Shipping ── */}
      {showShipping && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <PorterMessage>Almost done — how will you ship it?</PorterMessage>
          <InlineCard title="Shipping">
            <ShippingConfigCard
              packageSize={state.packageSize}
              weight={state.weight}
              shippingMethod={state.shippingMethod}
              onPackageSizeChange={(s) => setField("packageSize", s)}
              onWeightChange={(w) => setField("weight", w)}
              onShippingMethodChange={(m) => setField("shippingMethod", m)}
              Pill={Pill}
              tokens={{ text: TEXT, secondary: SECONDARY, cardBg: CARD_BG, cardBorder: CARD_BORDER }}
            />
          </InlineCard>
        </div>
      )}

      {/* ── Prepared listing preview ── */}
      {prepareListing.isLoading && showConfirmed && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 0", gap: 12 }}>
          <div style={{ width: 40, height: 40, border: "3px solid #E8E5DE", borderTopColor: ACCENT, borderRadius: "50%", animation: "shimmer 1s linear infinite" }} />
          <p style={{ fontSize: 13, color: SECONDARY }}>Preparing your listing...</p>
        </div>
      )}

      {prepareListing.data && showConfirmed && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <PorterMessage>Here&apos;s your optimized listing. Tap any field to edit.</PorterMessage>
          <ListingPreviewCard
            data={prepareListing.data}
            photos={state.photos}
            quantity={state.quantity}
            onFieldChange={(field, value) => setField(field as keyof typeof state, value as never)}
            onPriceChange={(price) => setField("price", price)}
            onQuantityChange={(q) => setField("quantity", q)}
            onPublish={(marketplace, publishMode) => {
              setField("marketplace", marketplace);
              runPublish({ ebayPreparedFields: prepareListing.data?.ebay ?? null, publishMode });
            }}
            isPublishing={state.publishStatus === "publishing"}
            sellerProfileComplete={!prepareListing.data.warnings.some(w => w.includes("Seller profile incomplete"))}
          />
        </div>
      )}

      {/* ── Review ── */}
      {showReview && state.price !== null && state.price > 0 && !prepareListing.data && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <PorterMessage>Ready to publish. Here&apos;s your summary.</PorterMessage>
          <InlineCard title="Review">
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {primaryPhoto && (
                <div style={{ width: "100%", height: 120, borderRadius: 8, overflow: "hidden", marginBottom: 12, background: "#000" }}>
                  <img src={primaryPhoto.url} alt={state.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              )}
              <KVRow label="Title" value={state.title} />
              <KVRow label="Category" value={state.category} />
              <KVRow label="Condition" value={state.condition} />
              <KVRow label="Price" value={state.price !== null ? formatPrice(state.price, 2) : null} />
              <KVRow label="Marketplace" value={state.marketplace} />
              <KVRow label="Shipping" value={state.shippingMethod} />

              {state.price > 0 && (
                <div style={{ marginTop: 12 }}>
                  <FeeEstimate price={state.price} marketplace={state.marketplace} />
                </div>
              )}
            </div>
          </InlineCard>

          {publishError && (
            <p style={{ fontSize: 12, color: "#DC2626", marginLeft: 34 }}>{publishError}</p>
          )}

          <div style={{ marginLeft: 34 }}>
            <Pill
              primary
              onClick={handlePublish}
              disabled={isPublishing || state.publishStatus === "publishing"}
            >
              {isPublishing ? "Publishing..." : "Publish"}
            </Pill>
          </div>
        </div>
      )}

      {/* ── Ready for review trigger ── */}
      {showConfirmed && state.title && state.price === null && lastStep === "confirmed" && (
        <div style={{ marginLeft: 34 }}>
          <Pill
            primary
            onClick={() => flow.setField("price", candidate?.estimatedValueLow ?? 0)}
          >
            Set a price →
          </Pill>
        </div>
      )}

      <div ref={bottomRef} />

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
          onSave={(aspects) => runPublish({ ...pendingPublishOpts.current, aspects })}
        />
      )}
    </div>
  );
}

// ─── COMPACT MODE ─────────────────────────────────────────────────────────────

function CompactMode({ flow }: { flow: ReturnType<typeof useListingFlow> }) {
  const { state, setField, applyPricingStrategy, publish } = flow;
  const [publishError, setPublishError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (!files.length) return;
      state.photos.forEach((p) => {
        if (p.url.startsWith("blob:")) URL.revokeObjectURL(p.url);
      });
      const photos = files.map((f) => ({
        url: URL.createObjectURL(f),
        key: `local-${Date.now()}-${f.name}`,
      }));
      flow.startFromPhoto(photos);
    },
    [flow, state.photos]
  );

  const handlePublish = async () => {
    setPublishError(null);
    setIsPublishing(true);
    const result = await publish();
    setIsPublishing(false);
    if (!result.success) {
      setPublishError(result.error ?? "Publishing failed");
    }
  };

  const primaryPhoto = state.photos[state.primaryPhotoIndex];

  if (state.publishStatus === "published" && state.listingId) {
    return (
      <PublishSuccess
        listingId={state.listingId}
        marketplace={state.marketplace}
        title={state.title}
        price={state.price ?? 0}
        photoUrl={primaryPhoto?.url ?? null}
        isFirstListing={false}
        onListAnother={flow.reset}
      />
    );
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    color: SECONDARY,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 5,
    display: "block",
  };

  const rowStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    paddingBottom: 14,
    borderBottom: `1px solid ${CARD_BORDER}`,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <style>{`@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }`}</style>

      {/* Photo strip */}
      <div style={{ ...rowStyle }}>
        <label style={labelStyle}>Photos</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {state.photos.map((p, i) => (
            <div
              key={i}
              style={{
                width: 56,
                height: 56,
                borderRadius: 8,
                overflow: "hidden",
                border: `2px solid ${i === state.primaryPhotoIndex ? ACCENT : CARD_BORDER}`,
                flexShrink: 0,
              }}
            >
              <img src={p.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          ))}
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: 56,
              height: 56,
              borderRadius: 8,
              border: `2px dashed ${CARD_BORDER}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              background: BG,
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={SECONDARY} strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoSelect} />
      </div>

      {/* Recognition loading */}
      {state.recognition.status === "recognizing" && (
        <div style={{ padding: "12px 0", display: "flex", flexDirection: "column", gap: 6 }}>
          <Skeleton h={14} />
          <Skeleton w="60%" h={12} />
        </div>
      )}

      {/* Title */}
      <div style={{ ...rowStyle, paddingTop: 14 }}>
        <label style={labelStyle}>Title</label>
        <StyledInput value={state.title} onChange={(v) => setField("title", v)} placeholder="Item name" large />
      </div>

      {/* Description */}
      <div style={{ ...rowStyle, paddingTop: 14 }}>
        <label style={labelStyle}>Description</label>
        <StyledTextarea value={state.description} onChange={(v) => setField("description", v)} placeholder="Describe the item..." rows={3} />
      </div>

      {/* Category & Condition */}
      <div style={{ ...rowStyle, paddingTop: 14 }}>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Category</label>
            <div style={{ fontSize: 12, color: TEXT, background: BG, borderRadius: 6, padding: "7px 10px", border: `1px solid ${CARD_BORDER}` }}>{state.category || "—"}</div>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Condition</label>
            <div style={{ fontSize: 12, color: TEXT, background: BG, borderRadius: 6, padding: "7px 10px", border: `1px solid ${CARD_BORDER}`, textTransform: "capitalize" }}>{state.condition || "—"}</div>
          </div>
        </div>
      </div>

      {/* Quantity */}
      <div style={{ ...rowStyle, paddingTop: 14 }}>
        <label style={labelStyle}>Quantity</label>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            onClick={() => setField("quantity", Math.max(1, state.quantity - 1))}
            disabled={state.quantity <= 1}
            style={{ width: 32, height: 32, borderRadius: "50%", border: `1px solid ${CARD_BORDER}`, background: CARD_BG, color: TEXT, fontSize: 18, cursor: state.quantity <= 1 ? "not-allowed" : "pointer", opacity: state.quantity <= 1 ? 0.4 : 1 }}
            aria-label="Decrease quantity"
          >
            −
          </button>
          <span style={{ minWidth: 24, textAlign: "center", fontSize: 16, fontWeight: 700, fontFamily: "var(--font-instrument)", color: TEXT }}>{state.quantity}</span>
          <button
            onClick={() => setField("quantity", state.quantity + 1)}
            style={{ width: 32, height: 32, borderRadius: "50%", border: `1px solid ${CARD_BORDER}`, background: CARD_BG, color: TEXT, fontSize: 18, cursor: "pointer" }}
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
      </div>

      {/* Price + Strategy */}
      <div style={{ ...rowStyle, paddingTop: 14 }}>
        <label style={labelStyle}>Price</label>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: SECONDARY, fontFamily: "var(--font-instrument)" }}>$</span>
          <input
            type="number"
            min={0}
            value={state.price ?? ""}
            onChange={(e) => setField("price", parseFloat(e.target.value) || null)}
            placeholder="0.00"
            style={{
              flex: 1,
              fontSize: 20,
              fontWeight: 700,
              color: TEXT,
              background: "transparent",
              border: "none",
              borderBottom: `2px solid ${CARD_BORDER}`,
              outline: "none",
              fontFamily: "var(--font-instrument)",
              letterSpacing: "-0.02em",
              paddingBottom: 4,
            }}
          />
        </div>
        <PricingStrategyPicker
          active={state.pricingStrategy}
          onSelect={applyPricingStrategy}
          Pill={Pill}
          tokens={{ secondary: SECONDARY }}
        />
      </div>

      {/* Marketplace */}
      <div style={{ ...rowStyle, paddingTop: 14 }}>
        <label style={labelStyle}>Marketplace</label>
        <div style={{ display: "flex", gap: 6 }}>
          {(["ebay", "etsy", "reverb"] as Marketplace[]).map((m) => (
            <Pill key={m} small active={state.marketplace === m} onClick={() => setField("marketplace", m)}>
              {m === "ebay" ? "eBay" : m === "etsy" ? "Etsy" : "Reverb"}
            </Pill>
          ))}
        </div>
      </div>

      {/* Shipping */}
      <div style={{ ...rowStyle, paddingTop: 14 }}>
        <ShippingConfigCard
          packageSize={state.packageSize}
          weight={state.weight}
          shippingMethod={state.shippingMethod}
          onPackageSizeChange={(s) => setField("packageSize", s)}
          onWeightChange={(w) => setField("weight", w)}
          onShippingMethodChange={(m) => setField("shippingMethod", m)}
          Pill={Pill}
          tokens={{ text: TEXT, secondary: SECONDARY, cardBg: CARD_BG, cardBorder: CARD_BORDER }}
          labelStyleOverride={labelStyle}
        />
      </div>

      {/* Fee estimate */}
      {state.price !== null && state.price > 0 && (
        <div style={{ paddingTop: 14, paddingBottom: 14, borderBottom: `1px solid ${CARD_BORDER}` }}>
          <FeeEstimate price={state.price} marketplace={state.marketplace} />
        </div>
      )}

      {publishError && (
        <p style={{ fontSize: 12, color: "#DC2626", marginTop: 10 }}>{publishError}</p>
      )}

      {/* Publish CTA */}
      <div style={{ paddingTop: 18 }}>
        <button
          onClick={handlePublish}
          disabled={isPublishing || !state.title || state.price === null}
          style={{
            width: "100%",
            padding: "14px 0",
            borderRadius: 10,
            background: !state.title || state.price === null ? "#aaa" : ACCENT,
            color: "#fff",
            fontSize: 15,
            fontWeight: 700,
            border: "none",
            cursor: !state.title || state.price === null ? "not-allowed" : "pointer",
            fontFamily: "var(--font-instrument)",
            letterSpacing: "-0.01em",
            transition: "opacity 0.15s",
          }}
        >
          {isPublishing ? "Publishing..." : "Publish"}
        </button>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function HybridFlow({ itemId }: HybridFlowProps) {
  const flow = useListingFlow();
  const prepareListing = usePrepareListing();
  const { compactMode, updatePrefs } = useUserPreferences();
  const [localCompact, setLocalCompact] = useState<boolean | null>(null);
  const [showCapture, setShowCapture] = useState(false);
  const isCompact = localCompact !== null ? localCompact : compactMode;
  const initialized = useRef(false);

  // Load from item if itemId provided
  useEffect(() => {
    if (itemId && !initialized.current) {
      initialized.current = true;
      flow.startFromItem(itemId);
    }
  }, [itemId, flow]);

  const toggleMode = useCallback(() => {
    const next = !isCompact;
    setLocalCompact(next);
    updatePrefs({ listingCompactMode: next });
  }, [isCompact, updatePrefs]);

  return (
    <div
      style={{
        "--flow-bg": BG,
        "--flow-text": TEXT,
        "--flow-accent": ACCENT,
        position: "relative",
        background: BG,
        minHeight: "100%",
        color: TEXT,
        fontFamily: "inherit",
      } as React.CSSProperties}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "16px 16px 12px",
          borderBottom: `1px solid ${CARD_BORDER}`,
        }}
      >
        <PorterAvatar />
        <div>
          <p
            style={{
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "var(--font-instrument)",
              letterSpacing: "-0.01em",
              color: TEXT,
              lineHeight: 1.2,
            }}
          >
            Porter
          </p>
          <p style={{ fontSize: 11, color: SECONDARY, lineHeight: 1.2 }}>Listing assistant</p>
        </div>
        <ModeToggle compact={isCompact} onToggle={toggleMode} />
      </div>

      {/* Body */}
      <div style={{ padding: 16, overflowY: "auto" }}>
        {isCompact ? (
          <CompactMode flow={flow} />
        ) : (
          <ChatMode
            flow={flow}
            prepareListing={prepareListing}
            onPublish={() => {
              // Published state is managed in flow; ChatMode handles the switch
            }}
            onShowCapture={() => setShowCapture(true)}
          />
        )}
      </div>

      <PhotoCaptureOverlay
        show={showCapture}
        onPhotos={(photos) => flow.startFromPhoto(photos)}
        onCancel={() => setShowCapture(false)}
      />
    </div>
  );
}
