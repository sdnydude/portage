"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useShippingSettings, useShippingProvider } from "@/hooks/use-shipping-provider";
import { useShippingPresets } from "@/hooks/use-shipping";

type ProviderType = "shippo" | "easypost" | "pirate_ship";

const PROVIDER_OPTIONS: { value: ProviderType; label: string; description: string }[] = [
  { value: "shippo", label: "Shippo", description: "Multi-carrier shipping platform" },
  { value: "easypost", label: "EasyPost", description: "Simple shipping API" },
  { value: "pirate_ship", label: "Pirate Ship", description: "Free USPS shipping software" },
];

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
];

export default function ShippingSettingsPage() {
  const router = useRouter();

  // ── Data hooks ──
  const { settings, isLoading: settingsLoading, updateSettings } = useShippingSettings();
  const { provider, isLoading: providerLoading, setProviderConfig, testConnection } = useShippingProvider();
  const { presets, isLoading: presetsLoading, updatePreset, deletePreset } = useShippingPresets();

  // ── Ship-from address form ──
  const [addressName, setAddressName] = useState("");
  const [addressStreet1, setAddressStreet1] = useState("");
  const [addressStreet2, setAddressStreet2] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressState, setAddressState] = useState("");
  const [addressZip, setAddressZip] = useState("");
  const [autoMark, setAutoMark] = useState(false);
  const [addressSaved, setAddressSaved] = useState(false);

  // ── Provider form ──
  const [selectedProvider, setSelectedProvider] = useState<ProviderType>("pirate_ship");
  const [apiKey, setApiKey] = useState("");
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [providerSaved, setProviderSaved] = useState(false);

  // ── Preset editing ──
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editPresetName, setEditPresetName] = useState("");

  // ── Loading states ──
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [isSavingProvider, setIsSavingProvider] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  // ── Populate form from settings ──
  useEffect(() => {
    if (settings) {
      if (settings.shipFromAddress) {
        setAddressName(settings.shipFromAddress.name ?? "");
        setAddressStreet1(settings.shipFromAddress.street1 ?? "");
        setAddressStreet2(settings.shipFromAddress.street2 ?? "");
        setAddressCity(settings.shipFromAddress.city ?? "");
        setAddressState(settings.shipFromAddress.state ?? "");
        setAddressZip(settings.shipFromAddress.zip ?? "");
      }
      setAutoMark(settings.shippingAutoMark);
    }
  }, [settings]);

  // ── Populate provider from data ──
  useEffect(() => {
    if (provider) {
      setSelectedProvider(provider.provider);
    }
  }, [provider]);

  // ── Save address ──
  const handleSaveAddress = async () => {
    setIsSavingAddress(true);
    setAddressSaved(false);
    try {
      await updateSettings({
        shipFromAddress: {
          name: addressName,
          street1: addressStreet1,
          street2: addressStreet2 || undefined,
          city: addressCity,
          state: addressState,
          zip: addressZip,
          country: "US",
        },
        shippingAutoMark: autoMark,
      });
      setAddressSaved(true);
      setTimeout(() => setAddressSaved(false), 3000);
    } catch {
      // Error handled by hook
    } finally {
      setIsSavingAddress(false);
    }
  };

  // ── Save provider ──
  const handleSaveProvider = async () => {
    if (!apiKey.trim()) return;
    setIsSavingProvider(true);
    setProviderSaved(false);
    try {
      await setProviderConfig({
        provider: selectedProvider,
        apiKey: apiKey.trim(),
      });
      setApiKey("");
      setProviderSaved(true);
      setTimeout(() => setProviderSaved(false), 3000);
    } catch {
      // Error handled by hook
    } finally {
      setIsSavingProvider(false);
    }
  };

  // ── Test connection ──
  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testConnection();
      if (result) {
        setTestResult({ success: result.formatValid, message: result.message });
      }
    } catch {
      setTestResult({ success: false, message: "Connection test failed" });
    } finally {
      setIsTesting(false);
    }
  };

  // ── Delete preset ──
  const handleDeletePreset = async (id: string) => {
    await deletePreset(id);
  };

  // ── Rename preset ──
  const handleRenamePreset = async (id: string) => {
    if (!editPresetName.trim()) return;
    await updatePreset(id, { name: editPresetName.trim() });
    setEditingPresetId(null);
    setEditPresetName("");
  };

  const isLoading = settingsLoading || providerLoading || presetsLoading;

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-forest-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-text-secondary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Back
          </button>
          <h1 className="text-lg font-semibold font-[family-name:var(--font-instrument)] text-text-primary">
            Shipping Settings
          </h1>
          <div className="w-12" />
        </div>
      </header>

      <div className="px-4 pb-8 max-w-lg mx-auto">
        {/* ─── Ship-From Address ──────────────────────── */}
        <section className="py-5">
          <h2 className="font-[family-name:var(--font-instrument)] font-semibold text-text-primary mb-3" style={{ fontSize: "var(--text-headline)" }}>
            Ship-From Address
          </h2>
          <div className="rounded-2xl border border-border bg-surface p-4 space-y-3" style={{ boxShadow: "var(--shadow-subtle)" }}>
            <div>
              <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">Name</label>
              <input
                type="text"
                value={addressName}
                onChange={(e) => setAddressName(e.target.value)}
                placeholder="Full name"
                className="w-full py-2.5 px-3 bg-muted rounded-xl text-sm text-text-primary border border-transparent focus:border-border-focus focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">Street Address</label>
              <input
                type="text"
                value={addressStreet1}
                onChange={(e) => setAddressStreet1(e.target.value)}
                placeholder="Street address"
                className="w-full py-2.5 px-3 bg-muted rounded-xl text-sm text-text-primary border border-transparent focus:border-border-focus focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">Apt / Suite (optional)</label>
              <input
                type="text"
                value={addressStreet2}
                onChange={(e) => setAddressStreet2(e.target.value)}
                placeholder="Apt, suite, unit"
                className="w-full py-2.5 px-3 bg-muted rounded-xl text-sm text-text-primary border border-transparent focus:border-border-focus focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">City</label>
                <input
                  type="text"
                  value={addressCity}
                  onChange={(e) => setAddressCity(e.target.value)}
                  placeholder="City"
                  className="w-full py-2.5 px-3 bg-muted rounded-xl text-sm text-text-primary border border-transparent focus:border-border-focus focus:outline-none"
                />
              </div>
              <div className="w-24">
                <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">State</label>
                <select
                  value={addressState}
                  onChange={(e) => setAddressState(e.target.value)}
                  className="w-full py-2.5 px-3 bg-muted rounded-xl text-sm text-text-primary border border-transparent focus:border-border-focus focus:outline-none appearance-none"
                >
                  <option value="">--</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="w-28">
                <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">ZIP</label>
                <input
                  type="text"
                  value={addressZip}
                  onChange={(e) => setAddressZip(e.target.value)}
                  placeholder="ZIP"
                  maxLength={10}
                  className="w-full py-2.5 px-3 bg-muted rounded-xl text-sm text-text-primary border border-transparent focus:border-border-focus focus:outline-none"
                />
              </div>
            </div>

            {/* Auto-mark toggle */}
            <label className="flex items-center gap-3 py-2 cursor-pointer">
              <div
                onClick={() => setAutoMark(!autoMark)}
                className={`w-10 h-6 rounded-full transition-colors flex items-center ${
                  autoMark ? "bg-forest-green" : "bg-muted border border-border"
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                  autoMark ? "translate-x-5" : "translate-x-1"
                }`} />
              </div>
              <div>
                <span className="text-sm text-text-primary">Auto-mark as shipped</span>
                <p className="text-xs text-text-secondary">Automatically mark orders as shipped after buying a label</p>
              </div>
            </label>

            <button
              onClick={handleSaveAddress}
              disabled={isSavingAddress || !addressName || !addressStreet1 || !addressCity || !addressState || !addressZip}
              className="w-full py-2.5 rounded-xl bg-forest-green text-white text-sm font-medium disabled:opacity-50"
            >
              {isSavingAddress ? "Saving..." : addressSaved ? "Saved!" : "Save Address"}
            </button>
          </div>
        </section>

        {/* ─── Package Presets ────────────────────────── */}
        <section className="py-3">
          <h2 className="font-[family-name:var(--font-instrument)] font-semibold text-text-primary mb-3" style={{ fontSize: "var(--text-headline)" }}>
            Package Presets
          </h2>

          {presets.length === 0 ? (
            <div className="rounded-2xl border border-border bg-surface p-6 text-center" style={{ boxShadow: "var(--shadow-subtle)" }}>
              <p className="text-sm text-text-secondary mb-1">No presets yet</p>
              <p className="text-xs text-text-placeholder">Create presets from the Ship It screen when shipping orders</p>
            </div>
          ) : (
            <div className="space-y-2">
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  className="rounded-2xl border border-border bg-surface p-4"
                  style={{ boxShadow: "var(--shadow-subtle)" }}
                >
                  {editingPresetId === preset.id ? (
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={editPresetName}
                        onChange={(e) => setEditPresetName(e.target.value)}
                        className="flex-1 py-2 px-3 bg-muted rounded-xl text-sm text-text-primary border border-transparent focus:border-border-focus focus:outline-none"
                        autoFocus
                      />
                      <button
                        onClick={() => handleRenamePreset(preset.id)}
                        className="px-3 py-2 rounded-xl bg-forest-green text-white text-xs font-medium"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => { setEditingPresetId(null); setEditPresetName(""); }}
                        className="px-2 py-2 text-xs text-text-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-text-primary">{preset.name}</h3>
                          {preset.isDefault && (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-forest-green-50 text-forest-green">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-secondary mt-0.5">
                          {preset.packageType === "box" ? "Box" : preset.packageType === "envelope" ? "Padded Envelope" : "Poly Mailer"}
                          {" · "}
                          {preset.length}&#8243; x {preset.width}&#8243; x {preset.height}&#8243;
                          {" · "}
                          {preset.weightLbs > 0 ? `${preset.weightLbs} lb ` : ""}{preset.weightOz} oz
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setEditingPresetId(preset.id); setEditPresetName(preset.name); }}
                          className="p-2 rounded-lg text-text-secondary hover:bg-muted transition-colors"
                          aria-label="Edit preset"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeletePreset(preset.id)}
                          className="p-2 rounded-lg text-text-secondary hover:bg-red-50 hover:text-accent-error transition-colors"
                          aria-label="Delete preset"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ─── Shipping Provider ──────────────────────── */}
        <section className="py-3">
          <h2 className="font-[family-name:var(--font-instrument)] font-semibold text-text-primary mb-3" style={{ fontSize: "var(--text-headline)" }}>
            Shipping Provider
          </h2>
          <div className="rounded-2xl border border-border bg-surface p-4 space-y-3" style={{ boxShadow: "var(--shadow-subtle)" }}>
            <p className="text-xs text-text-secondary">
              Connect a third-party shipping provider for discounted rates alongside marketplace rates.
            </p>

            {/* Provider selector */}
            <div>
              <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">Provider</label>
              <div className="space-y-2">
                {PROVIDER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedProvider(opt.value)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      selectedProvider === opt.value
                        ? "border-forest-green bg-forest-green-50"
                        : "border-border hover:border-forest-green-light"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-text-primary">{opt.label}</p>
                        <p className="text-xs text-text-secondary">{opt.description}</p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        selectedProvider === opt.value ? "border-forest-green" : "border-border"
                      }`}>
                        {selectedProvider === opt.value && <div className="w-2 h-2 rounded-full bg-forest-green" />}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* API key input */}
            <div>
              <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={provider?.hasApiKey ? "key saved" : "Enter API key"}
                className="w-full py-2.5 px-3 bg-muted rounded-xl text-sm text-text-primary border border-transparent focus:border-border-focus focus:outline-none font-[family-name:var(--font-jetbrains)]"
              />
            </div>

            {/* Test result */}
            {testResult && (
              <div className={`rounded-xl p-3 text-sm ${
                testResult.success
                  ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800"
                  : "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
              }`}>
                {testResult.message}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              {provider && (
                <button
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-text-primary disabled:opacity-50"
                >
                  {isTesting ? "Testing..." : "Test Connection"}
                </button>
              )}
              <button
                onClick={handleSaveProvider}
                disabled={isSavingProvider || !apiKey.trim()}
                className="flex-1 py-2.5 rounded-xl bg-forest-green text-white text-sm font-medium disabled:opacity-50"
              >
                {isSavingProvider ? "Saving..." : providerSaved ? "Saved!" : "Save Provider"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
