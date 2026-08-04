"use client";

import { useState, useEffect, useRef } from "react";
import { resolvePublishMode } from "@/lib/publish-mode";
import type { PublishPriceSource } from "@/lib/price";
import { api, ApiError } from "@/lib/api";
import { scopedPublishIdempotencyKey } from "@/lib/publish-idempotency";
import { useAuth } from "@/hooks/use-auth";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { DisclaimerSheet } from "./disclaimer-sheet";
import { AspectFillSheet, type AspectRequirement } from "./aspect-fill-sheet";
import { ShippingFieldsSection, SHIPPING_FIELDS_DEFAULT, type ShippingFieldsValue } from "./shipping-fields-section";
import { ReverbCategorySection } from "./reverb-category-section";

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
  /** Scan-review ride-along: seed the eBay shipping fields. A seed IS seller
   *  intent (they set it on the review screen), so it counts as touched. */
  initialShipping?: ShippingFieldsValue;
  /** BO-5: seed the eBay Best Offer fields VISIBLY (e.g. an AI-prepared
   *  auto-accept floor) — a value the seller sees and can change, never
   *  invisible config riding the POST. Counts as touched, like shipping. */
  initialBestOffer?: { bestOfferAutoAcceptPrice?: number; minimumBestOfferPrice?: number };
  /** F1: seed the publish-now toggle (e.g. seller profile default = live). */
  initialPublishNow?: boolean;
  /**
   * Cross-list guard: marketplaces still open for this item (no non-archived
   * listing). Omit for the unrestricted picker.
   */
  allowedMarketplaces?: Array<"ebay" | "reverb">;
  onCreated: () => void;
  onClose: () => void;
}

export function CreateListingSheet({ itemId, suggestedPrice, priceSource, categoryId, initialAspects, initialEbayDraft = false, initialShipping, initialBestOffer, initialPublishNow = false, allowedMarketplaces, onCreated, onClose }: CreateListingSheetProps) {
  const { token } = useAuth();
  // F3b: within the 7-day window the terms sheet is skipped (consent still recorded).
  const { disclaimerSuppressed } = useUserPreferences();
  const marketplaceOptions = allowedMarketplaces ?? (["ebay", "reverb"] as const);
  const [marketplace, setMarketplace] = useState<"ebay" | "reverb">(marketplaceOptions[0] ?? "ebay");
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
  // Per-listing "Accept offers" (beta request 1ad18a5b). Untouched → nothing is
  // sent and the server/profile defaults apply (eBay: off; Reverb: profile,
  // default on). Only an explicit user flip rides the POST.
  // Per-marketplace offers state (C1, operator-classified critical
  // 2026-08-03): eBay and Reverb Best Offer are DIFFERENT features — eBay is
  // enable + two thresholds, Reverb is a single explicit boolean. One shared
  // value corrupted both in one session (seed → switch → toggle → back).
  // Each marketplace owns its slice; switching only changes which slice
  // renders. Seeded once here — no switch-time re-seeding.
  const [offers, setOffers] = useState({
    ebay: {
      enabled: initialBestOffer != null,
      min: initialBestOffer?.minimumBestOfferPrice != null ? String(initialBestOffer.minimumBestOfferPrice) : "",
      autoAccept: initialBestOffer?.bestOfferAutoAcceptPrice != null ? String(initialBestOffer.bestOfferAutoAcceptPrice) : "",
    },
    reverb: { enabled: true }, // profile default is on
  });
  // Touched PER MARKETPLACE (review finding 2026-08-02): an eBay flip must not
  // ride a later Reverb POST as offersEnabledExplicit (or vice versa). An
  // initialBestOffer seed counts as touched (BO-5, same as initialShipping).
  const offersTouched = useRef<{ ebay: boolean; reverb: boolean }>({ ebay: initialBestOffer != null, reverb: false });
  const acceptOffers = marketplace === "ebay" ? offers.ebay.enabled : offers.reverb.enabled;
  const setAcceptOffers = (v: boolean) =>
    setOffers((o) => marketplace === "ebay" ? { ...o, ebay: { ...o.ebay, enabled: v } } : { ...o, reverb: { enabled: v } });
  const minOffer = offers.ebay.min;
  const setMinOffer = (v: string) => setOffers((o) => ({ ...o, ebay: { ...o.ebay, min: v } }));
  const autoAcceptOffer = offers.ebay.autoAccept;
  const setAutoAcceptOffer = (v: string) => setOffers((o) => ({ ...o, ebay: { ...o.ebay, autoAccept: v } }));
  // Advertising (beta request 55639b6e): eBay Promoted Listings ad rate /
  // Reverb Bump bid. Off by default; nothing rides the POST until toggled.
  const [promote, setPromote] = useState(false);
  const [adRate, setAdRate] = useState("");
  const [bumpBid, setBumpBid] = useState("1.5");
  // Per-listing shipping (beta 17be7322) — eBay only for now. Untouched sends
  // nothing: the server keeps its calculated-shipping defaults and legacy rows
  // keep profile-driven behavior (same contract as offersTouched above).
  const [shipFields, setShipFields] = useState<ShippingFieldsValue>(initialShipping ?? SHIPPING_FIELDS_DEFAULT);
  const shippingTouched = useRef(initialShipping != null);
  // Reverb per-listing shipping: profile select ("" = seller-profile default),
  // or "pickup" for local-pickup-only. Same touched contract as eBay above.
  const [reverbProfiles, setReverbProfiles] = useState<Array<{ id: string; name: string }>>([]);
  const [reverbShipChoice, setReverbShipChoice] = useState("");
  const [reverbLocalPickup, setReverbLocalPickup] = useState(false);
  const reverbShippingTouched = useRef(false);
  // Reverb category cascade — an explicit pick overrides server enrichment
  // (AI/prepare-cache/profile); null = untouched, nothing sent.
  const [reverbCategory, setReverbCategory] = useState<{ uuid: string; fullName: string } | null>(null);
  // Pre-seed with the category that WILL publish (operator feedback 2026-08-02):
  // prepare-cache first, else the same first-match the publish-time enrichment
  // guess uses (GET /category-suggestion) — never an unexplained blank default.
  // One seed attempt per sheet instance: a seller's explicit reset to the
  // default must survive marketplace toggles (review finding 2026-08-02) —
  // reverbCategory truthiness alone can't distinguish "never seeded" from
  // "seeded then deliberately cleared".
  const reverbSeedAttempted = useRef(false);
  useEffect(() => {
    if (marketplace !== "reverb" || !token || reverbCategory || reverbSeedAttempted.current) return;
    reverbSeedAttempted.current = true;
    let cancelled = false;
    (async () => {
      try {
        const item = await api<{ title?: string; category?: string; marketplaceData?: { reverb?: { categoryUuid?: string | null; categoryName?: string | null } } }>(`/items/${itemId}`, { token });
        if (cancelled) return;
        const cached = item?.marketplaceData?.reverb;
        if (cached?.categoryUuid) {
          setReverbCategory({ uuid: cached.categoryUuid, fullName: cached.categoryName ?? "" });
          return;
        }
        const q = item?.category || item?.title;
        if (!q) return;
        const r = await api<{ suggestion: { uuid: string; fullName: string } | null }>(`/marketplace/reverb/category-suggestion?q=${encodeURIComponent(q)}`, { token });
        if (!cancelled && r?.suggestion) setReverbCategory(r.suggestion);
      } catch { /* cascade stays on defaults; enrichment still guesses at publish */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketplace, token, itemId]);
  useEffect(() => {
    if (marketplace !== "reverb" || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await api<{ profiles: Array<{ id: string; name: string }> }>("/marketplace/reverb/shipping-profiles", { token });
        if (!cancelled && r?.profiles) setReverbProfiles(r.profiles);
      } catch { /* select still offers default + pickup */ }
    })();
    return () => { cancelled = true; };
  }, [marketplace, token]);
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

  // Dedup key reused across retries of the same item+marketplace (aspects fill,
  // network error) so the server resumes the insert-first row instead of
  // inserting an orphan draft per attempt; cleared on success below.
  const idempotencyKeyRef = useRef<string | null>(null);

  // Single create-and-publish call; `aspects` carries seller-filled item
  // specifics on a retry after EBAY_ASPECTS_REQUIRED.
  const submitListing = async (priceNum: number, aspects?: Record<string, string[]>, suppress7d = false) => {
    const fields: {
      categoryId?: string;
      aspects?: Record<string, string[]>;
      bestOfferEnabled?: boolean;
      minimumBestOfferPrice?: number;
      bestOfferAutoAcceptPrice?: number;
      offersEnabledExplicit?: boolean;
      ebayAdRate?: number;
      reverbBumpBid?: number;
      ebayShipping?: { method: string; flatCost?: number; service?: string; handlingDays?: number; localPickup?: boolean };
      reverbShipping?: { profileId?: string; localPickup?: boolean; localPickupOnly?: boolean };
      categoryUuid?: string;
    } = {};
    if (categoryId) fields.categoryId = categoryId;
    // The seller-filled retry set wins; otherwise fall back to scan prefill.
    const effectiveAspects = aspects ?? initialAspects;
    if (effectiveAspects && Object.keys(effectiveAspects).length > 0) fields.aspects = effectiveAspects;
    // Offers ride only on an explicit user flip — untouched keeps server/profile
    // defaults, and pre-toggle rows keep profile-driven sync behavior.
    if (offersTouched.current[marketplace]) {
      if (marketplace === "ebay") {
        fields.bestOfferEnabled = acceptOffers;
        if (acceptOffers) {
          const min = parseFloat(minOffer);
          const auto = parseFloat(autoAcceptOffer);
          if (min > 0) fields.minimumBestOfferPrice = min;
          if (auto > 0) fields.bestOfferAutoAcceptPrice = auto;
        }
      } else {
        fields.offersEnabledExplicit = acceptOffers;
      }
    }
    // Shipping rides only on an explicit user interaction (shippingTouched) —
    // untouched keeps the server's calculated defaults.
    if (shippingTouched.current && marketplace === "ebay") {
      const cost = parseFloat(shipFields.flatCost);
      const days = parseInt(shipFields.handlingDays, 10);
      fields.ebayShipping = {
        method: shipFields.method,
        ...(shipFields.method === "flat" && cost > 0 ? { flatCost: cost } : {}),
        ...(shipFields.service ? { service: shipFields.service } : {}),
        ...(days >= 0 && shipFields.handlingDays !== "" ? { handlingDays: days } : {}),
        ...(shipFields.localPickup ? { localPickup: true } : {}),
      };
    }
    if (reverbShippingTouched.current && marketplace === "reverb" && (reverbLocalPickup || reverbShipChoice)) {
      fields.reverbShipping = {
        ...(reverbShipChoice ? { profileId: reverbShipChoice } : {}),
        ...(reverbLocalPickup ? { localPickup: true } : {}),
      };
    }
    // Explicit cascade pick wins over server enrichment (applyReverbEnrichment
    // only fills categoryUuid when absent).
    if (marketplace === "reverb" && reverbCategory) {
      fields.categoryUuid = reverbCategory.uuid;
    }
    // Advertising rides only when the promote toggle is on with a valid rate.
    if (promote) {
      if (marketplace === "ebay") {
        const rate = parseFloat(adRate);
        if (rate > 0) fields.ebayAdRate = rate;
      } else {
        const bid = parseFloat(bumpBid);
        if (bid > 0) fields.reverbBumpBid = bid / 100;
      }
    }
    idempotencyKeyRef.current = scopedPublishIdempotencyKey(itemId, marketplace, idempotencyKeyRef.current);
    const res = await api<PublishResult>("/listings", {
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
        idempotencyKey: idempotencyKeyRef.current,
      },
      token: token!,
    });
    // Attempt complete — a later publish from this sheet is a new intent.
    idempotencyKeyRef.current = null;
    return res;
  };

  const handleCreate = async (suppress7d = false) => {
    const priceNum = parseFloat(price);
    if (!priceNum || priceNum <= 0) {
      setError("Enter a valid price");
      return;
    }
    // Server rejects flat-with-no-cost (EBAY_FLAT_COST_REQUIRED) — catch it
    // here with the same message so the seller never round-trips for it.
    if (marketplace === "ebay" && shippingTouched.current && shipFields.method === "flat" && !(parseFloat(shipFields.flatCost) > 0)) {
      setError("Flat-rate shipping needs a buyer cost above $0 — enter the rate or switch to free shipping.");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const res = await submitListing(priceNum, undefined, suppress7d);
      setResult(res); // show the result; onCreated() fires when the seller dismisses it
    } catch (err) {
      // Required item specifics: open the fill sheet instead of dead-ending.
      // The gate throws from the adapter AFTER the insert-first row exists; the
      // retry reuses idempotencyKeyRef so the server resumes that row.
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
      <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
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
              href={`/inventory/${itemId}?listing=${result.id}`}
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
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
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
            {marketplaceOptions.map((m) => (
              <button
                key={m}
                onClick={() => setMarketplace(m)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  marketplace === m
                    ? "bg-forest-green text-white"
                    : "bg-muted text-text-secondary border border-border"
                }`}
              >
                {m === "ebay" ? "eBay" : "Reverb"}
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

        {/* Per-listing offers (beta request): eBay Best Offer with optional
            auto-decline/auto-accept floors; Reverb offers_enabled override. */}
        <label className="flex items-center gap-3 py-2 cursor-pointer">
          <div
            onClick={() => { offersTouched.current[marketplace] = true; setAcceptOffers(!acceptOffers); }}
            className={`w-10 h-6 rounded-full transition-colors flex items-center ${
              acceptOffers ? "bg-forest-green" : "bg-muted border border-border"
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                acceptOffers ? "translate-x-5" : "translate-x-1"
              }`}
            />
          </div>
          <span className="text-sm text-text-primary">Accept offers</span>
        </label>
        {acceptOffers && marketplace === "ebay" && (
          <div className="flex gap-3">
            <div className="flex-1">
              <label htmlFor="min-offer" className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
                Minimum offer ($)
              </label>
              <input
                id="min-offer"
                type="number"
                inputMode="decimal"
                min="0"
                value={minOffer}
                onChange={(e) => setMinOffer(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2.5 bg-muted rounded-xl text-sm text-text-primary border border-transparent focus:border-border-focus focus:outline-none"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="auto-accept-offer" className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
                Auto-accept at ($)
              </label>
              <input
                id="auto-accept-offer"
                type="number"
                inputMode="decimal"
                min="0"
                value={autoAcceptOffer}
                onChange={(e) => setAutoAcceptOffer(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2.5 bg-muted rounded-xl text-sm text-text-primary border border-transparent focus:border-border-focus focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Advertising (beta request 55639b6e): eBay Promoted Listings /
            Reverb Bump. Applied after the listing goes live; drafts store the
            intent and apply it on publish. */}
        <label className="flex items-center gap-3 py-2 cursor-pointer">
          <div
            onClick={() => setPromote(!promote)}
            className={`w-10 h-6 rounded-full transition-colors flex items-center ${
              promote ? "bg-forest-green" : "bg-muted border border-border"
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                promote ? "translate-x-5" : "translate-x-1"
              }`}
            />
          </div>
          <span className="text-sm text-text-primary">Promote this listing</span>
        </label>
        {promote && marketplace === "ebay" && (
          <div>
            <label htmlFor="ebay-ad-rate" className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
              Ad rate (% of sale)
            </label>
            <input
              id="ebay-ad-rate"
              type="number"
              inputMode="decimal"
              min="1"
              max="100"
              step="0.5"
              value={adRate}
              onChange={(e) => setAdRate(e.target.value)}
              placeholder="e.g. 5"
              className="w-full px-3 py-2.5 bg-muted rounded-xl text-sm text-text-primary border border-transparent focus:border-border-focus focus:outline-none"
            />
            <p className="mt-1 text-xs text-text-secondary">Charged only when the ad leads to a sale (eBay Promoted Listings).</p>
          </div>
        )}
        {promote && marketplace === "reverb" && (
          <div>
            <label htmlFor="reverb-bump-bid" className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
              Bump bid (% of sale)
            </label>
            <input
              id="reverb-bump-bid"
              type="number"
              inputMode="decimal"
              min="0.5"
              max="3.5"
              step="0.1"
              value={bumpBid}
              onChange={(e) => setBumpBid(e.target.value)}
              placeholder="0.5 – 3.5"
              className="w-full px-3 py-2.5 bg-muted rounded-xl text-sm text-text-primary border border-transparent focus:border-border-focus focus:outline-none"
            />
            <p className="mt-1 text-xs text-text-secondary">Charged only when the listing sells (Reverb Bump).</p>
          </div>
        )}

        {/* Per-listing shipping (beta 17be7322) — eBay only. Fields extracted to
            ShippingFieldsSection so scan-review can ride along with the same UI. */}
        {marketplace === "ebay" && (
          <ShippingFieldsSection
            value={shipFields}
            onChange={(v) => { shippingTouched.current = true; setShipFields(v); }}
          />
        )}

        {/* Reverb per-listing shipping: profile reference or local-pickup-only.
            Untouched keeps the seller-profile default flowing on sync. */}
        {marketplace === "reverb" && (
          <ReverbCategorySection value={reverbCategory} onChange={setReverbCategory} token={token} />
        )}
        {marketplace === "reverb" && (
          <div>
            <label htmlFor="reverb-shipping-profile" className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
              Shipping profile
            </label>
            <select
              id="reverb-shipping-profile"
              value={reverbShipChoice}
              onChange={(e) => { reverbShippingTouched.current = true; setReverbShipChoice(e.target.value); }}
              className="w-full px-3 py-2.5 bg-muted rounded-xl text-sm text-text-primary border border-transparent focus:border-border-focus focus:outline-none"
            >
              <option value="">Seller profile default</option>
              {reverbProfiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {/* Pickup is an ADD-ON toggle (operator correction 2026-08-03):
                it rides ALONGSIDE the shipping choice, never replaces it. */}
            <label className="flex items-center gap-3 py-2 mt-1 cursor-pointer">
              <div
                onClick={() => { reverbShippingTouched.current = true; setReverbLocalPickup(!reverbLocalPickup); }}
                className={`w-10 h-6 rounded-full transition-colors flex items-center ${
                  reverbLocalPickup ? "bg-forest-green" : "bg-muted border border-border"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                    reverbLocalPickup ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </div>
              <span className="text-sm text-text-primary">Offer local pickup</span>
            </label>
          </div>
        )}

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
              disabled={isCreating || !price || marketplaceOptions.length === 0}
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
