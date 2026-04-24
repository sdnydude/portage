"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

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
  const [publishNow, setPublishNow] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    const priceNum = parseFloat(price);
    if (!priceNum || priceNum <= 0) {
      setError("Enter a valid price");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      await api("/listings", {
        method: "POST",
        body: {
          itemId,
          marketplace,
          price: priceNum,
          publishImmediately: publishNow,
        },
        token: token!,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create listing");
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-surface rounded-t-2xl sm:rounded-2xl w-full max-w-sm mx-4 mb-0 sm:mb-0 p-6 space-y-4">
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
              className="w-full pl-7 pr-4 py-2.5 bg-muted rounded-xl text-sm text-text-primary border border-transparent focus:border-border-focus focus:outline-none"
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

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-text-primary"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating || !price}
            className="flex-1 py-2.5 rounded-xl bg-forest-green text-white text-sm font-medium disabled:opacity-50"
          >
            {isCreating ? "Creating..." : publishNow ? "List Now" : "Save Draft"}
          </button>
        </div>
      </div>
    </div>
  );
}
