"use client";

import { useState, useEffect } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { DisclaimerSheet } from "./disclaimer-sheet";
import { AspectFillSheet, type AspectRequirement } from "./aspect-fill-sheet";

interface CreateListingSheetProps {
  itemId: string;
  suggestedPrice?: number;
  onCreated: () => void;
  onClose: () => void;
}

export function CreateListingSheet({ itemId, suggestedPrice, onCreated, onClose }: CreateListingSheetProps) {
  const { token } = useAuth();
  const [marketplace, setMarketplace] = useState<"ebay" | "etsy">("ebay");
  const [price, setPrice] = useState(suggestedPrice?.toString() ?? "");
  // Keep the prefill in sync if suggestedPrice resolves after mount (e.g. comps
  // load asynchronously). The user can still edit freely afterward.
  useEffect(() => {
    setPrice(suggestedPrice?.toString() ?? "");
  }, [suggestedPrice]);
  const [publishNow, setPublishNow] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  // eBay can reject a live publish for missing item specifics; collect them in a
  // sheet and retry rather than dead-ending on the raw error message.
  const [aspectMissing, setAspectMissing] = useState<AspectRequirement[] | null>(null);
  const [aspectError, setAspectError] = useState<string | null>(null);

  // Single create-and-publish call; `aspects` carries seller-filled item
  // specifics on a retry after EBAY_ASPECTS_REQUIRED.
  const submitListing = async (priceNum: number, aspects?: Record<string, string[]>) => {
    await api("/listings", {
      method: "POST",
      body: {
        itemId,
        marketplace,
        price: priceNum,
        publishMode: publishNow ? "live" : "draft",
        ...(aspects ? { marketplaceSpecificFields: { aspects } } : {}),
      },
      token: token!,
    });
  };

  const handleCreate = async () => {
    const priceNum = parseFloat(price);
    if (!priceNum || priceNum <= 0) {
      setError("Enter a valid price");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      await submitListing(priceNum);
      onCreated();
    } catch (err) {
      // Required item specifics: open the fill sheet instead of dead-ending.
      // The gate throws before any listing row is created, so the retry won't
      // duplicate.
      if (err instanceof ApiError && err.code === "EBAY_ASPECTS_REQUIRED") {
        setShowDisclaimer(false); // hand off from the terms sheet to the aspect sheet
        setAspectMissing((err.details as unknown as AspectRequirement[]) ?? []);
        setIsCreating(false);
        return;
      }
      setError(err instanceof ApiError ? err.message : "Failed to create listing");
      setIsCreating(false);
    }
  };

  const handleAspectsSave = async (aspects: Record<string, string[]>) => {
    const priceNum = parseFloat(price);
    setAspectError(null);
    try {
      await submitListing(priceNum, aspects);
      onCreated();
    } catch (err) {
      // Still missing something — keep the sheet open with eBay's message.
      if (err instanceof ApiError && err.code === "EBAY_ASPECTS_REQUIRED") {
        setAspectMissing((err.details as unknown as AspectRequirement[]) ?? []);
        setAspectError(err.message);
        return;
      }
      setAspectMissing(null);
      setError(err instanceof ApiError ? err.message : "Failed to create listing");
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-surface rounded-t-2xl sm:rounded-2xl w-full max-w-sm mx-4 mb-0 sm:mb-0 p-6 space-y-4 max-h-[85dvh] overflow-y-auto">
        <h3 className="text-lg font-semibold font-[family-name:var(--font-instrument)] text-text-primary">
          Create Listing
        </h3>

        {error && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
            Marketplace
          </label>
          <div className="flex gap-2">
            {(["ebay", "etsy"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMarketplace(m)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  marketplace === m
                    ? "bg-forest-green text-white"
                    : "bg-muted text-text-secondary border border-border"
                }`}
              >
                {m === "ebay" ? "eBay" : "Etsy"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
            Price (USD)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-sm">$</span>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              min="0.01"
              step="0.01"
              className="w-full pl-7 pr-4 py-2.5 bg-muted rounded-xl text-base text-text-primary border border-transparent focus:border-border-focus focus:outline-none"
            />
          </div>
        </div>

        <label className="flex items-center gap-3 py-2 cursor-pointer">
          <div
            onClick={() => setPublishNow(!publishNow)}
            className={`w-10 h-6 rounded-full transition-colors flex items-center ${
              publishNow ? "bg-forest-green" : "bg-muted border border-border"
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                publishNow ? "translate-x-5" : "translate-x-1"
              }`}
            />
          </div>
          <span className="text-sm text-text-primary">Publish immediately</span>
        </label>

        {/* Disclaimer — shown when publish is toggled on */}
        {publishNow && showDisclaimer && (
          <DisclaimerSheet
            listingId={itemId}
            isFirstTime={true}
            onAccept={async () => {
              await handleCreate();
            }}
            onCancel={() => setShowDisclaimer(false)}
          />
        )}

        {aspectMissing && (
          <AspectFillSheet
            missing={aspectMissing}
            saving={isCreating}
            error={aspectError}
            onCancel={() => {
              setAspectMissing(null);
              setAspectError(null);
            }}
            onSave={handleAspectsSave}
          />
        )}

        {!showDisclaimer && (
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-text-primary"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (publishNow) {
                  setShowDisclaimer(true);
                } else {
                  handleCreate();
                }
              }}
              disabled={isCreating || !price}
              className="flex-1 py-2.5 rounded-xl bg-forest-green text-white text-sm font-medium disabled:opacity-50"
            >
              {isCreating ? "Creating..." : publishNow ? "Review Terms" : "Save Draft"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
