"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import type { SellerProfile } from "@portage/shared";

// This page lives outside the (tabs) group, so it has no bottom nav. Without a
// header the seller could get stuck here — give every state a back affordance.
function BackHeader() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push("/inventory")}
      aria-label="Back to inventory"
      className="flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-text-primary mb-4"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      Inventory
    </button>
  );
}

export default function SellerProfilePage() {
  const { token } = useAuth();
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [ebayConnected, setEbayConnected] = useState(false);
  const [addr, setAddr] = useState({ name: "", street1: "", street2: "", city: "", state: "", zip: "" });

  useEffect(() => {
    if (!token) return;
    api<{ profile: SellerProfile }>("/seller-profile", { token })
      .then(data => {
        setProfile(data.profile);
        const sf = data.profile.shipFromAddress as { name?: string; street1?: string; street2?: string; city?: string; state?: string; zip?: string } | null;
        if (sf) setAddr({ name: sf.name ?? "", street1: sf.street1 ?? "", street2: sf.street2 ?? "", city: sf.city ?? "", state: sf.state ?? "", zip: sf.zip ?? "" });
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load profile"));

    api<{ accounts: Array<{ marketplace: string }> }>("/users/me/marketplace-accounts", { token })
      .then(data => setEbayConnected(data.accounts.some(a => a.marketplace === "ebay")))
      .catch(() => {});
  }, [token]);

  const handleConnect = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api<{ authUrl: string }>("/marketplace/ebay/connect", { token });
      window.location.assign(data.authUrl);
    } catch {
      setMessage("Failed to start eBay connection");
    }
  }, [token]);

  const updateField = useCallback(async (field: string, value: unknown) => {
    if (!token) return;
    setSaving(true);
    setMessage(null);
    try {
      const result = await api<{ profile: SellerProfile }>("/seller-profile", {
        method: "PATCH",
        body: { [field]: value },
        token,
      });
      setProfile(result.profile);
      setMessage("Saved");
      setTimeout(() => setMessage(null), 2000);
    } catch (err) {
      // Server messages here are actionable (e.g. PRICING_FLOOR_INVALID's
      // "floor must be below suggest") — never collapse them to a generic.
      setMessage(err instanceof Error && err.message ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [token]);

  // Inline terms (Trade-First) killed the Business Policies setup — the only
  // eBay prerequisite left is the ship-from address (calculated shipping needs
  // the origin ZIP), so it gets its own explicit save.
  const handleSaveAddress = useCallback(async () => {
    if (!token) return;
    if (!addr.zip.trim()) {
      setMessage("ZIP is required — eBay computes buyer shipping from it");
      return;
    }
    setSavingAddress(true);
    setMessage(null);
    try {
      const result = await api<{ profile: SellerProfile }>("/seller-profile", {
        method: "PATCH",
        body: { shipFromAddress: { ...addr, country: "US" } },
        token,
      });
      setProfile(result.profile);
      setMessage("Saved");
      setTimeout(() => setMessage(null), 2000);
    } catch (err) {
      setMessage(err instanceof Error && err.message ? err.message : "Failed to save address");
    } finally {
      setSavingAddress(false);
    }
  }, [token, addr]);

  if (loadError) {
    return (
      <div className="content-container px-4 py-8">
        <BackHeader />
        <h1 className="text-2xl font-bold mb-4">Seller Profile</h1>
        <div className="text-sm py-2 px-3 rounded-lg" style={{ background: "rgba(204,51,51,0.1)", color: "#CC3333" }}>
          {loadError}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="content-container px-4 py-8 space-y-6 compact-bar-clearance">
      <BackHeader />
      <h1 className="text-2xl font-bold">Seller Profile</h1>

      {message && (() => {
        const tone = message === "Saved"
          ? { background: "rgba(45,90,39,0.1)", color: "#2D5A27" }
          : { background: "rgba(204,51,51,0.1)", color: "#CC3333" };
        return (
          <div className="text-sm py-2 px-3 rounded-lg" style={tone}>
            {message}
          </div>
        );
      })()}

      <section className="rounded-xl p-4 space-y-3" style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.08)" }}>
        <h2 className="text-lg font-semibold">eBay Account</h2>

        {/* Step 1 — Connect */}
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm" style={{ color: "rgba(0,0,0,0.7)" }}>
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: ebayConnected ? "#2D5A27" : "rgba(0,0,0,0.3)" }} />
            {ebayConnected ? "eBay account connected" : "Connect your eBay account"}
          </span>
          <button
            onClick={handleConnect}
            className="rounded-lg px-3 py-1.5 text-sm font-medium"
            style={ebayConnected
              ? { background: "transparent", color: "#2D5A27", border: "1px solid rgba(45,90,39,0.4)" }
              : { background: "#2D5A27", color: "white" }}
          >
            {ebayConnected ? "Reconnect / switch account" : "Connect eBay"}
          </button>
        </div>

        {/* Ship-from address — the one eBay prerequisite left under inline terms:
            calculated shipping is computed from this origin ZIP. */}
        <div className="space-y-2 pt-1">
          <span className="text-sm font-medium block">Ship-from location</span>
          <span className="text-xs block" style={{ color: "rgba(0,0,0,0.45)" }}>
            Only your ZIP is required — eBay uses it to compute buyer shipping. Street/city are optional.
          </span>
          <input placeholder="Name" value={addr.name} onChange={e => setAddr({ ...addr, name: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm" />
          <input placeholder="Street address" value={addr.street1} onChange={e => setAddr({ ...addr, street1: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm" />
          <input placeholder="Apt, suite (optional)" value={addr.street2} onChange={e => setAddr({ ...addr, street2: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm" />
          <div className="grid grid-cols-3 gap-2">
            <input placeholder="City" value={addr.city} onChange={e => setAddr({ ...addr, city: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
            <input placeholder="State" value={addr.state} onChange={e => setAddr({ ...addr, state: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
            <input placeholder="ZIP" value={addr.zip} onChange={e => setAddr({ ...addr, zip: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm" style={{ color: "rgba(0,0,0,0.7)" }}>
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: (profile.shipFromAddress as { zip?: string } | null)?.zip ? "#2D5A27" : "rgba(0,0,0,0.3)" }} />
              {(profile.shipFromAddress as { zip?: string } | null)?.zip ? "Ship-from set — ready to list" : "Add your ship-from ZIP to list on eBay"}
            </span>
            <button
              onClick={handleSaveAddress}
              disabled={savingAddress}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              style={{ background: "#2D5A27" }}
            >
              {savingAddress ? "Saving..." : "Save address"}
            </button>
          </div>
        </div>

        <label className="block text-sm">
          <span className="text-sm font-medium mb-1 block">Default Publish Mode</span>
          <select
            value={profile.ebayPublishMode}
            onChange={e => updateField("ebayPublishMode", e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="live">Publish live immediately</option>
            <option value="draft">Save as draft (review on eBay first)</option>
          </select>
          <span className="text-xs mt-1 block" style={{ color: "rgba(0,0,0,0.45)" }}>
            Default for new eBay listings. You can still override it per listing at publish time.
          </span>
        </label>
      </section>

      <section className="rounded-xl p-4 space-y-3" style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.08)" }}>
        <h2 className="text-lg font-semibold">Reverb Defaults</h2>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={profile.reverbOffersEnabled}
            onChange={e => updateField("reverbOffersEnabled", e.target.checked)}
            className="rounded"
          />
          <span>Accept offers on Reverb listings</span>
        </label>
      </section>

      <section className="rounded-xl p-4 space-y-3" style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.08)" }}>
        <h2 className="text-lg font-semibold">Shipping Defaults</h2>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="font-medium mb-1 block">Weight Unit</span>
            <select
              value={profile.defaultWeightUnit}
              onChange={e => updateField("defaultWeightUnit", e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="oz">oz</option>
              <option value="lb">lb</option>
              <option value="g">g</option>
              <option value="kg">kg</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium mb-1 block">Dimension Unit</span>
            <select
              value={profile.defaultDimensionUnit}
              onChange={e => updateField("defaultDimensionUnit", e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="in">inches</option>
              <option value="cm">cm</option>
            </select>
          </label>
        </div>

        <label className="block text-sm">
          <span className="font-medium mb-1 block">Default Package Type</span>
          <select
            value={profile.defaultPackageType}
            onChange={e => updateField("defaultPackageType", e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="box">Box</option>
            <option value="envelope">Envelope</option>
            <option value="poly_mailer">Poly Mailer</option>
          </select>
        </label>
      </section>

      <section className="rounded-xl p-4 space-y-3" style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.08)" }}>
        <h2 className="text-lg font-semibold">Listing Preferences</h2>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={profile.autoPublish}
            onChange={e => updateField("autoPublish", e.target.checked)}
            className="rounded"
          />
          <span>Auto-publish listings (skip review)</span>
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={profile.gtcAutoEnd ?? false}
            onChange={e => updateField("gtcAutoEnd", e.target.checked)}
            className="rounded"
          />
          <span>eBay GTC — auto-end listings just before the monthly renewal to avoid the insertion fee (relist any time)</span>
        </label>
      </section>

      <section className="rounded-xl p-4 space-y-3" style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.08)" }}>
        <h2 className="text-lg font-semibold">Pricing</h2>
        <p className="text-xs" style={{ color: "rgba(0,0,0,0.5)" }}>
          Suggested prices come from sold-comp percentiles. 50 = market median (with a small undercut); higher aims for top dollar, lower moves items faster.
        </p>
        <label className="block text-sm space-y-1">
          <span>Suggested-price percentile (10–90)</span>
          <input
            type="number"
            min={10}
            max={90}
            defaultValue={profile.pricingSuggestPercentile ?? 50}
            onBlur={e => {
              const v = Math.round(Number(e.target.value));
              if (Number.isFinite(v) && v >= 10 && v <= 90) {
                if (v !== profile.pricingSuggestPercentile) updateField("pricingSuggestPercentile", v);
              } else {
                // Out of range: revert the (uncontrolled) input to the stored
                // value — never leave an unsaved number on screen.
                e.target.value = String(profile.pricingSuggestPercentile ?? 50);
              }
            }}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "rgba(0,0,0,0.12)", background: "white" }}
          />
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={profile.bestOfferAutoAcceptEnabled ?? false}
            onChange={e => updateField("bestOfferAutoAcceptEnabled", e.target.checked)}
            className="rounded"
          />
          <span>eBay Best Offer — auto-accept offers at or above your floor</span>
        </label>
        <label className="block text-sm space-y-1">
          <span>Auto-accept floor percentile (5–75)</span>
          <input
            type="number"
            min={5}
            max={75}
            defaultValue={profile.pricingFloorPercentile ?? 25}
            onBlur={e => {
              const v = Math.round(Number(e.target.value));
              if (Number.isFinite(v) && v >= 5 && v <= 75) {
                if (v !== profile.pricingFloorPercentile) updateField("pricingFloorPercentile", v);
              } else {
                e.target.value = String(profile.pricingFloorPercentile ?? 25);
              }
            }}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "rgba(0,0,0,0.12)", background: "white" }}
          />
        </label>
        <label className="block text-sm space-y-1">
          <span>Default listing footer (appended to every listing at publish)</span>
          <textarea
            rows={3}
            maxLength={2000}
            defaultValue={profile.defaultListingFooter ?? ""}
            onBlur={e => {
              const v = e.target.value.trim();
              const current = profile.defaultListingFooter ?? "";
              if (v !== current) updateField("defaultListingFooter", v === "" ? null : v);
            }}
            placeholder="e.g. Ships within 1 business day from a smoke-free studio."
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "rgba(0,0,0,0.12)", background: "white" }}
          />
        </label>
      </section>

      {saving && <p className="text-sm text-center" style={{ color: "rgba(0,0,0,0.4)" }}>Saving...</p>}
    </div>
  );
}
