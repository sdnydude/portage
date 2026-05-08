"use client";

import { useState, useCallback } from "react";
import { CompsPricingWidget } from "./comps-pricing-widget";
import type { PreparedListingData } from "@portage/shared";

interface ListingPreviewCardProps {
  data: PreparedListingData;
  photos: Array<{ url: string; key: string }>;
  onFieldChange: (field: string, value: unknown) => void;
  onPriceChange: (price: number) => void;
  onPublish: (marketplace: "ebay" | "reverb") => void;
  isPublishing: boolean;
  sellerProfileComplete: boolean;
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
  onFieldChange,
  onPriceChange,
  onPublish,
  isPublishing,
  sellerProfileComplete,
}: ListingPreviewCardProps) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [showAspects, setShowAspects] = useState(false);

  const handleFieldSave = useCallback((field: string, value: string) => {
    onFieldChange(field, value);
  }, [onFieldChange]);

  const currentPrice = data.pricing.suggested;

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

        <CompsPricingWidget
          pricing={data.pricing}
          comps={data.comps}
          currentPrice={currentPrice}
          onPriceChange={onPriceChange}
        />

        {data.ebay?.aspects && (
          <div>
            <button
              onClick={() => setShowAspects(!showAspects)}
              className="flex items-center justify-between w-full text-sm font-medium py-2"
            >
              <span>Item Specifics</span>
              <span style={{ color: "rgba(0,0,0,0.4)" }}>{showAspects ? "▲" : "▼"}</span>
            </button>
            {showAspects && (
              <div className="space-y-1 pb-2">
                {Object.entries(data.ebay.aspects).map(([key, values]) => (
                  <div key={key} className="flex text-sm">
                    <span className="w-1/3 shrink-0" style={{ color: "rgba(0,0,0,0.5)" }}>{key}</span>
                    <span>{values.join(", ")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {data.ebay && (
          <div className="text-sm space-y-1" style={{ color: "rgba(0,0,0,0.6)" }}>
            <p>Weight: ~{data.ebay.weight.value} {data.ebay.weight.unit} (estimated)</p>
            <p>Dimensions: {data.ebay.dimensions.length}x{data.ebay.dimensions.width}x{data.ebay.dimensions.height} {data.ebay.dimensions.unit} (estimated)</p>
          </div>
        )}

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

          <div className="flex gap-3">
            <button
              onClick={() => onPublish("ebay")}
              disabled={isPublishing || !sellerProfileComplete}
              className="flex-1 py-3.5 rounded-xl text-base font-semibold text-white disabled:opacity-40"
              style={{ background: "var(--flow-accent, #2D5A27)" }}
            >
              {isPublishing ? "Publishing..." : "Publish to eBay"}
            </button>
            {data.isMusicGear && (
              <button
                onClick={() => onPublish("reverb")}
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
