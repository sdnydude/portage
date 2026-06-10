"use client";

import { useState, useCallback, useEffect } from "react";
import { CompsPricingWidget } from "./comps-pricing-widget";
import { PhotoGalleryStrip } from "../capture/photo-gallery-strip";
import { PhotoEditPanel } from "../capture/photo-edit-panel";
import { CropTool } from "../listing-flow/crop-tool";
import { usePhotoEdit } from "@/hooks/use-photo-edit";
import { useRequiredAspects } from "@/hooks/use-required-aspects";
import type { PreparedListingData } from "@portage/shared";

interface ListingPreviewCardProps {
  data: PreparedListingData;
  photos: Array<{ url: string; key: string }>;
  quantity: number;
  onFieldChange: (field: string, value: unknown) => void;
  onPriceChange: (price: number) => void;
  onQuantityChange: (quantity: number) => void;
  onPublish: (marketplace: "ebay" | "reverb", publishMode: "draft" | "live", aspects?: Record<string, string[]>) => void;
  isPublishing: boolean;
  sellerProfileComplete: boolean;
  /** When provided, the card shows the photo gallery strip and hosts the
   *  full-screen editor overlay (all 4 tools); edits persist through this. */
  onPhotoUpdated?: (index: number, patch: { url: string; key?: string; width?: number; height?: number }) => void;
}

function InlineEdit({ value, field, onSave }: { value: string; field: string; onSave: (field: string, value: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);

  if (editing) {
    return (
      <input
        autoFocus
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={() => { onSave(field, text); setEditing(false); }}
        onKeyDown={e => { if (e.key === "Enter") { onSave(field, text); setEditing(false); } }}
        className="w-full bg-transparent border-b-2 outline-none text-inherit font-inherit"
        style={{ borderColor: "var(--flow-accent, #2D5A27)" }}
      />
    );
  }

  return (
    <span onClick={() => setEditing(true)} className="cursor-pointer hover:underline decoration-dotted underline-offset-4">
      {value}
    </span>
  );
}

export function ListingPreviewCard({
  data,
  photos,
  quantity,
  onFieldChange,
  onPriceChange,
  onQuantityChange,
  onPublish,
  isPublishing,
  sellerProfileComplete,
  onPhotoUpdated,
}: ListingPreviewCardProps) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [publishMode, setPublishMode] = useState<"draft" | "live">("live");
  const photoEdit = usePhotoEdit(photos, (index, patch) => onPhotoUpdated?.(index, patch));

  const handleFieldSave = useCallback((field: string, value: string) => {
    onFieldChange(field, value);
  }, [onFieldChange]);

  const currentPrice = data.pricing.suggested;

  // ── eBay item specifics (aspects) ──────────────────────────────────────────
  // The AI pre-fills aspects at prepare time; we fetch the category's required
  // schema so the user can review/complete them HERE, before publishing — eBay
  // rejects publish (error 25002) when a required specific is missing.
  const categoryId = data.ebay?.categoryId ?? null;
  const { aspects: requiredAspects } = useRequiredAspects(categoryId);
  const [aspectValues, setAspectValues] = useState<Record<string, string>>({});

  // Seed from the AI-prepared values when the prepared category changes.
  useEffect(() => {
    const seed: Record<string, string> = {};
    for (const [k, v] of Object.entries(data.ebay?.aspects ?? {})) {
      seed[k] = Array.isArray(v) ? (v[0] ?? "") : String(v ?? "");
    }
    setAspectValues(seed);
  }, [categoryId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Display every required aspect (from the schema) plus any extra the AI filled.
  const aspectNames = Array.from(
    new Set([
      ...Object.entries(requiredAspects).filter(([, m]) => m.required).map(([n]) => n),
      ...Object.keys(data.ebay?.aspects ?? {}),
    ]),
  );
  const missingRequired = Object.entries(requiredAspects)
    .filter(([name, m]) => m.required && !(aspectValues[name] ?? "").trim())
    .map(([name]) => name);
  const aspectsBlockPublish = missingRequired.length > 0;
  const [showAspects, setShowAspects] = useState(false);

  const buildAspects = (): Record<string, string[]> => {
    const out: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(aspectValues)) {
      if (v.trim()) out[k] = [v.trim()];
    }
    return out;
  };

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "white", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
      <div className="relative aspect-square bg-gray-100">
        {photos.length > 0 && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photos[photoIndex]?.url}
              alt="Listing"
              className="w-full h-full object-cover"
            />
            {photos.length > 1 && (
              <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                {photos.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPhotoIndex(i)}
                    className="w-2 h-2 rounded-full transition-colors"
                    style={{ background: i === photoIndex ? "white" : "rgba(255,255,255,0.5)" }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="p-4 space-y-4">
        {onPhotoUpdated && (
          <PhotoGalleryStrip
            photos={photos.map((p, i) => ({ key: p.key || `photo-${i}`, url: p.url }))}
            onEditPhoto={photoEdit.openEditor}
            maxPhotos={12}
          />
        )}

        {onPhotoUpdated && photoEdit.editingIndex !== null && photoEdit.editingPhoto && (
          photoEdit.showCrop ? (
            <CropTool
              imageUrl={photoEdit.editingPhoto.url}
              imageWidth={photoEdit.editingPhoto.width ?? 1024}
              imageHeight={photoEdit.editingPhoto.height ?? 1024}
              onApply={photoEdit.applyCrop}
              onCancel={photoEdit.cancelCrop}
            />
          ) : (
            <PhotoEditPanel
              photo={{ url: photoEdit.editingPhoto.url }}
              photoIndex={photoEdit.editingIndex}
              photoCount={photos.length}
              onClose={photoEdit.closeEditor}
              onRotate={photoEdit.rotate}
              onCrop={() => !photoEdit.isProcessing && photoEdit.openCrop()}
              onEnhance={photoEdit.enhanceCurrent}
              onBgRemove={photoEdit.bgRemoveCurrent}
              isProcessing={photoEdit.isProcessing}
              processingLabel={photoEdit.processingLabel}
              pendingPreview={
                photoEdit.pendingPreview
                  ? { ...photoEdit.pendingPreview, alt: data.title }
                  : null
              }
            />
          )
        )}

        <h3 className="text-lg font-semibold" style={{ color: "var(--flow-text, #18191C)" }}>
          <InlineEdit value={data.title} field="title" onSave={handleFieldSave} />
        </h3>

        <div className="flex items-center gap-2 text-sm">
          <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: "rgba(45,90,39,0.1)", color: "#2D5A27" }}>
            {data.condition.replace("_", " ")}
          </span>
          <span style={{ color: "rgba(0,0,0,0.5)" }}>{data.brand} · {data.model}</span>
        </div>

        <p className="text-sm italic" style={{ color: "rgba(0,0,0,0.6)" }}>
          &quot;{data.conditionDescription}&quot;
        </p>

        {data.listingFooter && (
          <div className="rounded-lg px-3 py-2 text-sm" style={{ background: "rgba(0,0,0,0.03)", border: "1px dashed rgba(0,0,0,0.15)" }}>
            <p style={{ color: "rgba(0,0,0,0.6)" }}>{data.listingFooter}</p>
            <p className="text-[10px] mt-1" style={{ color: "rgba(0,0,0,0.4)" }}>Listing footer — added at publish</p>
          </div>
        )}

        <CompsPricingWidget
          pricing={data.pricing}
          comps={data.comps}
          currentPrice={currentPrice}
          onPriceChange={onPriceChange}
        />

        {data.ebay && aspectNames.length > 0 && (
          <div>
            <button
              onClick={() => setShowAspects(!showAspects)}
              className="flex items-center justify-between w-full text-sm font-medium py-2"
            >
              <span>
                Item Specifics
                {aspectsBlockPublish && (
                  <span className="ml-2 text-xs font-normal" style={{ color: "#CC3333" }}>
                    {missingRequired.length} required
                  </span>
                )}
              </span>
              <span style={{ color: "rgba(0,0,0,0.4)" }}>{showAspects || aspectsBlockPublish ? "▲" : "▼"}</span>
            </button>
            {(showAspects || aspectsBlockPublish) && (
              <div className="space-y-3 pb-2">
                {aspectNames.map((name) => {
                  const meta = requiredAspects[name];
                  const isRequired = meta?.required ?? false;
                  const empty = !(aspectValues[name] ?? "").trim();
                  const allowed = meta?.values ?? null;
                  return (
                    <div key={name} className="space-y-1">
                      <label className="text-xs font-medium" style={{ color: empty && isRequired ? "#CC3333" : "rgba(0,0,0,0.5)" }}>
                        {name}{isRequired ? " *" : ""}
                      </label>
                      {allowed && allowed.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {allowed.map((v) => {
                            const selected = aspectValues[name] === v;
                            return (
                              <button
                                key={v}
                                type="button"
                                onClick={() => setAspectValues((p) => ({ ...p, [name]: v }))}
                                className="px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors"
                                style={selected
                                  ? { background: "var(--flow-accent, #2D5A27)", color: "white", borderColor: "var(--flow-accent, #2D5A27)" }
                                  : { background: "transparent", color: "rgba(0,0,0,0.7)", borderColor: "rgba(0,0,0,0.15)" }}
                              >
                                {v}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={aspectValues[name] ?? ""}
                          onChange={(e) => setAspectValues((p) => ({ ...p, [name]: e.target.value }))}
                          placeholder={`Enter ${name}`}
                          className="w-full px-2.5 py-1.5 rounded-lg text-sm outline-none border"
                          style={{ borderColor: empty && isRequired ? "#CC3333" : "rgba(0,0,0,0.15)", background: "white" }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Weight/dimensions are captured editably in each flow's shipping step
            (WeightDimsInputs) and persisted to the item columns, which are the
            source of truth at publish — so the old read-only estimate block here
            (which showed the prepare estimate, not the publish value) is gone. */}

        {data.warnings.length > 0 && (
          <div className="space-y-1">
            {data.warnings.map((w, i) => (
              <p key={i} className="text-xs px-2 py-1 rounded" style={{ background: "rgba(204,51,51,0.08)", color: "#CC3333" }}>
                {w}
              </p>
            ))}
          </div>
        )}

        <div className="pt-2">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium" style={{ color: "rgba(0,0,0,0.6)" }}>Quantity</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
                className="w-8 h-8 rounded-full flex items-center justify-center text-lg font-medium disabled:opacity-30"
                style={{ background: "rgba(0,0,0,0.06)" }}
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span className="w-6 text-center text-base font-semibold tabular-nums">{quantity}</span>
              <button
                onClick={() => onQuantityChange(quantity + 1)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-lg font-medium"
                style={{ background: "rgba(0,0,0,0.06)" }}
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex gap-2 mb-3 p-1 rounded-xl" style={{ background: "rgba(0,0,0,0.05)" }}>
            {(["live", "draft"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setPublishMode(mode)}
                className="flex-1 py-2 text-sm font-medium rounded-lg transition-colors"
                style={
                  publishMode === mode
                    ? { background: "white", color: "var(--flow-accent, #2D5A27)", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }
                    : { background: "transparent", color: "rgba(0,0,0,0.5)" }
                }
              >
                {mode === "live" ? "Publish live" : "Save as draft"}
              </button>
            ))}
          </div>

          {data.isMusicGear && (
            <div className="flex gap-2 mb-3">
              {(["ebay", "reverb"] as const).map(m => (
                <button
                  key={m}
                  className="flex-1 py-2 text-sm font-medium rounded-lg transition-colors"
                  style={{
                    background: "rgba(0,0,0,0.05)",
                    color: "rgba(0,0,0,0.6)",
                  }}
                >
                  {m === "ebay" ? "eBay" : "Reverb"}
                </button>
              ))}
            </div>
          )}

          {!sellerProfileComplete && (
            <a
              href="/settings/seller-profile"
              className="block text-center text-sm py-2 mb-3 rounded-lg"
              style={{ background: "rgba(204,153,0,0.1)", color: "#B8860B" }}
            >
              Set up seller profile to publish →
            </a>
          )}

          {aspectsBlockPublish && publishMode === "live" && (
            <p className="text-xs mb-2" style={{ color: "#CC3333" }}>
              Fill the required item specifics above before publishing to eBay.
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => onPublish("ebay", publishMode, buildAspects())}
              disabled={isPublishing || !sellerProfileComplete || (aspectsBlockPublish && publishMode === "live")}
              className="flex-1 py-3.5 rounded-xl text-base font-semibold text-white disabled:opacity-40"
              style={{ background: "var(--flow-accent, #2D5A27)" }}
            >
              {isPublishing ? "Publishing..." : publishMode === "draft" ? "Save eBay draft" : "Publish to eBay"}
            </button>
            {data.isMusicGear && (
              <button
                onClick={() => onPublish("reverb", publishMode, buildAspects())}
                disabled={isPublishing || !sellerProfileComplete}
                className="flex-1 py-3.5 rounded-xl text-base font-semibold text-white disabled:opacity-40"
                style={{ background: "#E8620A" }}
              >
                {isPublishing ? "Publishing..." : "Publish to Reverb"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
