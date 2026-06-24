"use client";

import { useState, useEffect, useRef } from "react";
import { resolvePublishMode } from "@/lib/publish-mode";
import type { PublishPriceSource } from "@/lib/price";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { DisclaimerSheet } from "./disclaimer-sheet";
import { AspectFillSheet, type AspectRequirement } from "./aspect-fill-sheet";

/** POST /listings response — `warning` carries eBay's verbatim reason when a
 *  live publish fell back to a draft. */
interface PublishResult {
  id: string;
  status: string;
  warning?: string;
}

interface CreateListingSheetProps {
  itemId: string;
  suggestedPrice?: number;
  /** F2: where suggestedPrice came from — shown as a provenance hint. */
  priceSource?: PublishPriceSource;
  /** F1: scan prefill — the eBay leaf category resolved at scan time. */
  categoryId?: string;
  /** F1: scan prefill — item specifics captured at scan time. */
  initialAspects?: Record<string, string[]>;
  /** F1: scan prefill — default the eBay-draft toggle on. */
  initialEbayDraft?: boolean;
  /** F1: seed the publish-now toggle (e.g. seller profile default = live). */
  initialPublishNow?: boolean;
  onCreated: () => void;
  onClose: () => void;
}

export function CreateListingSheet({ itemId, suggestedPrice, priceSource, categoryId, initialAspects, initialEbayDraft = false, initialPublishNow = false, onCreated, onClose }: CreateListingSheetProps) {
  const { token } = useAuth();
  // F3b: within the 7-day window the terms sheet is skipped (consent still recorded).
  const { disclaimerSuppressed } = useUserPreferences();
  const [marketplace, setMarketplace] = useState<"ebay" | "etsy">("ebay");
  const [price, setPrice] = useState(suggestedPrice?.toString() ?? "");
  // Once the user types their own price it is authoritative — a late-arriving AI
  // suggestion (comps resolve async after mount) must never overwrite it. Adopt
  // the prefill only while the field is still untouched.
  const userEditedPrice = useRef(false);
  // A new item gets its own suggestion — clear the edit guard so the sheet doesn't
  // carry the previous item's typed price if it's reused without remounting.
  useEffect(() => {
    userEditedPrice.current = false;
  }, [itemId]);
  useEffect(() => {
    if (userEditedPrice.current) return;
    setPrice(suggestedPrice?.toString() ?? "");
  }, [suggestedPrice]);
  const [publishNow, setPublishNow] = useState(initialPublishNow);
  // When not publishing now, optionally create an UNPUBLISHED eBay offer (Seller
  // Hub draft) instead of a Portage-local draft. eBay marketplace only.
  const [ebayDraft, setEbayDraft] = useState(initialEbayDraft);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  // eBay can reject a live publish for missing item specifics; collect them in a
  // sheet and retry rather than dead-ending on the raw error message.
  const [aspectMissing, setAspectMissing] = useState<AspectRequirement[] | null>(null);
  const [aspectError, setAspectError] = useState<string | null>(null);
  // F4: a successful create surfaces a truthful two-state result (published vs
  // saved-as-draft-with-eBay's-reason) instead of silently navigating away.
  const [result, setResult] = useState<PublishResult | null>(null);

  // Single create-and-publish call; `aspects` carries seller-filled item
  // specifics on a retry after EBAY_ASPECTS_REQUIRED.
  const submitListing = async (priceNum: number, aspects?: Record<string, string[]>, suppress7d = false) => {
    const fields: { categoryId?: string; aspects?: Record<string, string[]> } = {};
    if (categoryId) fields.categoryId = categoryId;
    // The seller-filled retry set wins; otherwise fall back to scan prefill.
    const effectiveAspects = aspects ?? initialAspects;
    if (effectiveAspects && Object.keys(effectiveAspects).length > 0) fields.aspects = effectiveAspects;
    return api<PublishResult>("/listings", {
      method: "POST",
      body: {
        itemId,
        marketplace,
        price: priceNum,
        publishMode: resolvePublishMode({ publishNow, ebayDraft, marketplace }),
        // F3a: publish-now is the only path that shows + requires the terms sheet,
        // so its acceptance is recorded server-side against the new listing.
        ...(publishNow ? { disclaimerAccepted: true } : {}),
        // F3b: opt-in "don't show the terms sheet for 7 days" (display only).
        ...(publishNow && suppress7d ? { suppress7d: true } : {}),
        ...(Object.keys(fields).length > 0 ? { marketplaceSpecificFields: fields } : {}),
      },
      token: token!,
    });
  };

  const handleCreate = async (suppress7d = false) => {
    const priceNum = parseFloat(price);
    if (!priceNum || priceNum <= 0) {
      setError("Enter a valid price");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const res = await submitListing(priceNum, undefined, suppress7d);
      setResult(res); // show the result; onCreated() fires when the seller dismisses it
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
    // Drive the AspectFillSheet busy state (saving={isCreating}) so its Save button
    // disables during the retry and a second tap can't fire a duplicate POST /listings.
    setIsCreating(true);
    setAspectError(null);
    try {
      const res = await submitListing(priceNum, aspects);
      setResult(res); // same truthful result screen as the direct publish path
    } catch (err) {
      // Still missing something — keep the sheet open with eBay's message.
      if (err instanceof ApiError && err.code === "EBAY_ASPECTS_REQUIRED") {
        setAspectMissing((err.details as unknown as AspectRequirement[]) ?? []);
        setAspectError(err.message);
        setIsCreating(false); // reopen for another try
        return;
      }
      setAspectMissing(null);
      setError(err instanceof ApiError ? err.message : "Failed to create listing");
      setIsCreating(false);
    }
  };

  // F4: once a create succeeds, the sheet becomes a truthful result screen.
  // `warning` (or a non-active status) means the live publish fell back to a
  // draft; show eBay's verbatim reason rather than implying a clean publish.
  if (result) {
    const isDraft = !!result.warning || result.status !== "active";
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
        <div className="fixed inset-0 bg-black/50" onClick={onCreated} />
        <div className="relative bg-surface rounded-t-2xl sm:rounded-2xl w-full max-w-sm mx-4 p-6 space-y-4 max-h-[85dvh] overflow-y-auto text-center">
          <div
            className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center ${
              result.warning ? "bg-amber-100 dark:bg-amber-950/40" : "bg-forest-green/15"
            }`}
          >
            {result.warning ? (
              // Amber alert only when the live publish actually fell back to a
              // draft. A deliberate draft save is a clean success, not a problem.
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green, #2D5A27)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            )}
          </div>
          <h3 className="text-lg font-semibold font-[family-name:var(--font-instrument)] text-text-primary">
            {isDraft ? "Saved as draft" : "Published"}
          </h3>
          {result.warning && (
            <div
              role="alert"
              className="rounded-xl p-3 text-left text-[13px] border border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200"
            >
              {result.warning}
            </div>
          )}
          <div className="flex flex-col gap-3 pt-2">
            <a
              href={`/listings/${result.id}`}
              className="w-full py-2.5 rounded-xl border border-border text-sm font-medium text-text-primary"
            >
              View listing
            </a>
            <button
              onClick={onCreated}
              className="w-full py-2.5 rounded-xl bg-forest-green text-white text-sm font-medium"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

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
              onChange={(e) => {
                userEditedPrice.current = true;
                setPrice(e.target.value);
              }}
              placeholder="0.00"
              min="0.01"
              step="0.01"
              className="w-full pl-7 pr-4 py-2.5 bg-muted rounded-xl text-base text-text-primary border border-transparent focus:border-border-focus focus:outline-none"
            />
          </div>
          {priceSource && (
            <p className="mt-1 text-xs text-text-secondary">
              {priceSource === "item"
                ? "From your price"
                : priceSource === "comps"
                  ? "From market comps"
                  : "Estimated"}
            </p>
          )}
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

        {/* eBay-draft option — only when not publishing now and on eBay. Creates an
            unpublished eBay offer (Seller Hub draft) rather than a Portage-local draft. */}
        {!publishNow && marketplace === "ebay" && (
          <label className="flex items-center gap-3 py-2 cursor-pointer">
            <div
              onClick={() => setEbayDraft(!ebayDraft)}
              className={`w-10 h-6 rounded-full transition-colors flex items-center ${
                ebayDraft ? "bg-forest-green" : "bg-muted border border-border"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                  ebayDraft ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </div>
            <span className="text-sm text-text-primary">Save as eBay draft</span>
          </label>
        )}

        {/* Disclaimer — shown when publish is toggled on */}
        {publishNow && showDisclaimer && (
          <DisclaimerSheet
            listingId={itemId}
            isFirstTime={true}
            onAccept={async (suppress7d: boolean) => {
              await handleCreate(suppress7d);
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

        {/* F3b: terms are suppressed but still apply — keep them discoverable via About. */}
        {!showDisclaimer && publishNow && disclaimerSuppressed && (
          <p className="text-xs text-text-secondary pt-1">
            Terms apply — view them on the{" "}
            <a href="/about" className="underline text-forest-green">About page</a>.
          </p>
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
                if (publishNow && !disclaimerSuppressed) {
                  setShowDisclaimer(true);
                } else {
                  // Suppressed publish-now (or a draft save) goes straight through;
                  // consent is still recorded server-side on the live publish.
                  handleCreate();
                }
              }}
              disabled={isCreating || !price}
              className="flex-1 py-2.5 rounded-xl bg-forest-green text-white text-sm font-medium disabled:opacity-50"
            >
              {isCreating
                ? "Creating..."
                : publishNow
                  ? disclaimerSuppressed
                    ? "Publish"
                    : "Review Terms"
                  : ebayDraft && marketplace === "ebay"
                    ? "Save eBay Draft"
                    : "Save Draft"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
