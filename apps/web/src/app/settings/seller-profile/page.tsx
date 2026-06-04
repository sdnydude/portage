"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import type { SellerProfile, EbayPoliciesResponse } from "@portage/shared";

export default function SellerProfilePage() {
  const { token } = useAuth();
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [policies, setPolicies] = useState<EbayPoliciesResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [settingUp, setSettingUp] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api<{ profile: SellerProfile }>("/seller-profile", { token })
      .then(data => setProfile(data.profile))
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load profile"));

    api<EbayPoliciesResponse>("/seller-profile/ebay-policies", { token })
      .then(data => setPolicies(data))
      .catch(() => {});
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
    } catch {
      setMessage("Failed to save");
    } finally {
      setSaving(false);
    }
  }, [token]);

  const handleAutoSetup = useCallback(async () => {
    if (!token) return;
    setSettingUp(true);
    setMessage(null);
    try {
      const result = await api<{
        setup: {
          fulfillmentPolicyId: string;
          paymentPolicyId: string;
          returnPolicyId: string;
          merchantLocationKey: string | null;
          locationConfigured: boolean;
        };
      }>("/seller-profile/ebay/auto-setup", { method: "POST", token });

      // Reflect the created/reused IDs immediately, then refresh the policy
      // lists so the dropdowns gain the new "Portage Standard" options.
      setProfile(prev => prev ? {
        ...prev,
        ebayFulfillmentPolicyId: result.setup.fulfillmentPolicyId,
        ebayPaymentPolicyId: result.setup.paymentPolicyId,
        ebayReturnPolicyId: result.setup.returnPolicyId,
        ebayMerchantLocationKey: result.setup.merchantLocationKey,
      } : prev);

      const refreshed = await api<EbayPoliciesResponse>("/seller-profile/ebay-policies", { token });
      setPolicies(refreshed);

      setMessage(result.setup.locationConfigured
        ? "Saved"
        : "Policies set up. Add a ship-from address in Shipping settings to enable your eBay location.");
      setTimeout(() => setMessage(null), 5000);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "eBay setup failed");
    } finally {
      setSettingUp(false);
    }
  }, [token]);

  if (loadError) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
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
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Seller Profile</h1>

      {message && (() => {
        const tone = message === "Saved"
          ? { background: "rgba(45,90,39,0.1)", color: "#2D5A27" }
          : message.startsWith("Policies set up")
            ? { background: "rgba(204,153,0,0.12)", color: "#B8860B" }
            : { background: "rgba(204,51,51,0.1)", color: "#CC3333" };
        return (
          <div className="text-sm py-2 px-3 rounded-lg" style={tone}>
            {message}
          </div>
        );
      })()}

      <section className="rounded-xl p-4 space-y-3" style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.08)" }}>
        <h2 className="text-lg font-semibold">eBay Account</h2>

        {(() => {
          const hasPolicies = Boolean(
            profile.ebayFulfillmentPolicyId && profile.ebayPaymentPolicyId && profile.ebayReturnPolicyId,
          );
          const fullyConfigured = hasPolicies && Boolean(profile.ebayMerchantLocationKey);
          const status = fullyConfigured
            ? { dot: "#2D5A27", label: "eBay selling configured" }
            : hasPolicies
              ? { dot: "#B8860B", label: "Policies set · ship-from address needed" }
              : { dot: "rgba(0,0,0,0.3)", label: "Not set up yet" };
          return (
            <div className="flex items-center justify-between gap-3 pb-1">
              <span className="flex items-center gap-2 text-sm" style={{ color: "rgba(0,0,0,0.7)" }}>
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: status.dot }} />
                {status.label}
              </span>
              <button
                onClick={handleAutoSetup}
                disabled={settingUp}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                style={{ background: "#2D5A27" }}
              >
                {settingUp ? "Setting up..." : fullyConfigured ? "Re-run setup" : "Set up eBay Selling"}
              </button>
            </div>
          );
        })()}

        <p className="text-xs" style={{ color: "rgba(0,0,0,0.45)" }}>
          One-click setup creates standard fulfillment, payment, and return policies plus your inventory location. Safe to re-run.
        </p>

        <label className="block text-sm">
          <span className="text-sm font-medium mb-1 block">Fulfillment Policy</span>
          <select
            value={profile.ebayFulfillmentPolicyId ?? ""}
            onChange={e => updateField("ebayFulfillmentPolicyId", e.target.value || null)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">Select...</option>
            {policies?.fulfillment.map(p => <option key={p.policyId} value={p.policyId}>{p.name}</option>)}
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-sm font-medium mb-1 block">Payment Policy</span>
          <select
            value={profile.ebayPaymentPolicyId ?? ""}
            onChange={e => updateField("ebayPaymentPolicyId", e.target.value || null)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">Select...</option>
            {policies?.payment.map(p => <option key={p.policyId} value={p.policyId}>{p.name}</option>)}
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-sm font-medium mb-1 block">Return Policy</span>
          <select
            value={profile.ebayReturnPolicyId ?? ""}
            onChange={e => updateField("ebayReturnPolicyId", e.target.value || null)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">Select...</option>
            {policies?.returnPolicy.map(p => <option key={p.policyId} value={p.policyId}>{p.name}</option>)}
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-sm font-medium mb-1 block">Merchant Location Key</span>
          <input
            type="text"
            value={profile.ebayMerchantLocationKey ?? ""}
            onChange={e => updateField("ebayMerchantLocationKey", e.target.value || null)}
            placeholder="default"
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
        </label>

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
      </section>

      {saving && <p className="text-sm text-center" style={{ color: "rgba(0,0,0,0.4)" }}>Saving...</p>}
    </div>
  );
}
