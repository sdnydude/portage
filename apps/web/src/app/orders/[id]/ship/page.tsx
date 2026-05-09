"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useShippingPresets, useShippingRates, useShippingLabel } from "@/hooks/use-shipping";
import type { ShippingRate, ShippingPreset } from "@/hooks/use-shipping";

// ─── Types ─────────────────────────────────────────────────

interface OrderDetail {
  id: string;
  marketplace: "ebay" | "etsy";
  marketplaceOrderId: string;
  buyerUsername: string;
  buyerAddress?: {
    name: string;
    street1: string;
    street2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  salePrice: number;
  shippingCost: number;
  currency: string;
  status: "payment_received" | "label_purchased" | "shipped" | "delivered";
  trackingNumber: string | null;
  carrier: string | null;
  shippingLabelUrl: string | null;
  soldAt: string;
  shippedAt: string | null;
  item: {
    id: string;
    title: string;
    photos: Array<{ url: string; isPrimary?: boolean }>;
    category: string;
  };
}

type PackageType = "box" | "envelope" | "poly_mailer";

// ─── Helpers ───────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function getMarketplaceBadge(marketplace: "ebay" | "etsy") {
  return marketplace === "ebay"
    ? { label: "eBay", bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-300" }
    : { label: "Etsy", bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-700 dark:text-orange-300" };
}

function getCarrierLogo(carrier: string): string {
  switch (carrier.toUpperCase()) {
    case "USPS": return "USPS";
    case "UPS": return "UPS";
    case "FEDEX": return "FedEx";
    default: return carrier;
  }
}

// ─── Page Component ────────────────────────────────────────

export default function ShipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = use(params);
  const router = useRouter();
  const { token } = useAuth();

  // ── Order data ──
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [orderLoading, setOrderLoading] = useState(true);
  const [orderError, setOrderError] = useState<string | null>(null);

  // ── Package dimensions ──
  const [packageType, setPackageType] = useState<PackageType>("box");
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [weightLbs, setWeightLbs] = useState("");
  const [weightOz, setWeightOz] = useState("");
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [presetName, setPresetName] = useState("");

  // ── Rate selection ──
  const [selectedRateId, setSelectedRateId] = useState<string | null>(null);
  const [showAllRates, setShowAllRates] = useState(false);

  // ── Label purchase state ──
  const [labelResult, setLabelResult] = useState<{
    trackingNumber: string;
    carrier: string;
    shippingLabelUrl: string | null;
    isStub?: boolean;
    message?: string;
  } | null>(null);
  const [labelSuccess, setLabelSuccess] = useState(false);
  const [isMarkedShipped, setIsMarkedShipped] = useState(false);

  // ── Hooks ──
  const { presets, createPreset } = useShippingPresets();
  const dimensions = {
    packageType,
    length: length ? Number(length) : undefined,
    width: width ? Number(width) : undefined,
    height: height ? Number(height) : undefined,
    weightLbs: weightLbs ? Number(weightLbs) : undefined,
    weightOz: weightOz ? Number(weightOz) : undefined,
  };
  const { rates, isLoading: ratesLoading, error: ratesError, fetchRates } = useShippingRates(orderId, dimensions);
  const { purchaseLabel, markShipped, isLoading: labelLoading, error: labelError } = useShippingLabel();

  // ── Fetch order detail ──
  const fetchOrder = useCallback(async () => {
    if (!token) return;
    setOrderLoading(true);
    setOrderError(null);

    try {
      const data = await api<OrderDetail>(`/orders/${orderId}`, { token });
      setOrder(data);
    } catch (err) {
      setOrderError(err instanceof ApiError ? err.message : "Failed to load order");
    } finally {
      setOrderLoading(false);
    }
  }, [token, orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // ── Apply preset ──
  const applyPreset = useCallback((preset: ShippingPreset) => {
    setPackageType(preset.packageType);
    setLength(String(preset.length));
    setWidth(String(preset.width));
    setHeight(String(preset.height));
    setWeightLbs(String(preset.weightLbs));
    setWeightOz(String(preset.weightOz));
    setActivePresetId(preset.id);
    setShowSavePreset(false);
  }, []);

  // ── Auto-select AI/default preset ──
  useEffect(() => {
    if (presets.length > 0 && !activePresetId) {
      const defaultPreset = presets.find((p) => p.isDefault) ?? presets[0];
      if (defaultPreset) applyPreset(defaultPreset);
    }
  }, [presets, activePresetId, applyPreset]);

  // ── Handle buy label ──
  const handleBuyLabel = async () => {
    if (!selectedRateId) return;

    try {
      const result = await purchaseLabel({
        orderId,
        rateId: selectedRateId,
        packageType,
        length: length ? Number(length) : undefined,
        width: width ? Number(width) : undefined,
        height: height ? Number(height) : undefined,
        weightLbs: weightLbs ? Number(weightLbs) : undefined,
        weightOz: weightOz ? Number(weightOz) : undefined,
      });

      if (result) {
        setLabelResult({
          trackingNumber: result.trackingNumber,
          carrier: result.carrier,
          shippingLabelUrl: result.shippingLabelUrl,
          isStub: result.isStub,
          message: result.message,
        });
        setLabelSuccess(true);
      }
    } catch {
      // Error is set by the hook
    }
  };

  // ── Handle mark shipped ──
  const handleMarkShipped = async () => {
    try {
      await markShipped(orderId);
      setIsMarkedShipped(true);
    } catch {
      // Error handled by hook
    }
  };

  // ── Save preset ──
  const handleSavePreset = async () => {
    if (!presetName.trim()) return;
    await createPreset({
      name: presetName.trim(),
      packageType,
      length: Number(length),
      width: Number(width),
      height: Number(height),
      weightLbs: Number(weightLbs || 0),
      weightOz: Number(weightOz || 0),
      isDefault: false,
      sortOrder: presets.length,
    });
    setShowSavePreset(false);
    setPresetName("");
  };

  // ── Derive selected rate ──
  const selectedRate = rates.find((r) => r.rateId === selectedRateId);

  // ── Categorize rates ──
  const sortedRates = [...rates].sort((a, b) => a.price - b.price);
  const cheapest = sortedRates[0] ?? null;
  const fastest = [...rates].sort((a, b) => a.estimatedDays - b.estimatedDays)[0] ?? null;
  const bestValue = sortedRates.find((r) => r.estimatedDays <= 3) ?? cheapest;
  const topRateIds = new Set<string>();
  if (cheapest) topRateIds.add(cheapest.rateId);
  if (fastest) topRateIds.add(fastest.rateId);
  if (bestValue) topRateIds.add(bestValue.rateId);
  const topRates = rates.filter((r) => topRateIds.has(r.rateId));
  const remainingRates = rates.filter((r) => !topRateIds.has(r.rateId));

  function getRateLabel(rate: ShippingRate): string | null {
    if (rate.rateId === cheapest?.rateId) return "Cheapest";
    if (rate.rateId === fastest?.rateId) return "Fastest";
    if (rate.rateId === bestValue?.rateId && rate.rateId !== cheapest?.rateId) return "Best Value";
    return null;
  }

  // ── Loading state ──
  if (orderLoading) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-forest-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Error state ──
  if (orderError || !order) {
    return (
      <div className="min-h-dvh bg-background px-4 py-6">
        <div className="max-w-lg mx-auto">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-sm text-text-secondary mb-4"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Back
          </button>
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-2xl p-4 text-sm text-red-700 dark:text-red-300">
            {orderError ?? "Order not found"}
          </div>
        </div>
      </div>
    );
  }

  // ── Success state (label purchased) ──
  if (labelSuccess && labelResult) {
    return (
      <div className="min-h-dvh bg-background px-4 py-6">
        <div className="max-w-lg mx-auto flex flex-col items-center justify-center py-16">
          {/* Checkmark animation */}
          <div
            className="w-20 h-20 rounded-full bg-forest-green flex items-center justify-center mb-6 animate-spring-in"
            style={{ boxShadow: "var(--shadow-elevated)" }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h2
            className="font-[family-name:var(--font-instrument)] font-bold text-text-primary mb-2"
            style={{ fontSize: "var(--text-title)" }}
          >
            Label Purchased
          </h2>

          <p className="text-text-secondary text-center mb-8" style={{ fontSize: "var(--text-body)" }}>
            Your shipping label is ready
          </p>

          {/* Tracking info card */}
          <div
            className="w-full rounded-2xl border border-border bg-surface p-4 mb-6"
            style={{ boxShadow: "var(--shadow-medium)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">Tracking Number</span>
              <span className="text-xs font-medium text-text-secondary">{labelResult.carrier}</span>
            </div>
            <p
              className="font-[family-name:var(--font-jetbrains)] text-text-primary font-medium select-all"
              style={{ fontSize: "var(--text-body)" }}
            >
              {labelResult.trackingNumber}
            </p>
          </div>

          {/* Action buttons */}
          <div className="w-full space-y-3">
            {labelResult.shippingLabelUrl ? (
              <a
                href={labelResult.shippingLabelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl border border-border bg-surface text-text-primary font-semibold text-sm transition-colors hover:bg-muted"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <path d="M14 2v6h6" />
                </svg>
                View Label
              </a>
            ) : labelResult.message ? (
              <p className="text-center text-sm text-text-secondary py-3">{labelResult.message}</p>
            ) : null}

            {!isMarkedShipped ? (
              <button
                onClick={handleMarkShipped}
                className="w-full py-3.5 rounded-2xl bg-forest-green text-white font-semibold text-sm transition-colors hover:bg-forest-green-dark"
              >
                Mark as Shipped
              </button>
            ) : (
              <div className="flex items-center justify-center gap-2 py-3.5 text-forest-green font-semibold text-sm">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
                Marked as Shipped
              </div>
            )}

            <button
              onClick={() => router.push(`/orders/${orderId}`)}
              className="w-full py-3 text-sm text-text-secondary font-medium"
            >
              View Order Details
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main shipping flow ──
  const badge = getMarketplaceBadge(order.marketplace);
  const primaryPhoto = order.item.photos?.find((p) => p.isPrimary) ?? order.item.photos?.[0];

  return (
    <div className="min-h-dvh bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-sm text-text-secondary"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Back
          </button>
          <h1 className="text-lg font-semibold font-[family-name:var(--font-instrument)] text-text-primary">
            Ship It
          </h1>
          <div className="w-12" /> {/* Spacer for centering */}
        </div>
      </header>

      <div className="px-4 pb-8 max-w-lg mx-auto">
        {/* ─── Section 1: Item + Buyer ───────────────────── */}
        <section className="py-5">
          <div
            className="rounded-2xl border border-border bg-surface p-4"
            style={{ boxShadow: "var(--shadow-subtle)" }}
          >
            <div className="flex gap-3">
              {/* Item photo */}
              {primaryPhoto ? (
                <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-muted">
                  <img
                    src={primaryPhoto.url}
                    alt={order.item.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-placeholder)" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                </div>
              )}

              {/* Item info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-text-primary truncate">{order.item.title}</h3>
                  <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${badge.bg} ${badge.text}`}>
                    {badge.label}
                  </span>
                </div>
                <p className="text-lg font-bold text-text-primary mt-0.5 font-[family-name:var(--font-instrument)]">
                  {formatCurrency(order.salePrice)}
                </p>
              </div>
            </div>

            {/* Buyer address */}
            {order.buyerAddress && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">Ship to</p>
                <p className="text-sm text-text-primary font-medium">{order.buyerAddress.name}</p>
                <p className="text-sm text-text-secondary">{order.buyerAddress.street1}</p>
                {order.buyerAddress.street2 && (
                  <p className="text-sm text-text-secondary">{order.buyerAddress.street2}</p>
                )}
                <p className="text-sm text-text-secondary">
                  {order.buyerAddress.city}, {order.buyerAddress.state} {order.buyerAddress.zip}
                </p>
              </div>
            )}

            {!order.buyerAddress && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">Buyer</p>
                <p className="text-sm text-text-primary font-medium">{order.buyerUsername}</p>
                <p className="text-xs text-text-secondary mt-1">
                  Address will be available when the marketplace syncs buyer details.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* ─── Section 2: Package ─────────────────────────── */}
        <section className="py-3">
          <h2
            className="font-[family-name:var(--font-instrument)] font-semibold text-text-primary mb-3"
            style={{ fontSize: "var(--text-headline)" }}
          >
            Package
          </h2>

          {/* Preset pills — horizontal scroll */}
          {presets.length > 0 && (
            <div className="mb-4">
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => applyPreset(preset)}
                    className={`flex-shrink-0 px-3.5 py-2 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                      activePresetId === preset.id
                        ? "bg-forest-green text-white"
                        : "bg-muted text-text-secondary border border-border hover:border-forest-green"
                    }`}
                  >
                    {preset.isDefault && activePresetId !== preset.id && (
                      <span className="mr-1 text-forest-green">*</span>
                    )}
                    {preset.name}
                  </button>
                ))}
              </div>
              {activePresetId && presets.find((p) => p.id === activePresetId)?.isDefault && (
                <p className="text-[11px] text-forest-green font-medium mt-1">
                  Suggested by Porter
                </p>
              )}
            </div>
          )}

          {/* Package type — segmented control */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
              Package Type
            </label>
            <div className="flex rounded-xl bg-muted p-1">
              {([
                { value: "box" as const, label: "Box" },
                { value: "envelope" as const, label: "Padded Envelope" },
                { value: "poly_mailer" as const, label: "Poly Mailer" },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setPackageType(opt.value);
                    setActivePresetId(null);
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                    packageType === opt.value
                      ? "bg-surface text-text-primary shadow-sm"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dimensions — L x W x H */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
              Dimensions (inches)
            </label>
            <div className="flex gap-2">
              {[
                { label: "L", value: length, setter: setLength },
                { label: "W", value: width, setter: setWidth },
                { label: "H", value: height, setter: setHeight },
              ].map((dim) => (
                <div key={dim.label} className="flex-1">
                  <div className="relative">
                    <input
                      type="number"
                      value={dim.value}
                      onChange={(e) => {
                        dim.setter(e.target.value);
                        setActivePresetId(null);
                      }}
                      placeholder={dim.label}
                      min="0"
                      step="0.1"
                      className="w-full py-2.5 px-3 bg-muted rounded-xl text-sm text-text-primary text-center border border-transparent focus:border-border-focus focus:outline-none"
                      aria-label={`${dim.label === "L" ? "Length" : dim.label === "W" ? "Width" : "Height"}`}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-text-placeholder">
                      {dim.label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Weight */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
              Weight
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                <div className="relative">
                  <input
                    type="number"
                    value={weightLbs}
                    onChange={(e) => {
                      setWeightLbs(e.target.value);
                      setActivePresetId(null);
                    }}
                    placeholder="0"
                    min="0"
                    className="w-full py-2.5 px-3 bg-muted rounded-xl text-sm text-text-primary text-center border border-transparent focus:border-border-focus focus:outline-none"
                    aria-label="Weight in pounds"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-text-placeholder">
                    lbs
                  </span>
                </div>
              </div>
              <div className="flex-1">
                <div className="relative">
                  <input
                    type="number"
                    value={weightOz}
                    onChange={(e) => {
                      setWeightOz(e.target.value);
                      setActivePresetId(null);
                    }}
                    placeholder="0"
                    min="0"
                    step="0.1"
                    className="w-full py-2.5 px-3 bg-muted rounded-xl text-sm text-text-primary text-center border border-transparent focus:border-border-focus focus:outline-none"
                    aria-label="Weight in ounces"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-text-placeholder">
                    oz
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Save as preset prompt */}
          {!activePresetId && length && width && height && (
            <div className="mb-2">
              {!showSavePreset ? (
                <button
                  onClick={() => setShowSavePreset(true)}
                  className="text-xs text-forest-green font-medium"
                >
                  Save as preset?
                </button>
              ) : (
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="Preset name..."
                    className="flex-1 py-2 px-3 bg-muted rounded-xl text-sm text-text-primary border border-transparent focus:border-border-focus focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={handleSavePreset}
                    disabled={!presetName.trim()}
                    className="px-3 py-2 rounded-xl bg-forest-green text-white text-xs font-medium disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setShowSavePreset(false); setPresetName(""); }}
                    className="px-2 py-2 text-xs text-text-secondary"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Get Rates button */}
          <button
            onClick={fetchRates}
            disabled={ratesLoading || !length || !width || !height}
            className="w-full py-3 rounded-2xl border border-forest-green text-forest-green font-semibold text-sm transition-colors hover:bg-forest-green-50 disabled:opacity-50 disabled:border-border disabled:text-text-placeholder"
          >
            {ratesLoading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-forest-green border-t-transparent rounded-full animate-spin" />
                Getting Rates...
              </span>
            ) : (
              "Get Rates"
            )}
          </button>
        </section>

        {/* ─── Section 3: Rate Selection ──────────────────── */}
        {rates.length > 0 && (
          <section className="py-3">
            <h2
              className="font-[family-name:var(--font-instrument)] font-semibold text-text-primary mb-3"
              style={{ fontSize: "var(--text-headline)" }}
            >
              Select Shipping
            </h2>

            {ratesError && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-2xl p-3 text-sm text-red-700 dark:text-red-300 mb-3">
                {ratesError}
              </div>
            )}

            {/* Top rates */}
            <div className="space-y-2">
              {topRates.map((rate) => {
                const label = getRateLabel(rate);
                const isSelected = selectedRateId === rate.rateId;
                return (
                  <button
                    key={rate.rateId}
                    onClick={() => setSelectedRateId(rate.rateId)}
                    className={`w-full text-left rounded-2xl border p-4 transition-all ${
                      isSelected
                        ? "border-forest-green bg-forest-green-50 ring-1 ring-forest-green"
                        : "border-border bg-surface hover:border-forest-green-light"
                    }`}
                    style={{ boxShadow: isSelected ? "var(--shadow-medium)" : "var(--shadow-subtle)" }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {/* Radio indicator */}
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected ? "border-forest-green" : "border-border"
                        }`}>
                          {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-forest-green" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-text-secondary uppercase">{getCarrierLogo(rate.carrier)}</span>
                            <span className="text-sm font-medium text-text-primary">{rate.service}</span>
                          </div>
                          <p className="text-xs text-text-secondary mt-0.5">
                            {rate.estimatedDays === 1 ? "1 business day" : `${rate.estimatedDays} business days`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-text-primary">{formatCurrency(rate.price)}</p>
                        {label && (
                          <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                            label === "Cheapest" ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300" :
                            label === "Fastest" ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300" :
                            "bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300"
                          }`}>
                            {label}
                          </span>
                        )}
                        {rate.source !== "marketplace" && (
                          <p className="text-[10px] text-text-placeholder mt-0.5">
                            via {rate.source}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Show all rates */}
            {remainingRates.length > 0 && (
              <div className="mt-2">
                <button
                  onClick={() => setShowAllRates(!showAllRates)}
                  className="flex items-center gap-1 text-xs font-medium text-forest-green py-2"
                >
                  {showAllRates ? "Hide" : "Show"} {remainingRates.length} more rate{remainingRates.length > 1 ? "s" : ""}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`transition-transform ${showAllRates ? "rotate-180" : ""}`}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                {showAllRates && (
                  <div className="space-y-2 animate-fade-in">
                    {remainingRates.map((rate) => {
                      const isSelected = selectedRateId === rate.rateId;
                      return (
                        <button
                          key={rate.rateId}
                          onClick={() => setSelectedRateId(rate.rateId)}
                          className={`w-full text-left rounded-2xl border p-3 transition-all ${
                            isSelected
                              ? "border-forest-green bg-forest-green-50 ring-1 ring-forest-green"
                              : "border-border bg-surface hover:border-forest-green-light"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                isSelected ? "border-forest-green" : "border-border"
                              }`}>
                                {isSelected && <div className="w-2 h-2 rounded-full bg-forest-green" />}
                              </div>
                              <div>
                                <span className="text-xs font-bold text-text-secondary uppercase">{getCarrierLogo(rate.carrier)}</span>
                                <span className="text-sm font-medium text-text-primary ml-1.5">{rate.service}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-text-primary">{formatCurrency(rate.price)}</p>
                              <p className="text-[10px] text-text-secondary">{rate.estimatedDays}d</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ─── Section 4: Buy Label ───────────────────────── */}
        {selectedRate && (
          <section className="py-3">
            {labelError && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-2xl p-3 text-sm text-red-700 dark:text-red-300 mb-3">
                {labelError}
              </div>
            )}

            <button
              onClick={handleBuyLabel}
              disabled={labelLoading}
              className="w-full py-4 rounded-2xl bg-forest-green text-white font-bold text-base transition-colors hover:bg-forest-green-dark disabled:opacity-60"
              style={{ boxShadow: "var(--shadow-elevated)" }}
            >
              {labelLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Purchasing...
                </span>
              ) : (
                `Buy Label — ${formatCurrency(selectedRate.price)}`
              )}
            </button>

            <p className="text-[11px] text-text-placeholder text-center mt-2">
              {selectedRate.carrier} {selectedRate.service} · {selectedRate.estimatedDays === 1 ? "1 day" : `${selectedRate.estimatedDays} days`}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
